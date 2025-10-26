const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');

class Playlist {
  static async create(playlistData) {
    const { user_id, title, description, is_public } = playlistData;
    
    const playlist = {
      user_id,
      title,
      description: description || '',
      is_public: is_public !== undefined ? is_public : true,
      created_at: Date.now(),
      updated_at: Date.now()
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
    const updateData = {
      ...playlistData,
      updated_at: Date.now()
    };
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.PLAYLISTS, id, updateData);
    return await this.findById(id);
  }

  // ❗ [수정됨] 안정성을 높인 삭제 로직
  static async delete(id) {
    console.log(`[DB Model] Playlist.delete 호출됨: ${id}`);
    try {
        // 1. 삭제할 모든 관련 데이터를 먼저 조회합니다.
        const playlistSongsQuery = RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLIST_SONGS, 'playlist_id', id);
        const likesQuery = RealtimeDBHelpers.queryDocuments(COLLECTIONS.LIKED_PLAYLISTS, 'playlist_id', id);
        
        const [playlistSongs, likes] = await Promise.all([playlistSongsQuery, likesQuery]);

        console.log(`[DB Model] 삭제 대상: ${playlistSongs.length}곡, ${likes.length}개의 좋아요`);

        // 2. 모든 삭제 작업을 Promise 배열에 담습니다.
        const deletionPromises = [];

        // 관련 playlist_songs 삭제 프로미스 추가
        playlistSongs.forEach(song => {
            deletionPromises.push(RealtimeDBHelpers.deleteDocument(COLLECTIONS.PLAYLIST_SONGS, song.id));
        });

        // 관련 likes 삭제 프로미스 추가
        likes.forEach(like => {
            deletionPromises.push(RealtimeDBHelpers.deleteDocument(COLLECTIONS.LIKED_PLAYLISTS, like.id));
        });

        // 마지막으로 플레이리스트 본체 삭제 프로미스 추가
        deletionPromises.push(RealtimeDBHelpers.deleteDocument(COLLECTIONS.PLAYLISTS, id));

        // 3. 모든 삭제 작업을 병렬로 실행합니다.
        await Promise.all(deletionPromises);
        console.log(`[DB Model] 플레이리스트 ${id} 및 관련 데이터 모두 삭제 완료`);

    } catch (error) {
        console.error(`[DB Model] 플레이리스트 ${id} 및 관련 데이터 삭제 중 심각한 오류 발생:`, error);
        // 오류를 상위로 전파하여 컨트롤러에서 처리하도록 합니다.
        throw new Error('데이터베이스에서 플레이리스트 관련 항목들을 삭제하는 데 실패했습니다.');
    }
  }

  // 플레이리스트 검색
  static async searchPlaylists(query, limit = 10) {
    const allPlaylists = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLISTS, 'is_public', true);
    
    // 클라이언트 사이드 필터링 (제목과 설명)
    const filteredPlaylists = allPlaylists.filter(playlist => 
      (playlist.title && playlist.title.toLowerCase().includes(query.toLowerCase())) ||
      (playlist.description && playlist.description.toLowerCase().includes(query.toLowerCase()))
    );
    
    return filteredPlaylists.slice(0, limit);
  }

  // 플레이리스트의 곡 개수
  static async getSongCount(playlistId) {
    const songs = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLIST_SONGS, 'playlist_id', playlistId);
    return songs.length;
  }
}

module.exports = Playlist;