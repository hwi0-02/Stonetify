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

// In-memory short-lived access token cache: { userId: { accessToken, expiresAt } }
const accessCache = new Map();

function requireEnv(name){
  if(!process.env[name]) throw new Error(`${name} env var missing`);
  return process.env[name];
}

async function getUserId(req){
  const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId;
  if(!userId) throw new Error('userId missing (header x-user-id)');
  return userId;
}

async function getAccessTokenForUser(userId){
  const cached = accessCache.get(userId);
  if(cached && cached.expiresAt > Date.now() + 5000){
    return cached.accessToken;
  }
  const rec = await SpotifyTokenModel.getByUser(userId);
  if(!rec || rec.revoked) throw new Error('No stored refresh token for user');
  const refreshToken = SpotifyTokenModel.decryptRefresh(rec);
  if(!refreshToken) throw new Error('Refresh token null (revoked?)');
  const clientId = requireEnv('SPOTIFY_CLIENT_ID');

  const params = new URLSearchParams();
  params.append('grant_type','refresh_token');
  params.append('refresh_token', refreshToken);
  params.append('client_id', clientId);

  const tokenResp = await axios.post('https://accounts.spotify.com/api/token', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const { access_token, expires_in } = tokenResp.data;
  accessCache.set(userId, { accessToken: access_token, expiresAt: Date.now() + (expires_in*1000) });
  return access_token;
}

async function spotifyRequest(userId, method, url, data){
  const accessToken = await getAccessTokenForUser(userId);
  const resp = await axios({ method, url: `https://api.spotify.com/v1${url}`, data, headers: { Authorization: `Bearer ${accessToken}` } });
  return resp.data || { success: true };
}

exports.getState = async (req,res) => {
  try {
    const userId = await getUserId(req);
    const data = await spotifyRequest(userId,'get','/me/player', null);
    res.json(data);
  } catch(e){
    console.error('[Playback][state] error', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ message: 'Failed to fetch state' });
  }
};

exports.play = async (req,res) => {
  try {
    const userId = await getUserId(req);
    const { uris, context_uri, position_ms, device_id } = req.body || {};
    const body = {};
    if(uris) body.uris = uris;
    if(context_uri) body.context_uri = context_uri;
    if(position_ms != null) body.position_ms = position_ms;
    // Device specific endpoint uses query param
    const qp = device_id ? `?device_id=${encodeURIComponent(device_id)}` : '';
    await spotifyRequest(userId,'put',`/me/player/play${qp}`, body);
    res.json({ success: true });
  } catch(e){
    console.error('[Playback][play] error', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ message: 'Failed to play' });
  }
};

exports.pause = async (req,res) => {
  try {
    const userId = await getUserId(req);
    await spotifyRequest(userId,'put','/me/player/pause', null);
    res.json({ success: true });
  } catch(e){
    console.error('[Playback][pause] error', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ message: 'Failed to pause' });
  }
};

exports.next = async (req,res) => {
  try {
    const userId = await getUserId(req);
    await spotifyRequest(userId,'post','/me/player/next', null);
    res.json({ success: true });
  } catch(e){
    console.error('[Playback][next] error', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ message: 'Failed to skip next' });
  }
};

exports.previous = async (req,res) => {
  try {
    const userId = await getUserId(req);
    await spotifyRequest(userId,'post','/me/player/previous', null);
    res.json({ success: true });
  } catch(e){
    console.error('[Playback][previous] error', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ message: 'Failed to skip previous' });
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
    console.error('[Playback][seek] error', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ message: 'Failed to seek' });
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
    console.error('[Playback][volume] error', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ message: 'Failed to set volume' });
  }
};

exports.getDevices = async (req,res) => {
  try {
    const userId = await getUserId(req);
    const data = await spotifyRequest(userId,'get','/me/player/devices', null);
    res.json(data);
  } catch(e){
    console.error('[Playback][devices] error', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ message: 'Failed to fetch devices' });
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
    console.error('[Playback][transfer] error', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ message: 'Failed to transfer playback' });
  }
};
