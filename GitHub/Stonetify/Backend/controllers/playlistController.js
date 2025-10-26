const { Playlist, User, Song, PlaylistSongs, LikedPlaylist, ShareLink, SongLike } = require('../models');
const asyncHandler = require('express-async-handler');

// 내 플레이리스트 목록 조회
const getMyPlaylists = asyncHandler(async (req, res) => {
    const user_id = req.user.id;

    try {
        const playlists = await Playlist.findByUserId(user_id);

        // 플레이리스트에 썸네일용 이미지 추가 (최대 4개)
        const playlistsWithCovers = await Promise.all(playlists.map(async (playlist) => {
            // 플레이리스트의 곡들 가져오기
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

        // 최신순으로 정렬
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
        
        // 공개 플레이리스트만 필터링
        const publicPlaylists = playlists.filter(playlist => playlist.is_public);

        // 플레이리스트에 썸네일용 이미지 추가
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

        // 최신순으로 정렬
        playlistsWithCovers.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

        res.status(200).json(playlistsWithCovers);
    } catch (error) {
        console.error('❌ Error in getPlaylistsByUser:', error);
        res.status(500).json({ error: error.message });
    }
});

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

    console.log('🗑️ 플레이리스트 삭제 요청:', { playlistId, userId });

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        console.log('❌ 플레이리스트를 찾을 수 없음:', playlistId);
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        console.log('❌ 권한 없음:', { playlistUserId: playlist.user_id, requestUserId: userId });
        res.status(403);
        throw new Error('자신이 생성한 플레이리스트만 삭제할 수 있습니다.');
    }

    try {
        console.log('🔄 플레이리스트 삭제 시작...');
        // Playlist.delete 메서드가 관련 데이터들을 모두 삭제함
        await Playlist.delete(playlistId);
        
        console.log('✅ 플레이리스트 삭제 완료');
        res.status(200).json({ message: '플레이리스트가 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error('❌ 플레이리스트 삭제 중 오류:', error);
        console.error('오류 스택:', error.stack);
        res.status(500);
        throw new Error(`플레이리스트 삭제 실패: ${error.message}`);
    }
});

// 플레이리스트에 곡 추가
const addSongToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { song } = req.body;
    const { id: userId } = req.user;

    console.log('🎵 곡 추가 요청:', { playlistId, song, userId });

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        console.log('❌ 플레이리스트를 찾을 수 없음:', playlistId);
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        console.log('❌ 권한 없음:', { playlistUserId: playlist.user_id, requestUserId: userId });
        res.status(403);
        throw new Error('자신의 플레이리스트에만 곡을 추가할 수 있습니다.');
    }

    console.log('🔄 곡 추가 시작...');

    // 곡을 표준화하여 찾거나 생성
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

    // 플레이리스트에 이미 이 곡이 있는지 확인
    const existingPlaylistSong = await PlaylistSongs.findByPlaylistAndSong(playlistId, existingSong.id);
    if (existingPlaylistSong) {
        console.log('❌ 이미 플레이리스트에 있는 곡');
        res.status(409);
        throw new Error('이미 플레이리스트에 있는 곡입니다.');
    }

    // 플레이리스트에 곡 추가
    await PlaylistSongs.addToPlaylist(playlistId, existingSong.id);

    console.log('✅ 곡 추가 완료');
    res.status(201).json({ message: '플레이리스트에 곡이 성공적으로 추가되었습니다.' });
});

// 플레이리스트에서 곡 삭제
const removeSongFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, songId } = req.params;
    const { id: userId } = req.user;

    console.log('🗑️ 곡 삭제 요청:', { playlistId, songId, userId });

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        console.log('❌ 플레이리스트를 찾을 수 없음:', playlistId);
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        console.log('❌ 권한 없음:', { playlistUserId: playlist.user_id, requestUserId: userId });
        res.status(403);
        throw new Error('자신의 플레이리스트에 있는 곡만 삭제할 수 있습니다.');
    }

    // songId는 내부 DB ID 또는 spotify_id일 수 있음 → 유연하게 처리
    let song = await Song.findById(songId);
    if (!song) {
        console.log('🔎 DB ID로 곡을 찾지 못함. spotify_id로 재시도:', songId);
        song = await Song.findBySpotifyId(songId);
    }
    if (!song) {
        console.log('❌ 곡을 찾을 수 없음(spotify_id 포함 실패):', songId);
        res.status(404);
        throw new Error('곡을 찾을 수 없습니다.');
    }

    try {
        console.log('🔄 곡 삭제 시작...');
        let removed = await PlaylistSongs.deleteByPlaylistAndSong(playlistId, song.id);

        // Fallback: 링크가 어긋난 경우 spotify_id로 탐색
        if (!removed) {
            console.log('🔁 1차 삭제 실패. 대체 경로로 재시도');
            const links = await PlaylistSongs.findByPlaylistId(playlistId);
            console.log('🔍 후보 링크 수:', links.length);
            for (const link of links) {
                const s = await Song.findById(link.song_id);
                if (s && (s.id === song.id || s.spotify_id === (song.spotify_id || songId))) {
                    console.log('🧩 매칭된 링크 발견. 강제 삭제:', link.id);
                    await PlaylistSongs.delete(link.id);
                    removed = true;
                    break;
                }
            }
        }

        if (removed) {
            console.log('✅ 곡 삭제 완료');
            res.status(200).json({ message: '플레이리스트에서 곡이 성공적으로 삭제되었습니다.' });
        } else {
            console.log('❌ 플레이리스트에서 해당 곡을 찾을 수 없음');
            res.status(404);
            throw new Error('플레이리스트에서 해당 곡을 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('❌ 곡 삭제 중 오류:', error);
        console.error('오류 스택:', error.stack);
        res.status(500);
        throw new Error(`곡 삭제 실패: ${error.message}`);
    }
});

// 플레이리스트 좋아요/취소 토글
const likePlaylist = asyncHandler(async (req, res) => {
    const { id: playlistId } = req.params;
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
        
        // 플레이리스트 상세 정보 가져오기
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

        // null 값 제거 및 좋아요한 시간순 정렬
        const validPlaylists = playlistsWithDetails
            .filter(playlist => playlist !== null)
            .sort((a, b) => (b.liked_at || 0) - (a.liked_at || 0));

        res.status(200).json(validPlaylists);
    } catch (error) {
        console.error('❌ Error in getLikedPlaylists:', error);
        res.status(500).json({ error: error.message });
    }
});

// 인기 플레이리스트 차트 조회 (일간/주간)
const getPopularPlaylists = asyncHandler(async (req, res) => {
    const { period = 'weekly' } = req.query; // 'daily' 또는 'weekly'
    const limit = parseInt(req.query.limit, 10) || 50;

    try {
        const playlists = await Playlist.findPopular(period, limit);

        // 플레이리스트에 커버 이미지 추가
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

    // 기존 활성 공유 링크 확인
    const existingLink = await ShareLink.findActiveByPlaylistId(playlist_id);
    if (existingLink.length > 0) { // 배열을 반환하므로 length로 확인
        const link = existingLink[0];
        return res.status(200).json({
            share_id: link.id, // ID 사용
            share_url: `${req.protocol}://${req.get('host')}/api/playlists/shared/${link.id}`,
            created_at: link.created_at
        });
    }

    // 새 공유 링크 생성
    const shareLinkId = await ShareLink.create({
        playlist_id,
        user_id: userId,
        share_token: ShareLink.generateToken(), // 토큰 생성
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

    const shareLink = await ShareLink.findById(share_id); // ID로 조회
    if (!shareLink || !shareLink.is_active) {
        res.status(404);
        throw new Error('유효하지 않은 공유 링크입니다.');
    }

    // 조회수 증가
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


// 최신 플레이리스트 랜덤 추천
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
    // song likes
    toggleLikeSong: asyncHandler(async (req, res) => {
        const { songId } = req.params;
        const payloadSong = req.body?.song;
        // songId may be internal or spotify_id -> resolve to internal id
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
        // 최신 좋아요 순으로 정렬
        songs.sort((a, b) => (b.liked_at || 0) - (a.liked_at || 0));
        res.status(200).json(songs);
    }),
};