const { ensureRequiredFields, sanitizeString, sanitizeOptionalString, coerceNumber, coerceBoolean } = require('./common');

const validatePlaybackStart = (data) => {
  ensureRequiredFields(data, ['userId', 'track'], '재생 기록');
  const track = data.track || {};
  ensureRequiredFields(track, ['id', 'name'], '트랙 정보');
  return {
    user_id: sanitizeString(data.userId),
    track_id: sanitizeString(track.id),
    track_uri: sanitizeOptionalString(track.uri) || `spotify:track:${track.id}`,
    track_name: sanitizeString(track.name),
    artist_name: Array.isArray(track.artists)
      ? track.artists.map((artist) => sanitizeString(artist)).filter(Boolean).join(', ')
      : sanitizeOptionalString(track.artists) || '',
    playback_source: sanitizeOptionalString(data.playbackSource) || 'spotify_full',
  };
};

const validatePlaybackComplete = (data) => {
  const payload = {};
  if (data.positionMs !== undefined) payload.positionMs = coerceNumber(data.positionMs, 0) || 0;
  if (data.durationMs !== undefined) payload.durationMs = coerceNumber(data.durationMs, null);
  if (data.completed !== undefined) payload.completed = coerceBoolean(data.completed, false);
  return payload;
};

module.exports = {
  validatePlaybackStart,
  validatePlaybackComplete,
};
