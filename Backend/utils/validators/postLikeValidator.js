const { ensureRequiredFields, sanitizeString } = require('./common');

const validatePostLikeCreate = (data) => {
  ensureRequiredFields(data, ['user_id', 'post_id'], '게시물 좋아요');
  return {
    user_id: sanitizeString(data.user_id),
    post_id: sanitizeString(data.post_id),
    liked_at: data.liked_at || Date.now(),
  };
};

module.exports = {
  validatePostLikeCreate,
};
