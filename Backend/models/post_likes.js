const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');

class PostLike {
  static async create(postLikeData) {
    const { user_id, post_id } = postLikeData;
    
    const postLike = {
      user_id,
      post_id,
      liked_at: Date.now()
    };
    
    const postLikeId = await RealtimeDBHelpers.createDocument(COLLECTIONS.POST_LIKES, postLike);
    return postLikeId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.POST_LIKES, id);
  }

  static async findByUserId(userId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.POST_LIKES, 'user_id', userId);
  }

  static async findByPostId(postId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.POST_LIKES, 'post_id', postId);
  }

  static async findByUserAndPost(userId, postId) {
    const allPostLikes = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.POST_LIKES);
    const match = allPostLikes.find(pl => 
      pl.user_id === userId && pl.post_id === postId
    );
    return match || null;
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.POST_LIKES, id);
  }

  static async deleteByUserAndPost(userId, postId) {
    const postLike = await this.findByUserAndPost(userId, postId);
    if (postLike) {
      await this.delete(postLike.id);
      return true;
    }
    return false;
  }

  static async deleteByPostId(postId) {
    const postLikes = await this.findByPostId(postId);
    for (const postLike of postLikes) {
      await this.delete(postLike.id);
    }
  }

  static async isLiked(userId, postId) {
    const liked = await this.findByUserAndPost(userId, postId);
    return liked !== null;
  }

  static async getLikeCount(postId) {
    const likes = await this.findByPostId(postId);
    return likes.length;
  }

  static async toggle(userId, postId) {
    const existing = await this.findByUserAndPost(userId, postId);

    if (existing) {
      await this.delete(existing.id);
      return { action: 'unliked', liked: false };
    } else {
      await this.create({ user_id: userId, post_id: postId });
      return { action: 'liked', liked: true };
    }
  }
}

module.exports = PostLike;
