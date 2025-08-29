const express = require('express');
const router = express.Router();
const {
    createPlaylist,
    getPlaylistById,
    getPlaylistsByUser,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    likePlaylist,
    unlikePlaylist,
    getLikedPlaylists,
    getSongsInPlaylist
} = require('../controllers/playlistController');
const { protect } = require('../middleware/authMiddleware');

// @/api/playlists/

// Playlist Like
router.route('/:id/like')
  .post(protect, likePlaylist)
  .delete(protect, unlikePlaylist);

router.get('/liked', protect, getLikedPlaylists); // 좋아요한 플레이리스트 목록

// Songs in Playlist
router.post('/:id/songs', protect, addSongToPlaylist);
router.get('/:id/songs', getSongsInPlaylist);
router.delete('/:playlistId/songs/:songId', protect, removeSongFromPlaylist);


// Playlist CRUD
router.post('/', protect, createPlaylist);
router.get('/user/:userId', getPlaylistsByUser); // 특정 사용자의 플레이리스트 목록
router.get('/:id', getPlaylistById);
router.put('/:id', protect, updatePlaylist);
router.delete('/:id', protect, deletePlaylist);


module.exports = router;