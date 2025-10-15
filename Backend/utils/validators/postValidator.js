const { ensureRequiredFields, sanitizeString, sanitizeOptionalString } = require('./common');

const DEFAULT_POST_TYPE = 'text';

const validatePostCreate = (data) => {
  ensureRequiredFields(data, ['user_id', 'content'], '게시물');
  return {
    user_id: sanitizeString(data.user_id),
    content: sanitizeString(data.content),
    playlist_id: sanitizeOptionalString(data.playlist_id) || null,
    type: sanitizeOptionalString(data.type) || DEFAULT_POST_TYPE,
  };
};

const validatePostUpdate = (data) => {
  const payload = {};
  if (data.content !== undefined) payload.content = sanitizeString(data.content);
  if (data.playlist_id !== undefined) payload.playlist_id = sanitizeOptionalString(data.playlist_id) || null;
  if (data.type !== undefined) payload.type = sanitizeOptionalString(data.type) || DEFAULT_POST_TYPE;
  return payload;
};

module.exports = {
  validatePostCreate,
  validatePostUpdate,
};
