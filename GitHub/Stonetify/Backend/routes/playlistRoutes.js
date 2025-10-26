const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getMyPlaylists,
    createPlaylist,
    getPlaylistById,
    getPlaylistsByUser,
    searchPlaylists,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    likePlaylist,
    getLikedPlaylists,
    createShareLink,
    getSharedPlaylist,
    getShareStats,
    deactivateShareLink,
    getMyLikedSongs,
    getPopularPlaylists,
    getRandomPlaylists,
} = require('../controllers/playlistController');

// @/api/playlists/

// 랜덤 플레이리스트 추천
router.get('/random', getRandomPlaylists);

// 인기차트
router.get('/popular', getPopularPlaylists);

// 내 플레이리스트
router.get('/me', protect, getMyPlaylists);

// 좋아요한 플레이리스트
router.get('/liked', protect, getLikedPlaylists);
router.get('/songs/liked/me', protect, getMyLikedSongs);

// 플레이리스트 검색
router.get('/search', searchPlaylists);

// 플레이리스트 좋아요/취소 토글
router.post('/:playlistId/like', protect, likePlaylist);

// 플레이리스트 생성
router.post('/', protect, createPlaylist);

// 플레이리스트 수정
router.put('/:playlistId', protect, updatePlaylist);

// 플레이리스트 삭제
router.delete('/:playlistId', protect, deletePlaylist);

// 플레이리스트 내 노래 추가/삭제
router.post('/:playlistId/songs', protect, addSongToPlaylist);
router.delete('/:playlistId/songs/:songId', protect, removeSongFromPlaylist);
// 곡 좋아요 토글
router.post('/songs/:songId/like', protect, (req, res, next) => require('../controllers/playlistController').toggleLikeSong(req, res, next));


// 플레이리스트 공유 관련 라우트 (개선된 버전)
router.post('/:playlist_id/share', protect, createShareLink);
router.get('/:playlist_id/share/stats', protect, getShareStats);
router.delete('/:playlist_id/share', protect, deactivateShareLink);

// 공유 링크로 플레이리스트 조회 (인증 불필요)
router.get('/shared/:share_id', getSharedPlaylist);

// 개별 플레이리스트 CRUD
router.post('/', protect, createPlaylist);
router.get('/user/:userId', getPlaylistsByUser); // 특정 사용자의 플레이리스트 목록
// 특정 플레이리스트 조회
router.get('/:playlistId', getPlaylistById);
router.put('/:playlistId', protect, updatePlaylist);
router.delete('/:playlistId', protect, deletePlaylist);
router.get('/me', protect, getMyPlaylists);


module.exports = router;