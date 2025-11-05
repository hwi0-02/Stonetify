const { Playlist, User, Song, PlaylistSongs, LikedPlaylist, ShareLink, SongLike } = require('../models');
const asyncHandler = require('express-async-handler');

// 내 플레이리스트 목록 조회
const getMyPlaylists = asyncHandler(async (req, res) => {
    const user_id = req.user.id;

    try {
        const playlists = await Playlist.findByUserId(user_id);

        // 썸네일 이미지 추가 (최대 4개)
        const playlistsWithCovers = await Promise.all(playlists.map(async (playlist) => {
            const songs = await Song.findByPlaylistId(playlist.id);
            const user = await User.findById(playlist.user_id);
            
            const coverImages = songs
                .slice(0, 4)
                .map(song => song.album_cover_url)
                .filter(url => url);
                
            return {
                ...playlist,
                cover_images: coverImages,
                cover_image_url: coverImages.length > 0 ? coverImages[0] : null,
                user: user ? { id: user.id, display_name: user.display_name } : null,
            };
        }));

        playlistsWithCovers.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

        res.status(200).json(playlistsWithCovers);
    } catch (error) {
        console.error('❌ Error in getMyPlaylists:', error);
        res.status(500).json({ error: error.message });
    }
});

// 플레이리스트 생성
const createPlaylist = asyncHandler(async (req, res) => {
    const { title, description, is_public } = req.body;
    const user_id = req.user.id;

    if (!title) {
        res.status(400);
        throw new Error('플레이리스트 제목은 필수입니다.');
    }

    const playlistId = await Playlist.create({
        user_id,
        title,
        description: description || '',
        is_public: is_public !== undefined ? is_public : true,
    });

    const createdPlaylist = await Playlist.findById(playlistId);
    res.status(201).json(createdPlaylist);
});

// 플레이리스트 상세 조회
const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    const songs = await Song.findByPlaylistId(playlistId);
    const user = await User.findById(playlist.user_id);

    const songsForClient = (songs || []).map(s => ({
        id: s.id,
        spotify_id: s.spotify_id,
        name: s.title || s.name,
        artists: s.artist,
        album: s.album,
        album_cover_url: s.album_cover_url,
        preview_url: s.preview_url,
        duration_ms: s.duration_ms,
        external_urls: s.external_urls,
        position: s.position,
        added_at: s.added_at,
    }));

    const playlistWithSongs = {
        ...playlist,
        songs: songsForClient,
        user: user ? { id: user.id, display_name: user.display_name } : null,
    };

    res.status(200).json(playlistWithSongs);
});

// 특정 사용자의 플레이리스트 목록 조회
const getPlaylistsByUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    try {
        const playlists = await Playlist.findByUserId(userId);

        const publicPlaylists = playlists.filter(playlist => playlist.is_public);

        // 썸네일 이미지 추가
        const playlistsWithCovers = await Promise.all(publicPlaylists.map(async (playlist) => {
            const songs = await Song.findByPlaylistId(playlist.id);
            const user = await User.findById(playlist.user_id);
            
            const coverImages = songs
                .slice(0, 4)
                .map(song => song.album_cover_url)
                .filter(url => url);
                
            return {
                ...playlist,
                cover_images: coverImages,
                cover_image_url: coverImages.length > 0 ? coverImages[0] : null,
                user: user ? { id: user.id, display_name: user.display_name } : null,
            };
        }));

        playlistsWithCovers.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

        res.status(200).json(playlistsWithCovers);
    } catch (error) {
        console.error('❌ Error in getPlaylistsByUser:', error);
        res.status(500).json({ error: error.message });
    }
});

// 플레이리스트 검색
const searchPlaylists = asyncHandler(async (req, res) => {
    const { q } = req.query;

    if (!q) {
        return res.status(200).json([]);
    }

    try {
        const playlists = await Playlist.searchPlaylists(q);

        const playlistsWithDetails = await Promise.all(playlists.map(async (playlist) => {
            const songs = await Song.findByPlaylistId(playlist.id);
            const user = await User.findById(playlist.user_id);

            const coverImages = songs
                .slice(0, 4)
                .map(song => song.album_cover_url)
                .filter(url => url);

            return {
                ...playlist,
                cover_images: coverImages,
                cover_image_url: coverImages.length > 0 ? coverImages[0] : null,
                owner_nickname: user ? user.display_name : '알 수 없음',
                user: user ? { id: user.id, display_name: user.display_name } : null,
            };
        }));

        res.status(200).json(playlistsWithDetails);
    } catch (error) {
        console.error('❌ Error in searchPlaylists:', error);
        res.status(500).json({ error: error.message });
    }
});

// 플레이리스트 수정
const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { title, description, is_public } = req.body;
    const { id: userId } = req.user;

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        res.status(403);
        throw new Error('자신이 생성한 플레이리스트만 수정할 수 있습니다.');
    }

    const updatedPlaylist = await Playlist.update(playlistId, {
        title: title || playlist.title,
        description: description !== undefined ? description : playlist.description,
        is_public: is_public !== undefined ? is_public : playlist.is_public,
    });

    res.status(200).json(updatedPlaylist);
});

// 플레이리스트 삭제
const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { id: userId } = req.user;

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        res.status(403);
        throw new Error('자신이 생성한 플레이리스트만 삭제할 수 있습니다.');
    }

    try {
        await Playlist.delete(playlistId);
        res.status(200).json({ message: '플레이리스트가 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error('❌ 플레이리스트 삭제 중 오류:', error);
        res.status(500);
        throw new Error(`플레이리스트 삭제 실패: ${error.message}`);
    }
});

// 플레이리스트에 곡 추가
const addSongToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { song } = req.body;
    const { id: userId } = req.user;

    // song 객체 유효성 검증
    if (!song || typeof song !== 'object') {
        res.status(400);
        throw new Error('유효한 곡 정보가 필요합니다.');
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        res.status(403);
        throw new Error('자신의 플레이리스트에만 곡을 추가할 수 있습니다.');
    }

    const normalized = {
        spotify_id: song.spotify_id || song.id,
        title: song.title || song.name,
        artist: song.artist || song.artists,
        album: song.album,
        album_cover_url: song.album_cover_url,
        preview_url: song.preview_url,
        duration_ms: song.duration_ms,
        external_urls: song.external_urls || song.external_url || null,
    };

    const existingSong = await Song.findOrCreate(normalized);

    const existingPlaylistSong = await PlaylistSongs.findByPlaylistAndSong(playlistId, existingSong.id);
    if (existingPlaylistSong) {
        res.status(409);
        throw new Error('이미 플레이리스트에 있는 곡입니다.');
    }

    await PlaylistSongs.addToPlaylist(playlistId, existingSong.id);

    res.status(201).json({ message: '플레이리스트에 곡이 성공적으로 추가되었습니다.' });
});

// 플레이리스트에서 곡 삭제
const removeSongFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, songId } = req.params;
    const { id: userId } = req.user;

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        res.status(403);
        throw new Error('자신의 플레이리스트에 있는 곡만 삭제할 수 있습니다.');
    }

    // songId는 내부 DB ID 또는 spotify_id일 수 있음
    let song = await Song.findById(songId);
    if (!song) {
        song = await Song.findBySpotifyId(songId);
    }
    if (!song) {
        res.status(404);
        throw new Error('곡을 찾을 수 없습니다.');
    }

    try {
        let removed = await PlaylistSongs.deleteByPlaylistAndSong(playlistId, song.id);

        // Fallback: 링크가 어긋난 경우 spotify_id로 탐색
        if (!removed) {
            const links = await PlaylistSongs.findByPlaylistId(playlistId);
            for (const link of links) {
                const s = await Song.findById(link.song_id);
                if (s && (s.id === song.id || s.spotify_id === (song.spotify_id || songId))) {
                    await PlaylistSongs.delete(link.id);
                    removed = true;
                    break;
                }
            }
        }

        if (removed) {
            res.status(200).json({ message: '플레이리스트에서 곡이 성공적으로 삭제되었습니다.' });
        } else {
            res.status(404);
            throw new Error('플레이리스트에서 해당 곡을 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('❌ 곡 삭제 중 오류:', error);
        res.status(500);
        throw new Error(`곡 삭제 실패: ${error.message}`);
    }
});

// 플레이리스트 좋아요/취소 토글
const likePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    if (!playlistId) {
        res.status(400);
        throw new Error('플레이리스트 ID가 제공되지 않았습니다.');
    }
    const { id: userId } = req.user;

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    const existingLike = await LikedPlaylist.findByUserAndPlaylist(userId, playlistId);

    if (existingLike) {
        // 좋아요 취소
        await LikedPlaylist.delete(existingLike.id);
        res.status(200).json({ message: '플레이리스트 좋아요가 취소되었습니다.', liked: false });
    } else {
        // 좋아요 추가
        await LikedPlaylist.create({ user_id: userId, playlist_id: playlistId });
        res.status(200).json({ message: '플레이리스트를 좋아요했습니다.', liked: true });
    }
});

// 좋아요한 플레이리스트 목록 조회
const getLikedPlaylists = asyncHandler(async (req, res) => {
    const { id: userId } = req.user;

    try {
        const likedPlaylists = await LikedPlaylist.findByUserId(userId);

        const playlistsWithDetails = await Promise.all(likedPlaylists.map(async (like) => {
            const playlist = await Playlist.findById(like.playlist_id);
            if (!playlist) return null;
            
            const songs = await Song.findByPlaylistId(playlist.id);
            const user = await User.findById(playlist.user_id);
            
            const coverImages = songs
                .slice(0, 4)
                .map(song => song.album_cover_url)
                .filter(url => url);
            
            return {
                ...playlist,
                cover_images: coverImages,
                cover_image_url: coverImages.length > 0 ? coverImages[0] : null,
                user: user ? { id: user.id, display_name: user.display_name } : null,
                liked_at: like.created_at
            };
        }));

        const validPlaylists = playlistsWithDetails
            .filter(playlist => playlist !== null)
            .sort((a, b) => (b.liked_at || 0) - (a.liked_at || 0));

        res.status(200).json(validPlaylists);
    } catch (error) {
        console.error('❌ Error in getLikedPlaylists:', error);
        res.status(500).json({ error: error.message });
    }
});

// 플레이리스트 라이브러리에 저장
const savePlaylistToLibrary = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { id: userId } = req.user;

    const originalPlaylist = await Playlist.findById(playlistId);
    if (!originalPlaylist) {
        return res.status(404).json({ message: '플레이리스트를 찾을 수 없습니다.' });
    }

    if (originalPlaylist.user_id === userId) {
        return res.status(400).json({ message: '자신의 플레이리스트는 담을 수 없습니다.' });
    }

    const originalOwner = await User.findById(originalPlaylist.user_id);
    const ownerName = originalOwner?.display_name || 'Unknown';
    const newTitle = `'${ownerName}'님의 ${originalPlaylist.title}`;

    const myPlaylists = await Playlist.findByUserId(userId);
    const alreadySaved = (myPlaylists || []).some((playlist) => {
        if (playlist.saved_from_playlist_id === playlistId) {
            return true;
        }
        return playlist.title === newTitle;
    });
    if (alreadySaved) {
        return res.status(409).json({ message: '이미 담은 플레이리스트입니다.' });
    }

    const newPlaylistId = await Playlist.create({
        user_id: userId,
        title: newTitle,
        description: originalPlaylist.description || '',
        is_public: false,
        saved_from_playlist_id: playlistId,
    });

    const originalLinks = await PlaylistSongs.findByPlaylistIdSorted(playlistId);
    const copyTasks = [];

    for (let index = 0; index < originalLinks.length; index++) {
        const link = originalLinks[index];
        const songId = link.song_id;
        if (!songId) {
            continue;
        }

        const position = typeof link.position === 'number' ? link.position : index;

        copyTasks.push(
            PlaylistSongs.create({
                playlist_id: newPlaylistId,
                song_id: songId,
                position,
            })
        );
    }

    if (copyTasks.length > 0) {
        await Promise.all(copyTasks);
    }

    const savedPlaylist = await Playlist.findById(newPlaylistId);
    res.status(201).json(savedPlaylist);
});

// 인기 플레이리스트 차트 조회 (일간/주간)
const getPopularPlaylists = asyncHandler(async (req, res) => {
    const { period = 'weekly' } = req.query; // 'daily' 또는 'weekly'
    const limit = parseInt(req.query.limit, 10) || 50;

    try {
        const playlists = await Playlist.findPopular(period, limit);

        const playlistsWithCovers = await Promise.all(playlists.map(async (playlist) => {
            const songs = await Song.findByPlaylistId(playlist.id);
            const user = await User.findById(playlist.user_id);

            const coverImages = songs
                .slice(0, 4)
                .map(song => song.album_cover_url)
                .filter(url => url);

            return {
                ...playlist,
                cover_images: coverImages,
                user: user ? { id: user.id, display_name: user.display_name } : null,
            };
        }));

        res.status(200).json(playlistsWithCovers);
    } catch (error) {
        console.error('❌ Error in getPopularPlaylists:', error);
        res.status(500).json({ error: error.message });
    }
});

// 공유 링크 생성
const createShareLink = asyncHandler(async (req, res) => {
    const { playlist_id } = req.params;
    const { id: userId } = req.user;

    const playlist = await Playlist.findById(playlist_id);
    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        res.status(403);
        throw new Error('자신의 플레이리스트만 공유할 수 있습니다.');
    }

    const existingLink = await ShareLink.findActiveByPlaylistId(playlist_id);
    if (existingLink.length > 0) {
        const link = existingLink[0];
        return res.status(200).json({
            share_id: link.id,
            share_url: `${req.protocol}://${req.get('host')}/api/playlists/shared/${link.id}`,
            created_at: link.created_at
        });
    }

    const shareLinkId = await ShareLink.create({
        playlist_id,
        user_id: userId,
        share_token: ShareLink.generateToken(),
        is_active: true
    });

    const shareLink = await ShareLink.findById(shareLinkId);
    
    res.status(201).json({
        share_id: shareLink.id,
        share_url: `${req.protocol}://${req.get('host')}/api/playlists/shared/${shareLink.id}`,
        created_at: shareLink.created_at
    });
});

// 공유 링크로 플레이리스트 조회
const getSharedPlaylist = asyncHandler(async (req, res) => {
    const { share_id } = req.params;

    const shareLink = await ShareLink.findById(share_id);
    if (!shareLink || !shareLink.is_active) {
        res.status(404);
        throw new Error('유효하지 않은 공유 링크입니다.');
    }

    await ShareLink.update(shareLink.id, { view_count: (shareLink.view_count || 0) + 1 });

    const playlist = await Playlist.findById(shareLink.playlist_id);
    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    const songs = await Song.findByPlaylistId(playlist.id);
    const user = await User.findById(playlist.user_id);

    const playlistWithSongs = {
        ...playlist,
        songs: songs || [],
        user: user ? { id: user.id, display_name: user.display_name } : null,
        shared_at: shareLink.created_at
    };

    res.status(200).json(playlistWithSongs);
});

// 공유 통계 조회
const getShareStats = asyncHandler(async (req, res) => {
    const { playlist_id } = req.params;
    const { id: userId } = req.user;

    const playlist = await Playlist.findById(playlist_id);
    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        res.status(403);
        throw new Error('자신의 플레이리스트 통계만 볼 수 있습니다.');
    }

    const shareLinks = await ShareLink.findByPlaylistId(playlist_id);
    const totalViews = shareLinks.reduce((sum, link) => sum + (link.view_count || 0), 0);
    const activeLinks = shareLinks.filter(link => link.is_active);

    res.status(200).json({
        total_shares: shareLinks.length,
        active_shares: activeLinks.length,
        total_views: totalViews,
        share_links: activeLinks.map(link => ({
            share_id: link.id,
            share_url: `${req.protocol}://${req.get('host')}/api/playlists/shared/${link.id}`,
            view_count: link.view_count || 0,
            created_at: link.created_at
        }))
    });
});

// 공유 링크 비활성화
const deactivateShareLink = asyncHandler(async (req, res) => {
    const { playlist_id } = req.params;
    const { id: userId } = req.user;

    const playlist = await Playlist.findById(playlist_id);
    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        res.status(403);
        throw new Error('자신의 플레이리스트 공유만 취소할 수 있습니다.');
    }

    const shareLinks = await ShareLink.findByPlaylistId(playlist_id);
    for (const link of shareLinks) {
      await ShareLink.deactivate(link.id);
    }
    
    res.status(200).json({ message: '모든 공유 링크가 비활성화되었습니다.' });
});


// 플레이리스트 랜덤 추천
const getRandomPlaylists = asyncHandler(async (req, res) => {
    const publicPlaylists = await Playlist.findPublicPlaylists();
    if (!publicPlaylists || publicPlaylists.length === 0) {
        return res.status(200).json([]);
    }

    const shuffled = [...publicPlaylists];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selected = shuffled.slice(0, 10);
    const playlistsWithDetails = await Promise.all(selected.map(async (playlist) => {
        const songs = await Song.findByPlaylistId(playlist.id);
        const coverImages = (songs || [])
            .slice(0, 4)
            .map(song => song.album_cover_url)
            .filter(Boolean);
        const owner = playlist.user_id ? await User.findById(playlist.user_id) : null;

        return {
            ...playlist,
            cover_images: coverImages,
            cover_image_url: coverImages.length > 0 ? coverImages[0] : null,
            user: owner ? { id: owner.id, display_name: owner.display_name } : null,
        };
    }));

    res.status(200).json(playlistsWithDetails);
});


module.exports = {
    getMyPlaylists,
    createPlaylist,
    getPlaylistById,
    getPlaylistsByUser,
    searchPlaylists,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    likePlaylist,
    getLikedPlaylists,
    createShareLink,
    getSharedPlaylist,
    getShareStats,
    deactivateShareLink,
    getRandomPlaylists,
    getPopularPlaylists,
    savePlaylistToLibrary,
    // 곡 좋아요 토글
    toggleLikeSong: asyncHandler(async (req, res) => {
        const { songId } = req.params;
        const payloadSong = req.body?.song;
        const key = songId || payloadSong?.spotify_id || payloadSong?.id;
        let song = key ? await Song.findById(key) : null;
        if (!song && key) song = await Song.findBySpotifyId(key);
        if (!song && payloadSong) {
            const normalized = {
                spotify_id: payloadSong.spotify_id || payloadSong.id || songId,
                title: payloadSong.title || payloadSong.name,
                artist: payloadSong.artist || payloadSong.artists,
                album: payloadSong.album || '',
                album_cover_url: payloadSong.album_cover_url || payloadSong.albumCoverUrl || null,
                duration_ms: payloadSong.duration_ms || null,
                external_urls: payloadSong.external_urls || payloadSong.external_url || null,
            };
            song = await Song.findOrCreate(normalized);
        }
        if (!song) {
            res.status(404);
            throw new Error('곡을 찾을 수 없습니다.');
        }
        const result = await SongLike.toggle(req.user.id, song.id);
        res.status(200).json(result);
    }),
    // 내 좋아요 곡 목록 조회
    getMyLikedSongs: asyncHandler(async (req, res) => {
        const likes = await SongLike.findByUserId(req.user.id);
        const songs = [];
        for (const like of likes) {
            const s = await Song.findById(like.song_id);
            if (s) {
                songs.push({
                    id: s.id,
                    spotify_id: s.spotify_id,
                    name: s.title || s.name,
                    artists: s.artist,
                    album: s.album,
                    album_cover_url: s.album_cover_url,
                    duration_ms: s.duration_ms,
                    external_urls: s.external_urls,
                    liked_at: like.liked_at,
                });
            }
        }
        songs.sort((a, b) => (b.liked_at || 0) - (a.liked_at || 0));
        res.status(200).json(songs);
    }),
};
