const { COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const { shareLink: shareLinkValidators } = require('../utils/validators');
const { buildUpdatePayload } = require('../utils/modelUtils');

class ShareLink {
  static async create(shareLinkData) {
    const payload = shareLinkValidators.validateShareLinkCreate(shareLinkData);
    const now = Date.now();
    const shareLink = {
      ...payload,
      created_at: now,
      updated_at: now,
    };
    const shareLinkId = await RealtimeDBHelpers.createDocument(COLLECTIONS.SHARE_LINKS, shareLink);
    return shareLinkId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.SHARE_LINKS, id);
  }

  static async findByToken(token) {
    const matches = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SHARE_LINKS, 'share_token', token);
    return matches[0] || null;
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
    const current = await this.findById(id);
    if (!current) return null;
    const sanitized = shareLinkValidators.validateShareLinkUpdate(updateData);
    const payload = buildUpdatePayload(current, sanitized);
    if (!Object.keys(payload).length) {
      return current;
    }
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.SHARE_LINKS, id, payload);
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

  // 공유 링크 비활성화
  static async deactivate(id) {
    await this.update(id, { is_active: false });
  }

  // 토큰으로 공유 링크 찾기 및 조회수 증가
  static async findAndIncrementViews(token) {
    const shareLink = await this.findByToken(token);
    
    if (!shareLink) {
      return null;
    }

    // 만료되었거나 비활성화된 링크인지 확인
    if (!shareLink.is_active || (shareLink.expires_at && shareLink.expires_at < Date.now())) {
      return null;
    }

    // 조회수 증가
    await this.update(shareLink.id, { 
      view_count: (shareLink.view_count || 0) + 1 
    });

    return await this.findById(shareLink.id);
  }

  // 만료된 공유 링크 정리
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

  // 고유한 토큰 생성
  static generateToken() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  // 플레이리스트의 활성 공유 링크 찾기 또는 생성
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
