const express = require('express');
const router = express.Router();
const spotifyController = require('../controllers/spotifyController');
const spotifyAuthController = require('../controllers/spotifyAuthController');
const spotifyPlaybackController = require('../controllers/spotifyPlaybackController');
const playbackHistoryController = require('../controllers/playbackHistoryController');
const { authLimiter, playbackLimiter } = require('../middleware/rateLimiter');

router.get('/search', playbackLimiter, spotifyController.searchTracks);

// Spotify PKCE 인증 (Phase B)
router.post('/auth/token', authLimiter, spotifyAuthController.exchangeCode);
router.post('/auth/refresh', authLimiter, spotifyAuthController.refreshToken);
router.post('/auth/revoke', authLimiter, spotifyAuthController.revoke);
router.get('/auth/premium-status', authLimiter, spotifyAuthController.getMockPremiumStatus);
router.get('/me', authLimiter, spotifyAuthController.getProfile);

// 재생 제어 엔드포인트 (프리미엄 전체 트랙 재생) - playbackLimiter 적용
router.get('/playback/state', playbackLimiter, spotifyPlaybackController.getState);
router.get('/me/devices', playbackLimiter, spotifyPlaybackController.getDevices);
router.put('/playback/play', playbackLimiter, spotifyPlaybackController.play);
router.put('/playback/pause', playbackLimiter, spotifyPlaybackController.pause);
router.post('/playback/next', playbackLimiter, spotifyPlaybackController.next);
router.post('/playback/previous', playbackLimiter, spotifyPlaybackController.previous);
router.put('/playback/seek', playbackLimiter, spotifyPlaybackController.seek);
router.put('/playback/volume', playbackLimiter, spotifyPlaybackController.setVolume);
router.put('/playback/transfer', playbackLimiter, spotifyPlaybackController.transfer);

// 재생 기록 이벤트 수집
router.post('/playback/history/start', playbackLimiter, playbackHistoryController.start);
router.post('/playback/history/complete', playbackLimiter, playbackHistoryController.complete);

module.exports = router;