const { ApiError } = require('./errors');
const { Playlist, Song, User } = require('../models');

const normalizeSongForClient = (song) => ({
  id: song.id,
  spotify_id: song.spotify_id,
  name: song.title || song.name,
  artists: song.artist,
  album: song.album,
  album_cover_url: song.album_cover_url,
  preview_url: song.preview_url,
  duration_ms: song.duration_ms,
  external_urls: song.external_urls,
  position: song.position,
  added_at: song.added_at,
});

const buildPlaylistDetails = async (playlist, { includeSongs = false } = {}) => {
  if (!playlist) return null;
  const [songs, owner] = await Promise.all([
    Song.findByPlaylistId(playlist.id),
    playlist.user_id ? User.findById(playlist.user_id) : null,
  ]);

  const coverImages = (songs || [])
    .slice(0, 4)
    .map((song) => song.album_cover_url)
    .filter(Boolean);

  const result = {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description || '',
    is_public: playlist.is_public !== false,
    created_at: playlist.created_at,
    updated_at: playlist.updated_at,
    user_id: playlist.user_id,
    cover_images: coverImages,
    cover_image_url: coverImages[0] || null,
    user: owner
      ? {
          id: owner.id,
          display_name: owner.display_name,
          profile_image_url: owner.profile_image_url || owner.profile_image || null,
        }
      : null,
    song_count: songs.length,
  };

  if (includeSongs) {
    result.songs = (songs || []).map((song) => normalizeSongForClient(song));
  }

  return result;
};

const ensurePlaylist = async (
  playlistId,
  { notFoundMessage, requireOwnerId, forbiddenMessage } = {},
) => {
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw ApiError.notFound(notFoundMessage || '플레이리스트를 찾을 수 없습니다.');
  }
  if (requireOwnerId && playlist.user_id !== requireOwnerId) {
    throw ApiError.forbidden(forbiddenMessage || '해당 플레이리스트에 대한 권한이 없습니다.');
  }
  return playlist;
};

const sortByDateDesc = (items, key = 'created_at') =>
  [...items].sort((a, b) => (b?.[key] || 0) - (a?.[key] || 0));

const buildShareUrl = (req, shareId) =>
  `${req.protocol}://${req.get('host')}/api/playlists/shared/${shareId}`;

module.exports = {
  normalizeSongForClient,
  buildPlaylistDetails,
  ensurePlaylist,
  sortByDateDesc,
  buildShareUrl,
};
