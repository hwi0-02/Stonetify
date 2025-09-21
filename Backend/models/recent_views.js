const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');

class RecentView {
  static async create(recentViewData) {
    const { user_id, playlist_id } = recentViewData;
    
    const recentView = {
      user_id,
      playlist_id,
      viewed_at: Date.now()
    };
    
    const recentViewId = await RealtimeDBHelpers.createDocument(COLLECTIONS.RECENT_VIEWS, recentView);
    return recentViewId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.RECENT_VIEWS, id);
  }

  static async findByUserId(userId, limit = 10) {
    const allViews = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.RECENT_VIEWS, 'user_id', userId);
    
    // 시간순으로 정렬해서 최신순으로 반환
    return allViews
      .sort((a, b) => (b.viewed_at || 0) - (a.viewed_at || 0))
      .slice(0, limit);
  }

  static async findByPlaylistId(playlistId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.RECENT_VIEWS, 'playlist_id', playlistId);
  }

  static async findByUserAndPlaylist(userId, playlistId) {
    const allViews = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.RECENT_VIEWS);
    const match = allViews.find(rv => 
      rv.user_id === userId && rv.playlist_id === playlistId
    );
    return match || null;
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.RECENT_VIEWS, id);
  }

  static async deleteByUserAndPlaylist(userId, playlistId) {
    const recentView = await this.findByUserAndPlaylist(userId, playlistId);
    if (recentView) {
      await this.delete(recentView.id);
      return true;
    }
    return false;
  }

  static async deleteByPlaylistId(playlistId) {
    const recentViews = await this.findByPlaylistId(playlistId);
    for (const recentView of recentViews) {
      await this.delete(recentView.id);
    }
  }

  // 사용자의 최근 본 플레이리스트 추가 또는 업데이트
  static async addOrUpdate(userId, playlistId) {
    // 기존 기록이 있는지 확인
    const existing = await this.findByUserAndPlaylist(userId, playlistId);
    
    if (existing) {
      // 기존 기록이 있으면 시간만 업데이트
      await RealtimeDBHelpers.updateDocument(COLLECTIONS.RECENT_VIEWS, existing.id, {
        viewed_at: Date.now()
      });
      return existing.id;
    } else {
      // 새로 생성
      return await this.create({ user_id: userId, playlist_id: playlistId });
    }
  }

  // 사용자의 최근 본 플레이리스트 개수 제한 (예: 최대 20개)
  static async limitUserViews(userId, maxViews = 20) {
    const userViews = await this.findByUserId(userId, 100); // 많이 가져온 후 제한
    
    if (userViews.length > maxViews) {
      const viewsToDelete = userViews.slice(maxViews);
      for (const view of viewsToDelete) {
        await this.delete(view.id);
      }
    }
  }

  // 플레이리스트 조회수
  static async getViewCount(playlistId) {
    const views = await this.findByPlaylistId(playlistId);
    return views.length;
  }
}

module.exports = RecentView;
