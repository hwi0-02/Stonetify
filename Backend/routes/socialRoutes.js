const express = require('express');
const router = express.Router();
const kakaoAuthController = require('../controllers/kakaoAuthController');
const naverAuthController = require('../controllers/naverAuthController');
const socialStateController = require('../controllers/socialStateController');
const { authLimiter } = require('../middleware/rateLimiter');
const { protect } = require('../middleware/authMiddleware');

// OAuth state 생성 (인증 불필요 - 로그인 전에 사용)
router.post('/state', authLimiter, socialStateController.createState);

// 모든 소셜 로그인 라우트에 인증 미들웨어 적용
router.use(protect);

// Kakao OAuth
router.post('/kakao/token', authLimiter, kakaoAuthController.exchangeCode);
router.post('/kakao/refresh', authLimiter, kakaoAuthController.refreshToken);
router.post('/kakao/revoke', authLimiter, kakaoAuthController.revoke);
router.get('/kakao/me', authLimiter, kakaoAuthController.getProfile);

// Naver OAuth
router.post('/naver/token', authLimiter, naverAuthController.exchangeCode);
router.post('/naver/refresh', authLimiter, naverAuthController.refreshToken);
router.post('/naver/revoke', authLimiter, naverAuthController.revoke);
router.get('/naver/me', authLimiter, naverAuthController.getProfile);

module.exports = router;
