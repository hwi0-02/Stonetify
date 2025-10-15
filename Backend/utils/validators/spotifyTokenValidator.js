const { ensureRequiredFields, sanitizeString, coerceNumber } = require('./common');

const validateSpotifyTokenCreate = (data) => {
  ensureRequiredFields(data, ['user_id', 'refresh_token_enc'], 'Spotify 토큰');
  return {
    user_id: sanitizeString(data.user_id),
    refresh_token_enc: sanitizeString(data.refresh_token_enc),
    scope: sanitizeString(data.scope || ''),
    version: coerceNumber(data.version, 1) || 1,
    revoked: Boolean(data.revoked),
    history: Array.isArray(data.history) ? data.history : [],
  };
};

module.exports = {
  validateSpotifyTokenCreate,
};
