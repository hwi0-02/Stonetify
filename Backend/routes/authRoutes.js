// Backend/routes/authRoutes.js
// 서버 주도 OAuth 플로우 라우트

const express = require('express');
const router = express.Router();
const socialStateStore = require('../utils/socialStateStore');
const getRequestFingerprint = require('../utils/requestFingerprint');
const { kakaoCallback, naverCallback } = require('../controllers/authCallbackController');
const { validateReturnUrlMiddleware } = require('../utils/returnUrlValidator');
const rateLimit = require('express-rate-limit');

const KAKAO_AUTH_URL = 'https://kauth.kakao.com/oauth/authorize';
const NAVER_AUTH_URL = 'https://nid.naver.com/oauth2.0/authorize';

// Rate limiter: 5초당 1회 (429 방지)
const oauthStartLimiter = rateLimit({
  windowMs: 5000, // 5초
  max: 1, // 5초당 1회
  message: { message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 카카오 OAuth 시작
 * GET /api/auth/kakao/start?returnUrl=...
 */
router.get('/kakao/start', oauthStartLimiter, validateReturnUrlMiddleware, (req, res) => {
  try {
    const { returnUrl } = req.query;

    const fingerprint = getRequestFingerprint(req);
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/kakao/callback`;
    
    // state 생성 및 저장
    const state = socialStateStore.issueState({
      provider: 'kakao',
      fingerprint: fingerprint || null,
      redirectUri,
      metadata: { returnUrl }
    });

    // 카카오 인증 URL 생성
    const authUrl = new URL(KAKAO_AUTH_URL);
    authUrl.searchParams.set('client_id', process.env.KAKAO_REST_API_KEY);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'profile_nickname,account_email');

    // 카카오 인증 페이지로 리다이렉트
    res.redirect(authUrl.toString());
    
  } catch (err) {
    console.error('❌ [Kakao Start] Error:', err);
    res.status(500).json({ message: '카카오 로그인 시작 실패', error: err.message });
  }
});

/**
 * 네이버 OAuth 시작
 * GET /api/auth/naver/start?returnUrl=...
 */
router.get('/naver/start', oauthStartLimiter, validateReturnUrlMiddleware, (req, res) => {
  try {
    const { returnUrl } = req.query;

    const fingerprint = getRequestFingerprint(req);
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/naver/callback`;
    
    // state 생성 및 저장
    const state = socialStateStore.issueState({
      provider: 'naver',
      fingerprint: fingerprint || null,
      redirectUri,
      metadata: { returnUrl }
    });

    // 네이버 인증 URL 생성
    const authUrl = new URL(NAVER_AUTH_URL);
    authUrl.searchParams.set('client_id', process.env.NAVER_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    // 네이버 인증 페이지로 리다이렉트
    res.redirect(authUrl.toString());
    
  } catch (err) {
    console.error('❌ [Naver Start] Error:', err);
    res.status(500).json({ message: '네이버 로그인 시작 실패', error: err.message });
  }
});

/**
 * 카카오 OAuth 콜백
 * GET /api/auth/kakao/callback
 */
router.get('/kakao/callback', kakaoCallback);

/**
 * 네이버 OAuth 콜백
 * GET /api/auth/naver/callback
 */
router.get('/naver/callback', naverCallback);

/**
 * 1회용 코드로 토큰 교환 (모바일 전용)
 * POST /api/auth/complete
 * Body: { code }
 */
router.post('/complete', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'code is required' });
    }

    const { consumeOneTimeCode } = require('../utils/oneTimeCodeStore');
    const result = consumeOneTimeCode(code);

    if (!result) {
      return res.status(400).json({ message: '잘못된 또는 만료된 코드입니다.' });
    }

    // 캐시 무효화 헤더
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // 토큰 반환
    return res.json({
      success: true,
      token: result.token,
      provider: result.provider,
    });

  } catch (err) {
    console.error('❌ [Auth Complete] Error:', err);
    return res.status(500).json({ message: '토큰 교환 실패', error: err.message });
  }
});

module.exports = router;
