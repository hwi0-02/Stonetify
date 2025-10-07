// Firebase-based Spotify token persistence (replaces in-memory map)
const { COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const { encrypt, decrypt } = require('../utils/encryption');

/**
 * Stored shape (in DB): {
 *  id: <generated>,
 *  user_id: string,
 *  refresh_token_enc: string | null,
 *  scope: string,
 *  version: number,
 *  history: string[], // previous encrypted refresh tokens (bounded)
 *  revoked: boolean,
 *  updated_at: number,
 *  created_at: number,
 *  last_rotation_at: number,
 *  rotation_count_window: { count: number, window_start: number }
 * }
 */
class SpotifyTokenModel {
  static async getByUser(userId) {
    const docs = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SPOTIFY_TOKENS, 'user_id', userId);
    return docs && docs.length ? docs[0] : null;
  }

  static async upsertRefresh(userId, plainRefreshToken, scope, options = {}) {
    const existing = await this.getByUser(userId);
    const now = Date.now();
    const enc = plainRefreshToken ? encrypt(plainRefreshToken) : null;

    if (!existing) {
      await RealtimeDBHelpers.createDocument(COLLECTIONS.SPOTIFY_TOKENS, {
        user_id: userId,
        refresh_token_enc: enc,
        scope: scope || '',
        version: 1,
        history: [],
        revoked: false,
        created_at: now,
        updated_at: now,
        last_rotation_at: now,
        rotation_count_window: { count: 1, window_start: now }
      });
      return this.getByUser(userId);
    }

    // Rotation / history management
    const historyLimit = options.historyLimit || 5;
    const history = existing.refresh_token_enc ? [existing.refresh_token_enc, ...(existing.history || [])] : (existing.history || []);
    const boundedHistory = history.slice(0, historyLimit);

    // Rotation rate limiting
    const hourMs = 60 * 60 * 1000;
    let { rotation_count_window } = existing;
    if (!rotation_count_window) {
      rotation_count_window = { count: 0, window_start: now };
    } else if (now - rotation_count_window.window_start > hourMs) {
      rotation_count_window = { count: 0, window_start: now };
    }
    rotation_count_window.count += 1;
    const maxPerHour = options.maxPerHour || 12;
    if (rotation_count_window.count > maxPerHour) {
      throw new Error('Refresh token rotation rate exceeded');
    }

    await RealtimeDBHelpers.updateDocument(COLLECTIONS.SPOTIFY_TOKENS, existing.id, {
      refresh_token_enc: enc || existing.refresh_token_enc,
      scope: scope || existing.scope,
      version: (existing.version || 1) + (plainRefreshToken ? 1 : 0),
      history: boundedHistory,
      revoked: false,
      updated_at: now,
      last_rotation_at: now,
      rotation_count_window
    });

    return this.getByUser(userId);
  }

  static async revoke(userId) {
    const existing = await this.getByUser(userId);
    if (!existing) return;
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.SPOTIFY_TOKENS, existing.id, {
      revoked: true,
      refresh_token_enc: null,
      updated_at: Date.now()
    });
  }

  static decryptRefresh(record) {
    if (!record || !record.refresh_token_enc) return null;
    return decrypt(record.refresh_token_enc);
  }
}

module.exports = SpotifyTokenModel;
