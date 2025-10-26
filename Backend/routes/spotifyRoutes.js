const express = require('express');
const router = express.Router();
const spotifyController = require('../controllers/spotifyController');

router.get('/search', spotifyController.searchTracks);

module.exports = router;