const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');

class ShareLink {
  static async create(shareLinkData) {
    const { playlist_id, user_id, share_token, expires_at } = shareLinkData;
    
    const shareLink = {
      playlist_id,
      user_id,
      share_token,
      expires_at: expires_at || null,
      created_at: Date.now(),
      view_count: 0,
      is_active: true
    };
    
    const shareLinkId = await RealtimeDBHelpers.createDocument(COLLECTIONS.SHARE_LINKS, shareLink);
    return shareLinkId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.SHARE_LINKS, id);
  }

  static async findByToken(token) {
    const allShareLinks = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.SHARE_LINKS);
    const match = allShareLinks.find(sl => sl.share_token === token);
    return match || null;
  }

  static async findByPlaylistId(playlistId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SHARE_LINKS, 'playlist_id', playlistId);
  }

  static async findByUserId(userId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SHARE_LINKS, 'user_id', userId);
  }

  static async findActiveByPlaylistId(playlistId) {
    const shareLinks = await this.findByPlaylistId(playlistId);
    return shareLinks.filter(link => 
      link.is_active && 
      (!link.expires_at || link.expires_at > Date.now())
    );
  }

  static async update(id, updateData) {
    const newData = {
      ...updateData,
      updated_at: Date.now()
    };
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.SHARE_LINKS, id, newData);
    return await this.findById(id);
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.SHARE_LINKS, id);
  }

  static async deleteByPlaylistId(playlistId) {
    const shareLinks = await this.findByPlaylistId(playlistId);
    for (const shareLink of shareLinks) {
      await this.delete(shareLink.id);
    }
  }

  static async deactivate(id) {
    await this.update(id, { is_active: false });
  }

  static async findAndIncrementViews(token) {
    const shareLink = await this.findByToken(token);

    if (!shareLink) {
      return null;
    }

    if (!shareLink.is_active || (shareLink.expires_at && shareLink.expires_at < Date.now())) {
      return null;
    }

    await this.update(shareLink.id, {
      view_count: (shareLink.view_count || 0) + 1
    });

    return await this.findById(shareLink.id);
  }

  static async cleanupExpiredLinks() {
    const allShareLinks = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.SHARE_LINKS);
    const now = Date.now();

    const expiredLinks = allShareLinks.filter(link =>
      link.expires_at && link.expires_at < now
    );

    for (const link of expiredLinks) {
      await this.delete(link.id);
    }

    return expiredLinks.length;
  }

  static generateToken() {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  static async findOrCreateForPlaylist(playlistId, userId, expiresInDays = null) {
    const activeLinks = await this.findActiveByPlaylistId(playlistId);

    if (activeLinks.length > 0) {
      return activeLinks[0];
    }

    const token = this.generateToken();
    const expiresAt = expiresInDays ? Date.now() + (expiresInDays * 24 * 60 * 60 * 1000) : null;

    const shareLinkId = await this.create({
      playlist_id: playlistId,
      user_id: userId,
      share_token: token,
      expires_at: expiresAt
    });

    return await this.findById(shareLinkId);
  }
}

module.exports = ShareLink;
