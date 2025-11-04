const express = require('express');
const router = express.Router();
const {
    getRecommendedPlaylists,
    getSimilarUsers,
    getTrendingPlaylists,
    getGeminiRecommendations,
    postRecommendationFeedback,
} = require('../controllers/recommendationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/playlists', protect, getRecommendedPlaylists);
router.get('/users', protect, getSimilarUsers);
router.get('/trending', getTrendingPlaylists);
router.get('/gemini', protect, getGeminiRecommendations);
router.post('/feedback', protect, postRecommendationFeedback);

module.exports = router;
