const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');

class SongLike {
  static async create({ user_id, song_id }) {
    const like = { user_id, song_id, liked_at: Date.now() };
    const id = await RealtimeDBHelpers.createDocument(COLLECTIONS.SONG_LIKES, like);
    return id;
  }

  static async findByUserAndSong(userId, songId) {
    const all = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.SONG_LIKES);
    return all.find(l => l.user_id === userId && l.song_id === songId) || null;
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
    const all = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.SONG_LIKES);
    return all.filter(l => l.user_id === userId);
  }
}

module.exports = SongLike;