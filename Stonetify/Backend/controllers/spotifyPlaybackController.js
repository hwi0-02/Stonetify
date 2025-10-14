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
const SpotifyTokenModel = require('../models/spotify_token');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

// 액세스 토큰을 짧은 시간 동안 보관하는 인메모리 캐시 { userId: { accessToken, expiresAt } }
const accessCache = new Map();

function prepareTokenRequest(params, clientIdOverride) {
  if (!(params instanceof URLSearchParams)) {
    throw new Error('prepareTokenRequest expects URLSearchParams');
  }
  const envId = process.env.SPOTIFY_CLIENT_ID;
  const clientId = clientIdOverride || envId || params.get('client_id');
  if (!clientId) throw new Error('Spotify client_id is missing');
  if (!params.get('client_id')) params.append('client_id', clientId);
  // PKCE 규칙상 Authorization 헤더를 사용하지 않고 body에 client_id만 포함한다
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  return { headers, clientId };
}

async function getUserId(req){
  const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId;
  if(!userId) throw new Error('userId missing (header x-user-id)');
  return userId;
}

// TOKEN_REVOKED 상황에 대한 공통 에러 처리기
function handlePlaybackError(e, res, operation) {
  // 토큰이 회수된 경우인지 먼저 확인한다
  if (e.code === 'TOKEN_REVOKED' || e.requiresReauth) {
    console.error(`🔴 [Playback][${operation}] Token revoked - user needs to reconnect`);
    return res.status(401).json({
      message: 'Spotify 세션이 만료되었거나 회수되었습니다. Spotify 계정을 다시 연결해주세요.',
      error: 'TOKEN_REVOKED',
      requiresReauth: true
    });
  }

  console.error(`❌ [Playback][${operation}] error:`, {
    status: e.response?.status,
    data: e.response?.data,
    message: e.message
  });

  // 사용자에게 전달할 에러 메시지를 정리한다
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
    return cached.accessToken;
  }
  const rec = await SpotifyTokenModel.getByUser(userId);
  if(!rec || rec.revoked) {
    const error = new Error('No stored refresh token for user');
    error.code = 'TOKEN_REVOKED';
    throw error;
  }
  const refreshToken = SpotifyTokenModel.decryptRefresh(rec);
  if(!refreshToken) {
    const error = new Error('Refresh token null (revoked?)');
    error.code = 'TOKEN_REVOKED';
    throw error;
  }

  const params = new URLSearchParams();
  params.append('grant_type','refresh_token');
  params.append('refresh_token', refreshToken);
  const { headers } = prepareTokenRequest(params, rec.client_id);

  try {
    const tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), { headers });
    const { access_token, expires_in, refresh_token: newRefresh, scope } = tokenResp.data || {};
  // Spotify가 새 refresh token을 제공하면 저장한다
    if (newRefresh) {
      try {
        await SpotifyTokenModel.upsertRefresh(userId, newRefresh, scope || rec.scope, { historyLimit: 5, maxPerHour: 12, clientId: rec.client_id || process.env.SPOTIFY_CLIENT_ID || null });
      } catch (e) {
        console.warn('[Playback:getAccessTokenForUser] Failed to persist rotated refresh token:', e.message);
      }
    }
    accessCache.set(userId, { accessToken: access_token, expiresAt: Date.now() + (expires_in*1000) });
    return access_token;
  } catch (error) {
  // Spotify 토큰 갱신 실패 처리
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      console.error('🔴 [getAccessTokenForUser] Refresh token revoked by Spotify:', userId);
  // 데이터베이스에 토큰이 회수되었음을 기록
      await SpotifyTokenModel.markRevoked(userId);
  // 캐시 제거
      accessCache.delete(userId);
      
      const revokedError = new Error('Refresh token has been revoked by Spotify. Please reconnect your account.');
      revokedError.code = 'TOKEN_REVOKED';
      revokedError.requiresReauth = true;
      throw revokedError;
    }
    throw error;
  }
}

async function spotifyRequest(userId, method, url, data){
  const accessToken = await getAccessTokenForUser(userId);
  
  console.log('🌐 [spotifyRequest] Making request to Spotify API:', {
    method,
    url: `${SPOTIFY_API_BASE_URL}${url}`,
    data,
    userId,
    hasToken: !!accessToken
  });
  
  try {
    const resp = await axios({ 
      method, 
      url: `${SPOTIFY_API_BASE_URL}${url}`, 
      data, 
      headers: { Authorization: `Bearer ${accessToken}` } 
    });
    
    console.log('✅ [spotifyRequest] Success:', resp.status);
    return resp.data || { success: true };
  } catch (error) {
    console.error('❌ [spotifyRequest] Spotify API Error:', {
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

    console.log('🎵 [Playback][play] Request:', {
      userId,
      uris,
      context_uri,
      position_ms,
      device_id
    });
    
  // Spotify URI 형식을 사전에 검증한다
    if (uris && Array.isArray(uris)) {
      for (const uri of uris) {
        if (!uri.startsWith('spotify:track:') && !uri.startsWith('spotify:episode:')) {
          console.error('❌ [Playback][play] Invalid URI format:', uri);
          return res.status(400).json({ 
            message: `Invalid Spotify URI format: ${uri}. Expected spotify:track:<id> or spotify:episode:<id>` 
          });
        }
        
  // Firebase에서 생성된 ID 패턴이 포함되어 있는지 확인한다
        const trackId = uri.split(':')[2];
        if (trackId && (trackId.startsWith('-') || trackId.includes('_'))) {
          console.error('❌ [Playback][play] Firebase ID detected in URI:', uri);
          return res.status(400).json({ 
            message: `Invalid track ID format (Firebase ID detected): ${uri}. Use Spotify track IDs only.` 
          });
        }
      }
    }
    
  // 새로운 트랙을 재생할 경우 먼저 사용 가능한 장치를 확인한다
    if (uris || context_uri) {
      try {
        const devices = await spotifyRequest(userId, 'get', '/me/player/devices', null);
        const availableCount = devices?.devices?.length || 0;
        console.log('🔊 [Playback][play] Available devices:', availableCount);
        
        if (!devices?.devices || devices.devices.length === 0) {
          console.warn('⚠️ [Playback][play] No active Spotify devices found');
          return res.status(400).json({
            message: 'No active Spotify device found. Please open Spotify app on any device first.',
            error: 'NO_ACTIVE_DEVICE',
            details: 'Spotify Web API requires an active device to play music. Open Spotify on your phone, computer, or smart speaker.'
          });
        }
        
  // 명시된 장치가 있으면 사용하고, 그렇지 않으면 활성 장치나 첫 번째 장치를 선택한다
        if (targetDeviceId) {
          const matched = devices.devices.find(d => d.id === targetDeviceId);
          console.log('🎯 [Playback][play] Using requested device:', matched?.name || 'Unknown', targetDeviceId);
        } else {
          const activeDevice = devices.devices.find(d => d.is_active) || null;
          if (activeDevice) {
            targetDeviceId = activeDevice.id;
            console.log('🎯 [Playback][play] Using active device:', activeDevice.name, activeDevice.id);
          } else {
            const firstDevice = devices.devices[0];
            targetDeviceId = firstDevice?.id || null;
            if (targetDeviceId) {
              console.log('🎯 [Playback][play] Using first available device:', firstDevice.name, targetDeviceId);
            }
          }
        }
      } catch (deviceError) {
        // TOKEN_REVOKED라면 즉시 상위로 전달한다
        if (deviceError.code === 'TOKEN_REVOKED' || deviceError.requiresReauth) {
          throw deviceError;
        }
        console.error('⚠️ [Playback][play] Could not check devices:', deviceError.message);
        // 장치 확인에 실패해도 Spotify API에 위임한다
      }
    }
    
    const body = {};
    if(uris) body.uris = uris;
    if(context_uri) body.context_uri = context_uri;
    if(position_ms != null) body.position_ms = position_ms;
    
    console.log('📤 [Playback][play] Sending to Spotify API:', body);
    
  // 특정 장치로 보낼 때는 쿼리 파라미터를 사용한다
    const qp = targetDeviceId ? `?device_id=${encodeURIComponent(targetDeviceId)}` : '';
    await spotifyRequest(userId,'put',`/me/player/play${qp}`, body);
    
    console.log('✅ [Playback][play] Success');
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
