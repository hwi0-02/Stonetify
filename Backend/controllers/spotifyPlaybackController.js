// Spotify 재생 제어 컨트롤러

const axios = require('axios');
const SpotifyTokenModel = require('../models/spotify_token');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

// 액세스 토큰 인메모리 캐시
const accessCache = new Map();

function prepareTokenRequest(params, clientIdOverride) {
  if (!(params instanceof URLSearchParams)) {
    throw new Error('prepareTokenRequest expects URLSearchParams');
  }
  const envId = process.env.SPOTIFY_CLIENT_ID;
  const clientId = clientIdOverride || envId || params.get('client_id');
  if (!clientId) throw new Error('Spotify client_id is missing');
  if (!params.get('client_id')) params.append('client_id', clientId);

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  return { headers, clientId };
}

async function getUserId(req){
  const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId;
  if(!userId) throw new Error('userId missing (header x-user-id)');
  return userId;
}

// 재생 에러 처리
function handlePlaybackError(e, res, operation) {
  if (e.code === 'TOKEN_REVOKED' || e.requiresReauth) {
    console.error(`[Playback][${operation}] Token revoked`);
    return res.status(401).json({
      message: 'Spotify 세션이 만료되었거나 회수되었습니다. Spotify 계정을 다시 연결해주세요.',
      error: 'TOKEN_REVOKED',
      requiresReauth: true
    });
  }

  console.error(`[Playback][${operation}] error:`, {
    status: e.response?.status,
    data: e.response?.data,
    message: e.message
  });

  let errorMessage = `${operation} 요청에 실패했습니다.`;
  let errorDetails = e.response?.data || e.message;

  if (e.response?.status === 404) {
    errorMessage = '활성화된 Spotify 장치를 찾지 못했습니다.';
    errorDetails = '휴대전화, 컴퓨터 등에서 Spotify 앱을 먼저 실행해주세요.';
  } else if (e.response?.status === 403) {
    errorMessage = '재생 권한이 없습니다.';
    errorDetails = 'Spotify 프리미엄이 아니거나 해당 장치에서 재생이 제한되었을 수 있습니다.';
  }

  return res.status(e.response?.status || 500).json({
    message: errorMessage,
    error: errorDetails,
    spotifyError: e.response?.data
  });
}

async function getAccessTokenForUser(userId){
  const cached = accessCache.get(userId);
  if(cached && cached.expiresAt > Date.now() + 5000){
    console.log('[getAccessTokenForUser] Using cached token for user:', userId);
    return cached.accessToken;
  }

  console.log('[getAccessTokenForUser] Token expired or not cached, refreshing for user:', userId);
  const rec = await SpotifyTokenModel.getByUser(userId);
  if(!rec || rec.revoked) {
    console.error('[getAccessTokenForUser] No token record or revoked for user:', userId);
    const error = new Error('Spotify 연결이 필요합니다. 프로필에서 Spotify를 연결해주세요.');
    error.code = 'TOKEN_REVOKED';
    error.requiresReauth = true;
    throw error;
  }
  const refreshToken = SpotifyTokenModel.decryptRefresh(rec);
  if(!refreshToken) {
    console.error('[getAccessTokenForUser] Refresh token decryption failed for user:', userId);
    const error = new Error('Spotify 인증 정보가 손상되었습니다. 다시 연결해주세요.');
    error.code = 'TOKEN_REVOKED';
    error.requiresReauth = true;
    throw error;
  }

  const params = new URLSearchParams();
  params.append('grant_type','refresh_token');
  params.append('refresh_token', refreshToken);
  const { headers } = prepareTokenRequest(params, rec.client_id);

  try {
    console.log('[getAccessTokenForUser] Requesting new access token from Spotify...');
    const tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), { headers });
    const { access_token, expires_in, refresh_token: newRefresh, scope } = tokenResp.data || {};

    if (!access_token) {
      throw new Error('Spotify did not return an access token');
    }

    console.log('[getAccessTokenForUser] Successfully obtained new access token');

    if (newRefresh) {
      try {
        await SpotifyTokenModel.upsertRefresh(userId, newRefresh, scope || rec.scope, { historyLimit: 5, maxPerHour: 12, clientId: rec.client_id || process.env.SPOTIFY_CLIENT_ID || null });
        console.log('[getAccessTokenForUser] Refresh token rotated successfully');
      } catch (e) {
        console.warn('[Playback:getAccessTokenForUser] Failed to persist rotated refresh token:', e.message);
      }
    }
    accessCache.set(userId, { accessToken: access_token, expiresAt: Date.now() + (expires_in*1000) });
    return access_token;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      console.error('[getAccessTokenForUser] Refresh token revoked by Spotify:', userId);
      await SpotifyTokenModel.markRevoked(userId);
      accessCache.delete(userId);

      const revokedError = new Error('Spotify 연결이 만료되었습니다. 프로필에서 Spotify를 다시 연결해주세요.');
      revokedError.code = 'TOKEN_REVOKED';
      revokedError.requiresReauth = true;
      throw revokedError;
    }
    console.error('[getAccessTokenForUser] Token refresh failed:', error.message);
    throw error;
  }
}

async function spotifyRequest(userId, method, url, data){
  const accessToken = await getAccessTokenForUser(userId);

  try {
    const resp = await axios({
      method,
      url: `${SPOTIFY_API_BASE_URL}${url}`,
      data,
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return resp.data || { success: true };
  } catch (error) {
    console.error('[spotifyRequest] Spotify API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: `${SPOTIFY_API_BASE_URL}${url}`,
      requestData: data
    });
    throw error;
  }
}

exports.getState = async (req,res) => {
  try {
    const userId = await getUserId(req);
    const data = await spotifyRequest(userId,'get','/me/player', null);
    res.json(data);
  } catch(e){
    return handlePlaybackError(e, res, 'getState');
  }
};

exports.play = async (req,res) => {
  try {
    const userId = await getUserId(req);
    const { uris, context_uri, position_ms, device_id } = req.body || {};
    let targetDeviceId = device_id || null;

    if (uris && Array.isArray(uris)) {
      for (const uri of uris) {
        if (!uri.startsWith('spotify:track:') && !uri.startsWith('spotify:episode:')) {
          return res.status(400).json({
            message: `Invalid Spotify URI format: ${uri}. Expected spotify:track:<id> or spotify:episode:<id>`
          });
        }

        const trackId = uri.split(':')[2];
        if (trackId && (trackId.startsWith('-') || trackId.includes('_'))) {
          return res.status(400).json({
            message: `Invalid track ID format (Firebase ID detected): ${uri}. Use Spotify track IDs only.`
          });
        }
      }
    }

    if (uris || context_uri) {
      try {
        const devices = await spotifyRequest(userId, 'get', '/me/player/devices', null);

        if (!devices?.devices || devices.devices.length === 0) {
          return res.status(400).json({
            message: 'No active Spotify device found. Please open Spotify app on any device first.',
            error: 'NO_ACTIVE_DEVICE',
            details: 'Spotify Web API requires an active device to play music. Open Spotify on your phone, computer, or smart speaker.'
          });
        }

        if (targetDeviceId) {
          const matched = devices.devices.find(d => d.id === targetDeviceId);
        } else {
          const activeDevice = devices.devices.find(d => d.is_active) || null;
          if (activeDevice) {
            targetDeviceId = activeDevice.id;
          } else {
            const firstDevice = devices.devices[0];
            targetDeviceId = firstDevice?.id || null;
          }
        }
      } catch (deviceError) {
        if (deviceError.code === 'TOKEN_REVOKED' || deviceError.requiresReauth) {
          throw deviceError;
        }
      }
    }

    const body = {};
    if(uris) body.uris = uris;
    if(context_uri) body.context_uri = context_uri;
    if(position_ms != null) body.position_ms = position_ms;

    const qp = targetDeviceId ? `?device_id=${encodeURIComponent(targetDeviceId)}` : '';
    await spotifyRequest(userId,'put',`/me/player/play${qp}`, body);

    res.json({ success: true });
  } catch(e){
    return handlePlaybackError(e, res, 'play');
  }
};

exports.pause = async (req,res) => {
  try {
    const userId = await getUserId(req);
    await spotifyRequest(userId,'put','/me/player/pause', null);
    res.json({ success: true });
  } catch(e){
    return handlePlaybackError(e, res, 'pause');
  }
};

exports.next = async (req,res) => {
  try {
    const userId = await getUserId(req);
    await spotifyRequest(userId,'post','/me/player/next', null);
    res.json({ success: true });
  } catch(e){
    return handlePlaybackError(e, res, 'next');
  }
};

exports.previous = async (req,res) => {
  try {
    const userId = await getUserId(req);
    await spotifyRequest(userId,'post','/me/player/previous', null);
    res.json({ success: true });
  } catch(e){
    return handlePlaybackError(e, res, 'previous');
  }
};

exports.seek = async (req,res) => {
  try {
    const userId = await getUserId(req);
    const { position_ms } = req.body || {};
    if(position_ms == null) return res.status(400).json({ message: 'position_ms required' });
    await spotifyRequest(userId,'put',`/me/player/seek?position_ms=${encodeURIComponent(position_ms)}`, null);
    res.json({ success: true });
  } catch(e){
    return handlePlaybackError(e, res, 'seek');
  }
};

exports.setVolume = async (req,res) => {
  try {
    const userId = await getUserId(req);
    const { volume_percent } = req.body || {};
    if(volume_percent == null) return res.status(400).json({ message: 'volume_percent required' });
    await spotifyRequest(userId,'put',`/me/player/volume?volume_percent=${encodeURIComponent(volume_percent)}`, null);
    res.json({ success: true });
  } catch(e){
    return handlePlaybackError(e, res, 'setVolume');
  }
};

exports.getDevices = async (req,res) => {
  try {
    const userId = await getUserId(req);
    const data = await spotifyRequest(userId,'get','/me/player/devices', null);
    res.json(data);
  } catch(e){
    return handlePlaybackError(e, res, 'getDevices');
  }
};

exports.transfer = async (req, res) => {
  try {
    const userId = await getUserId(req);
    const { device_id, play = true } = req.body || {};
    if (!device_id) return res.status(400).json({ message: 'device_id required' });
    const body = { device_ids: [device_id], play: !!play };
    await spotifyRequest(userId, 'put', '/me/player', body);
    res.json({ success: true });
  } catch (e) {
    return handlePlaybackError(e, res, 'transfer');
  }
};
