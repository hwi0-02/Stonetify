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
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);

router.post('/follow', protect, followUser);
router.delete('/unfollow', protect, unfollowUser); // DELETE 메소드 사용

router.get('/:userId/followers', getFollowers);
router.get('/:userId/following', getFollowing);

module.exports = router;