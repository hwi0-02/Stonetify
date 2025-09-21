const { Playlist, User, Song, PlaylistSongs, LikedPlaylist, ShareLink } = require('../models');
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
            
            const coverImages = songs
                .slice(0, 4)
                .map(song => song.album_cover_url)
                .filter(url => url);
                
            return {
                ...playlist,
                cover_images: coverImages,
                cover_image_url: coverImages.length > 0 ? coverImages[0] : null,
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
    const { id } = req.params;

    const playlist = await Playlist.findById(id);

    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    const songs = await Song.findByPlaylistId(id);
    const user = await User.findById(playlist.user_id);

    const playlistWithSongs = {
        ...playlist,
        songs: songs || [],
        user: user ? { id: user.id, username: user.username } : null,
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
            
            const coverImages = songs
                .slice(0, 4)
                .map(song => song.album_cover_url)
                .filter(url => url);
                
            return {
                ...playlist,
                cover_images: coverImages,
                cover_image_url: coverImages.length > 0 ? coverImages[0] : null,
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

// 플레이리스트 수정
const updatePlaylist = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, description, is_public } = req.body;
    const { id: userId } = req.user;

    const playlist = await Playlist.findById(id);

    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        res.status(403);
        throw new Error('자신이 생성한 플레이리스트만 수정할 수 있습니다.');
    }

    const updatedPlaylist = await Playlist.update(id, {
        title: title || playlist.title,
        description: description !== undefined ? description : playlist.description,
        is_public: is_public !== undefined ? is_public : playlist.is_public,
    });

    res.status(200).json(updatedPlaylist);
});

// 플레이리스트 삭제
const deletePlaylist = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { id: userId } = req.user;

    console.log('🗑️ 플레이리스트 삭제 요청:', { playlistId: id, userId });

    const playlist = await Playlist.findById(id);

    if (!playlist) {
        console.log('❌ 플레이리스트를 찾을 수 없음:', id);
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
        await Playlist.delete(id);
        
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
    const { id: playlistId } = req.params;
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

    // 먼저 곡이 이미 존재하는지 확인
    let existingSong = await Song.findBySpotifyId(song.spotify_id);
    
    if (!existingSong) {
        console.log('새 곡 생성 중...');
        // 곡이 없으면 새로 생성
        const songId = await Song.create({
            spotify_id: song.spotify_id,
            name: song.name,
            artist: song.artist,
            album: song.album,
            album_cover_url: song.album_cover_url,
            preview_url: song.preview_url,
            external_url: song.external_url,
            duration_ms: song.duration_ms
        });
        existingSong = await Song.findById(songId);
    }

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

    const song = await Song.findById(songId);
    if (!song) {
        console.log('❌ 곡을 찾을 수 없음:', songId);
        res.status(404);
        throw new Error('곡을 찾을 수 없습니다.');
    }

    try {
        console.log('🔄 곡 삭제 시작...');
        const removed = await PlaylistSongs.deleteByPlaylistAndSong(playlistId, songId);
        
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
                user: user ? { id: user.id, username: user.username } : null,
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
    if (existingLink) {
        return res.status(200).json({
            share_id: existingLink.share_id,
            share_url: `${req.protocol}://${req.get('host')}/shared/${existingLink.share_id}`,
            created_at: existingLink.created_at
        });
    }

    // 새 공유 링크 생성
    const shareLinkId = await ShareLink.create({
        playlist_id,
        user_id: userId,
        is_active: true
    });

    const shareLink = await ShareLink.findById(shareLinkId);
    
    res.status(201).json({
        share_id: shareLink.share_id,
        share_url: `${req.protocol}://${req.get('host')}/shared/${shareLink.share_id}`,
        created_at: shareLink.created_at
    });
});

// 공유 링크로 플레이리스트 조회
const getSharedPlaylist = asyncHandler(async (req, res) => {
    const { share_id } = req.params;

    const shareLink = await ShareLink.findByShareId(share_id);
    if (!shareLink || !shareLink.is_active) {
        res.status(404);
        throw new Error('유효하지 않은 공유 링크입니다.');
    }

    // 조회수 증가
    await ShareLink.incrementViews(shareLink.id);

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
        user: user ? { id: user.id, username: user.username } : null,
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
            share_id: link.share_id,
            share_url: `${req.protocol}://${req.get('host')}/shared/${link.share_id}`,
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

    await ShareLink.deactivateByPlaylistId(playlist_id);
    
    res.status(200).json({ message: '공유 링크가 비활성화되었습니다.' });
});

module.exports = {
    getMyPlaylists,
    createPlaylist,
    getPlaylistById,
    getPlaylistsByUser,
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
};