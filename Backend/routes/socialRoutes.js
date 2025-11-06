const express = require('express');
const router = express.Router();
const kakaoAuthController = require('../controllers/kakaoAuthController');
const naverAuthController = require('../controllers/naverAuthController');
const socialStateController = require('../controllers/socialStateController');
const { authLimiter } = require('../middleware/rateLimiter');
const { protect } = require('../middleware/authMiddleware');

// OAuth state 생성 (인증 불필요 - 로그인 전에 사용)
router.post('/state', authLimiter, socialStateController.createState);

// ===== 인증 불필요 엔드포인트 (로그인/회원가입 용도) =====
// 소셜 로그인 토큰 교환 - 이미 로그인된 사용자가 소셜 계정을 연결하는 용도
// 주의: 이 엔드포인트는 Stonetify 계정에 소셜 계정을 "연결"하는 것이므로 인증 필요
router.post('/kakao/token', authLimiter, protect, kakaoAuthController.exchangeCode);
router.post('/naver/token', authLimiter, protect, naverAuthController.exchangeCode);

// ===== 인증 필요 엔드포인트 =====
// Kakao OAuth - 연결된 계정 관리
router.post('/kakao/refresh', authLimiter, protect, kakaoAuthController.refreshToken);
router.post('/kakao/revoke', authLimiter, protect, kakaoAuthController.revoke);
router.get('/kakao/me', authLimiter, protect, kakaoAuthController.getProfile);

// Naver OAuth - 연결된 계정 관리
router.post('/naver/refresh', authLimiter, protect, naverAuthController.refreshToken);
router.post('/naver/revoke', authLimiter, protect, naverAuthController.revoke);
router.get('/naver/me', authLimiter, protect, naverAuthController.getProfile);

module.exports = router;
