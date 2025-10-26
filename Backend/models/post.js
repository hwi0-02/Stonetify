const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');

class Post {
  static async create(postData) {
    const { user_id, content, playlist_id, type = 'text' } = postData;
    
    const post = {
      user_id,
      content,
      playlist_id: playlist_id || null,
      type,
      created_at: Date.now(),
      updated_at: Date.now()
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
    const updateData = {
      ...postData,
      updated_at: Date.now()
    };
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.POSTS, id, updateData);
    return await this.findById(id);
  }

  static async delete(id) {
    console.log('Post.delete 호출됨:', id);
    
    // 게시물 삭제
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.POSTS, id);
    console.log('게시물 삭제 완료');
    
    // 관련 좋아요 삭제
    console.log('게시물 좋아요 삭제 중...');
    const postLikes = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.POST_LIKES, 'post_id', id);
    console.log('삭제할 좋아요 개수:', postLikes.length);
    for (const like of postLikes) {
      await RealtimeDBHelpers.deleteDocument(COLLECTIONS.POST_LIKES, like.id);
    }
    console.log('게시물 좋아요 삭제 완료');
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
    
    const filteredPosts = allPosts.filter(post => 
      post.content && post.content.toLowerCase().includes(query.toLowerCase())
    );
    
    return filteredPosts.slice(0, limit);
  }
}

module.exports = Post;
