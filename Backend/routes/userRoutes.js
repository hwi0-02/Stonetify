const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getMe,
    getUserProfile,
    toggleFollow,
    updateProfile,
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    requestPasswordReset,
    verifyPasswordResetCode,
    deleteUserAccount
} = require('../controllers/userController');
const socialAuthController = require('../controllers/socialAuthController');
const socialStateController = require('../controllers/socialStateController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);

// 소셜 로그인 라우트 (회원가입/로그인)
router.post('/auth/social/state', authLimiter, socialStateController.createPublicState);
router.post('/auth/social/kakao', authLimiter, socialAuthController.kakaoAuth);
router.post('/auth/social/naver', authLimiter, socialAuthController.naverAuth);
router.put('/profile', protect, updateProfile);
router.get('/:id/profile', optionalProtect, getUserProfile);

// 비밀번호 재설정 엔드포인트
router.post('/password-reset/request', requestPasswordReset);
router.post('/password-reset/verify', verifyPasswordResetCode);

router.post('/follow', protect, followUser);
router.delete('/unfollow', protect, unfollowUser); // DELETE 메소드 사용
router.post('/:id/toggle-follow', protect, toggleFollow);

router.get('/:userId/followers', getFollowers);
router.get('/:userId/following', getFollowing);

router.route('/me')
    .get(protect, getMe)
    .delete(protect, deleteUserAccount);

module.exports = router;
