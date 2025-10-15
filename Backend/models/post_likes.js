const { COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const { postLike: postLikeValidators } = require('../utils/validators');

class PostLike {
  static async create(postLikeData) {
    const payload = postLikeValidators.validatePostLikeCreate(postLikeData);
    const now = Date.now();
    const postLike = {
      ...payload,
      liked_at: payload.liked_at || now,
      created_at: now,
      updated_at: now,
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
    const matches = await RealtimeDBHelpers.queryDocumentsMultiple(COLLECTIONS.POST_LIKES, [
      { field: 'user_id', operator: '==', value: userId },
      { field: 'post_id', operator: '==', value: postId },
    ]);
    return matches[0] || null;
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

  // 사용자가 좋아요한 게시물인지 확인
  static async isLiked(userId, postId) {
    const liked = await this.findByUserAndPost(userId, postId);
    return liked !== null;
  }

  // 게시물의 총 좋아요 수
  static async getLikeCount(postId) {
    const likes = await this.findByPostId(postId);
    return likes.length;
  }

  // 좋아요 토글 (있으면 삭제, 없으면 생성)
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
