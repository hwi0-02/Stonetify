// Spotify Playback Control Proxy Controller (uses stored refresh token)
// Endpoints (to be wired):
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
// Auth strategy: expects X-User-Id header or userId query/body. For production integrate real auth middleware.

const axios = require('axios');
const SpotifyTokenModel = require('../models/spotify_token');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

// In-memory short-lived access token cache: { userId: { accessToken, expiresAt } }
const accessCache = new Map();

function requireEnv(name){
  if(!process.env[name]) throw new Error(`${name} env var missing`);
  return process.env[name];
}

function prepareTokenRequest(params) {
  if (!(params instanceof URLSearchParams)) {
    throw new Error('prepareTokenRequest expects URLSearchParams');
  }
  const clientId = requireEnv('SPOTIFY_CLIENT_ID');
  if (!params.has('client_id')) {
    params.append('client_id', clientId);
  }
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (clientSecret) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${basic}`;
  }
  return headers;
}

async function getUserId(req){
  const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId;
  if(!userId) throw new Error('userId missing (header x-user-id)');
  return userId;
}

// Common error handler for TOKEN_REVOKED errors
function handlePlaybackError(e, res, operation) {
  // Check if it's a token revoked error
  if (e.code === 'TOKEN_REVOKED' || e.requiresReauth) {
    console.error(`🔴 [Playback][${operation}] Token revoked - user needs to reconnect`);
    return res.status(401).json({
      message: 'Your Spotify session has expired or been revoked. Please reconnect your Spotify account.',
      error: 'TOKEN_REVOKED',
      requiresReauth: true
    });
  }

  console.error(`❌ [Playback][${operation}] error:`, {
    status: e.response?.status,
    data: e.response?.data,
    message: e.message
  });

  // Provide more helpful error messages
  let errorMessage = `Failed to ${operation}`;
  let errorDetails = e.response?.data || e.message;

  if (e.response?.status === 404) {
    errorMessage = 'No active device found';
    errorDetails = 'Please open Spotify app on your phone, computer, or any connected device.';
  } else if (e.response?.status === 403) {
    errorMessage = 'Playback forbidden';
    errorDetails = 'Your Spotify account may not have premium access or the device is restricted.';
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
  const headers = prepareTokenRequest(params);

  try {
    const tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), { 
      headers
    });
    const { access_token, expires_in } = tokenResp.data;
    accessCache.set(userId, { accessToken: access_token, expiresAt: Date.now() + (expires_in*1000) });
    return access_token;
  } catch (error) {
    // Handle Spotify token refresh errors
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      console.error('🔴 [getAccessTokenForUser] Refresh token revoked by Spotify:', userId);
      // Mark token as revoked in database
      await SpotifyTokenModel.markRevoked(userId);
      // Clear cache
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
    
    console.log('🎵 [Playback][play] Request:', {
      userId,
      uris,
      context_uri,
      position_ms,
      device_id
    });
    
    // Validate Spotify URI format before making API call
    if (uris && Array.isArray(uris)) {
      for (const uri of uris) {
        if (!uri.startsWith('spotify:track:') && !uri.startsWith('spotify:episode:')) {
          console.error('❌ [Playback][play] Invalid URI format:', uri);
          return res.status(400).json({ 
            message: `Invalid Spotify URI format: ${uri}. Expected spotify:track:<id> or spotify:episode:<id>` 
          });
        }
        
        // Check for Firebase ID patterns in URI
        const trackId = uri.split(':')[2];
        if (trackId && (trackId.startsWith('-') || trackId.includes('_'))) {
          console.error('❌ [Playback][play] Firebase ID detected in URI:', uri);
          return res.status(400).json({ 
            message: `Invalid track ID format (Firebase ID detected): ${uri}. Use Spotify track IDs only.` 
          });
        }
      }
    }
    
    // Check for available devices first (only if playing new track)
    if (uris || context_uri) {
      try {
        const devices = await spotifyRequest(userId, 'get', '/me/player/devices', null);
        console.log('🔊 [Playback][play] Available devices:', devices?.devices?.length || 0);
        
        if (!devices?.devices || devices.devices.length === 0) {
          console.warn('⚠️ [Playback][play] No active Spotify devices found');
          return res.status(400).json({
            message: 'No active Spotify device found. Please open Spotify app on any device first.',
            error: 'NO_ACTIVE_DEVICE',
            details: 'Spotify Web API requires an active device to play music. Open Spotify on your phone, computer, or smart speaker.'
          });
        }
        
        // If no device_id specified, use the first active device
        if (!device_id && devices.devices.length > 0) {
          const activeDevice = devices.devices.find(d => d.is_active) || devices.devices[0];
          console.log('🎯 [Playback][play] Using device:', activeDevice.name, activeDevice.id);
        }
      } catch (deviceError) {
        // If TOKEN_REVOKED, propagate immediately
        if (deviceError.code === 'TOKEN_REVOKED' || deviceError.requiresReauth) {
          throw deviceError;
        }
        console.error('⚠️ [Playback][play] Could not check devices:', deviceError.message);
        // Continue anyway - let Spotify API handle it
      }
    }
    
    const body = {};
    if(uris) body.uris = uris;
    if(context_uri) body.context_uri = context_uri;
    if(position_ms != null) body.position_ms = position_ms;
    
    console.log('📤 [Playback][play] Sending to Spotify API:', body);
    
    // Device specific endpoint uses query param
    const qp = device_id ? `?device_id=${encodeURIComponent(device_id)}` : '';
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
