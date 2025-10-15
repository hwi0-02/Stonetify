const { ensureRequiredFields, sanitizeString } = require('./common');

const validateSavedPostCreate = (data) => {
  ensureRequiredFields(data, ['user_id', 'post_id'], '게시물 저장');
  return {
    user_id: sanitizeString(data.user_id),
    post_id: sanitizeString(data.post_id),
    saved_at: data.saved_at || Date.now(),
  };
};

module.exports = {
  validateSavedPostCreate,
};
