const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');

class Recommendation {
  static async create(recommendationData) {
    const { user_id, recommended_playlist_id, reason, score } = recommendationData;
    
    const recommendation = {
      user_id,
      recommended_playlist_id,
      reason: reason || 'Based on your listening history',
      score: score || 0.5,
      created_at: Date.now(),
      viewed: false
    };
    
    const recommendationId = await RealtimeDBHelpers.createDocument(COLLECTIONS.RECOMMENDATIONS, recommendation);
    return recommendationId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.RECOMMENDATIONS, id);
  }

  static async findByUserId(userId, limit = 10) {
    const allRecommendations = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.RECOMMENDATIONS, 'user_id', userId);
    
    // 점수 순으로 정렬해서 반환
    return allRecommendations
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);
  }

  static async findByPlaylistId(playlistId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.RECOMMENDATIONS, 'recommended_playlist_id', playlistId);
  }

  static async findUnviewedByUserId(userId, limit = 10) {
    const allRecommendations = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.RECOMMENDATIONS, 'user_id', userId);
    
    const unviewed = allRecommendations.filter(rec => !rec.viewed);
    
    return unviewed
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);
  }

  static async update(id, updateData) {
    const newData = {
      ...updateData,
      updated_at: Date.now()
    };
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.RECOMMENDATIONS, id, newData);
    return await this.findById(id);
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.RECOMMENDATIONS, id);
  }

  static async deleteByPlaylistId(playlistId) {
    const recommendations = await this.findByPlaylistId(playlistId);
    for (const recommendation of recommendations) {
      await this.delete(recommendation.id);
    }
  }

  // 추천을 확인함으로 표시
  static async markAsViewed(id) {
    await this.update(id, { viewed: true });
  }

  // 사용자의 추천 중복 확인
  static async findExisting(userId, playlistId) {
    const allRecommendations = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.RECOMMENDATIONS);
    const match = allRecommendations.find(rec => 
      rec.user_id === userId && rec.recommended_playlist_id === playlistId
    );
    return match || null;
  }

  // 중복되지 않은 추천만 생성
  static async createIfNotExists(recommendationData) {
    const { user_id, recommended_playlist_id } = recommendationData;
    
    const existing = await this.findExisting(user_id, recommended_playlist_id);
    if (existing) {
      return existing.id;
    }
    
    return await this.create(recommendationData);
  }

  // 오래된 추천 정리 (예: 30일 이상 된 것들)
  static async cleanupOldRecommendations(daysOld = 30) {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const allRecommendations = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.RECOMMENDATIONS);
    
    const oldRecommendations = allRecommendations.filter(rec => 
      (rec.created_at || 0) < cutoffTime
    );
    
    for (const recommendation of oldRecommendations) {
      await this.delete(recommendation.id);
    }
    
    return oldRecommendations.length;
  }
}

module.exports = Recommendation;