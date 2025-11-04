const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const LikedPlaylist = require('./liked_playlists');

class Playlist {
  static async create(playlistData) {
    const { user_id, title, description, is_public, saved_from_playlist_id } = playlistData;
    
    const playlist = {
      user_id,
      title,
      description: description || '',
      is_public: is_public !== undefined ? is_public : true,
      saved_from_playlist_id: saved_from_playlist_id || null,
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
    console.log(`[DB Model] Playlist.delete 호출됨: ${id}`);
    try {
        const playlistSongsQuery = RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLIST_SONGS, 'playlist_id', id);
        const likesQuery = RealtimeDBHelpers.queryDocuments(COLLECTIONS.LIKED_PLAYLISTS, 'playlist_id', id);

        const [playlistSongs, likes] = await Promise.all([playlistSongsQuery, likesQuery]);

        console.log(`[DB Model] 삭제 대상: ${playlistSongs.length}곡, ${likes.length}개의 좋아요`);

        const deletionPromises = [];

        playlistSongs.forEach(song => {
            deletionPromises.push(RealtimeDBHelpers.deleteDocument(COLLECTIONS.PLAYLIST_SONGS, song.id));
        });

        likes.forEach(like => {
            deletionPromises.push(RealtimeDBHelpers.deleteDocument(COLLECTIONS.LIKED_PLAYLISTS, like.id));
        });

        deletionPromises.push(RealtimeDBHelpers.deleteDocument(COLLECTIONS.PLAYLISTS, id));

        await Promise.all(deletionPromises);
        console.log(`[DB Model] 플레이리스트 ${id} 및 관련 데이터 모두 삭제 완료`);

    } catch (error) {
        console.error(`[DB Model] 플레이리스트 ${id} 및 관련 데이터 삭제 중 심각한 오류 발생:`, error);
        throw new Error('데이터베이스에서 플레이리스트 관련 항목들을 삭제하는 데 실패했습니다.');
    }
  }

  static async searchPlaylists(query, limit = 10) {
    const allPlaylists = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLISTS, 'is_public', true);

    const filteredPlaylists = allPlaylists.filter(playlist =>
      (playlist.title && playlist.title.toLowerCase().includes(query.toLowerCase())) ||
      (playlist.description && playlist.description.toLowerCase().includes(query.toLowerCase()))
    );
    
    return filteredPlaylists.slice(0, limit);
  }

  static async getSongCount(playlistId) {
    const songs = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLIST_SONGS, 'playlist_id', playlistId);
    return songs.length;
  }

  static async findPopular(period = 'weekly', limit = 50) {
    const allPlaylists = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.PLAYLISTS);
    const allLikes = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.LIKED_PLAYLISTS);

    const now = Date.now();
    const periodMs = period === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const startTime = now - periodMs;

    const likeCounts = allLikes
      .filter(like => like.liked_at >= startTime)
      .reduce((acc, like) => {
        acc[like.playlist_id] = (acc[like.playlist_id] || 0) + 1;
        return acc;
      }, {});

    const popularPlaylists = allPlaylists
      .filter(p => p.is_public)
      .map(p => ({
        ...p,
        like_count: likeCounts[p.id] || 0
      }))
      .filter(p => p.like_count > 0)
      .sort((a, b) => b.like_count - a.like_count)
      .slice(0, limit);

    return popularPlaylists;
  }
}

module.exports = Playlist;
