const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');

class Follow {
  static async create(followData) {
    const { follower_id, following_id } = followData;
    
    const follow = {
      follower_id,
      following_id,
      followed_at: Date.now()
    };
    
    const followId = await RealtimeDBHelpers.createDocument(COLLECTIONS.FOLLOWS, follow);
    return followId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.FOLLOWS, id);
  }

  static async findByFollowerId(followerId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.FOLLOWS, 'follower_id', followerId);
  }

  static async findByFollowingId(followingId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.FOLLOWS, 'following_id', followingId);
  }

  static async findByFollowerAndFollowing(followerId, followingId) {
    const allFollows = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.FOLLOWS);
    const match = allFollows.find(f => 
      f.follower_id === followerId && f.following_id === followingId
    );
    return match || null;
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.FOLLOWS, id);
  }

  static async deleteByFollowerAndFollowing(followerId, followingId) {
    const follow = await this.findByFollowerAndFollowing(followerId, followingId);
    if (follow) {
      await this.delete(follow.id);
      return true;
    }
    return false;
  }

  // 팔로우 여부 확인
  static async isFollowing(followerId, followingId) {
    const follow = await this.findByFollowerAndFollowing(followerId, followingId);
    return follow !== null;
  }

  // 팔로워 수 
  static async getFollowerCount(userId) {
    const followers = await this.findByFollowingId(userId);
    return followers.length;
  }

  // 팔로잉 수
  static async getFollowingCount(userId) {
    const following = await this.findByFollowerId(userId);
    return following.length;
  }

  // 팔로우 토글 (있으면 언팔로우, 없으면 팔로우)
  static async toggle(followerId, followingId) {
    const existing = await this.findByFollowerAndFollowing(followerId, followingId);
    
    if (existing) {
      await this.delete(existing.id);
      return { action: 'unfollowed', following: false };
    } else {
      await this.create({ follower_id: followerId, following_id: followingId });
      return { action: 'followed', following: true };
    }
  }

  // 사용자의 팔로워 목록
  static async getFollowers(userId) {
    return await this.findByFollowingId(userId);
  }

  // 사용자의 팔로잉 목록
  static async getFollowing(userId) {
    return await this.findByFollowerId(userId);
  }
}

module.exports = Follow;
