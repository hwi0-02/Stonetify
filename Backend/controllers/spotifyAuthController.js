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
    console.log('[exchangeCode] Request received for userId:', userId);

    // 필수 파라미터 검증
    if (!code || !code_verifier || !redirect_uri || !userId) {
      console.error('[exchangeCode] Missing required parameters:', {
        code: !!code,
        code_verifier: !!code_verifier,
        redirect_uri: !!redirect_uri,
        userId: !!userId
      });
      return res.status(400).json({
        message: 'code, code_verifier, redirect_uri, userId가 필요합니다.',
        error: 'MISSING_REQUIRED_PARAMETERS'
      });
    }

    // Client ID 검증
    const finalClientId = client_id || process.env.SPOTIFY_CLIENT_ID;
    if (!finalClientId) {
      console.error('[exchangeCode] Spotify Client ID is not configured');
      return res.status(500).json({
        message: '서버 설정 오류: Spotify Client ID가 설정되지 않았습니다.',
        error: 'MISSING_CLIENT_ID'
      });
    }

    // Client ID 형식 검증 (기본적인 검증)
    if (typeof finalClientId !== 'string' || finalClientId.length < 10) {
      console.error('[exchangeCode] Invalid Spotify Client ID format');
      return res.status(400).json({
        message: 'Spotify Client ID 형식이 올바르지 않습니다.',
        error: 'INVALID_CLIENT_ID'
      });
    }

    // Redirect URI 형식 검증
    try {
      new URL(redirect_uri);
    } catch (err) {
      console.error('[exchangeCode] Invalid redirect_uri format:', redirect_uri);
      return res.status(400).json({
        message: 'Redirect URI 형식이 올바르지 않습니다.',
        error: 'INVALID_REDIRECT_URI'
      });
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

    const { headers } = prepareTokenRequest(params, finalClientId);

    console.log('[exchangeCode] Requesting token from Spotify with redirect_uri:', redirect_uri);
    let tokenResp;
    try {
      tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), { headers });
    } catch (axiosError) {
      // Spotify API 오류 처리
      const errorData = axiosError.response?.data;
      console.error('[exchangeCode] Spotify API error:', errorData);

      if (errorData?.error === 'invalid_grant') {
        return res.status(400).json({
          message: 'Spotify 인증 코드가 만료되었거나 올바르지 않습니다. 다시 로그인해주세요.',
          error: 'INVALID_GRANT'
        });
      }

      if (errorData?.error === 'redirect_uri_mismatch') {
        return res.status(400).json({
          message: 'Spotify Redirect URI가 일치하지 않습니다. Spotify Dashboard 설정을 확인해주세요.',
          error: 'REDIRECT_URI_MISMATCH',
          details: process.env.NODE_ENV === 'development' ? { redirect_uri } : undefined
        });
      }

      throw axiosError;
    }

    const { access_token, refresh_token, expires_in, scope, token_type } = tokenResp.data;
    console.log('[exchangeCode] New token obtained with scope:', scope);

    if (!access_token) {
      console.error('[exchangeCode] Spotify did not return an access token');
      return res.status(400).json({
        message: 'Spotify 토큰 교환에 실패했습니다.',
        error: 'MISSING_ACCESS_TOKEN'
      });
    }

    // Refresh token 검증 (첫 번째 인증이거나 기존 토큰이 없는 경우 필수)
    if (!refresh_token && !existingToken?.refresh_token_enc) {
      console.error('[exchangeCode] Spotify did not return a refresh token and no existing token is stored.');
      return res.status(400).json({
        message: 'Spotify가 refresh token을 제공하지 않았습니다. Spotify를 다시 연결해주세요.',
        error: 'MISSING_REFRESH_TOKEN'
      });
    }

    if (refresh_token) {
      await SpotifyTokenModel.upsertRefresh(userId, refresh_token, scope, { historyLimit: 5, maxPerHour: 12, clientId: client_id });
      console.log('[exchangeCode] Refresh token stored successfully');
    } else {
      console.log('[exchangeCode] No new refresh_token from Spotify; keeping existing one.');
    }

    const stored = await SpotifyTokenModel.getByUser(userId);

    console.log('[exchangeCode] Token exchange successful for userId:', userId);
    return res.json({
      accessToken: access_token,
      refreshTokenEnc: stored.refresh_token_enc,
      expiresIn: expires_in,
      scope,
      tokenType: token_type,
      isPremium: false
    });
  } catch (err) {
    console.error('[exchangeCode] Spotify code exchange failed:', {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });

    const errorMessage = err.response?.data?.error_description || err.response?.data?.error || err.message || 'Spotify 코드 교환 실패';
    return res.status(err.response?.status || 500).json({
      message: errorMessage,
      error: err.response?.data?.error || 'CODE_EXCHANGE_FAILED'
    });
  }
};

// 리프레시 토큰 갱신
exports.refreshToken = async (req, res) => {
  try {
    const { userId, client_id } = req.body;
    console.log('[refreshToken] Request received for userId:', userId);

    if (!userId) {
      console.error('[refreshToken] Missing userId parameter');
      return res.status(400).json({ message: 'userId required' });
    }

    const record = await SpotifyTokenModel.getByUser(userId);
    if (!record || record.revoked) {
      console.error('[refreshToken] Token not found or revoked for userId:', userId);
      return res.status(404).json({
        message: 'Spotify 연결 정보를 찾을 수 없습니다. 다시 연결해주세요.',
        error: 'TOKEN_NOT_FOUND',
        requiresReauth: true
      });
    }

    const refreshToken = SpotifyTokenModel.decryptRefresh(record);
    if (!refreshToken) {
      console.error('[refreshToken] No stored refresh token after decrypt for user:', userId);
      return res.status(404).json({
        message: 'Spotify 인증 정보가 손상되었습니다. 다시 연결해주세요.',
        error: 'TOKEN_MISSING',
        requiresReauth: true
      });
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

    const { headers } = prepareTokenRequest(params, client_id);

    console.log('[refreshToken] Requesting new access token from Spotify...');
    const tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), { headers });
    const { access_token, expires_in, scope, token_type, refresh_token: newRefresh } = tokenResp.data;

    if (!access_token) {
      console.error('[refreshToken] Spotify did not return an access token');
      return res.status(502).json({
        message: 'Spotify 토큰 갱신에 실패했습니다.',
        error: 'MISSING_ACCESS_TOKEN'
      });
    }

    console.log('[refreshToken] Successfully obtained new access token');

    if (newRefresh) {
      try {
        await SpotifyTokenModel.upsertRefresh(userId, newRefresh, scope || record.scope, {
          historyLimit: 5,
          maxPerHour: 12,
          clientId: client_id || record.client_id || process.env.SPOTIFY_CLIENT_ID || null,
        });
        console.log('[refreshToken] Refresh token rotated successfully');
      } catch (e) {
        console.warn('[refreshToken] Refresh rotation policy violation:', e.message);
        return res.status(429).json({ message: '토큰 갱신 속도 제한을 초과했습니다. 잠시 후 다시 시도해주세요.' });
      }
    }

    const updated = await SpotifyTokenModel.getByUser(userId);
    console.log('[refreshToken] Token refresh successful for userId:', userId);

    return res.json({
      accessToken: access_token,
      refreshTokenEnc: updated.refresh_token_enc,
      expiresIn: expires_in,
      scope: scope || updated.scope,
      tokenType: token_type,
      version: updated.version
    });
  } catch (err) {
    console.error('[refreshToken] Spotify refresh failed:', {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });

    if (err.response?.status === 400 && err.response?.data?.error === 'invalid_grant') {
      console.error('[refreshToken] Refresh token revoked by Spotify for user:', req.body.userId);
      try {
        await SpotifyTokenModel.markRevoked(req.body.userId);
        console.log('[refreshToken] Token marked as revoked in database');
      } catch (e) {
        console.error('[refreshToken] Failed to mark revoked:', e);
      }
      return res.status(401).json({
        message: 'Spotify 연결이 만료되었습니다. 프로필에서 Spotify를 다시 연결해주세요.',
        error: 'TOKEN_REVOKED',
        requiresReauth: true
      });
    }

    const errorMessage = err.response?.data?.error_description || err.response?.data?.error || err.message || 'Spotify 토큰 갱신 실패';
    return res.status(err.response?.status || 500).json({
      message: errorMessage,
      error: err.response?.data?.error || 'REFRESH_FAILED'
    });
  }
};

// 사용자별 액세스 토큰 발급
const axiosRef = axios;
async function getAccessTokenForUser(userId) {
  console.log('[getAccessTokenForUser:spotifyAuthController] Starting for userId:', userId);

  const record = await SpotifyTokenModel.getByUser(userId);
  if (!record || record.revoked) {
    console.error('[getAccessTokenForUser:spotifyAuthController] No token record or revoked for userId:', userId);
    const error = new Error('Spotify 연결이 필요합니다. 프로필에서 Spotify를 연결해주세요.');
    error.code = 'TOKEN_REVOKED';
    error.requiresReauth = true;
    throw error;
  }

  const refreshToken = SpotifyTokenModel.decryptRefresh(record);
  if (!refreshToken) {
    console.error('[getAccessTokenForUser:spotifyAuthController] Refresh token decryption failed for userId:', userId);
    const error = new Error('Spotify 인증 정보가 손상되었습니다. 다시 연결해주세요.');
    error.code = 'TOKEN_REVOKED';
    error.requiresReauth = true;
    throw error;
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);

  const { headers } = prepareTokenRequest(params, record?.client_id || process.env.SPOTIFY_CLIENT_ID);

  try {
    console.log('[getAccessTokenForUser:spotifyAuthController] Requesting token from Spotify...');
    const tokenResp = await axiosRef.post(SPOTIFY_TOKEN_URL, params.toString(), { headers });
    const { access_token, refresh_token: newRefresh, scope } = tokenResp.data || {};

    if (!access_token) {
      throw new Error('Spotify did not return an access token');
    }

    console.log('[getAccessTokenForUser:spotifyAuthController] Successfully obtained access token');

    if (newRefresh) {
      try {
        const recNow = await SpotifyTokenModel.getByUser(userId);
        await SpotifyTokenModel.upsertRefresh(userId, newRefresh, scope || recNow?.scope, {
          historyLimit: 5,
          maxPerHour: 12,
          clientId: recNow?.client_id || process.env.SPOTIFY_CLIENT_ID || null,
        });
        console.log('[getAccessTokenForUser:spotifyAuthController] Refresh token rotated');
      } catch (e) {
        console.warn('[getAccessTokenForUser:spotifyAuthController] Failed to persist rotated refresh token:', e.message);
      }
    }
    return access_token;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      console.error('[getAccessTokenForUser:spotifyAuthController] Refresh token invalid_grant for userId:', userId);
      await SpotifyTokenModel.markRevoked(userId);
      const revokedError = new Error('Spotify 연결이 만료되었습니다. 프로필에서 Spotify를 다시 연결해주세요.');
      revokedError.code = 'TOKEN_REVOKED';
      revokedError.requiresReauth = true;
      throw revokedError;
    }
    console.error('[getAccessTokenForUser:spotifyAuthController] Token refresh failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
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
