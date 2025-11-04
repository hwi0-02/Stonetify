const axios = require('axios');
const SocialTokenModel = require('../models/social_token');
const socialStateStore = require('../utils/socialStateStore');
const getRequestFingerprint = require('../utils/requestFingerprint');
const { resolveSocialRedirectUri } = require('../utils/oauthRedirect');

const NAVER_TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const NAVER_API_URL = 'https://openapi.naver.com';

/**
 * 1. Authorization Code 교환
 * POST /api/social/naver/token
 * Body: { code, state }
 */
exports.exchangeCode = async (req, res) => {
  try {
    const { code, state, redirectUri: requestedRedirectUri } = req.body;
    const userId = req.user?.id;

    if (!code) {
      return res.status(400).json({ message: 'code required' });
    }
    if (!state) {
      return res.status(400).json({ message: 'state required' });
    }
    if (!userId) {
      return res.status(401).json({ message: '인증된 사용자만 소셜 로그인을 연동할 수 있습니다.' });
    }

    const fingerprint = getRequestFingerprint(req);
    const stateEntry = socialStateStore.consumeState({
      provider: 'naver',
      userId,
      fingerprint: fingerprint || null,
      state,
    });
    if (!stateEntry) {
      return res.status(400).json({ message: '잘못된 또는 만료된 state 파라미터입니다.' });
    }

    let redirectUri;
    try {
      ({ redirectUri } = resolveSocialRedirectUri({
        provider: 'naver',
        requestedUri: stateEntry.redirectUri || requestedRedirectUri,
      }));
    } catch (err) {
      if (err.code === 'INVALID_REDIRECT_URI') {
        return res.status(400).json({
          message: '허용되지 않은 redirect_uri 입니다.',
          allowedRedirectUris: err.allowedList,
        });
      }
      console.error('Naver redirect URI resolution failed:', err.message);
      return res.status(500).json({ message: '네이버 Redirect URI 설정을 확인해주세요.' });
    }

    // 네이버 토큰 요청
    const tokenResponse = await axios.post(
      NAVER_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.NAVER_CLIENT_ID,
        client_secret: process.env.NAVER_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code: code,
        state: state || '',
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { 
      access_token, 
      refresh_token, 
      expires_in, 
      token_type 
    } = tokenResponse.data;

    // 네이버 사용자 정보 조회
    const userResponse = await axios.get(
      `${NAVER_API_URL}/v1/nid/me`,
      {
        headers: { Authorization: `Bearer ${access_token}` }
      }
    );

    const naverUser = userResponse.data?.response;
    if (!naverUser) {
      return res.status(500).json({ message: '네이버 사용자 정보를 가져올 수 없습니다.' });
    }

    const providerUserId = naverUser.id || '';
    const providerUserEmail = naverUser.email || '';
    const providerUserName = naverUser.name || naverUser.nickname || '';

    // 토큰 저장 (암호화)
    await SocialTokenModel.upsertToken(userId, 'naver', {
      access_token,
      refresh_token,
      token_type,
      expires_at: Date.now() + expires_in * 1000,
      scope: '',
      provider_user_id: providerUserId,
      provider_user_email: providerUserEmail,
      provider_user_name: providerUserName,
    });

    return res.json({
      success: true,
      provider: 'naver',
      accessToken: access_token,
      expiresIn: expires_in,
      providerUser: {
        id: providerUserId,
        email: providerUserEmail,
        name: providerUserName,
      }
    });

  } catch (err) {
    console.error('Naver code exchange failed:', err.response?.data || err.message);
    return res.status(500).json({ 
      message: '네이버 로그인에 실패했습니다.',
      error: err.response?.data 
    });
  }
};

/**
 * 2. Refresh Token 갱신
 * POST /api/social/naver/refresh
 * Body: {}
 */
exports.refreshToken = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: '인증 정보가 없습니다.' });
    }

    const record = await SocialTokenModel.getByUser(userId, 'naver');
    
    if (!record || record.revoked) {
      return res.status(404).json({ 
        message: '네이버 연동 정보를 찾을 수 없습니다.' 
      });
    }

    const { refresh_token: refreshToken } = SocialTokenModel.decryptToken(record);

    if (!refreshToken) {
      return res.status(404).json({ 
        message: '저장된 네이버 토큰이 없습니다.',
        error: 'TOKEN_MISSING' 
      });
    }

    const tokenResponse = await axios.post(
      NAVER_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.NAVER_CLIENT_ID,
        client_secret: process.env.NAVER_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, expires_in } = tokenResponse.data;

    // 새 토큰 저장 (네이버는 refresh_token을 갱신 시에 반환하지 않음)
    await SocialTokenModel.upsertToken(userId, 'naver', {
      access_token,
      expires_at: Date.now() + expires_in * 1000,
    });

    return res.json({
      success: true,
      accessToken: access_token,
      expiresIn: expires_in,
    });

  } catch (err) {
    console.error('Naver refresh failed:', err.response?.data || err.message);
    
    if (err.response?.status === 401 || err.response?.data?.error === 'invalid_request') {
      const userId = req.user?.id;
      if (userId) {
        await SocialTokenModel.revoke(userId, 'naver');
      }
      return res.status(401).json({
        message: '네이버 연동이 만료되었습니다. 다시 로그인해주세요.',
        error: 'TOKEN_REVOKED',
        requiresReauth: true
      });
    }
    
    return res.status(500).json({ message: '네이버 토큰 갱신에 실패했습니다.' });
  }
};

/**
 * 3. 연동 해제
 * POST /api/social/naver/revoke
 * Body: {}
 */
exports.revoke = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: '인증 정보가 없습니다.' });
    }

    const record = await SocialTokenModel.getByUser(userId, 'naver');
    
    if (record && !record.revoked) {
      const { access_token: accessToken } = SocialTokenModel.decryptToken(record);
      
      // 네이버 토큰 삭제 API 호출
      if (accessToken) {
        try {
          await axios.post(
            NAVER_TOKEN_URL,
            new URLSearchParams({
              grant_type: 'delete',
              client_id: process.env.NAVER_CLIENT_ID,
              client_secret: process.env.NAVER_CLIENT_SECRET,
              access_token: accessToken,
            }),
            {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
          );
        } catch (err) {
          console.warn('Naver token delete API failed:', err.message);
        }
      }
    }

    await SocialTokenModel.revoke(userId, 'naver');

    return res.json({ success: true, revoked: true });

  } catch (err) {
    console.error('Naver revoke failed:', err.message);
    return res.status(500).json({ message: '네이버 연동 해제에 실패했습니다.' });
  }
};

/**
 * 4. 사용자 정보 조회
 * GET /api/social/naver/me
 * Header: Authorization (세션/토큰)
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: '인증 정보가 없습니다.' });
    }

    const record = await SocialTokenModel.getByUser(userId, 'naver');
    
    if (!record || record.revoked) {
      return res.status(404).json({ message: '네이버 연동 정보를 찾을 수 없습니다.' });
    }

    const { access_token: accessToken } = SocialTokenModel.decryptToken(record);

    if (!accessToken) {
      return res.status(404).json({ message: '네이버 액세스 토큰이 없습니다.' });
    }

    const userResponse = await axios.get(
      `${NAVER_API_URL}/v1/nid/me`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const naverUser = userResponse.data?.response;
    if (!naverUser) {
      return res.status(500).json({ message: '네이버 사용자 정보를 가져올 수 없습니다.' });
    }

    return res.json({
      id: naverUser.id || '',
      email: naverUser.email || '',
      name: naverUser.name || naverUser.nickname || '',
      profileImage: naverUser.profile_image || '',
    });

  } catch (err) {
    console.error('Naver profile fetch failed:', err.response?.data || err.message);
    
    if (err.response?.status === 401) {
      return res.status(401).json({ 
        message: '네이버 토큰이 만료되었습니다.',
        error: 'TOKEN_EXPIRED',
        requiresReauth: true 
      });
    }
    
    return res.status(500).json({ message: '네이버 프로필 조회에 실패했습니다.' });
  }
};
