const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getMe,
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// @/api/users/

// 연결 테스트 엔드포인트
router.get('/test', (req, res) => {
    res.status(200).json({ 
        message: 'API 서버가 정상적으로 실행 중입니다.',
        timestamp: new Date().toISOString(),
        status: 'healthy' 
    });
});

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);

router.post('/follow', protect, followUser);
router.delete('/unfollow', protect, unfollowUser); // DELETE 메소드 사용

router.get('/:userId/followers', getFollowers);
router.get('/:userId/following', getFollowing);

module.exports = router;