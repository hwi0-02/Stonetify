// Firebase Realtime Database 모델들 내보내기
const User = require('./user');
const Playlist = require('./playlist');
const Song = require('./song');
const PlaylistSongs = require('./playlist_songs');
const LikedPlaylist = require('./liked_playlists');
const Post = require('./post');
const PostLike = require('./post_likes');
const SavedPost = require('./saved_posts');
const Follow = require('./follows');
const ShareLink = require('./share_links');
const SongLike = require('./song_likes');
const SpotifyToken = require('./spotify_token');
const PlaybackHistory = require('./playback_history');

module.exports = {
  User,
  Playlist,
  Song,
  PlaylistSongs,
  LikedPlaylist,
  Post,
  PostLike,
  SavedPost,
  Follow,
  ShareLink
  ,SongLike
  ,SpotifyToken
  ,PlaybackHistory
};