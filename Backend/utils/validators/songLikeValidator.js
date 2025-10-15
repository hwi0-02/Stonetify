const { ensureRequiredFields, sanitizeString } = require('./common');

const validateSongLikeCreate = (data) => {
  ensureRequiredFields(data, ['user_id', 'song_id'], '곡 좋아요');
  return {
    user_id: sanitizeString(data.user_id),
    song_id: sanitizeString(data.song_id),
    liked_at: data.liked_at || Date.now(),
  };
};

module.exports = {
  validateSongLikeCreate,
};
