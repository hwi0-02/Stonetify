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

  static async isFollowing(followerId, followingId) {
    const follow = await this.findByFollowerAndFollowing(followerId, followingId);
    return follow !== null;
  }

  static async getFollowerCount(userId) {
    const followers = await this.findByFollowingId(userId);
    return followers.length;
  }

  static async getFollowingCount(userId) {
    const following = await this.findByFollowerId(userId);
    return following.length;
  }

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

  static async getFollowers(userId) {
    return await this.findByFollowingId(userId);
  }

  static async getFollowing(userId) {
    return await this.findByFollowerId(userId);
  }
}

module.exports = Follow;
