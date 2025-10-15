const { COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const { savedPost: savedPostValidators } = require('../utils/validators');

class SavedPost {
  static async create(savedPostData) {
    const payload = savedPostValidators.validateSavedPostCreate(savedPostData);
    const now = Date.now();
    const savedPost = {
      ...payload,
      saved_at: payload.saved_at || now,
      created_at: now,
      updated_at: now,
    };
    return await RealtimeDBHelpers.createDocument(COLLECTIONS.SAVED_POSTS, savedPost);
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.SAVED_POSTS, id);
  }

  static async findByUserAndPost(userId, postId) {
    const matches = await RealtimeDBHelpers.queryDocumentsMultiple(COLLECTIONS.SAVED_POSTS, [
      { field: 'user_id', operator: '==', value: userId },
      { field: 'post_id', operator: '==', value: postId },
    ]);
    return matches[0] || null;
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
