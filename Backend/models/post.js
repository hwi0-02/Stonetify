const { COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const SavedPost = require('./saved_posts');
const { post: postValidators } = require('../utils/validators');
const { buildUpdatePayload } = require('../utils/modelUtils');

class Post {
  static async create(postData) {
    const payload = postValidators.validatePostCreate(postData);
    const now = Date.now();
    const post = {
      ...payload,
      created_at: now,
      updated_at: now,
    };
    const postId = await RealtimeDBHelpers.createDocument(COLLECTIONS.POSTS, post);
    return postId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.POSTS, id);
  }

  static async findByUserId(userId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.POSTS, 'user_id', userId);
  }

  static async findAll(limit = 50) {
    return await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.POSTS);
  }

  static async findByPlaylistId(playlistId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.POSTS, 'playlist_id', playlistId);
  }

  static async update(id, postData) {
    const current = await this.findById(id);
    if (!current) return null;
    const sanitized = postValidators.validatePostUpdate(postData);
    const payload = buildUpdatePayload(current, sanitized);
    if (!Object.keys(payload).length) {
      return current;
    }
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.POSTS, id, payload);
    return await this.findById(id);
  }

  static async delete(id) {
    // 게시물 삭제
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.POSTS, id);
    const postLikes = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.POST_LIKES, 'post_id', id);
    for (const like of postLikes) {
      await RealtimeDBHelpers.deleteDocument(COLLECTIONS.POST_LIKES, like.id);
    }
    const savedEntries = await SavedPost.findByPostId(id);
    for (const entry of savedEntries) {
      await SavedPost.delete(entry.id);
    }
  }

  // 최신 게시물부터 가져오기 (시간순 정렬)
  static async getRecentPosts(limit = 20) {
    const allPosts = await this.findAll();
    return allPosts
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, limit);
  }

  // 게시물 검색
  static async searchPosts(query, limit = 10) {
    const allPosts = await this.findAll();
    const normalized = query.toLowerCase();
    const filteredPosts = allPosts.filter(post => 
      post.content && post.content.toLowerCase().includes(normalized)
    );
    return filteredPosts.slice(0, limit);
  }
}

module.exports = Post;
