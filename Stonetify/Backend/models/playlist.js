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

  static async delete(id) {
    console.log('Playlist.delete 호출됨:', id);
    
    // 플레이리스트 삭제
    console.log('플레이리스트 삭제 중...');
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.PLAYLISTS, id);
    console.log('플레이리스트 삭제 완료');
    
    // 관련 playlist_songs도 삭제 (별도 처리 필요)
    console.log('관련 곡들 삭제 중...');
    const playlistSongs = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLIST_SONGS, 'playlist_id', id);
    console.log('삭제할 곡 개수:', playlistSongs.length);
    for (const song of playlistSongs) {
      await RealtimeDBHelpers.deleteDocument(COLLECTIONS.PLAYLIST_SONGS, song.id);
    }
    console.log('관련 곡들 삭제 완료');
    
    // 좋아요 삭제
    console.log('좋아요 삭제 중...');
    const likes = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.LIKED_PLAYLISTS, 'playlist_id', id);
    console.log('삭제할 좋아요 개수:', likes.length);
    for (const like of likes) {
      await RealtimeDBHelpers.deleteDocument(COLLECTIONS.LIKED_PLAYLISTS, like.id);
    }
    console.log('좋아요 삭제 완료');
    console.log('모든 삭제 작업 완료');
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