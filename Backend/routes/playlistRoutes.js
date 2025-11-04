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
    savePlaylistToLibrary,
} = require('../controllers/playlistController');

router.get('/random', getRandomPlaylists);
router.get('/popular', getPopularPlaylists);
router.get('/me', protect, getMyPlaylists);
router.get('/liked', protect, getLikedPlaylists);
router.get('/songs/liked/me', protect, getMyLikedSongs);
router.get('/search', searchPlaylists);
router.post('/:playlistId/like', protect, likePlaylist);
router.post('/:playlistId/save', protect, savePlaylistToLibrary);
router.post('/', protect, createPlaylist);
router.put('/:playlistId', protect, updatePlaylist);
router.delete('/:playlistId', protect, deletePlaylist);
router.post('/:playlistId/songs', protect, addSongToPlaylist);
router.delete('/:playlistId/songs/:songId', protect, removeSongFromPlaylist);
router.post('/songs/:songId/like', protect, (req, res, next) => require('../controllers/playlistController').toggleLikeSong(req, res, next));
router.post('/:playlist_id/share', protect, createShareLink);
router.get('/:playlist_id/share/stats', protect, getShareStats);
router.delete('/:playlist_id/share', protect, deactivateShareLink);
router.get('/shared/:share_id', getSharedPlaylist);
router.get('/user/:userId', getPlaylistsByUser);
router.get('/:playlistId', getPlaylistById);


module.exports = router;