const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');

class LikedPlaylist {
  static async create(likedPlaylistData) {
    const { user_id, playlist_id } = likedPlaylistData;
    
    const likedPlaylist = {
      user_id,
      playlist_id,
      liked_at: Date.now()
    };
    
    const likedPlaylistId = await RealtimeDBHelpers.createDocument(COLLECTIONS.LIKED_PLAYLISTS, likedPlaylist);
    return likedPlaylistId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.LIKED_PLAYLISTS, id);
  }

  static async findByUserId(userId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.LIKED_PLAYLISTS, 'user_id', userId);
  }

  static async findByPlaylistId(playlistId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.LIKED_PLAYLISTS, 'playlist_id', playlistId);
  }

  static async findByUserAndPlaylist(userId, playlistId) {
    const allLikedPlaylists = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.LIKED_PLAYLISTS);
    const match = allLikedPlaylists.find(lp => 
      lp.user_id === userId && lp.playlist_id === playlistId
    );
    return match || null;
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.LIKED_PLAYLISTS, id);
  }

  static async deleteByUserAndPlaylist(userId, playlistId) {
    const likedPlaylist = await this.findByUserAndPlaylist(userId, playlistId);
    if (likedPlaylist) {
      await this.delete(likedPlaylist.id);
      return true;
    }
    return false;
  }

  static async deleteByPlaylistId(playlistId) {
    const likedPlaylists = await this.findByPlaylistId(playlistId);
    for (const likedPlaylist of likedPlaylists) {
      await this.delete(likedPlaylist.id);
    }
  }

  static async isLiked(userId, playlistId) {
    const liked = await this.findByUserAndPlaylist(userId, playlistId);
    return liked !== null;
  }

  static async getLikeCount(playlistId) {
    const likes = await this.findByPlaylistId(playlistId);
    return likes.length;
  }

  static async toggle(userId, playlistId) {
    const existing = await this.findByUserAndPlaylist(userId, playlistId);

    if (existing) {
      await this.delete(existing.id);
      return { action: 'unliked', liked: false };
    } else {
      await this.create({ user_id: userId, playlist_id: playlistId });
      return { action: 'liked', liked: true };
    }
  }
}

module.exports = LikedPlaylist;