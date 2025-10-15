// 저장된 refresh token을 사용해 Spotify 재생 제어를 위임하는 컨트롤러
// 지원 엔드포인트 목록:
//  GET    /api/spotify/playback/state
//  PUT    /api/spotify/playback/play
//  PUT    /api/spotify/playback/pause
//  POST   /api/spotify/playback/next
//  POST   /api/spotify/playback/previous
//  PUT    /api/spotify/playback/seek
//  PUT    /api/spotify/playback/volume
//  GET    /api/spotify/me/devices
//  PUT    /api/spotify/playback/transfer
//
// 인증 방식: 헤더 x-user-id 또는 쿼리/바디의 userId를 기대하며, 실서비스에서는 인증 미들웨어와 연동해야 한다.
const axios = require('axios');
const asyncHandler = require('express-async-handler');
const SpotifyTokenModel = require('../models/spotify_token');
const { successResponse } = require('../utils/responses');
const { ApiError } = require('../utils/errors');
const { ERROR_CODES } = require('../utils/constants');
const { logger } = require('../utils/logger');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

const accessCache = new Map();

const prepareTokenRequest = (params, clientIdOverride) => {
  if (!(params instanceof URLSearchParams)) {
    throw ApiError.badRequest('잘못된 토큰 요청입니다.');
  }
  const defaultClientId = process.env.SPOTIFY_CLIENT_ID;
  const clientId = clientIdOverride || defaultClientId || params.get('client_id');
  if (!clientId) {
    throw ApiError.badRequest('Spotify client_id가 필요합니다.');
  }
  if (!params.get('client_id')) {
    params.append('client_id', clientId);
  }
  return {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    clientId,
  };
};

const getUserId = (req) => {
  const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;
  if (!userId) {
    throw ApiError.badRequest('userId가 필요합니다.');
  }
  return userId;
};

const buildPlaybackError = (error, operation) => {
  if (error.code === 'TOKEN_REVOKED' || error.requiresReauth) {
    return new ApiError({
      message: 'Spotify 세션이 만료되었거나 회수되었습니다. 다시 연결해주세요.',
      statusCode: 401,
      errorCode: ERROR_CODES.AUTH_REQUIRED,
      details: { operation, error: 'TOKEN_REVOKED', requiresReauth: true },
    });
  }

  const status = error.response?.status;
  if (status === 404) {
    return new ApiError({
      message: '활성화된 Spotify 장치를 찾을 수 없습니다.',
      statusCode: 404,
      errorCode: ERROR_CODES.NOT_FOUND,
      details: {
        operation,
        hint: 'Spotify 앱을 실행한 뒤 다시 시도해주세요.',
        response: error.response?.data,
      },
    });
  }

  if (status === 403) {
    return new ApiError({
      message: 'Spotify 재생 권한이 없습니다.',
      statusCode: 403,
      errorCode: ERROR_CODES.FORBIDDEN,
      details: {
        operation,
        response: error.response?.data,
      },
    });
  }

  return new ApiError({
    message: `${operation} 요청에 실패했습니다.`,
    statusCode: status || 502,
    errorCode: status ? ERROR_CODES.DEPENDENCY : ERROR_CODES.INTERNAL,
    details: {
      operation,
      response: error.response?.data,
      message: error.message,
    },
  });
};

const throwPlaybackError = (error, operation) => {
  const mapped = buildPlaybackError(error, operation);
  logger.error(`Spotify playback ${operation} failed`, {
    status: error.response?.status,
    data: error.response?.data,
    message: error.message,
  });
  throw mapped;
};

const getAccessTokenForUser = async (userId) => {
  const cached = accessCache.get(userId);
  if (cached && cached.expiresAt > Date.now() + 5000) {
    return cached.accessToken;
  }

  const record = await SpotifyTokenModel.getByUser(userId);
  if (!record || record.revoked) {
    const error = new ApiError({
      message: 'Spotify 계정이 연결되어 있지 않습니다.',
      statusCode: 401,
      errorCode: ERROR_CODES.AUTH_REQUIRED,
    });
    error.code = 'TOKEN_REVOKED';
    error.requiresReauth = true;
    throw error;
  }

  const refreshTokenValue = SpotifyTokenModel.decryptRefresh(record);
  if (!refreshTokenValue) {
    const error = new ApiError({
      message: 'Spotify refresh token이 유효하지 않습니다.',
      statusCode: 401,
      errorCode: ERROR_CODES.AUTH_REQUIRED,
    });
    error.code = 'TOKEN_REVOKED';
    error.requiresReauth = true;
    throw error;
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshTokenValue);
  const { headers } = prepareTokenRequest(params, record.client_id);

  try {
    const tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), { headers });
    const { access_token, expires_in, refresh_token: newRefresh, scope } = tokenResp.data || {};
    if (newRefresh) {
      try {
        await SpotifyTokenModel.upsertRefresh(userId, newRefresh, scope || record.scope, {
          historyLimit: 5,
          maxPerHour: 12,
          clientId: record.client_id || process.env.SPOTIFY_CLIENT_ID || null,
        });
      } catch (error) {
        logger.warn('Failed to persist rotated refresh token', { userId, error: error.message });
      }
    }
    accessCache.set(userId, {
      accessToken: access_token,
      expiresAt: Date.now() + expires_in * 1000,
    });
    return access_token;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      logger.error('Spotify revoked refresh token', { userId });
      await SpotifyTokenModel.markRevoked(userId);
      accessCache.delete(userId);
      const revokedError = new ApiError({
        message: 'Spotify 계정이 만료되었습니다. 다시 연결해주세요.',
        statusCode: 401,
        errorCode: ERROR_CODES.AUTH_REQUIRED,
        details: { error: 'TOKEN_REVOKED', requiresReauth: true },
      });
      revokedError.code = 'TOKEN_REVOKED';
      revokedError.requiresReauth = true;
      throw revokedError;
    }
    throwPlaybackError(error, 'token');
  }
};

const spotifyRequest = async (userId, method, url, data) => {
  const accessToken = await getAccessTokenForUser(userId);
  logger.debug('Spotify API request', { userId, method, url, data });
  try {
    const response = await axios({
      method,
      url: `${SPOTIFY_API_BASE_URL}${url}`,
      data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    logger.debug('Spotify API response', { status: response.status, url });
    return response.data || { success: true };
  } catch (error) {
    throwPlaybackError(error, method.toLowerCase());
  }
};

const getState = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const data = await spotifyRequest(userId, 'get', '/me/player', null);
  successResponse(res, { data });
});

const play = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { uris, context_uri, position_ms, device_id } = req.body || {};
  let targetDeviceId = device_id || null;

  if (uris && Array.isArray(uris)) {
    for (const uri of uris) {
      if (!uri.startsWith('spotify:track:') && !uri.startsWith('spotify:episode:')) {
        throw ApiError.badRequest('유효한 Spotify URI 형식이 아닙니다.', [{ field: 'uris' }]);
      }
      const trackId = uri.split(':')[2];
      if (trackId && (trackId.startsWith('-') || trackId.includes('_'))) {
        throw ApiError.badRequest('Firebase ID가 포함된 URI는 사용할 수 없습니다.', [{ field: 'uris' }]);
      }
    }
  }

  if (uris || context_uri) {
    try {
      const devices = await spotifyRequest(userId, 'get', '/me/player/devices', null);
      const availableDevices = devices?.devices || [];
      if (!availableDevices.length) {
        throw new ApiError({
          message: '활성화된 Spotify 장치를 찾을 수 없습니다. 앱을 먼저 실행해주세요.',
          statusCode: 400,
          errorCode: ERROR_CODES.NOT_FOUND,
          details: { error: 'NO_ACTIVE_DEVICE' },
        });
      }

      if (targetDeviceId) {
        const matched = availableDevices.find((device) => device.id === targetDeviceId);
        if (!matched) {
          logger.warn('Requested device not found; using fallback', { userId, deviceId: targetDeviceId });
          targetDeviceId = null;
        }
      }

      if (!targetDeviceId) {
        const activeDevice = availableDevices.find((device) => device.is_active);
        targetDeviceId = activeDevice?.id || availableDevices[0]?.id || null;
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throwPlaybackError(error, 'devices');
    }
  }

  const body = {};
  if (uris) body.uris = uris;
  if (context_uri) body.context_uri = context_uri;
  if (position_ms !== undefined) body.position_ms = position_ms;
  const query = targetDeviceId ? `?device_id=${encodeURIComponent(targetDeviceId)}` : '';

  await spotifyRequest(userId, 'put', `/me/player/play${query}`, body);
  successResponse(res, { data: { success: true }, message: '재생을 시작했습니다.' });
});

const pause = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  await spotifyRequest(userId, 'put', '/me/player/pause', null);
  successResponse(res, { data: { success: true }, message: '재생을 일시 정지했습니다.' });
});

const next = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  await spotifyRequest(userId, 'post', '/me/player/next', null);
  successResponse(res, { data: { success: true }, message: '다음 트랙으로 이동했습니다.' });
});

const previous = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  await spotifyRequest(userId, 'post', '/me/player/previous', null);
  successResponse(res, { data: { success: true }, message: '이전 트랙으로 이동했습니다.' });
});

const seek = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { position_ms } = req.body || {};
  if (position_ms === undefined) {
    throw ApiError.badRequest('position_ms 값을 입력해주세요.', [{ field: 'position_ms' }]);
  }
  await spotifyRequest(userId, 'put', `/me/player/seek?position_ms=${encodeURIComponent(position_ms)}`, null);
  successResponse(res, { data: { success: true }, message: '재생 위치를 변경했습니다.' });
});

const setVolume = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { volume_percent } = req.body || {};
  if (volume_percent === undefined) {
    throw ApiError.badRequest('volume_percent 값을 입력해주세요.', [{ field: 'volume_percent' }]);
  }
  await spotifyRequest(userId, 'put', `/me/player/volume?volume_percent=${encodeURIComponent(volume_percent)}`, null);
  successResponse(res, { data: { success: true }, message: '볼륨을 조정했습니다.' });
});

const getDevices = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const data = await spotifyRequest(userId, 'get', '/me/player/devices', null);
  successResponse(res, { data });
});

const transfer = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { device_id: deviceId, play: shouldPlay = true } = req.body || {};
  if (!deviceId) {
    throw ApiError.badRequest('device_id가 필요합니다.', [{ field: 'device_id' }]);
  }
  const body = { device_ids: [deviceId], play: Boolean(shouldPlay) };
  await spotifyRequest(userId, 'put', '/me/player', body);
  successResponse(res, { data: { success: true }, message: '재생 장치를 변경했습니다.' });
});

module.exports = {
  getState,
  play,
  pause,
  next,
  previous,
  seek,
  setVolume,
  getDevices,
  transfer,
};
