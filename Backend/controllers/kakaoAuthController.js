const axios = require('axios');
const SocialTokenModel = require('../models/social_token');
const socialStateStore = require('../utils/socialStateStore');
const getRequestFingerprint = require('../utils/requestFingerprint');
const { resolveSocialRedirectUri } = require('../utils/oauthRedirect');

const KAKAO_AUTH_URL = 'https://kauth.kakao.com';
const KAKAO_API_URL = 'https://kapi.kakao.com';

/**
 * 안전하게 undefined/null 제거
 */
const safeObject = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null)
  );

/**
 * 1. Authorization Code 교환
 * POST /api/users/auth/social/kakao
 * Body: { code, state, redirectUri }
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
      provider: 'kakao',
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
        provider: 'kakao',
        requestedUri: stateEntry.redirectUri || requestedRedirectUri,
      }));
    } catch (err) {
      if (err.code === 'INVALID_REDIRECT_URI') {
        return res.status(400).json({
          message: '허용되지 않은 redirect_uri 입니다.',
          allowedRedirectUris: err.allowedList,
        });
      }
      console.error('Kakao redirect URI resolution failed:', err.message);
      return res.status(500).json({ message: '카카오 Redirect URI 설정을 확인해주세요.' });
    }

    // 1️⃣ 카카오 토큰 요청
    const tokenResponse = await axios.post(
      `${KAKAO_AUTH_URL}/oauth/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_REST_API_KEY,
        client_secret: process.env.KAKAO_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        code: code,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const {
      access_token,
      refresh_token,
      expires_in,
      token_type,
      scope
    } = tokenResponse.data;

    // 2️⃣ 카카오 사용자 정보 조회
    const userResponse = await axios.get(`${KAKAO_API_URL}/v2/user/me`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const kakaoUser = userResponse.data;
    const providerUserId = kakaoUser.id?.toString?.() || '';
    const providerUserEmail = kakaoUser.kakao_account?.email ?? null;
    const providerUserName = kakaoUser.kakao_account?.profile?.nickname ?? null;
    const providerUserProfile =
      kakaoUser.kakao_account?.profile?.profile_image_url ?? null;

    // 3️⃣ undefined/null-safe로 토큰 저장
    await SocialTokenModel.upsertToken(
      userId,
      'kakao',
      safeObject({
        access_token,
        refresh_token,
        token_type,
        expires_at: Date.now() + expires_in * 1000,
        scope: scope || '',
        provider_user_id: providerUserId,
        provider_user_email: providerUserEmail,
        provider_user_name: providerUserName,
        provider_user_profile: providerUserProfile,
      })
    );

    // 4️⃣ 응답 반환
    return res.json({
      success: true,
      provider: 'kakao',
      accessToken: access_token,
      expiresIn: expires_in,
      providerUser: {
        id: providerUserId,
        email: providerUserEmail,
        name: providerUserName,
        profile_image: providerUserProfile,
      },
    });
  } catch (err) {
    console.error('Kakao code exchange failed:', err.response?.data || err.message);
    return res.status(500).json({
      message: '카카오 로그인에 실패했습니다.',
      error: err.response?.data || err.message,
    });
  }
};

/**
 * 2. Refresh Token 갱신
 * POST /api/users/auth/social/kakao/refresh
 */
exports.refreshToken = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: '인증 정보가 없습니다.' });
    }

    const record = await SocialTokenModel.getByUser(userId, 'kakao');
    if (!record || record.revoked) {
      return res.status(404).json({ message: '카카오 연동 정보를 찾을 수 없습니다.' });
    }

    const { refresh_token: refreshToken } = SocialTokenModel.decryptToken(record);
    if (!refreshToken) {
      return res.status(404).json({ message: '저장된 카카오 토큰이 없습니다.', error: 'TOKEN_MISSING' });
    }

    const tokenResponse = await axios.post(
      `${KAKAO_AUTH_URL}/oauth/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.KAKAO_REST_API_KEY,
        client_secret: process.env.KAKAO_CLIENT_SECRET || '',
        refresh_token: refreshToken,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, expires_in, refresh_token: newRefreshToken } = tokenResponse.data;

    await SocialTokenModel.upsertToken(
      userId,
      'kakao',
      safeObject({
        access_token,
        refresh_token: newRefreshToken || refreshToken,
        expires_at: Date.now() + expires_in * 1000,
      })
    );

    return res.json({
      success: true,
      accessToken: access_token,
      expiresIn: expires_in,
    });
  } catch (err) {
    console.error('Kakao refresh failed:', err.response?.data || err.message);
    if (err.response?.status === 401 || err.response?.data?.error === 'invalid_grant') {
      const userId = req.user?.id;
      if (userId) await SocialTokenModel.revoke(userId, 'kakao');
      return res.status(401).json({
        message: '카카오 연동이 만료되었습니다. 다시 로그인해주세요.',
        error: 'TOKEN_REVOKED',
        requiresReauth: true,
      });
    }
    return res.status(500).json({ message: '카카오 토큰 갱신에 실패했습니다.' });
  }
};

/**
 * 3. 연동 해제
 * POST /api/users/auth/social/kakao/revoke
 */
exports.revoke = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: '인증 정보가 없습니다.' });
    }

    const record = await SocialTokenModel.getByUser(userId, 'kakao');
    if (record && !record.revoked) {
      const { access_token: accessToken } = SocialTokenModel.decryptToken(record);
      if (accessToken) {
        try {
          await axios.post(
            `${KAKAO_API_URL}/v1/user/unlink`,
            {},
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
        } catch (err) {
          console.warn('Kakao unlink API failed:', err.message);
        }
      }
    }

    await SocialTokenModel.revoke(userId, 'kakao');
    return res.json({ success: true, revoked: true });
  } catch (err) {
    console.error('Kakao revoke failed:', err.message);
    return res.status(500).json({ message: '카카오 연동 해제에 실패했습니다.' });
  }
};

/**
 * 4. 사용자 정보 조회
 * GET /api/users/auth/social/kakao/me
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: '인증 정보가 없습니다.' });
    }

    const record = await SocialTokenModel.getByUser(userId, 'kakao');
    if (!record || record.revoked) {
      return res.status(404).json({ message: '카카오 연동 정보를 찾을 수 없습니다.' });
    }

    const { access_token: accessToken } = SocialTokenModel.decryptToken(record);
    if (!accessToken) {
      return res.status(404).json({ message: '카카오 액세스 토큰이 없습니다.' });
    }

    const userResponse = await axios.get(`${KAKAO_API_URL}/v2/user/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const kakaoUser = userResponse.data;
    return res.json({
      id: kakaoUser.id?.toString?.() || '',
      email: kakaoUser.kakao_account?.email ?? null,
      name: kakaoUser.kakao_account?.profile?.nickname ?? null,
      profileImage: kakaoUser.kakao_account?.profile?.profile_image_url ?? null,
    });
  } catch (err) {
    console.error('Kakao profile fetch failed:', err.response?.data || err.message);
    if (err.response?.status === 401) {
      return res.status(401).json({
        message: '카카오 토큰이 만료되었습니다.',
        error: 'TOKEN_EXPIRED',
        requiresReauth: true,
      });
    }
    return res.status(500).json({ message: '카카오 프로필 조회에 실패했습니다.' });
  }
};
