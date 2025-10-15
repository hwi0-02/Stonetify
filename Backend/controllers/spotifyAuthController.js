const axios = require('axios');
const asyncHandler = require('express-async-handler');
const SpotifyTokenModel = require('../models/spotify_token');
const { successResponse } = require('../utils/responses');
const { ApiError } = require('../utils/errors');
const { ERROR_CODES } = require('../utils/constants');
const { logger } = require('../utils/logger');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

const prepareTokenRequest = (params, clientIdOverride) => {
  if (!(params instanceof URLSearchParams)) {
    throw ApiError.badRequest('잘못된 토큰 요청입니다.');
  }
  const fallbackClientId = process.env.SPOTIFY_CLIENT_ID;
  const clientId = clientIdOverride || fallbackClientId || params.get('client_id');
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

const handleSpotifyHttpError = (error, message, options = {}) => {
  logger.error(message, {
    status: error.response?.status,
    data: error.response?.data,
    error: error.message,
  });
  throw new ApiError({
    message,
    statusCode: options.statusCode || 502,
    errorCode: options.errorCode || ERROR_CODES.DEPENDENCY,
    details: options.details,
  });
};

const exchangeCode = asyncHandler(async (req, res) => {
  const { code, code_verifier, redirect_uri, userId, client_id: clientId } = req.body || {};
  const missing = [
    ['code', code],
    ['code_verifier', code_verifier],
    ['redirect_uri', redirect_uri],
    ['userId', userId],
  ]
    .filter(([, value]) => !value)
    .map(([field]) => ({ field }));

  if (missing.length) {
    throw ApiError.badRequest('Spotify 인증에 필요한 값이 누락되었습니다.', missing);
  }

  const existingToken = await SpotifyTokenModel.getByUser(userId);
  if (existingToken?.revoked) {
    logger.info('Exchange code called for revoked token, refreshing with new credentials', { userId });
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', redirect_uri);
  params.append('code_verifier', code_verifier);

  const { headers } = prepareTokenRequest(params, clientId);

  let tokenResp;
  try {
    tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), { headers });
  } catch (error) {
    handleSpotifyHttpError(error, 'Spotify 인증 코드 교환에 실패했습니다.');
  }

  const { access_token, refresh_token, expires_in, scope, token_type } = tokenResp.data || {};

  if (!refresh_token && !existingToken?.refresh_token_enc) {
    throw new ApiError({
      message: 'Spotify가 refresh token을 제공하지 않았습니다. 다시 연결해주세요.',
      statusCode: 502,
      errorCode: ERROR_CODES.DEPENDENCY,
      details: { error: 'MISSING_REFRESH_TOKEN' },
    });
  }

  if (refresh_token) {
    await SpotifyTokenModel.upsertRefresh(userId, refresh_token, scope, {
      historyLimit: 5,
      maxPerHour: 12,
      clientId,
    });
  } else {
    logger.info('Spotify did not rotate refresh token; keeping existing token', { userId });
  }

  const stored = await SpotifyTokenModel.getByUser(userId);

  successResponse(res, {
    data: {
      accessToken: access_token,
      refreshTokenEnc: stored.refresh_token_enc,
      expiresIn: expires_in,
      scope,
      tokenType: token_type,
      isPremium: false,
    },
    message: 'Spotify 토큰을 발급했습니다.',
  });
});

const refreshToken = asyncHandler(async (req, res) => {
  const { userId, client_id: clientId } = req.body || {};
  if (!userId) {
    throw ApiError.badRequest('userId가 필요합니다.', [{ field: 'userId' }]);
  }

  const record = await SpotifyTokenModel.getByUser(userId);
  if (!record || record.revoked) {
    throw ApiError.notFound('저장된 Spotify 토큰을 찾을 수 없습니다.');
  }

  const refreshTokenValue = SpotifyTokenModel.decryptRefresh(record);
  if (!refreshTokenValue) {
    throw new ApiError({
      message: '저장된 refresh token이 없습니다. 다시 연결해주세요.',
      statusCode: 404,
      errorCode: ERROR_CODES.NOT_FOUND,
      details: { error: 'TOKEN_MISSING' },
    });
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshTokenValue);

  const { headers } = prepareTokenRequest(params, clientId);

  let tokenResp;
  try {
    tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), { headers });
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      logger.error('Spotify refresh token revoked by Spotify', { userId });
      await SpotifyTokenModel.markRevoked(userId);
      throw new ApiError({
        message: 'Spotify 연결이 만료되었습니다. 다시 연결해주세요.',
        statusCode: 401,
        errorCode: ERROR_CODES.AUTH_REQUIRED,
        details: { error: 'TOKEN_REVOKED', requiresReauth: true },
      });
    }
    handleSpotifyHttpError(error, 'Spotify 토큰 갱신에 실패했습니다.');
  }

  const { access_token, expires_in, scope, token_type, refresh_token: newRefresh } = tokenResp.data || {};

  if (newRefresh) {
    try {
      await SpotifyTokenModel.upsertRefresh(userId, newRefresh, scope || record.scope, {
        historyLimit: 5,
        maxPerHour: 12,
        clientId: clientId || record.client_id || process.env.SPOTIFY_CLIENT_ID || null,
      });
    } catch (error) {
      logger.warn('Refresh token rotation limit exceeded', { userId, error: error.message });
      throw new ApiError({
        message: 'refresh token 교체 빈도가 너무 잦습니다.',
        statusCode: 429,
        errorCode: ERROR_CODES.RATE_LIMITED,
      });
    }
  } else {
    logger.debug('Spotify refresh token not rotated', { userId });
  }

  const updated = await SpotifyTokenModel.getByUser(userId);

  successResponse(res, {
    data: {
      accessToken: access_token,
      refreshTokenEnc: updated.refresh_token_enc,
      expiresIn: expires_in,
      scope: scope || updated.scope,
      tokenType: token_type,
      version: updated.version,
    },
    message: 'Spotify 토큰을 갱신했습니다.',
  });
});

const axiosRef = axios;
const getAccessTokenForUser = async (userId) => {
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
      message: 'Spotify 계정이 만료되었습니다. 다시 연결해주세요.',
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

  const { headers } = prepareTokenRequest(params, record?.client_id || process.env.SPOTIFY_CLIENT_ID);

  try {
    const tokenResp = await axiosRef.post(SPOTIFY_TOKEN_URL, params.toString(), { headers });
    const { access_token, refresh_token: newRefresh, scope } = tokenResp.data || {};
    if (newRefresh) {
      try {
        const latest = await SpotifyTokenModel.getByUser(userId);
        await SpotifyTokenModel.upsertRefresh(userId, newRefresh, scope || latest?.scope, {
          historyLimit: 5,
          maxPerHour: 12,
          clientId: latest?.client_id || process.env.SPOTIFY_CLIENT_ID || null,
        });
      } catch (error) {
        logger.warn('Failed to persist rotated refresh token', { userId, error: error.message });
      }
    }
    return access_token;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      logger.error('Spotify revoked refresh token', { userId });
      await SpotifyTokenModel.markRevoked(userId);
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
    handleSpotifyHttpError(error, 'Spotify 액세스 토큰 발급에 실패했습니다.');
  }
};

const getUserIdFromRequest = (req) =>
  req.headers['x-user-id'] || req.query.userId || req.body?.userId || null;

const getMockPremiumStatus = asyncHandler(async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    throw ApiError.badRequest('userId가 필요합니다.');
  }

  const accessToken = await getAccessTokenForUser(userId);
  try {
    const meResp = await axiosRef.get(`${SPOTIFY_API_BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const product = meResp.data?.product;
    successResponse(res, {
      data: { isPremium: product === 'premium', product },
    });
  } catch (error) {
    handleSpotifyHttpError(error, 'Spotify 프리미엄 상태 확인에 실패했습니다.');
  }
});

const getProfile = asyncHandler(async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    throw ApiError.badRequest('userId가 필요합니다.');
  }

  const accessToken = await getAccessTokenForUser(userId);
  try {
    const meResp = await axiosRef.get(`${SPOTIFY_API_BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { display_name, id, product } = meResp.data || {};
    successResponse(res, {
      data: {
        id,
        display_name,
        product,
        isPremium: product === 'premium',
      },
    });
  } catch (error) {
    handleSpotifyHttpError(error, 'Spotify 프로필 정보를 가져오지 못했습니다.');
  }
});

const revoke = asyncHandler(async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    throw ApiError.badRequest('userId가 필요합니다.');
  }

  await SpotifyTokenModel.revoke(userId);
  logger.info('Spotify token revoked by user', { userId });
  successResponse(res, {
    data: { revoked: true },
    message: 'Spotify 연결이 해제되었습니다.',
  });
});

module.exports = {
  exchangeCode,
  refreshToken,
  getMockPremiumStatus,
  getProfile,
  revoke,
};
