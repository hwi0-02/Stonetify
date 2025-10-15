const { COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const { songLike: songLikeValidators } = require('../utils/validators');

class SongLike {
  static async create({ user_id, song_id }) {
    const payload = songLikeValidators.validateSongLikeCreate({ user_id, song_id });
    const now = Date.now();
    const like = {
      ...payload,
      liked_at: payload.liked_at || now,
      created_at: now,
      updated_at: now,
    };
    const id = await RealtimeDBHelpers.createDocument(COLLECTIONS.SONG_LIKES, like);
    return id;
  }

  static async findByUserAndSong(userId, songId) {
    const matches = await RealtimeDBHelpers.queryDocumentsMultiple(COLLECTIONS.SONG_LIKES, [
      { field: 'user_id', operator: '==', value: userId },
      { field: 'song_id', operator: '==', value: songId },
    ]);
    return matches[0] || null;
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.SONG_LIKES, id);
  }

  static async toggle(userId, songId) {
    const existing = await this.findByUserAndSong(userId, songId);
    if (existing) {
      await this.delete(existing.id);
      return { liked: false };
    }
    await this.create({ user_id: userId, song_id: songId });
    return { liked: true };
  }

  static async findByUserId(userId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SONG_LIKES, 'user_id', userId);
  }
}

module.exports = SongLike;