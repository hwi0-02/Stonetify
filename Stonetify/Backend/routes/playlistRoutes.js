const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlistController');
const { protect } = require('../middleware/authMiddleware');

// Playlist CRUD
router.post('/', protect, playlistController.createPlaylist);
router.get('/:id', playlistController.getPlaylistById);
router.put('/:id', protect, playlistController.updatePlaylist);
router.delete('/:id', protect, playlistController.deletePlaylist);

// Songs in Playlist
router.post('/:id/songs', protect, playlistController.addSongToPlaylist);
router.get('/:id/songs', playlistController.getSongsInPlaylist);
router.delete('/:playlistId/songs/:songId', protect, playlistController.removeSongFromPlaylist);

// Playlist Like
router.route('/:id/like')
  .post(protect, playlistController.likePlaylist)
  .delete(protect, playlistController.unlikePlaylist);

module.exports = router;