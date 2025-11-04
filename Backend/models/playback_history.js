const { COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');

class PlaybackHistoryModel {
  static async createStart({ userId, track, playbackSource }) {
    const now = Date.now();
    return await RealtimeDBHelpers.createDocument(COLLECTIONS.PLAYBACK_HISTORY, {
      user_id: userId,
      track_id: track.id,
      track_uri: track.uri || `spotify:track:${track.id}`,
      track_name: track.name,
      artist_name: Array.isArray(track.artists) ? track.artists.join(', ') : track.artists,
      playback_source: playbackSource || 'spotify_full',
      started_at: now,
      ended_at: null,
      duration_played_ms: null,
      completed: false,
      created_at: now,
      updated_at: now
    });
  }

  static async complete(id, { positionMs, durationMs }) {
    if (!id) return;
    const now = Date.now();
    const played = Math.min(positionMs, durationMs || positionMs);
    const completed = durationMs ? (played >= (durationMs - 1000)) : false;
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.PLAYBACK_HISTORY, id, {
      ended_at: now,
      duration_played_ms: played,
      completed,
      updated_at: now
    });
  }

  static async findByUserId(userId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYBACK_HISTORY, 'user_id', userId);
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.PLAYBACK_HISTORY, id);
  }

  static async findByUserId(userId, { limit = 50 } = {}) {
    if (!userId) return [];

    const records = await RealtimeDBHelpers.queryDocuments(
      COLLECTIONS.PLAYBACK_HISTORY,
      'user_id',
      userId
    );

    if (!records || records.length === 0) {
      return [];
    }

    const normalizedTimestamp = (record) =>
      record.started_at || record.created_at || record.updated_at || null;

    const sorted = records
      .map((record) => ({
        ...record,
        played_at: normalizedTimestamp(record),
      }))
      .sort((a, b) => (b.played_at || 0) - (a.played_at || 0));

    return typeof limit === 'number' && limit > 0 ? sorted.slice(0, limit) : sorted;
  }
}

module.exports = PlaybackHistoryModel;
