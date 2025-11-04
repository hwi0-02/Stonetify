const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');

class PlaylistSongs {
  static async create(playlistSongsData) {
    const { playlist_id, song_id, position } = playlistSongsData;
    
    const playlistSong = {
      playlist_id,
      song_id,
      position: position !== undefined ? position : 0,
      added_at: Date.now()
    };
    
    const playlistSongId = await RealtimeDBHelpers.createDocument(COLLECTIONS.PLAYLIST_SONGS, playlistSong);
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
    const allPlaylistSongs = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.PLAYLIST_SONGS);
    const match = allPlaylistSongs.find(ps => 
      ps.playlist_id === playlistId && ps.song_id === songId
    );
    return match || null;
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
    const newData = {
      ...updateData,
      updated_at: Date.now()
    };
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.PLAYLIST_SONGS, id, newData);
    return await this.findById(id);
  }

  static async findByPlaylistIdSorted(playlistId) {
    const songs = await this.findByPlaylistId(playlistId);
    return songs.sort((a, b) => (a.position || 0) - (b.position || 0));
  }

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