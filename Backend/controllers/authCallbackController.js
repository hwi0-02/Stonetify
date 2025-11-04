// Backend/controllers/authCallbackController.js
// 서버 주도 OAuth 콜백 핸들러

const axios = require('axios');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const socialStateStore = require('../utils/socialStateStore');
const getRequestFingerprint = require('../utils/requestFingerprint');
const { issueOneTimeCode } = require('../utils/oneTimeCodeStore');

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
 * 카카오 OAuth 콜백
 * GET /api/auth/kakao/callback?code=...&state=...
 */
exports.kakaoCallback = async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // 에러 처리
    if (error) {
      console.error('❌ [Kakao Callback] Error:', error, error_description);
      return res.status(400).send(`
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>로그인 실패</title></head>
        <body style="font-family: system-ui; padding: 20px; text-align: center;">
          <h1>카카오 로그인 실패</h1>
          <p>${error_description || error}</p>
          <button onclick="window.close()">닫기</button>
        </body></html>
      `);
    }

    if (!code || !state) {
      return res.status(400).json({ message: 'code and state are required' });
    }

    // state 검증
    const fingerprint = getRequestFingerprint(req);
    const stateEntry = socialStateStore.consumeState({
      provider: 'kakao',
      state,
      fingerprint: fingerprint || null,
    });

    if (!stateEntry) {
      return res.status(400).json({ message: '잘못된 또는 만료된 state 파라미터입니다.' });
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/kakao/callback`;

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
          password: null,
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

    // 5. returnUrl로 리다이렉트
    const returnUrl = stateEntry.metadata?.returnUrl || 'stonetify://oauth-finish';
    
    // returnUrl이 http/https면 웹, 아니면 모바일 deep link
    if (returnUrl.startsWith('http://') || returnUrl.startsWith('https://')) {
      // 웹: HttpOnly 쿠키로 토큰 설정
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
      });
      
      console.log('✅ [Kakao] Redirecting to web (cookie set):', returnUrl);
      return res.redirect(returnUrl);
    } else {
      // 모바일: 1회용 코드로 deep link (토큰 노출 방지)
      const oneTimeCode = issueOneTimeCode(token, 'kakao');
      const separator = returnUrl.includes('?') ? '&' : '?';
      const finalUrl = `${returnUrl}${separator}code=${encodeURIComponent(oneTimeCode)}`;
      console.log('✅ [Kakao] Redirecting to app (one-time code):', finalUrl);
      
      // 바로 앱으로 리다이렉트
      return res.redirect(finalUrl);
    }

  } catch (err) {
    console.error('❌ [Kakao Callback] Error:', err.response?.data || err.message);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>로그인 실패</title></head>
      <body style="font-family: system-ui; padding: 20px; text-align: center;">
        <h1>카카오 로그인 실패</h1>
        <p>${err.message}</p>
        <button onclick="window.close()">닫기</button>
      </body></html>
    `);
  }
};

/**
 * 네이버 OAuth 콜백
 * GET /api/auth/naver/callback?code=...&state=...
 */
exports.naverCallback = async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // 에러 처리
    if (error) {
      console.error('❌ [Naver Callback] Error:', error, error_description);
      return res.status(400).send(`
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>로그인 실패</title></head>
        <body style="font-family: system-ui; padding: 20px; text-align: center;">
          <h1>네이버 로그인 실패</h1>
          <p>${error_description || error}</p>
          <button onclick="window.close()">닫기</button>
        </body></html>
      `);
    }

    if (!code || !state) {
      return res.status(400).json({ message: 'code and state are required' });
    }

    // state 검증
    const fingerprint = getRequestFingerprint(req);
    const stateEntry = socialStateStore.consumeState({
      provider: 'naver',
      state,
      fingerprint: fingerprint || null,
    });

    if (!stateEntry) {
      return res.status(400).json({ message: '잘못된 또는 만료된 state 파라미터입니다.' });
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/naver/callback`;

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
      throw new Error('네이버 사용자 정보를 가져올 수 없습니다.');
    }

    const naverId = naverUser.id;
    const email = naverUser.email || `naver_${naverId}@stonetify.app`;
    const displayName = naverUser.name || naverUser.nickname || `네이버사용자${naverId.slice(-4)}`;
    const profileImage = naverUser.profile_image || null;

    // 3. 기존 사용자 찾기 또는 새로 생성
    let user = await User.findByNaverId(naverId);

    if (!user) {
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
          password: null,
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

    // 5. returnUrl로 리다이렉트
    const returnUrl = stateEntry.metadata?.returnUrl || 'stonetify://oauth-finish';
    
    // returnUrl이 http/https면 웹, 아니면 모바일 deep link
    if (returnUrl.startsWith('http://') || returnUrl.startsWith('https://')) {
      // 웹: HttpOnly 쿠키로 토큰 설정
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
      });
      
      console.log('✅ [Naver] Redirecting to web (cookie set):', returnUrl);
      return res.redirect(returnUrl);
    } else {
      // 모바일: 1회용 코드로 deep link (토큰 노출 방지)
      const oneTimeCode = issueOneTimeCode(token, 'naver');
      const separator = returnUrl.includes('?') ? '&' : '?';
      const finalUrl = `${returnUrl}${separator}code=${encodeURIComponent(oneTimeCode)}`;
      console.log('✅ [Naver] Redirecting to app (one-time code):', finalUrl);
      
      // 바로 앱으로 리다이렉트
      return res.redirect(finalUrl);
    }

  } catch (err) {
    console.error('❌ [Naver Callback] Error:', err.response?.data || err.message);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>로그인 실패</title></head>
      <body style="font-family: system-ui; padding: 20px; text-align: center;">
        <h1>네이버 로그인 실패</h1>
        <p>${err.message}</p>
        <button onclick="window.close()">닫기</button>
      </body></html>
    `);
  }
};
