const { LikedPlaylist, Song, PlaybackHistory, Playlist } = require('../models');

// 사용자 프로필 구성
async function buildUserProfile(userId) {
    try {
        const likedRelations = await LikedPlaylist.findByUserId(userId);
        const likedPlaylistIds = likedRelations.map(like => like.playlist_id);

        const artistFrequency = {};
        const genreSet = new Set();
        
        if (likedPlaylistIds.length > 0) {
            const songLists = await Promise.all(
                likedPlaylistIds.map(id => Song.findByPlaylistId(id))
            );
            
            songLists.flat().forEach(song => {
                if (!song) return;

                if (song.artist) {
                    const artists = song.artist.split(',').map(a => a.trim()).filter(Boolean);
                    artists.forEach(artist => {
                        artistFrequency[artist] = (artistFrequency[artist] || 0) + 1;
                    });
                }

                if (song.tags && Array.isArray(song.tags)) {
                    song.tags.forEach(tag => genreSet.add(tag));
                }
            });
        }

        const topArtists = Object.entries(artistFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([artist]) => artist);

        const topGenres = Array.from(genreSet).slice(0, 10);

        let recentTracks = [];
        try {
            const playbackHistory = await PlaybackHistory.findByUserId(userId);
            if (playbackHistory && playbackHistory.length > 0) {
                recentTracks = playbackHistory
                    .sort((a, b) => (b.played_at || 0) - (a.played_at || 0))
                    .slice(0, 10)
                    .map(history => ({
                        title: history.track_name || history.title,
                        artist: history.artist_name || history.artist,
                        spotify_id: history.track_id || history.spotify_id,
                    }))
                    .filter(t => t.title && t.artist);
            }
        } catch (error) {
            console.log('[FeatureBuilder] No playback history available:', error.message);
        }

        const moodSignals = generateMoodSignals({
            artistCount: Object.keys(artistFrequency).length,
            genreCount: genreSet.size,
            totalLikedPlaylists: likedPlaylistIds.length,
        });

        return {
            topArtists,
            topGenres,
            recentTracks,
            moodSignals,
            stats: {
                totalLikedPlaylists: likedPlaylistIds.length,
                totalArtists: Object.keys(artistFrequency).length,
                totalGenres: genreSet.size,
            },
        };
    } catch (error) {
        console.error('[FeatureBuilder] Error building user profile:', error);
        return {
            topArtists: [],
            topGenres: [],
            recentTracks: [],
            moodSignals: '다양한 음악을 즐기는 청취자',
            stats: {
                totalLikedPlaylists: 0,
                totalArtists: 0,
                totalGenres: 0,
            },
        };
    }
}

// 추천 후보 곡 수집
async function collectCandidateTracks(userId, { limit = 15 } = {}) {
    try {
        const likedRelations = await LikedPlaylist.findByUserId(userId);
        const likedPlaylistIds = likedRelations.map(like => like.playlist_id);

        const allPublicPlaylists = await Playlist.findPublicPlaylists();

        const candidatePlaylists = allPublicPlaylists.filter(
            playlist => playlist.user_id !== userId && !likedPlaylistIds.includes(playlist.id)
        );

        const artistFrequency = {};
        if (likedPlaylistIds.length > 0) {
            const songLists = await Promise.all(
                likedPlaylistIds.map(id => Song.findByPlaylistId(id))
            );
            
            songLists.flat().forEach(song => {
                if (!song || !song.artist) return;
                const artists = song.artist.split(',').map(a => a.trim()).filter(Boolean);
                artists.forEach(artist => {
                    artistFrequency[artist] = (artistFrequency[artist] || 0) + 1;
                });
            });
        }

        const trackScores = [];
        
        await Promise.all(
            candidatePlaylists.slice(0, 30).map(async playlist => {
                const songs = await Song.findByPlaylistId(playlist.id);
                
                songs.forEach(song => {
                    if (!song || !song.spotify_id) return;

                    let score = 0;

                    if (song.artist) {
                        const artists = song.artist.split(',').map(a => a.trim()).filter(Boolean);
                        artists.forEach(artist => {
                            if (artistFrequency[artist]) {
                                score += artistFrequency[artist];
                            }
                        });
                    }

                    score += Math.random() * 5;
                    
                    trackScores.push({
                        spotify_id: song.spotify_id,
                        title: song.title || song.name,
                        artist: song.artist,
                        album: song.album,
                        album_cover_url: song.album_cover_url,
                        preview_url: song.preview_url,
                        tags: song.tags || [],
                        playlistId: playlist.id,
                        playlistTitle: playlist.title,
                        score,
                    });
                });
            })
        );

        const selectedTracks = trackScores
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(({ score, ...track }) => track);

        return selectedTracks;
    } catch (error) {
        console.error('[FeatureBuilder] Error collecting candidate tracks:', error);
        return [];
    }
}

function generateMoodSignals({ artistCount, genreCount, totalLikedPlaylists }) {
    if (totalLikedPlaylists === 0) {
        return '새로운 음악을 탐색 중인 청취자';
    }
    
    if (artistCount > 20 && genreCount > 5) {
        return '다양한 장르와 아티스트를 즐기는 열린 취향의 청취자';
    }
    
    if (artistCount < 10) {
        return '특정 아티스트와 스타일을 선호하는 집중적인 청취자';
    }
    
    return '균형잡힌 음악 취향을 가진 청취자';
}

module.exports = {
    buildUserProfile,
    collectCandidateTracks,
};
