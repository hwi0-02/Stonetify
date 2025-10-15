const { ensureRequiredFields, sanitizeString } = require('./common');

const validateLikedPlaylistCreate = (data) => {
  ensureRequiredFields(data, ['user_id', 'playlist_id'], '플레이리스트 좋아요');
  return {
    user_id: sanitizeString(data.user_id),
    playlist_id: sanitizeString(data.playlist_id),
    liked_at: data.liked_at || Date.now(),
  };
};

module.exports = {
  validateLikedPlaylistCreate,
};
