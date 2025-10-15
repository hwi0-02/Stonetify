const { ensureRequiredFields, sanitizeString, sanitizeOptionalString, coerceNumber, coerceBoolean } = require('./common');

const validateShareLinkCreate = (data) => {
  ensureRequiredFields(data, ['playlist_id', 'user_id', 'share_token'], '공유 링크');
  return {
    playlist_id: sanitizeString(data.playlist_id),
    user_id: sanitizeString(data.user_id),
    share_token: sanitizeString(data.share_token),
    expires_at: data.expires_at ? coerceNumber(data.expires_at, null) : null,
    view_count: coerceNumber(data.view_count, 0),
    is_active: coerceBoolean(data.is_active, true),
  };
};

const validateShareLinkUpdate = (data) => {
  const payload = {};
  if (data.expires_at !== undefined) payload.expires_at = coerceNumber(data.expires_at, null);
  if (data.view_count !== undefined) payload.view_count = coerceNumber(data.view_count, 0);
  if (data.is_active !== undefined) payload.is_active = coerceBoolean(data.is_active, true);
  return payload;
};

module.exports = {
  validateShareLinkCreate,
  validateShareLinkUpdate,
};
