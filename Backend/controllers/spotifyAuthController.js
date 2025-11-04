// Spotify PKCE 인증 컨트롤러

const axios = require('axios');
const SpotifyTokenModel = require('../models/spotify_token');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

// PKCE 토큰 요청 준비
function prepareTokenRequest(params, clientIdOverride) {
  if (!(params instanceof URLSearchParams)) {
    throw new Error('prepareTokenRequest expects URLSearchParams');
  }
  const fromEnv = process.env.SPOTIFY_CLIENT_ID;
  const clientId = clientIdOverride || fromEnv || params.get('client_id');
  if (!clientId) throw new Error('Spotify client_id is missing');
  if (!params.get('client_id')) params.append('client_id', clientId);

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  return { headers, clientId };
}

// Spotify 코드 교환
exports.exchangeCode = async (req, res) => {
  try {
    const { code, code_verifier, redirect_uri, userId, client_id } = req.body;
    if (!code || !code_verifier || !redirect_uri || !userId) {
      return res.status(400).json({ message: 'code, code_verifier, redirect_uri, userId required' });
    }

    const existingToken = await SpotifyTokenModel.getByUser(userId);
    if (existingToken?.revoked) {
      console.log('[exchangeCode] Existing token marked revoked, will refresh from new exchange.');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirect_uri);
    params.append('code_verifier', code_verifier);

    const { headers } = prepareTokenRequest(params, client_id);

    const tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), { headers });
    const { access_token, refresh_token, expires_in, scope, token_type } = tokenResp.data;
    console.log('[exchangeCode] New token obtained with scope:', scope);

    if (!refresh_token && !existingToken?.refresh_token_enc) {
      console.error('[exchangeCode] Spotify did not return a refresh token and no existing token is stored.');
      return res.status(502).json({
        message: 'Spotify가 refresh token을 제공하지 않았습니다. Spotify를 다시 연결해주세요.',
        error: 'MISSING_REFRESH_TOKEN'
      });
    }

    if (refresh_token) {
      await SpotifyTokenModel.upsertRefresh(userId, refresh_token, scope, { historyLimit: 5, maxPerHour: 12, clientId: client_id });
    } else {
      console.log('[exchangeCode] No new refresh_token from Spotify; keeping existing one.');
    }

    const stored = await SpotifyTokenModel.getByUser(userId);

    return res.json({
      accessToken: access_token,
      refreshTokenEnc: stored.refresh_token_enc,
      expiresIn: expires_in,
      scope,
      tokenType: token_type,
      isPremium: false
    });
  } catch (err) {
    console.error('Spotify code exchange failed:', err.response?.data || err.message);
    return res.status(500).json({ message: 'Spotify code exchange failed' });
  }
};

// 리프레시 토큰 갱신
exports.refreshToken = async (req, res) => {
  try {
    const { userId, client_id } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId required' });

    const record = await SpotifyTokenModel.getByUser(userId);
    if (!record || record.revoked) return res.status(404).json({ message: 'token not found' });

    const refreshToken = SpotifyTokenModel.decryptRefresh(record);
    if (!refreshToken) {
      console.error('[refreshToken] No stored refresh token after decrypt for user:', userId);
      return res.status(404).json({ message: 'refresh token missing', error: 'TOKEN_MISSING' });
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

    const { headers } = prepareTokenRequest(params, client_id);

    const tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), { headers });
    const { access_token, expires_in, scope, token_type, refresh_token: newRefresh } = tokenResp.data;

    if (newRefresh) {
      try {
        await SpotifyTokenModel.upsertRefresh(userId, newRefresh, scope || record.scope, {
          historyLimit: 5,
          maxPerHour: 12,
          clientId: client_id || record.client_id || process.env.SPOTIFY_CLIENT_ID || null,
        });
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
    if (err.response?.status === 400 && err.response?.data?.error === 'invalid_grant') {
      console.error('[refreshToken] Refresh token revoked by Spotify for user:', req.body.userId);
      try { await SpotifyTokenModel.markRevoked(req.body.userId); } catch (e) { console.error('Failed to mark revoked:', e); }
      return res.status(401).json({
        message: 'Spotify 연결이 만료되었습니다. 프로필에서 Spotify를 다시 연결해주세요.',
        error: 'TOKEN_REVOKED',
        requiresReauth: true
      });
    }
    return res.status(500).json({ message: 'Spotify refresh failed' });
  }
};

// 사용자별 액세스 토큰 발급
const axiosRef = axios;
async function getAccessTokenForUser(userId) {
  const record = await SpotifyTokenModel.getByUser(userId);
  if (!record || record.revoked) throw new Error('No stored refresh token');
  const refreshToken = SpotifyTokenModel.decryptRefresh(record);
  if (!refreshToken) throw new Error('No stored refresh token');

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);

  const { headers } = prepareTokenRequest(params, record?.client_id || process.env.SPOTIFY_CLIENT_ID);

  try {
    const tokenResp = await axiosRef.post(SPOTIFY_TOKEN_URL, params.toString(), { headers });
    const { access_token, refresh_token: newRefresh, scope } = tokenResp.data || {};

    if (newRefresh) {
      try {
        const recNow = await SpotifyTokenModel.getByUser(userId);
        await SpotifyTokenModel.upsertRefresh(userId, newRefresh, scope || recNow?.scope, {
          historyLimit: 5,
          maxPerHour: 12,
          clientId: recNow?.client_id || process.env.SPOTIFY_CLIENT_ID || null,
        });
      } catch (e) { console.warn('[getAccessTokenForUser] Failed to persist rotated refresh token:', e.message); }
    }
    return access_token;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      console.error('[getAccessTokenForUser] Refresh token revoked by Spotify for user:', userId);
      await SpotifyTokenModel.markRevoked(userId);
      const revokedError = new Error('Refresh token has been revoked by Spotify. Please reconnect your Spotify account.');
      revokedError.code = 'TOKEN_REVOKED';
      revokedError.requiresReauth = true;
      throw revokedError;
    }
    throw error;
  }
}

// 사용자 프리미엄 상태 확인
exports.getMockPremiumStatus = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId;
    if (!userId) return res.status(400).json({ message: 'userId required' });

    const access = await getAccessTokenForUser(userId);
    const meResp = await axiosRef.get(`${SPOTIFY_API_BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${access}` }
    });
    const product = meResp.data?.product;
    res.json({ isPremium: product === 'premium', product });
  } catch (e) {
    console.error('Premium status check failed', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ message: 'Failed to check premium status' });
  }
};

// 사용자 프로필 조회
exports.getProfile = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId;
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const access = await getAccessTokenForUser(userId);
    const meResp = await axiosRef.get(`${SPOTIFY_API_BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${access}` }
    });
    const { display_name, id, product } = meResp.data;
    const isPremium = product === 'premium';
    res.json({ id, display_name, product, isPremium });
  } catch (e) {
    console.error('Spotify /me failed', e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ message: 'Failed to fetch profile' });
  }
};

// Spotify 연결 해제
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
