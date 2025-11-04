const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');

class Song {
  static async create(songData) {
    const { spotify_id, title, artist, album, album_cover_url, preview_url, duration_ms, external_urls } = songData;
    
    const song = {
      spotify_id,
      title,
      artist,
      album,
      album_cover_url,
      preview_url,
      duration_ms: duration_ms || null,
      external_urls: external_urls || null,
      created_at: Date.now()
    };
    
    const songId = await RealtimeDBHelpers.createDocument(COLLECTIONS.SONGS, song);
    return songId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.SONGS, id);
  }

  static async findBySpotifyId(spotifyId) {
    const songs = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SONGS, 'spotify_id', spotifyId);
    return songs.length > 0 ? songs[0] : null;
  }

  static async findOrCreate(songData) {
    const { spotify_id } = songData;
    let existingSong = await this.findBySpotifyId(spotify_id);
    if (existingSong) {
      return existingSong;
    }
    const newSongId = await this.create(songData);
    return await this.findById(newSongId);
  }

  static async update(id, songData) {
    const updateData = {
      ...songData,
      updated_at: Date.now()
    };
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.SONGS, id, updateData);
    return await this.findById(id);
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.SONGS, id);
  }

  static async searchSongs(query, limit = 10) {
    const allSongs = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.SONGS);
    const filteredSongs = allSongs.filter(song =>
      (song.title && song.title.toLowerCase().includes(query.toLowerCase())) ||
      (song.artist && song.artist.toLowerCase().includes(query.toLowerCase())) ||
      (song.album && song.album.toLowerCase().includes(query.toLowerCase()))
    );
    return filteredSongs.slice(0, limit);
  }

  static async findByPlaylistId(playlistId) {
    const playlistSongs = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLIST_SONGS, 'playlist_id', playlistId);
    const songs = [];

    for (const playlistSong of playlistSongs) {
      const song = await this.findById(playlistSong.song_id);
      if (song) {
        songs.push({
          ...song,
          position: playlistSong.position,
          added_at: playlistSong.added_at
        });
      }
    }

    return songs.sort((a, b) => a.position - b.position);
  }
}

module.exports = Song;