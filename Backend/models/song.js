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
    return { id: songId, ...song };
  }

  static async findById(id) {
    const song = await RealtimeDBHelpers.getDocumentById(COLLECTIONS.SONGS, id);
    if (!song) return null;
    // id가 누락되어 있으면 추가
    return { id, ...song };
  }

  static async findBySpotifyId(spotifyId) {
    const songs = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SONGS, 'spotify_id', spotifyId);
    if (songs.length > 0) {
        const song = songs[0];
        return { id: song.id, ...song };
    }
    return null;
  }

  static async findOrCreate(songData) {
    const { spotify_id } = songData;
    let existingSong = await this.findBySpotifyId(spotify_id);
    if (existingSong) {
        return existingSong;
    }
    const newSong = await this.create(songData);
    return await this.findById(newSong.id);
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

  // 곡 검색
  static async searchSongs(query, limit = 10) {
    const allSongs = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.SONGS);
    
    // 클라이언트 사이드 필터링
    const filteredSongs = allSongs.filter(song => 
      (song.title && song.title.toLowerCase().includes(query.toLowerCase())) ||
      (song.artist && song.artist.toLowerCase().includes(query.toLowerCase())) ||
      (song.album && song.album.toLowerCase().includes(query.toLowerCase()))
    );
    
    return filteredSongs.slice(0, limit);
  }

  // 특정 플레이리스트의 곡들 조회
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
    
    // position 순으로 정렬
    return songs.sort((a, b) => a.position - b.position);
  }
}

module.exports = Song;