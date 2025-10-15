const { ensureRequiredFields, sanitizeString, sanitizeOptionalString, coerceNumber } = require('./common');

const validateSongCreate = (data) => {
  ensureRequiredFields(data, ['spotify_id', 'title', 'artist'], '곡 정보');
  return {
    spotify_id: sanitizeString(data.spotify_id).toLowerCase(),
    title: sanitizeString(data.title),
    artist: sanitizeString(data.artist),
    album: sanitizeOptionalString(data.album) || null,
    album_cover_url: sanitizeOptionalString(data.album_cover_url) || null,
    preview_url: sanitizeOptionalString(data.preview_url) || null,
    duration_ms: coerceNumber(data.duration_ms, null),
    external_urls: data.external_urls || null,
  };
};

const validateSongUpdate = (data) => {
  const payload = {};
  if (data.title !== undefined) payload.title = sanitizeString(data.title);
  if (data.artist !== undefined) payload.artist = sanitizeString(data.artist);
  if (data.album !== undefined) payload.album = sanitizeOptionalString(data.album) || null;
  if (data.album_cover_url !== undefined) payload.album_cover_url = sanitizeOptionalString(data.album_cover_url) || null;
  if (data.preview_url !== undefined) payload.preview_url = sanitizeOptionalString(data.preview_url) || null;
  if (data.duration_ms !== undefined) payload.duration_ms = coerceNumber(data.duration_ms, null);
  if (data.external_urls !== undefined) payload.external_urls = data.external_urls || null;
  return payload;
};

module.exports = {
  validateSongCreate,
  validateSongUpdate,
};
