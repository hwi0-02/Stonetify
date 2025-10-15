const { COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const { song: songValidators } = require('../utils/validators');
const { buildUpdatePayload } = require('../utils/modelUtils');

class Song {
  static async create(songData) {
    const payload = songValidators.validateSongCreate(songData);
    const titleLower = payload.title.toLowerCase();
    const artistLower = payload.artist.toLowerCase();
    const albumLower = (payload.album || '').toLowerCase();
    const songId = await RealtimeDBHelpers.createDocument(COLLECTIONS.SONGS, {
      ...payload,
      title_lower: titleLower,
      artist_lower: artistLower,
      album_lower: albumLower,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    return songId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.SONGS, id);
  }

  static async findBySpotifyId(spotifyId) {
    const songs = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SONGS, 'spotify_id', spotifyId?.toLowerCase());
    return songs.length > 0 ? songs[0] : null;
  }

  static async findOrCreate(songData) {
  const { spotify_id } = songData;
    
    // 먼저 기존 곡이 있는지 확인
    let existingSong = await this.findBySpotifyId(spotify_id);
    
    if (existingSong) {
      return existingSong;
    }
    
    // 없으면 새로 생성
    const newSongId = await this.create(songData);
    return await this.findById(newSongId);
  }

  static async update(id, songData) {
    const current = await this.findById(id);
    if (!current) return null;
    const sanitized = songValidators.validateSongUpdate(songData);
    if (sanitized.title !== undefined) {
      sanitized.title_lower = sanitized.title.toLowerCase();
    }
    if (sanitized.artist !== undefined) {
      sanitized.artist_lower = sanitized.artist.toLowerCase();
    }
    if (sanitized.album !== undefined) {
      const albumValue = sanitized.album || '';
      sanitized.album_lower = albumValue.toLowerCase();
    }
    const payload = buildUpdatePayload(current, sanitized);
    if (!Object.keys(payload).length) {
      return current;
    }
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.SONGS, id, payload);
    return await this.findById(id);
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.SONGS, id);
  }

  // 곡 검색
  static async searchSongs(query, limit = 10) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    const [titleMatches, artistMatches, albumMatches] = await Promise.all([
      RealtimeDBHelpers.queryDocumentsByPrefix(COLLECTIONS.SONGS, 'title_lower', normalized, { limit }),
      RealtimeDBHelpers.queryDocumentsByPrefix(COLLECTIONS.SONGS, 'artist_lower', normalized, { limit }),
      RealtimeDBHelpers.queryDocumentsByPrefix(COLLECTIONS.SONGS, 'album_lower', normalized, { limit }),
    ]);

    const merged = [...titleMatches, ...artistMatches, ...albumMatches];
    const deduped = [];
    const seen = new Set();
    for (const song of merged) {
      if (seen.has(song.id)) continue;
      seen.add(song.id);
      deduped.push(song);
      if (limit && deduped.length >= limit) break;
    }

      if (!limit || deduped.length < limit) {
        const remaining = limit ? limit - deduped.length : null;
        const fallback = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SONGS);
        for (const candidate of fallback) {
          if (seen.has(candidate.id)) continue;
          const titleMatch = candidate.title?.toLowerCase().includes(normalized);
          const artistMatch = candidate.artist?.toLowerCase().includes(normalized);
          const albumMatch = candidate.album?.toLowerCase().includes(normalized);
          if (!titleMatch && !artistMatch && !albumMatch) continue;
          deduped.push(candidate);
          seen.add(candidate.id);
          if (remaining && deduped.length >= limit) break;
        }
      }

      return deduped;
  }

  // 특정 플레이리스트의 곡들 조회
  static async findByPlaylistId(playlistId) {
    const playlistSongs = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLIST_SONGS, 'playlist_id', playlistId);
    const songs = [];
    
    for (const playlistSong of playlistSongs) {
      const song = await this.findById(playlistSong.song_id);
      if (song) {
        // Log to verify spotify_id is present
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