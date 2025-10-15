const { ensureRequiredFields, coerceNumber, sanitizeString } = require('./common');

const validatePlaylistSongCreate = (data) => {
  ensureRequiredFields(data, ['playlist_id', 'song_id'], '플레이리스트 곡');
  return {
    playlist_id: sanitizeString(data.playlist_id),
    song_id: sanitizeString(data.song_id),
    position: coerceNumber(data.position, 0),
    added_at: data.added_at || Date.now(),
  };
};

const validatePlaylistSongUpdate = (data) => {
  const payload = {};
  if (data.position !== undefined) {
    payload.position = coerceNumber(data.position, 0);
  }
  if (data.added_at !== undefined) {
    payload.added_at = Number(data.added_at) || Date.now();
  }
  return payload;
};

module.exports = {
  validatePlaylistSongCreate,
  validatePlaylistSongUpdate,
};
