const { ensureRequiredFields, sanitizeString } = require('./common');

const validateFollowCreate = (data) => {
  ensureRequiredFields(data, ['follower_id', 'following_id'], '팔로우 정보');
  return {
    follower_id: sanitizeString(data.follower_id),
    following_id: sanitizeString(data.following_id),
    followed_at: data.followed_at || Date.now(),
  };
};

module.exports = {
  validateFollowCreate,
};
