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
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

function requireEnv(name) {
  if (!process.env[name]) throw new Error(`${name} env var missing`);
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

exports.exchangeCode = async (req, res, next) => {
  try {
    const { code, code_verifier, redirect_uri, userId } = req.body;
    if (!code || !code_verifier || !redirect_uri || !userId) {
      return res.status(400).json({ message: 'code, code_verifier, redirect_uri, userId required' });
    }
    // 새로운 인증 시작 전 기존 토큰 삭제 (중복 세션 방지, scope 불일치 방지)
    console.log('[exchangeCode] Revoking any existing tokens for user:', userId);
    try {
      await SpotifyTokenModel.revoke(userId);
    } catch (revokeErr) {
      console.warn('[exchangeCode] Failed to revoke old token (may not exist):', revokeErr.message);
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirect_uri);
    params.append('code_verifier', code_verifier);

    const headers = prepareTokenRequest(params);

    const tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), {
      headers
    });

  const { access_token, refresh_token, expires_in, scope, token_type } = tokenResp.data;
  console.log('[exchangeCode] ✅ New token obtained with scope:', scope);
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
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    const headers = prepareTokenRequest(params);
    const tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), {
      headers
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
    
    // invalid_grant 에러는 refresh token이 revoked된 것
    if (err.response?.status === 400 && err.response?.data?.error === 'invalid_grant') {
      console.error('🔴 [refreshToken] Refresh token revoked by Spotify for user:', req.body.userId);
      try {
        await SpotifyTokenModel.markRevoked(req.body.userId);
      } catch (revokeErr) {
        console.error('Failed to mark token as revoked:', revokeErr);
      }
      return res.status(401).json({
        message: 'Spotify 연결이 만료되었습니다. 프로필에서 Spotify를 다시 연결해주세요.',
        error: 'TOKEN_REVOKED',
        requiresReauth: true
      });
    }
    
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
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);
  const headers = prepareTokenRequest(params);
  
  try {
    const tokenResp = await axiosRef.post(SPOTIFY_TOKEN_URL, params.toString(), { headers });
    return tokenResp.data.access_token;
  } catch (error) {
    // invalid_grant 에러는 refresh token이 revoked된 것
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      console.error('🔴 [getAccessTokenForUser] Refresh token revoked by Spotify for user:', userId);
      await SpotifyTokenModelRef.markRevoked(userId);
      const revokedError = new Error('Refresh token has been revoked by Spotify. Please reconnect your Spotify account.');
      revokedError.code = 'TOKEN_REVOKED';
      revokedError.requiresReauth = true;
      throw revokedError;
    }
    throw error;
  }
}

exports.getMockPremiumStatus = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId;
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const access = await getAccessTokenForUser(userId);
    const meResp = await axiosRef.get(`${SPOTIFY_API_BASE_URL}/me`, { headers: { Authorization: `Bearer ${access}` } });
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
  const meResp = await axiosRef.get(`${SPOTIFY_API_BASE_URL}/me`, { headers: { Authorization: `Bearer ${access}` } });
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
