const { COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');

class SavedPost {
  static async create(savedPostData) {
    const { user_id, post_id } = savedPostData;
    const savedPost = {
      user_id,
      post_id,
      saved_at: Date.now(),
    };

    return await RealtimeDBHelpers.createDocument(COLLECTIONS.SAVED_POSTS, savedPost);
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.SAVED_POSTS, id);
  }

  static async findByUserAndPost(userId, postId) {
    const allSaved = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.SAVED_POSTS);
    return allSaved.find(entry => entry.user_id === userId && entry.post_id === postId) || null;
  }

  static async findByUserId(userId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SAVED_POSTS, 'user_id', userId);
  }

  static async findByPostId(postId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SAVED_POSTS, 'post_id', postId);
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.SAVED_POSTS, id);
  }

  static async toggle(userId, postId) {
    const existing = await this.findByUserAndPost(userId, postId);

    if (existing) {
      await this.delete(existing.id);
      return { saved: false };
    }

    await this.create({ user_id: userId, post_id: postId });
    return { saved: true };
  }
}

module.exports = SavedPost;
