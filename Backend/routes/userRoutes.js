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
    verifyPasswordResetCode
} = require('../controllers/userController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { successResponse } = require('../utils/responses');

// 연결 테스트 엔드포인트
router.get('/test', protect, (req, res) => {
    successResponse(res, {
        data: {
            message: 'API 서버가 정상적으로 실행 중입니다.',
            timestamp: new Date().toISOString(),
            status: 'healthy'
        }
    });
});

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/:id/profile', optionalProtect, getUserProfile);

// 비밀번호 재설정 엔드포인트
router.post('/password-reset/request', requestPasswordReset);
router.post('/password-reset/verify', verifyPasswordResetCode);

router.post('/follow', protect, followUser);
router.delete('/unfollow', protect, unfollowUser); // DELETE 메소드 사용
router.post('/:id/toggle-follow', protect, toggleFollow);

router.get('/:userId/followers', protect, getFollowers);
router.get('/:userId/following', protect, getFollowing);

module.exports = router;