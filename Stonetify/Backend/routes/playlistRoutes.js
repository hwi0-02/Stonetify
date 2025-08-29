const express = require('express');
const router = express.Router();
const {
    getMyPlaylists,
    createPlaylist,
    getPlaylistById,
    getPlaylistsByUser,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    likePlaylist,
    getLikedPlaylists,
} = require('../controllers/playlistController');
const { protect } = require('../middleware/authMiddleware');

// @/api/playlists/

// 내 플레이리스트 (메인화면)
router.get('/me', protect, getMyPlaylists);

// 좋아요한 플레이리스트
router.get('/liked', protect, getLikedPlaylists);

// 플레이리스트 좋아요/취소 토글
router.post('/:id/like', protect, likePlaylist);

// 플레이리스트 내 노래 추가/삭제
router.post('/:id/songs', protect, addSongToPlaylist);
router.delete('/:playlistId/songs/:songId', protect, removeSongFromPlaylist);


// 개별 플레이리스트 CRUD
router.post('/', protect, createPlaylist);
router.get('/user/:userId', getPlaylistsByUser); // 특정 사용자의 플레이리스트 목록
router.get('/:id', getPlaylistById);
router.put('/:id', protect, updatePlaylist);
router.delete('/:id', protect, deletePlaylist);


module.exports = router;
