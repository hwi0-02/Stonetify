// Spotify PKCE Auth Controller (Phase B/C scaffold)
// Endpoints:
//  POST /api/spotify/auth/token   { code, code_verifier }
//  POST /api/spotify/auth/refresh { encryptedRefreshToken }
// Stores encrypted refresh token mapped to user (stub: by userId in memory or Firebase later)

const axios = require('axios');
const { encrypt, decrypt } = require('../utils/encryption');

// Persistent token model
const SpotifyTokenModel = require('../models/spotify_token');

// NOTE: Playback history is handled in a separate controller during play events, not here.

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

function requireEnv(name) {
  if (!process.env[name]) throw new Error(`${name} env var missing`);
  return process.env[name];
}

exports.exchangeCode = async (req, res, next) => {
  try {
    const { code, code_verifier, redirect_uri, userId } = req.body;
    if (!code || !code_verifier || !redirect_uri || !userId) {
      return res.status(400).json({ message: 'code, code_verifier, redirect_uri, userId required' });
    }
    const clientId = requireEnv('SPOTIFY_CLIENT_ID');

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirect_uri);
    params.append('client_id', clientId);
    params.append('code_verifier', code_verifier);

    const tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

  const { access_token, refresh_token, expires_in, scope, token_type } = tokenResp.data;
  // Persist refresh token (rotation start)
  await SpotifyTokenModel.upsertRefresh(userId, refresh_token, scope, { historyLimit: 5, maxPerHour: 12 });
  const stored = await SpotifyTokenModel.getByUser(userId);
  const encryptedRefresh = stored.refresh_token_enc; // already encrypted in DB

    return res.json({
      accessToken: access_token,
      refreshTokenEnc: encryptedRefresh,
      expiresIn: expires_in,
      scope,
      tokenType: token_type,
      isPremium: false // Placeholder: real check requires /me or /me/player API call
    });
  } catch (err) {
    console.error('Spotify code exchange failed', err.response?.data || err.message);
    return res.status(500).json({ message: 'Spotify code exchange failed' });
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshTokenEnc, userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const record = await SpotifyTokenModel.getByUser(userId);
    if (!record || record.revoked) return res.status(404).json({ message: 'token not found' });
    // Provided refreshTokenEnc optional; we rely on stored record primarily
    const refreshToken = SpotifyTokenModel.decryptRefresh(record);
    const clientId = requireEnv('SPOTIFY_CLIENT_ID');

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', clientId);

    const tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, expires_in, scope, token_type, refresh_token: newRefresh } = tokenResp.data;
    if (newRefresh) {
      try {
        await SpotifyTokenModel.upsertRefresh(userId, newRefresh, scope || record.scope, { historyLimit: 5, maxPerHour: 12 });
      } catch (e) {
        console.warn('Refresh rotation policy violation:', e.message);
        return res.status(429).json({ message: 'rotation rate exceeded' });
      }
    }
    const updated = await SpotifyTokenModel.getByUser(userId);
    return res.json({
      accessToken: access_token,
      refreshTokenEnc: updated.refresh_token_enc,
      expiresIn: expires_in,
      scope: scope || updated.scope,
      tokenType: token_type,
      version: updated.version
    });
  } catch (err) {
    console.error('Spotify refresh failed', err.response?.data || err.message);
    return res.status(500).json({ message: 'Spotify refresh failed' });
  }
};

// Helper: obtain access token using stored refresh token for given userId
const SpotifyTokenModelRef = require('../models/spotify_token');
const axiosRef = axios; // reuse axios
async function getAccessTokenForUser(userId) {
  const record = await SpotifyTokenModelRef.getByUser(userId);
  if (!record || record.revoked) throw new Error('No stored refresh token');
  const refreshToken = SpotifyTokenModelRef.decryptRefresh(record);
  const clientId = requireEnv('SPOTIFY_CLIENT_ID');
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);
  params.append('client_id', clientId);
  const tokenResp = await axiosRef.post(SPOTIFY_TOKEN_URL, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  return tokenResp.data.access_token;
}

exports.getMockPremiumStatus = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId;
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const access = await getAccessTokenForUser(userId);
    const meResp = await axiosRef.get('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${access}` } });
    const product = meResp.data?.product;
    res.json({ isPremium: product === 'premium', product });
  } catch (e) {
    console.error('Premium status check failed', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ message: 'Failed to check premium status' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId;
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const access = await getAccessTokenForUser(userId);
    const meResp = await axiosRef.get('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${access}` } });
    const { display_name, id, product } = meResp.data;
    const isPremium = product === 'premium';
    res.json({ id, display_name, product, isPremium });
  } catch (e) {
    console.error('Spotify /me failed', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ message: 'Failed to fetch profile' });
  }
};

// Revoke (logout) endpoint (soft revoke; clears stored refresh token)
exports.revoke = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId required' });
    await SpotifyTokenModel.revoke(userId);
    res.json({ revoked: true });
  } catch (e) {
    res.status(500).json({ message: 'Failed to revoke' });
  }
};
