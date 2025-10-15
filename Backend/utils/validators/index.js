const user = require('./userValidator');
const playlist = require('./playlistValidator');
const follow = require('./followValidator');
const playlistSong = require('./playlistSongValidator');
const song = require('./songValidator');
const likedPlaylist = require('./likedPlaylistValidator');
const post = require('./postValidator');
const postLike = require('./postLikeValidator');
const savedPost = require('./savedPostValidator');
const shareLink = require('./shareLinkValidator');
const songLike = require('./songLikeValidator');
const spotifyToken = require('./spotifyTokenValidator');
const playbackHistory = require('./playbackHistoryValidator');

module.exports = {
  user,
  playlist,
  follow,
  playlistSong,
  song,
  likedPlaylist,
  post,
  postLike,
  savedPost,
  shareLink,
  songLike,
  spotifyToken,
  playbackHistory,
};
