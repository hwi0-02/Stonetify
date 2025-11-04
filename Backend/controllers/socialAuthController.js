const axios = require('axios');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const socialStateStore = require('../utils/socialStateStore');
const getRequestFingerprint = require('../utils/requestFingerprint');
const { resolveSocialRedirectUri } = require('../utils/oauthRedirect');

const KAKAO_AUTH_URL = 'https://kauth.kakao.com';
const KAKAO_API_URL = 'https://kapi.kakao.com';
const NAVER_TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const NAVER_API_URL = 'https://openapi.naver.com';

/**
 * JWT 토큰 생성
 */
function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

/**
 * 카카오 소셜 로그인/회원가입
 * POST /api/auth/social/kakao
 * Body: { code, state }
 */
exports.kakaoAuth = async (req, res) => {
  try {
    const { code, state, redirectUri: requestedRedirectUri } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'code required' });
    }
    if (!state) {
      return res.status(400).json({ message: 'state required' });
    }

    const fingerprint = getRequestFingerprint(req);
    const stateEntry = socialStateStore.consumeState({
      provider: 'kakao',
      state,
      fingerprint: fingerprint || null,
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

    // 1. 카카오 토큰 요청
    const tokenResponse = await axios.post(
      `${KAKAO_AUTH_URL}/oauth/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_REST_API_KEY,
        client_secret: process.env.KAKAO_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        code: code,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token } = tokenResponse.data;

    // 2. 카카오 사용자 정보 조회
    const userResponse = await axios.get(
      `${KAKAO_API_URL}/v2/user/me`,
      {
        headers: { Authorization: `Bearer ${access_token}` }
      }
    );

    const kakaoUser = userResponse.data;
    const kakaoId = kakaoUser.id.toString();
    const email = kakaoUser.kakao_account?.email || `kakao_${kakaoId}@stonetify.app`;
    const displayName = kakaoUser.kakao_account?.profile?.nickname || `카카오사용자${kakaoId.slice(-4)}`;
    const profileImage = kakaoUser.kakao_account?.profile?.profile_image_url || null;

    // 3. 기존 사용자 찾기 또는 새로 생성
    let user = await User.findByKakaoId(kakaoId);

    if (!user) {
      // 이메일로도 확인 (이미 이메일로 가입한 경우)
      user = await User.findByEmail(email);
      
      if (user) {
        // 기존 이메일 계정에 카카오 ID 연결
        await User.update(user.id, {
          kakao_id: kakaoId,
          profile_image: profileImage || user.profile_image
        });
        user = await User.findById(user.id);
      } else {
        // 새 사용자 생성
        const userId = await User.create({
          email,
          display_name: displayName,
          profile_image: profileImage,
          kakaoId,
          password: null, // 소셜 로그인은 비밀번호 없음
        });
        user = await User.findById(userId);
      }
    } else {
      // 기존 카카오 사용자 - 정보 업데이트
      if (profileImage && !user.profile_image) {
        await User.update(user.id, { profile_image: profileImage });
        user = await User.findById(user.id);
      }
    }

    // 4. JWT 토큰 생성
    const token = generateToken(user.id);

    // 인증 응답에 캐시 무효화 헤더 추가
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        profileImage: user.profile_image,
        kakaoId: user.kakao_id,
      },
      message: user.kakao_id === kakaoId && !user.password ? '카카오 로그인 성공' : '카카오 계정 연결 완료'
    });

  } catch (err) {
    console.error('Kakao auth failed:', err.response?.data || err.message);
    return res.status(500).json({ 
      message: '카카오 로그인에 실패했습니다.',
      error: err.response?.data?.error_description || err.message
    });
  }
};

/**
 * 네이버 소셜 로그인/회원가입
 * POST /api/auth/social/naver
 * Body: { code, state }
 */
exports.naverAuth = async (req, res) => {
  try {
    const { code, state, redirectUri: requestedRedirectUri } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'code required' });
    }
    if (!state) {
      return res.status(400).json({ message: 'state required' });
    }

    const fingerprint = getRequestFingerprint(req);
    const stateEntry = socialStateStore.consumeState({
      provider: 'naver',
      state,
      fingerprint: fingerprint || null,
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

    // 1. 네이버 토큰 요청
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

    const { access_token } = tokenResponse.data;

    // 2. 네이버 사용자 정보 조회
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

    const naverId = naverUser.id;
    const email = naverUser.email || `naver_${naverId}@stonetify.app`;
    const displayName = naverUser.name || naverUser.nickname || `네이버사용자${naverId.slice(-4)}`;
    const profileImage = naverUser.profile_image || null;

    // 3. 기존 사용자 찾기 또는 새로 생성
    let user = await User.findByNaverId(naverId);

    if (!user) {
      // 이메일로도 확인 (이미 이메일로 가입한 경우)
      user = await User.findByEmail(email);
      
      if (user) {
        // 기존 이메일 계정에 네이버 ID 연결
        await User.update(user.id, {
          naver_id: naverId,
          profile_image: profileImage || user.profile_image
        });
        user = await User.findById(user.id);
      } else {
        // 새 사용자 생성
        const userId = await User.create({
          email,
          display_name: displayName,
          profile_image: profileImage,
          naverId,
          password: null, // 소셜 로그인은 비밀번호 없음
        });
        user = await User.findById(userId);
      }
    } else {
      // 기존 네이버 사용자 - 정보 업데이트
      if (profileImage && !user.profile_image) {
        await User.update(user.id, { profile_image: profileImage });
        user = await User.findById(user.id);
      }
    }

    // 4. JWT 토큰 생성
    const token = generateToken(user.id);

    // 인증 응답에 캐시 무효화 헤더 추가
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        profileImage: user.profile_image,
        naverId: user.naver_id,
      },
      message: user.naver_id === naverId && !user.password ? '네이버 로그인 성공' : '네이버 계정 연결 완료'
    });

  } catch (err) {
    console.error('Naver auth failed:', err.response?.data || err.message);
    return res.status(500).json({ 
      message: '네이버 로그인에 실패했습니다.',
      error: err.response?.data?.error_description || err.message
    });
  }
};
