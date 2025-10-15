const { COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const { playlistSong: playlistSongValidators } = require('../utils/validators');
const { buildUpdatePayload } = require('../utils/modelUtils');

class PlaylistSongs {
  static async create(playlistSongsData) {
    const payload = playlistSongValidators.validatePlaylistSongCreate(playlistSongsData);
    const playlistSongId = await RealtimeDBHelpers.createDocument(COLLECTIONS.PLAYLIST_SONGS, payload);
    return playlistSongId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.PLAYLIST_SONGS, id);
  }

  static async findByPlaylistId(playlistId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLIST_SONGS, 'playlist_id', playlistId);
  }

  static async findBySongId(songId) {
    return await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLIST_SONGS, 'song_id', songId);
  }

  static async findByPlaylistAndSong(playlistId, songId) {
    const matches = await RealtimeDBHelpers.queryDocumentsMultiple(COLLECTIONS.PLAYLIST_SONGS, [
      { field: 'playlist_id', operator: '==', value: playlistId },
      { field: 'song_id', operator: '==', value: songId },
    ]);
    return matches[0] || null;
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.PLAYLIST_SONGS, id);
  }

  static async deleteByPlaylistAndSong(playlistId, songId) {
    const playlistSong = await this.findByPlaylistAndSong(playlistId, songId);
    if (playlistSong) {
      await this.delete(playlistSong.id);
      return true;
    }
    return false;
  }

  static async deleteByPlaylistId(playlistId) {
    const playlistSongs = await this.findByPlaylistId(playlistId);
    for (const playlistSong of playlistSongs) {
      await this.delete(playlistSong.id);
    }
  }

  static async update(id, updateData) {
    const current = await this.findById(id);
    if (!current) return null;
    const sanitized = playlistSongValidators.validatePlaylistSongUpdate(updateData);
    const payload = buildUpdatePayload(current, sanitized);
    if (!Object.keys(payload).length) {
      return current;
    }
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.PLAYLIST_SONGS, id, payload);
    return await this.findById(id);
  }

  // 플레이리스트의 곡들을 position 순으로 정렬해서 가져오기
  static async findByPlaylistIdSorted(playlistId) {
    const songs = await this.findByPlaylistId(playlistId);
    return songs.sort((a, b) => (a.position || 0) - (b.position || 0));
  }

  // 새 곡을 플레이리스트 맨 끝에 추가
  static async addToPlaylist(playlistId, songId) {
    const existingSongs = await this.findByPlaylistId(playlistId);
    const maxPosition = existingSongs.length > 0 
      ? Math.max(...existingSongs.map(s => s.position || 0))
      : -1;

    return await this.create({
      playlist_id: playlistId,
      song_id: songId,
      position: maxPosition + 1
    });
  }
}

module.exports = PlaylistSongs;