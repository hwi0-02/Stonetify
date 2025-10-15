const { COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const { playlist: playlistValidators } = require('../utils/validators');
const { ApiError } = require('../utils/errors');
const { logger } = require('../utils/logger');

class Playlist {
  static async create(playlistData) {
    if (!playlistData.user_id) {
      throw ApiError.badRequest('플레이리스트를 생성하려면 사용자 ID가 필요합니다.');
    }
    const payload = playlistValidators.validatePlaylistCreate(playlistData);
    const now = Date.now();
    const titleLower = payload.title.toLowerCase();
    const descriptionValue = payload.description || '';
    const playlist = {
      user_id: playlistData.user_id,
      title: payload.title,
      title_lower: titleLower,
      description: descriptionValue,
      description_lower: descriptionValue.toLowerCase(),
      is_public: payload.is_public,
      created_at: now,
      updated_at: now,
    };

    const playlistId = await RealtimeDBHelpers.createDocument(COLLECTIONS.PLAYLISTS, playlist);
    return playlistId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.PLAYLISTS, id);
  }

  static async findByUserId(userId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLISTS, 'user_id', userId);
  }

  static async findPublicPlaylists(limit = 20) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLISTS, 'is_public', true);
  }

  static async update(id, playlistData) {
    const sanitized = playlistValidators.validatePlaylistUpdate(playlistData);
    const current = await this.findById(id);
    if (!current) {
      throw ApiError.notFound('플레이리스트를 찾을 수 없습니다.');
    }

    const updateData = {};
    if (sanitized.title !== undefined && sanitized.title !== current.title) {
      updateData.title = sanitized.title;
      updateData.title_lower = sanitized.title.toLowerCase();
    }
    if (sanitized.description !== undefined && sanitized.description !== current.description) {
      const desc = sanitized.description || '';
      updateData.description = desc;
      updateData.description_lower = desc.toLowerCase();
    }
    if (sanitized.is_public !== undefined && sanitized.is_public !== current.is_public) {
      updateData.is_public = sanitized.is_public;
    }

    if (!Object.keys(updateData).length) {
      return current;
    }

    updateData.updated_at = Date.now();
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.PLAYLISTS, id, updateData);
    return await this.findById(id);
  }

  // ❗ [수정됨] 안정성을 높인 삭제 로직
  static async delete(id) {
    logger.debug('Playlist delete requested', { playlistId: id });
    try {
      // 1. 삭제할 모든 관련 데이터를 먼저 조회합니다.
      const playlistSongsQuery = RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLIST_SONGS, 'playlist_id', id);
      const likesQuery = RealtimeDBHelpers.queryDocuments(COLLECTIONS.LIKED_PLAYLISTS, 'playlist_id', id);

      const [playlistSongs, likes] = await Promise.all([playlistSongsQuery, likesQuery]);

      logger.debug('Playlist delete related records fetched', {
        playlistId: id,
        songCount: playlistSongs.length,
        likeCount: likes.length,
      });

      // 2. 모든 삭제 작업을 Promise 배열에 담습니다.
      const deletionPromises = [];

      // 관련 playlist_songs 삭제 프로미스 추가
      playlistSongs.forEach((song) => {
        deletionPromises.push(RealtimeDBHelpers.deleteDocument(COLLECTIONS.PLAYLIST_SONGS, song.id));
      });

      // 관련 likes 삭제 프로미스 추가
      likes.forEach((like) => {
        deletionPromises.push(RealtimeDBHelpers.deleteDocument(COLLECTIONS.LIKED_PLAYLISTS, like.id));
      });

      // 마지막으로 플레이리스트 본체 삭제 프로미스 추가
      deletionPromises.push(RealtimeDBHelpers.deleteDocument(COLLECTIONS.PLAYLISTS, id));

      // 3. 모든 삭제 작업을 병렬로 실행합니다.
      await Promise.all(deletionPromises);
      logger.info('Playlist and related records deleted', { playlistId: id });
    } catch (error) {
      logger.error('Failed to delete playlist and related records', { playlistId: id, error });
      throw ApiError.dependency('플레이리스트를 삭제하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  // 플레이리스트 검색
  static async searchPlaylists(query, limit = 10) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    const [titleMatches, descriptionMatches] = await Promise.all([
      RealtimeDBHelpers.queryDocumentsByPrefix(COLLECTIONS.PLAYLISTS, 'title_lower', normalized, { limit }),
      RealtimeDBHelpers.queryDocumentsByPrefix(COLLECTIONS.PLAYLISTS, 'description_lower', normalized, { limit }),
    ]);

    const merged = [...titleMatches, ...descriptionMatches].filter((playlist) => playlist.is_public !== false);
    const deduped = [];
    const seen = new Set();
    for (const playlist of merged) {
      if (seen.has(playlist.id)) continue;
      seen.add(playlist.id);
      deduped.push(playlist);
      if (limit && deduped.length >= limit) break;
    }

    if (!limit || deduped.length < limit) {
      const remaining = limit ? limit - deduped.length : null;
      const fallback = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLISTS, 'is_public', true);
      for (const candidate of fallback) {
        if (seen.has(candidate.id)) continue;
        const titleMatch = candidate.title?.toLowerCase().includes(normalized);
        const descMatch = candidate.description?.toLowerCase().includes(normalized);
        if (!titleMatch && !descMatch) continue;
        deduped.push(candidate);
        seen.add(candidate.id);
        if (remaining && deduped.length >= limit) break;
      }
    }

    return deduped;
  }

  // 플레이리스트의 곡 개수
  static async getSongCount(playlistId) {
    const songs = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLIST_SONGS, 'playlist_id', playlistId);
    return songs.length;
  }
}

module.exports = Playlist;