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

// 개인화된 추천 플레이리스트
router.get('/playlists', protect, getRecommendedPlaylists);

// 비슷한 취향의 사용자들
router.get('/users', protect, getSimilarUsers);

// 트렌딩 플레이리스트
router.get('/trending', getTrendingPlaylists);

// Gemini 기반 AI 추천
router.get('/gemini', protect, getGeminiRecommendations);

// 추천 피드백 저장
router.post('/feedback', protect, postRecommendationFeedback);

module.exports = router;
