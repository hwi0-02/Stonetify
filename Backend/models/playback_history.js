// Firebase-based playback history logging
const { COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const { playbackHistory: playbackValidators } = require('../utils/validators');
const { buildUpdatePayload } = require('../utils/modelUtils');

/**
 * Playback history records for analytics & recommendations
 * Shape: {
 *  id, user_id, track_id, track_uri, track_name, artist_name,
 *  playback_source: 'spotify_full',
 *  started_at: number (ms epoch),
 *  ended_at: number|null,
 *  duration_played_ms: number|null,
 *  completed: boolean,
 *  created_at, updated_at
 * }
 */
class PlaybackHistoryModel {
  static async createStart({ userId, track, playbackSource }) {
    const payload = playbackValidators.validatePlaybackStart({ userId, track, playbackSource });
    const now = Date.now();
    return await RealtimeDBHelpers.createDocument(COLLECTIONS.PLAYBACK_HISTORY, {
      ...payload,
      started_at: now,
      ended_at: null,
      duration_played_ms: null,
      completed: false,
      created_at: now,
      updated_at: now,
    });
  }

  static async complete(id, { positionMs, durationMs }) {
    if (!id) return;
    const current = await RealtimeDBHelpers.getDocumentById(COLLECTIONS.PLAYBACK_HISTORY, id);
    if (!current) return;
    const sanitized = playbackValidators.validatePlaybackComplete({ positionMs, durationMs });
    const now = Date.now();
    const played = Math.min(sanitized.positionMs ?? 0, sanitized.durationMs || sanitized.positionMs || 0);
    const completed = sanitized.durationMs ? (played >= (sanitized.durationMs - 1000)) : Boolean(sanitized.completed);
    const payload = buildUpdatePayload(current, {
      ended_at: now,
      duration_played_ms: played,
      completed,
    });
    if (!Object.keys(payload).length) {
      return;
    }
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.PLAYBACK_HISTORY, id, payload);
  }
}

module.exports = PlaybackHistoryModel;
