
## Backend/controllers/playlistController.js

```javascript
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
    const { id } = req.params;

    const playlist = await Playlist.findById(id);

    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    const songs = await Song.findByPlaylistId(id);
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

// 다른 사용자의 플레이리스트 담기
const savePlaylistToLibrary = asyncHandler(async (req, res) => {
    const { id: originalPlaylistId } = req.params;
    const { id: userId } = req.user;

    console.log('➕ 플레이리스트 담기 요청:', { originalPlaylistId, userId });

    // 1. 원본 플레이리스트 정보 가져오기
    const originalPlaylist = await Playlist.findById(originalPlaylistId);
    if (!originalPlaylist) {
        console.log('❌ 원본 플레이리스트를 찾을 수 없음:', originalPlaylistId);
        res.status(404);
        throw new Error('복사할 플레이리스트를 찾을 수 없습니다.');
    }

    const originalCreator = await User.findById(originalPlaylist.user_id);
    const creatorName = originalCreator?.display_name || 'Unknown';

    if (originalPlaylist.user_id === userId) {
        console.log('❌ 자신의 플레이리스트는 담을 수 없음');
        res.status(400);
        throw new Error('자신의 플레이리스트는 담을 수 없습니다.');
    }

    // 2. 이미 담았는지 확인 (원본 ID 기반으로 확인 - 선택적)
    const newPlaylistTitle = `'${creatorName}'님의 ${originalPlaylist.title}`;

    // 3. 현재 사용자를 위한 새 플레이리스트 생성 (제목에 원본 표시)
    const newPlaylistId = await Playlist.create({
        user_id: userId,
        title: newPlaylistTitle,
        description: originalPlaylist.description || '',
        is_public: false,
    });

    if (!newPlaylistId) {
        console.log('❌ 새 플레이리스트 생성 실패');
        res.status(500);
        throw new Error('플레이리스트를 복사하는 중 오류가 발생했습니다.');
    }
    console.log('✅ 새 플레이리스트 생성 완료:', newPlaylistId);

    // 4. 원본 플레이리스트의 곡 목록 가져오기
    const originalSongs = await Song.findByPlaylistId(originalPlaylistId);
    console.log(`🎵 원본 곡 ${originalSongs.length}개 복사 시작...`);

    // 5. 새 플레이리스트에 곡 추가 (순서대로)
    for (const song of originalSongs) {
        const songRecord = await Song.findOrCreate({
            spotify_id: song.spotify_id,
            title: song.title || song.name,
            artist: song.artist || song.artists,
            album: song.album,
            album_cover_url: song.album_cover_url,
            preview_url: song.preview_url,
            duration_ms: song.duration_ms,
            external_urls: song.external_urls,
        });
        await PlaylistSongs.addToPlaylist(newPlaylistId, songRecord.id);
    }

    console.log('✅ 곡 복사 완료');
    const savedPlaylist = await Playlist.findById(newPlaylistId);
    res.status(201).json(savedPlaylist);
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
    savePlaylistToLibrary,
    // song likes
    toggleLikeSong: asyncHandler(async (req, res, next) => {
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
```

-----

## Backend/routes/playlistRoutes.js

```javascript
const express = require('express');
const router = express.Router();
const {
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
    getMyLikedSongs,
    getPopularPlaylists,
    getRandomPlaylists,
    savePlaylistToLibrary,
} = require('../controllers/playlistController');
const { protect } = require('../middleware/authMiddleware');

// @/api/playlists/

// 랜덤 플레이리스트 추천
router.get('/random', getRandomPlaylists);

//인기차트
router.get('/popular', getPopularPlaylists);

// 내 플레이리스트 (메인화면)
router.get('/me', protect, getMyPlaylists);

// 좋아요한 플레이리스트
router.get('/liked', protect, getLikedPlaylists);
router.get('/songs/liked/me', protect, getMyLikedSongs);

// 플레이리스트 검색
router.get('/search', searchPlaylists);

// 플레이리스트 좋아요/취소 토글
router.post('/:id/like', protect, likePlaylist);

// 플레이리스트 내 노래 추가/삭제
router.post('/:id/songs', protect, addSongToPlaylist);
router.delete('/:playlistId/songs/:songId', protect, removeSongFromPlaylist);
// 곡 좋아요 토글
router.post('/songs/:songId/like', protect, (req, res, next) => require('../controllers/playlistController').toggleLikeSong(req, res, next));
// 다른 사용자 플레이리스트 담기(복사)
router.post('/:id/save', protect, savePlaylistToLibrary);

// 플레이리스트 공유 관련 라우트 (개선된 버전)
router.post('/:playlist_id/share', protect, createShareLink);
router.get('/:playlist_id/share/stats', protect, getShareStats);
router.delete('/:playlist_id/share', protect, deactivateShareLink);

// 공유 링크로 플레이리스트 조회 (인증 불필요)
router.get('/shared/:share_id', getSharedPlaylist);

// 개별 플레이리스트 CRUD
router.post('/', protect, createPlaylist);
router.get('/user/:userId', getPlaylistsByUser); // 특정 사용자의 플레이리스트 목록
router.get('/:id', getPlaylistById);
router.put('/:id', protect, updatePlaylist);
router.delete('/:id', protect, deletePlaylist);
router.get('/me', protect, getMyPlaylists);
router.get('/popular', getPopularPlaylists);

module.exports = router;
```

-----

## Frontend/store/slices/playlistSlice.js

```javascript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';

const initialState = {
  userPlaylists: [],
  likedPlaylists: [],
  recommendedPlaylists: [],
  forYouPlaylists: [],
  popularPlaylists: [],
  currentPlaylist: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

// 내 플레이리스트 목록 가져오기 (홈 화면용)
export const fetchMyPlaylists = createAsyncThunk(
  'playlist/fetchMyPlaylists',
  async (_, thunkAPI) => {
    try {
      const result = await apiService.getMyPlaylists();
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue('내 플레이리스트를 불러오는데 실패했습니다.');
    }
  }
);

//인기차트용 플레이리스트 가져오기 (홈 화면용)
export const fetchPopularPlaylists = createAsyncThunk(
  'playlist/fetchPopularPlaylists',
  async ({ period, limit }, thunkAPI) => {
    try {
      const result = await apiService.getPopularPlaylists(period, limit);
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue('인기 플레이리스트를 불러오는데 실패했습니다.');
    }
  }
);

// 특정 유저의 플레이리스트 목록 가져오기 (프로필 화면용)
export const fetchPlaylistsByUserId = createAsyncThunk(
  'playlist/fetchPlaylistsByUserId',
  async (userId, thunkAPI) => {
    try {
      return await apiService.getPlaylistsByUserId(userId);
    } catch (error) {
      return thunkAPI.rejectWithValue('사용자 플레이리스트를 불러오는데 실패했습니다.');
    }
  }
);

export const fetchPlaylistDetails = createAsyncThunk(
  'playlist/fetchPlaylistDetails',
  async (playlistId, thunkAPI) => {
    try {
      const result = await apiService.getPlaylistById(playlistId);
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue('플레이리스트 상세 정보를 불러오는데 실패했습니다.');
    }
  }
);

export const fetchLikedPlaylists = createAsyncThunk(
  'playlist/fetchLikedPlaylists',
  async (_, thunkAPI) => {
    try {
      return await apiService.getLikedPlaylists();
    } catch (error) {
      return thunkAPI.rejectWithValue('좋아요한 플레이리스트를 불러오는데 실패했습니다.');
    }
  }
);

export const createPlaylist = createAsyncThunk(
  'playlist/createPlaylist',
  async (playlistData, thunkAPI) => {
    try {
      const result = await apiService.createPlaylist(playlistData);
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue('플레이리스트 생성에 실패했습니다.');
    }
  }
);

export const updatePlaylist = createAsyncThunk(
  'playlist/updatePlaylist',
  async ({ playlistId, playlistData }, thunkAPI) => {
    try {
      const result = await apiService.updatePlaylist(playlistId, playlistData);
      return result;
    } catch (error) {
      const message = error.response?.data?.message || '플레이리스트 수정에 실패했습니다.';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const deletePlaylist = createAsyncThunk(
  'playlist/deletePlaylist',
  async (playlistId, thunkAPI) => {
    try {
      await apiService.deletePlaylist(playlistId);
      return playlistId; // 성공 시 playlistId를 반환합니다.
    } catch (error) {
      const message = error.response?.data?.message || '플레이리스트 삭제에 실패했습니다.';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// 플레이리스트 공유 링크 생성
export const createShareLinkAsync = createAsyncThunk(
  'playlist/createShareLink',
  async (playlistId, thunkAPI) => {
    try {
      const result = await apiService.createShareLink(playlistId);
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue('공유 링크 생성에 실패했습니다.');
    }
  }
);

// 공유 링크로 플레이리스트 조회
export const fetchSharedPlaylist = createAsyncThunk(
  'playlist/fetchSharedPlaylist',
  async (playlistId, thunkAPI) => {
    try {
      const result = await apiService.getSharedPlaylist(playlistId);
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue('공유 플레이리스트를 불러오는데 실패했습니다.');
    }
  }
);

// 플레이리스트 좋아요 토글
export const toggleLikePlaylist = createAsyncThunk(
  'playlist/toggleLikePlaylist',
  async (playlistId, thunkAPI) => {
    try {
      const result = await apiService.toggleLikePlaylist(playlistId);
      return { playlistId, liked: result.liked };
    } catch (error) {
      return thunkAPI.rejectWithValue('좋아요 처리에 실패했습니다.');
    }
  }
);

export const fetchRecommendedPlaylists = createAsyncThunk(
  'playlist/fetchRecommendedPlaylists',
  async (_, { rejectWithValue }) => {
    try {
      return await apiService.getRandomPlaylists();
    } catch (error) {
      return rejectWithValue('추천 플레이리스트를 불러오는데 실패했습니다.');
    }
  }
);

export const fetchForYouPlaylists = createAsyncThunk(
  'playlist/fetchForYouPlaylists',
  async (_, { rejectWithValue }) => {
    try {
      return await apiService.getRecommendedPlaylists();
    } catch (error) {
      return rejectWithValue('회원님을 위한 추천을 불러오는데 실패했습니다.');
    }
  }
);

// 플레이리스트 담기(복사)
export const savePlaylistAsync = createAsyncThunk(
  'playlist/savePlaylist',
  async (playlistId, thunkAPI) => {
    try {
      const savedPlaylist = await apiService.savePlaylist(playlistId);
      // 성공 시, 내 플레이리스트 목록을 갱신하기 위해 fetchMyPlaylists 호출
      thunkAPI.dispatch(fetchMyPlaylists());
      return savedPlaylist; // 복사된 플레이리스트 정보 반환 (선택 사항)
    } catch (error) {
      const message = error.response?.data?.message || '플레이리스트를 담는 데 실패했습니다.';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

const playlistSlice = createSlice({
  name: 'playlist',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetchMyPlaylists (내 플레이리스트)
      .addCase(fetchMyPlaylists.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchMyPlaylists.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.userPlaylists = action.payload;
      })
      .addCase(fetchMyPlaylists.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // fetchPlaylistsByUserId (다른 사용자 플레이리스트)
      .addCase(fetchPlaylistsByUserId.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchPlaylistsByUserId.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // 이 경우, userPlaylists를 덮어쓸지, 다른 state를 사용할지 결정해야 함.
        // 현재는 프로필 화면에서만 사용하므로, 덮어써도 무방할 수 있음.
        state.userPlaylists = action.payload;
      })
      .addCase(fetchPlaylistsByUserId.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // 기타 Thunks
      .addCase(fetchLikedPlaylists.fulfilled, (state, action) => {
        state.likedPlaylists = action.payload;
      })
      .addCase(fetchPlaylistDetails.pending, (state) => {
        state.status = 'loading';
        state.currentPlaylist = null; // 로딩 시작 시 초기화
      })
      .addCase(fetchPlaylistDetails.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.currentPlaylist = action.payload;

        // Log to verify songs have spotify_id
        if (action.payload?.songs) {
          console.log('📋 [fetchPlaylistDetails] Received songs:', action.payload.songs.length);
          action.payload.songs.forEach((song, idx) => {
            if (!song.spotify_id && !song.spotifyId) {
              console.warn(`⚠️ [fetchPlaylistDetails] Song ${idx} missing spotify_id:`, {
                id: song.id,
                title: song.title || song.name,
                allKeys: Object.keys(song)
              });
            }
          });
        }
      })
      .addCase(fetchPlaylistDetails.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchRecommendedPlaylists.fulfilled, (state, action) => {
        state.recommendedPlaylists = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchRecommendedPlaylists.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(fetchForYouPlaylists.fulfilled, (state, action) => {
        state.forYouPlaylists = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchForYouPlaylists.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(createPlaylist.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(createPlaylist.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.userPlaylists.unshift(action.payload);
      })
      .addCase(createPlaylist.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(updatePlaylist.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(updatePlaylist.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // 현재 플레이리스트 업데이트
        if (state.currentPlaylist && state.currentPlaylist.id === action.payload.id) {
          state.currentPlaylist = { ...state.currentPlaylist, ...action.payload };
        }
        // 사용자 플레이리스트 목록에서도 업데이트
        const index = state.userPlaylists.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.userPlaylists[index] = { ...state.userPlaylists[index], ...action.payload };
        }
      })
      .addCase(updatePlaylist.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(deletePlaylist.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(deletePlaylist.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const playlistId = action.payload;
        // 사용자 플레이리스트 목록에서 제거
        state.userPlaylists = state.userPlaylists.filter(p => p.id !== playlistId);
        // 현재 플레이리스트가 삭제된 경우 초기화
        if (state.currentPlaylist && state.currentPlaylist.id === playlistId) {
          state.currentPlaylist = null;
        }
      })
      .addCase(deletePlaylist.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(toggleLikePlaylist.fulfilled, (state, action) => {
        const { playlistId, liked } = action.payload;
        // 현재 플레이리스트의 좋아요 상태 업데이트
        if (state.currentPlaylist && state.currentPlaylist.id === playlistId) {
          state.currentPlaylist.liked = liked;
        }
        // 사용자 플레이리스트 목록에서도 업데이트
        const index = state.userPlaylists.findIndex(p => p.id === playlistId);
        if (index !== -1) {
          state.userPlaylists[index].liked = liked;
        }
        // 좋아요한 플레이리스트 목록 업데이트
        if (liked) {
          // 좋아요 추가
          const playlist = state.userPlaylists.find(p => p.id === playlistId);
          if (playlist && !state.likedPlaylists.find(p => p.id === playlistId)) {
            state.likedPlaylists.push(playlist);
          }
        } else {
          // 좋아요 제거
          state.likedPlaylists = state.likedPlaylists.filter(p => p.id !== playlistId);
        }
      })
      .addCase(toggleLikePlaylist.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(createShareLinkAsync.fulfilled, (state, action) => {
        // 공유 링크 생성 성공 시 특별한 상태 업데이트는 필요 없음
        // 필요시 공유 링크를 state에 저장할 수 있음
      })
      .addCase(createShareLinkAsync.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchSharedPlaylist.fulfilled, (state, action) => {
        state.currentPlaylist = action.payload;
        state.status = 'succeeded';
      })
      .addCase(fetchSharedPlaylist.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchPopularPlaylists.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchPopularPlaylists.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.popularPlaylists = action.payload;
      })
      .addCase(fetchPopularPlaylists.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(savePlaylistAsync.pending, (state) => {
        state.status = 'loading'; // 담는 중 상태 표시 (선택 사항)
      })
      .addCase(savePlaylistAsync.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // userPlaylists는 fetchMyPlaylists가 갱신하므로 여기서는 상태만 변경
      })
      .addCase(savePlaylistAsync.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload; // 에러 메시지 저장
      });
  },
});

export default playlistSlice.reducer;
```

-----

## Frontend/services/apiService.js

```javascript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const LOCAL_IP = process.env.EXPO_PUBLIC_LOCAL_IP || process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = parseNumber(process.env.EXPO_PUBLIC_BACKEND_PORT || process.env.BACKEND_PORT, 5000);
const PROXY_PORT = parseNumber(process.env.EXPO_PUBLIC_PROXY_PORT || process.env.PROXY_PORT, 3001);
const TIMEOUT = parseNumber(process.env.EXPO_PUBLIC_API_TIMEOUT || process.env.API_TIMEOUT, 15000);
const RETRY_DELAY = parseNumber(
  process.env.EXPO_PUBLIC_API_RETRY_DELAY ||
  process.env.EXPO_PUBLIC_RETRY_DELAY ||
  process.env.RETRY_DELAY,
  1000
);

const LOCAL_API_URL = process.env.EXPO_PUBLIC_LOCAL_API_URL ||
  process.env.DEV_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  `http://${LOCAL_IP}:${BACKEND_PORT}/api/`;

const TUNNEL_API_URL = process.env.EXPO_PUBLIC_TUNNEL_API_URL ||
  process.env.TUNNEL_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  LOCAL_API_URL;

const PROXY_API_URL = process.env.EXPO_PUBLIC_PROXY_API_URL ||
  process.env.PROXY_API_URL ||
  `http://localhost:${PROXY_PORT}/proxy/api/`;

const PRODUCTION_API = process.env.EXPO_PUBLIC_PROD_API_URL ||
  process.env.PROD_API_URL ||
  LOCAL_API_URL;

// 환경 설정 정보
const CONFIG = {
  LOCAL_IP,
  BACKEND_PORT,
  PROXY_PORT,
  TIMEOUT,
  RETRY_DELAY,
  LOCAL_API_URL,
  TUNNEL_API_URL,
  PROXY_API_URL,
  PRODUCTION_API,
};

// ?경?API URL ?정 (최적?된 버전)
const getApiUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'web') {
      const currentUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';

      // HTTPS ?널 모드 감? ??록???버 ?용
      if (currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'))) {
        console.log('Tunnel mode detected: using HTTPS proxy endpoint');
        return CONFIG.PROXY_API_URL;
      }

      // 로컬 ??개발
      return `http://localhost:${CONFIG.BACKEND_PORT}/api/`;
    }

    // 모바?에???널 모드 감?
    const hostUri = Constants.expoConfig?.hostUri;

    if (hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct'))) {
      // 모바???널 모드?서??IP 주소 ?용
      return CONFIG.TUNNEL_API_URL;
    }

    // 안드로이드 에뮬레이터는 10.0.2.2를 통해 호스트(PC)의 localhost에 접근합니다.
    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${CONFIG.BACKEND_PORT}/api/`;
    }

    // ?반 로컬 ?트?크 (iOS 시뮬레이터/실기기 등)
    return CONFIG.LOCAL_API_URL;
  }

  // ?로?션 ?경
  return CONFIG.PRODUCTION_API;
};

// 초기??
const API_URL = getApiUrl();

// ?널 모드 감? ?틸리티 (최적??
const isTunnelMode = () => {
  if (Platform.OS === 'web') {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    return currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'));
  }

  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct'));
};

// Axios ?스?스 ?성 (최적?된 ?정)
const api = axios.create({
  baseURL: API_URL,
  timeout: CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ?청 ?터?터 (?큰 ?동 추?)
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 🔍 Detailed logging for playback requests
  if (config.url && config.url.includes('playback/play')) {
    console.log('📡 [API Request] Playback Play:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data
    });
  }

  return config;
}, (error) => Promise.reject(error));

// ?답 ?터?터 (?러 처리 ??시??로직)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 🔍 Detailed error logging for playback requests
    if (originalRequest?.url && originalRequest.url.includes('playback')) {
      console.error('❌ [API Response Error]', {
        url: originalRequest.url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        requestData: originalRequest.data,
        headers: originalRequest.headers
      });
    }

    // Handle TOKEN_REVOKED error - Spotify refresh token expired
    if (error.response?.status === 401 && error.response?.data?.error === 'TOKEN_REVOKED') {
      console.error('🔴 [API] Spotify token revoked - clearing session');

      // Clear all auth data
  await AsyncStorage.multiRemove(['spotifyToken', 'spotifyRefreshToken']);
  await AsyncStorage.setItem('spotifyNeedsReauth', 'true');

  // Enhance error with user-friendly message
      const revokedError = new Error('Spotify 연결이 만료되었습니다. 다시 로그인해주세요.');
      revokedError.code = 'TOKEN_REVOKED';
      revokedError.requiresReauth = true;
      revokedError.originalError = error;

      return Promise.reject(revokedError);
    }

    // ?트?크 ?류 ?시??로직
    if ((error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') && !originalRequest._retry) {
      originalRequest._retry = true;
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return api(originalRequest);
    }

    // 401 ?러 ???큰 ?리 ?로그?웃
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['token', 'user']);
    }

    return Promise.reject(error);
  }
);

// ==================== API ENDPOINTS ====================

// Authentication APIs
export const register = (userData) => api.post('users/register', userData).then(res => res.data);
export const login = (userData) => api.post('users/login', userData).then(res => res.data);
export const getMe = () => api.get('users/me').then(res => res.data);

// User Management APIs
export const followUser = (following_id) => api.post('users/follow', { following_id }).then(res => res.data);
export const unfollowUser = (following_id) => api.delete('users/unfollow', { data: { following_id } }).then(res => res.data);
export const getFollowers = (userId) => api.get(`users/${userId}/followers`).then(res => res.data);
export const getFollowing = (userId) => api.get(`users/${userId}/following`).then(res => res.data);
export const getUserProfile = (userId) => api.get(`users/${userId}/profile`).then(res => res.data);
export const toggleFollow = (userId) => api.post(`users/${userId}/toggle-follow`).then(res => res.data);
export const updateProfile = (profileData) => api.put('users/profile', profileData).then(res => res.data);

// Playlist Management APIs
export const createPlaylist = (playlistData) => api.post('playlists', playlistData).then(res => res.data);
export const getMyPlaylists = () => api.get('playlists/me').then(res => res.data);
export const getPlaylistsByUserId = (userId) => api.get(`playlists/user/${userId}`).then(res => res.data);
export const getPlaylistById = (playlistId) => api.get(`playlists/${playlistId}`).then(res => res.data);
export const updatePlaylist = (playlistId, playlistData) => api.put(`playlists/${playlistId}`, playlistData).then(res => res.data);

// ?레?리?트 ??
export const deletePlaylist = async (playlistId) => {
  try {
    console.log('???레?리?트 ?? API ?출:', playlistId);
    const response = await api.delete(`playlists/${playlistId}`);
    console.log('???레?리?트 ?? ?공:', response.data);
    return response.data;
  } catch (error) {
    console.error('???레?리?트 ?? ?패:', error);
    console.error('?러 ?태:', error.response?.status);
    console.error('?러 메시지:', error.response?.data);
    throw error;
  }
};

// Playlist Song Management APIs
export const addSongToPlaylist = (playlistId, songData) => {
  // Normalize incoming song object (from Spotify search or internal)
  const normalized = {
    spotify_id: songData.spotify_id || songData.id || null,
    title: songData.title || songData.name || '',
    artist: songData.artist || songData.artists || '',
    album: songData.album || '',
    album_cover_url: songData.album_cover_url || songData.albumCoverUrl || null,
    preview_url: songData.preview_url || null,
    duration_ms: songData.duration_ms || null,
    external_urls: songData.external_urls || songData.external_url || null,
  };
  return api.post(`playlists/${playlistId}/songs`, { song: normalized }).then(res => res.data);
};

// ?레?리?트?서 ???
export const removeSongFromPlaylist = async (playlistId, songId) => {
  try {
    console.log('????? API ?출:', { playlistId, songId });
    const response = await api.delete(`playlists/${playlistId}/songs/${songId}`);
    console.log('????? ?공:', response.data);
    return response.data;
  } catch (error) {
    console.error('????? ?패:', error);
    console.error('?러 ?태:', error.response?.status);
    console.error('?러 메시지:', error.response?.data);
    throw error;
  }
};

// Playlist Interaction APIs
export const toggleLikePlaylist = (playlistId) => api.post(`playlists/${playlistId}/like`).then(res => res.data);
export const getLikedPlaylists = () => api.get('playlists/liked').then(res => res.data);
export const getPopularPlaylists = (period = 'weekly', limit = 50) => api.get(`playlists/popular?period=${period}&limit=${limit}`).then(res => res.data);
export const savePlaylist = (playlistId) => api.post(`playlists/${playlistId}/save`).then(res => res.data);

// Playlist Sharing APIs
export const createShareLink = (playlistId) => api.post(`playlists/${playlistId}/share`).then(res => res.data);
export const getSharedPlaylist = (shareId) => api.get(`playlists/shared/${shareId}`).then(res => res.data);
export const getShareStats = (playlistId) => api.get(`playlists/${playlistId}/share/stats`).then(res => res.data);
export const deactivateShareLink = (playlistId) => api.delete(`playlists/${playlistId}/share`).then(res => res.data);
export const updateShareSettings = (playlistId, settings) => api.put(`playlists/${playlistId}/share/settings`, settings).then(res => res.data);

// Post Management APIs
export const getPosts = () => api.get('posts').then(res => res.data);
export const createPost = (postData) => api.post('posts', postData).then(res => res.data);
export const likePost = (postId) => api.post(`posts/${postId}/like`).then(res => res.data);
export const updatePost = (postId, postData) => api.put(`posts/${postId}`, postData).then(res => res.data);
export const deletePost = (postId) => api.delete(`posts/${postId}`).then(res => res.data);
export const toggleSavePost = (postId) => api.post(`posts/${postId}/toggle-save`).then(res => res.data);
export const getSavedPosts = () => api.get('posts/saved/me').then(res => res.data);

// Spotify Integration APIs
export const searchTracks = (query) => api.get(`spotify/search?q=${encodeURIComponent(query)}`).then(res => res.data);
export const searchPlaylists = (query) => api.get(`playlists/search?q=${encodeURIComponent(query)}`).then(res => res.data);

// Spotify Auth (PKCE) - Phase B
export const exchangeSpotifyCode = ({ code, code_verifier, redirect_uri, userId, client_id }) =>
  api.post('spotify/auth/token', { code, code_verifier, redirect_uri, userId, client_id }).then(r => r.data);
export const refreshSpotifyToken = ({ refreshTokenEnc, userId, client_id }) =>
  api.post('spotify/auth/refresh', { refreshTokenEnc, userId, client_id }).then(r => r.data);
export const getSpotifyPremiumStatus = (userId) => api.get('spotify/auth/premium-status', { headers: { 'x-user-id': userId }}).then(r => r.data);
export const getSpotifyProfile = (userId) => api.get('spotify/me', { headers: { 'x-user-id': userId }}).then(r => r.data);
export const revokeSpotifySession = (userId) => api.post('spotify/auth/revoke', { userId }).then(r => r.data);

// Playback Control (remote full-track preparation) – REST proxy (backend handles access token)
export const getPlaybackState = (userId) => api.get('spotify/playback/state', { headers: { 'x-user-id': userId }}).then(r => r.data);
export const playRemote = ({ userId, uris, context_uri, position_ms, device_id }) => {
  const payload = { uris, context_uri, position_ms };
  if (device_id) payload.device_id = device_id;
  return api.put('spotify/playback/play', payload, { headers: { 'x-user-id': userId }}).then(r => r.data);
};
export const pauseRemote = (userId) => api.put('spotify/playback/pause', {}, { headers: { 'x-user-id': userId }}).then(r => r.data);
export const nextRemote = (userId) => api.post('spotify/playback/next', {}, { headers: { 'x-user-id': userId }}).then(r => r.data);
export const previousRemote = (userId) => api.post('spotify/playback/previous', {}, { headers: { 'x-user-id': userId }}).then(r => r.data);
export const seekRemote = ({ userId, position_ms }) => api.put('spotify/playback/seek', { position_ms }, { headers: { 'x-user-id': userId }}).then(r => r.data);
export const setRemoteVolume = ({ userId, volume_percent }) => api.put('spotify/playback/volume', { volume_percent }, { headers: { 'x-user-id': userId }}).then(r => r.data);
export const getRemoteDevices = (userId) => api.get('spotify/me/devices', { headers: { 'x-user-id': userId }}).then(r => r.data);
export const transferRemotePlayback = ({ userId, device_id, play = true }) =>
  api.put('spotify/playback/transfer', { device_id, play }, { headers: { 'x-user-id': userId }}).then(r => r.data);

// Playback History APIs
export const startPlaybackHistory = ({ userId, track, playbackSource }) =>
  api.post('spotify/playback/history/start', { userId, track, playbackSource }, { headers: { 'x-user-id': userId }}).then(r => r.data);
export const completePlaybackHistory = ({ userId, historyId, positionMs, durationMs }) =>
  api.post('spotify/playback/history/complete', { userId, historyId, positionMs, durationMs }, { headers: { 'x-user-id': userId }}).then(r => r.data);

// Song Like APIs
export const toggleLikeSong = (songIdOrSpotifyId, songPayload) =>
  api.post(`playlists/songs/${encodeURIComponent(songIdOrSpotifyId)}/like`, songPayload ? { song: songPayload } : undefined).then(res => res.data);
export const getMyLikedSongs = () => api.get('playlists/songs/liked/me').then(res => res.data);

// Recommendation APIs
export const getRecommendedPlaylists = () => api.get('recommendations/playlists').then(res => res.data);
export const getSimilarUsers = () => api.get('recommendations/users').then(res => res.data);
export const getTrendingPlaylists = () => api.get('recommendations/trending').then(res => res.data);
export const getRandomPlaylists = () => api.get('playlists/random').then(res => res.data);

// Utility APIs
export const testConnection = () => api.get('users/test').then(res => res.data);

// ==================== DEFAULT EXPORT ====================

const apiService = {
  // Authentication
  register,
  login,
  getMe,

  // User Management
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getUserProfile,
  toggleFollow,
  updateProfile,

  // Playlist Management
  createPlaylist,
  getMyPlaylists,
  getPlaylistsByUserId,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  savePlaylist,

  // Playlist Songs
  addSongToPlaylist,
  removeSongFromPlaylist,

  // Playlist Interactions
  toggleLikePlaylist,
  getLikedPlaylists,
  getPopularPlaylists,

  // Playlist Sharing
  createShareLink,
  getSharedPlaylist,
  getShareStats,
  deactivateShareLink,
  updateShareSettings,

  // Posts
  getPosts,
  createPost,
  likePost,
  updatePost,
  deletePost,
  toggleSavePost,
  getSavedPosts,

  // Spotify
  searchTracks,
  searchPlaylists,
  exchangeSpotifyCode,
  refreshSpotifyToken,
  getSpotifyPremiumStatus,
  getSpotifyProfile,
  revokeSpotifySession,
  // Remote playback control
  getPlaybackState,
  playRemote,
  pauseRemote,
  nextRemote,
  previousRemote,
  seekRemote,
  setRemoteVolume,
  getRemoteDevices,
  transferRemotePlayback,
  // Playback history
  startPlaybackHistory,
  completePlaybackHistory,
  toggleLikeSong,
  getMyLikedSongs,

  // Recommendations
  getRecommendedPlaylists,
  getSimilarUsers,
  getTrendingPlaylists,
  getRandomPlaylists,

  // Utilities
  testConnection,

  // Password Reset (new flow)
  requestPasswordReset: (email) => api.post('users/password-reset/request', { email }).then(r => r.data),
  verifyPasswordResetCode: ({ email, code, newPassword }) => api.post('users/password-reset/verify', { email, code, newPassword }).then(r => r.data),

  // Internal utilities (for debugging)
  _config: CONFIG,
  _apiUrl: API_URL,
  _isTunnelMode: isTunnelMode,
};

export default apiService;
```

-----

## Frontend/screens/PlaylistDetailScreen.js

```javascript
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, Share, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPlaylistDetails, updatePlaylist, deletePlaylist, toggleLikePlaylist, createShareLinkAsync, fetchLikedPlaylists, savePlaylistAsync } from '../store/slices/playlistSlice';
import { playTrackWithPlaylist } from '../store/slices/playerSlice';
import { fetchLikedSongs, toggleLikeSongThunk } from '../store/slices/likedSongsSlice';
import { addRecentPlaylist } from '../store/slices/recentPlaylistsSlice';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SongListItem from '../components/SongListItem';
import * as ApiService from '../services/apiService';

const placeholderAlbum = require('../assets/images/placeholder_album.png');

// 4개 이미지 격자를 렌더링하는 컴포넌트
const PlaylistHeaderImage = ({ songs }) => {
  const placeholderUrl = require('../assets/images/placeholder_album.png');

  const imageUrls = Array(4).fill(null).map((_, index) => {
    return (songs && songs[index]?.album_cover_url) || null;
  });

  const getImageSource = (imageUrl) => {
    if (!imageUrl) {
      return placeholderUrl;
    }
    if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
      return { uri: imageUrl };
    }
    return placeholderUrl;
  };

  return (
    <View style={styles.playlistImageGrid}>
      <View style={styles.imageRow}>
        <Image source={getImageSource(imageUrls[0])} style={styles.gridImage} />
        <Image source={getImageSource(imageUrls[1])} style={styles.gridImage} />
      </View>
      <View style={styles.imageRow}>
        <Image source={getImageSource(imageUrls[2])} style={styles.gridImage} />
        <Image source={getImageSource(imageUrls[3])} style={styles.gridImage} />
      </View>
    </View>
  );
};

const PlaylistDetailScreen = ({ route, navigation }) => {
  const dispatch = useDispatch();
  const { playlistId } = route.params;
  const { currentPlaylist, status, likedPlaylists } = useSelector((state) => state.playlist);
  const { map: likedSongsMap } = useSelector((state) => state.likedSongs);
  const { user } = useSelector((state) => state.auth);
  const spotify = useSelector((state) => state.spotify);

  const [menuVisible, setMenuVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likeInflight, setLikeInflight] = useState({});

  const { userPlaylists } = useSelector((state) => state.playlist); // 내 플레이리스트 목록 가져오기

  useEffect(() => {
    if (playlistId) {
      dispatch(fetchPlaylistDetails(playlistId));
      dispatch(fetchLikedPlaylists());
      dispatch(fetchLikedSongs());
    }
  }, [dispatch, playlistId]);

  useEffect(() => {
    if (currentPlaylist) {
      setEditTitle(currentPlaylist.title || '');
      setEditDescription(currentPlaylist.description || '');
      const liked = !!(likedPlaylists || []).find(p => p.id === currentPlaylist.id) || currentPlaylist.liked || false;
      setIsLiked(liked);
    }
  }, [currentPlaylist, likedPlaylists]);

  useEffect(() => {
    if (!currentPlaylist || !currentPlaylist.id) {
      return;
    }

    const isOwner = currentPlaylist && user && currentPlaylist.user_id === user.id;

    const coverImages = Array.isArray(currentPlaylist.cover_images) && currentPlaylist.cover_images.length > 0
      ? currentPlaylist.cover_images
      : (currentPlaylist.songs || [])
          .slice(0, 4)
          .map((song) => song?.album_cover_url)
          .filter(Boolean);

    const coverImageUrl = coverImages.length > 0
      ? coverImages[0]
      : currentPlaylist.cover_image_url || null;

    dispatch(addRecentPlaylist({
      id: currentPlaylist.id,
      title: currentPlaylist.title,
      description: currentPlaylist.description,
      cover_images: coverImages,
      cover_image_url: coverImageUrl,
      user: currentPlaylist.user ? {
        id: currentPlaylist.user.id,
        display_name: currentPlaylist.user.display_name,
      } : null,
    }));
  }, [dispatch, currentPlaylist?.id]);


  const isAlreadySaved = useMemo(() => {
    if (!currentPlaylist || !Array.isArray(userPlaylists)) {
        return false;
    }
    const originalCreatorName = currentPlaylist.user?.display_name || 'Unknown';
    const expectedSavedTitle = `'${originalCreatorName}'님의 ${currentPlaylist.title}`;

    return userPlaylists.some(p => p.title === expectedSavedTitle && p.user_id === user?.id);
    }, [currentPlaylist, userPlaylists, user?.id]);

  const handleEditPlaylist = () => {
    setMenuVisible(false);
    setEditModalVisible(true);
  };

  const handlePlayTrack = (song) => {
    dispatch(playTrackWithPlaylist(song, currentPlaylist.songs));
    navigation.navigate('Player');
  };

  const handlePlayAll = async () => {
    if (!currentPlaylist?.songs?.length) {
      Alert.alert('알림', '플레이리스트에 곡이 없습니다.');
      return;
    }

    try {
      // If Spotify full-track requires auth, route to Profile to connect then auto-play
      const needsSpotify = !spotify?.accessToken || !spotify?.isPremium;
      if (needsSpotify) {
        navigation.navigate('Main', {
          screen: 'Profile',
          params: {
            postConnect: {
              action: 'playAll',
              // Pass minimal data needed to start playback
              playlist: currentPlaylist.songs,
            }
          }
        });
        return;
      }

      await dispatch(playTrackWithPlaylist({ playlist: currentPlaylist.songs }));
      navigation.navigate('Player');
    } catch (error) {
      const message = typeof error === 'string' ? error : error?.message || '재생에 실패했습니다.';
      Alert.alert('재생 실패', message);
    }
  };

  // ❗ [수정됨] 최종 삭제 핸들러 로직
  const handleDeletePlaylist = () => {
    console.log('🚨 handleDeletePlaylist 함수 호출됨!');
    console.log('playlistId:', playlistId);
    console.log('currentPlaylist:', currentPlaylist);

    // route.params에서 받은 playlistId가 가장 확실한 값
    if (!playlistId) {
      console.log('❌ playlistId가 없음');
      Alert.alert('❌ 오류', '플레이리스트 ID가 없어 삭제할 수 없습니다.');
      return;
    }

    console.log('📱 Alert.alert 호출 시도...');
    setMenuVisible(false); // 메뉴를 먼저 닫아 UI 충돌 방지

    Alert.alert(
      '⚠️ 플레이리스트 삭제',
      `"${currentPlaylist?.title || '이 플레이리스트'}"을(를) 정말로 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없으며, 플레이리스트와 모든 곡이 영구적으로 삭제됩니다.`,
      [
        {
          text: '취소',
          style: 'cancel',
          onPress: () => console.log('✋ 플레이리스트 삭제 취소됨')
        },
        {
          text: '영구 삭제',
          style: 'destructive',
          onPress: async () => {
            console.log('💥 삭제 확인됨 - 실제 삭제 시작');
            try {
              console.log('🗑️ 플레이리스트 삭제 시작:', playlistId);
              await dispatch(deletePlaylist(playlistId)).unwrap();
              navigation.navigate('Main', { screen: 'Home' });
            } catch (error) {
              console.error('❌ 플레이리스트 삭제 실패:', error);
              Alert.alert('❌ 삭제 실패', error || '플레이리스트 삭제 중 오류가 발생했습니다.');
            }
          },
        },
      ],
      { cancelable: false }
    );
    console.log('📱 Alert.alert 호출 완료');
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      Alert.alert('오류', '플레이리스트 제목을 입력해주세요.');
      return;
    }

    try {
      await dispatch(updatePlaylist({
        playlistId: currentPlaylist.id,
        playlistData: {
          title: editTitle.trim(),
          description: editDescription.trim()
        }
      })).unwrap();

      Alert.alert('성공', '플레이리스트가 수정되었습니다.');
      setEditModalVisible(false);
    } catch (error) {
      Alert.alert('오류', error || '플레이리스트 수정에 실패했습니다.');
    }
  };

  const handleRemoveSong = (song) => {
    console.log('🎵 handleRemoveSong 함수 호출됨!');
    console.log('song:', song);

    const performRemove = async () => {
      console.log('💥 곡 제거 확인됨 - 실제 제거 시작');
      try {
        console.log('🗑️ 곡 제거 시작:', { playlistId: currentPlaylist.id, songId: song.id });
        await ApiService.removeSongFromPlaylist(currentPlaylist.id, song.id);
        dispatch(fetchPlaylistDetails(currentPlaylist.id));
        Alert.alert('✅ 제거 완료', '곡이 플레이리스트에서 제거되었습니다.');
      } catch (error) {
        console.error('❌ 곡 제거 실패:', error);
        const msg = `곡 제거 중 오류가 발생했습니다.\n\n${error.message || '알 수 없는 오류가 발생했습니다.'}`;
        Alert.alert('❌ 제거 실패', msg);
      }
    };

    // 모든 플랫폼에서 Alert.alert 사용

    Alert.alert(
      '🎵 곡 제거',
      `"${song.name || song.title}"을(를) 플레이리스트에서 제거하시겠습니까?\n\n💡 곡 자체는 삭제되지 않으며, 이 플레이리스트에서만 제거됩니다.`,
      [
        { text: '취소', style: 'cancel', onPress: () => console.log('✋ 곡 제거 취소됨') },
        { text: '제거', style: 'destructive', onPress: performRemove },
      ],
      { cancelable: false }
    );
  };

    //  좋아요 버튼 핸들러
  const handleToggleLike = async () => {
    if (!currentPlaylist?.id) return;
    try {
      const result = await dispatch(toggleLikePlaylist(currentPlaylist.id)).unwrap();
      setIsLiked(result.liked);
    } catch (error) {
      Alert.alert('오류', '좋아요 처리 중 문제가 발생했습니다.');
    }
  };

  //  담기 버튼 핸들러
  const handleSavePlaylist = async () => {
    if (!currentPlaylist?.id) return;
    if (isAlreadySaved) {
        Alert.alert('알림', '이미 내 라이브러리에 담은 플레이리스트입니다.');
        return;
    }
    try {
      await dispatch(savePlaylistAsync(currentPlaylist.id)).unwrap();
      Alert.alert('플레이리스트 담기 완료', `'${currentPlaylist.title}' 플레이리스트가 내 플레이리스트에 추가되었습니다.`);
    } catch (error) {
      Alert.alert('오류', error || '플레이리스트를 담는 중 오류가 발생했습니다.');
    }
  };
  const handleToggleSongLike = async (song) => {
    const key = song?.id || song?.spotify_id;
    if (!key) return;
    if (likeInflight[key]) return;
    setLikeInflight(prev => ({ ...prev, [key]: true }));
    try {
      await dispatch(toggleLikeSongThunk(song)).unwrap();
    } catch (e) {
      const msg = e?.message || '곡 좋아요 처리 중 오류가 발생했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setLikeInflight(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleShare = async () => {
    if (!currentPlaylist?.id) return;
    try {
      const result = await dispatch(createShareLinkAsync(currentPlaylist.id)).unwrap();
      const shareUrl = result.share_url;
      await Share.share({
        message: `Stonetify에서 "${currentPlaylist.title}" 플레이리스트를 확인해보세요!\n${shareUrl}`,
        url: shareUrl,
        title: `Stonetify 플레이리스트: ${currentPlaylist.title}`
      });
    } catch (error) {
      Alert.alert('오류', '공유 링크 생성 중 문제가 발생했습니다.');
    }
  };

  // 소유자 확인 (디버깅 추가)
  const isOwner = currentPlaylist && user && currentPlaylist.user_id === user.id;
  console.log('🔍 isOwner 디버깅:', {
    currentPlaylist: !!currentPlaylist,
    user: !!user,
    currentPlaylistUserId: currentPlaylist?.user_id,
    userId: user?.id,
    isOwner
  });

  if (status === 'loading' || !currentPlaylist) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8A2BE2" />
      </View>
    );
  }

  const renderHeader = () => (
    <LinearGradient colors={['#4c1e6e', '#121212']} style={styles.header}>
      <PlaylistHeaderImage songs={currentPlaylist.songs || []} />
      <Text style={styles.title}>{currentPlaylist.title}</Text>
      {currentPlaylist.description ? (
        <Text style={styles.description}>{currentPlaylist.description}</Text>
      ) : null}
      <Text style={styles.creator}>
        By {currentPlaylist.user?.display_name || 'Unknown User'}
      </Text>

      <View style={styles.actionButtons}>
        {/* 디버깅을 위해 임시로 항상 표시 */}
        {isOwner ? (
          // 내 플레이리스트: 메뉴, 좋아요, 공유
          <>
            <TouchableOpacity style={styles.iconButton} onPress={() => setMenuVisible(true)}>
              <Ionicons name="ellipsis-horizontal" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleToggleLike}>
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#1DB954" : "white"} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="white" />
            </TouchableOpacity>
          </>
        ) : (
          // 다른 사용자 플레이리스트: 좋아요, 담기, 공유
          <>
            {/* 좋아요 버튼 */}
            <TouchableOpacity style={styles.iconButton} onPress={handleToggleLike}>
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#1DB954" : "white"} />
            </TouchableOpacity>
            {/* 담기 버튼 */}
            <TouchableOpacity style={styles.iconButton} onPress={handleSavePlaylist}>
              {/* 아이콘: 이미 담았으면 체크, 아니면 추가 */}
              <Ionicons name={isAlreadySaved ? "checkmark-circle" : "add-circle-outline"} size={26} color={isAlreadySaved ? "#1DB954" : "white"} />
            </TouchableOpacity>
            {/* 공유 버튼 */}
            <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="white" />
            </TouchableOpacity>
          </>
        )}

        {currentPlaylist.songs && currentPlaylist.songs.length > 0 && (
          <TouchableOpacity
            style={styles.playAllButton}
            onPress={handlePlayAll}
          >
            <Ionicons name="play" size={18} color="#121212" style={styles.playAllIcon} />
            <Text style={styles.playAllText}>전체재생</Text>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      <View style={styles.fixedHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.fixedBackButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={currentPlaylist.songs || []}
        keyExtractor={(item, index) => `${playlistId}:${item?.id ?? item?.spotify_id ?? index}`}
        renderItem={({ item, index }) => {
          if (!item) return null;
          return (
            <SongListItem
              item={item}
              onPress={() => handlePlayTrack(item)}
              showRemoveButton={isOwner}
              onRemovePress={handleRemoveSong}
              showLikeButton
              onLikePress={handleToggleSongLike}
              liked={!!(likedSongsMap[item?.id] || likedSongsMap[item?.spotify_id])}
            />
          );
        }}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={true}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={48} color="#404040" />
            <Text style={styles.emptyText}>이 플레이리스트에는 아직 곡이 없습니다</Text>
            {isOwner && <Text style={styles.emptySubtext}>곡을 추가해보세요</Text>}
          </View>
        )}
      />


      {isOwner && (
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setMenuVisible(false)}
          activeOpacity={1}
        >
          <View style={styles.menuModal}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEditPlaylist}>
              <Ionicons name="create-outline" size={24} color="#ffffff" />
              <Text style={styles.menuItemText}>플레이리스트 수정</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.deleteMenuItem]}
              onPress={() => {
                console.log('🔴 삭제 메뉴 아이템 클릭됨');
                handleDeletePlaylist();
              }}
            >
              <Ionicons name="trash-outline" size={24} color="#ff4444" />
              <Text style={[styles.menuItemText, styles.deleteMenuText]}>플레이리스트 삭제</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    )}

      {isOwner && (
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>플레이리스트 수정</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <View style={styles.editForm}>
              <Text style={styles.inputLabel}>제목</Text>
              <TextInput
                style={styles.textInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="플레이리스트 제목을 입력하세요"
                placeholderTextColor="#666"
              />

              <Text style={styles.inputLabel}>설명</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="플레이리스트 설명을 입력하세요"
                placeholderTextColor="#666"
                multiline={true}
                numberOfLines={4}
              />

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.saveButtonText}>저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 100,
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  fixedBackButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  playlistImageGrid: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  imageRow: {
    flexDirection: 'row',
    flex: 1,
  },
  gridImage: {
    flex: 1,
    height: '100%',
    backgroundColor: '#282828',
    borderWidth: 0.5,
    borderColor: '#1a1a1a',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  description: {
    color: '#b3b3b3',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  creator: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600'
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 20,
  },
  menuButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1DB954',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginLeft: 12,
  },
  playAllIcon: {
    marginRight: 8,
  },
  playAllText: {
    color: '#121212',
    fontWeight: '700',
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#ffffff',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#a7a7a7',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuModal: {
    backgroundColor: '#282828',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  deleteMenuItem: {
    borderTopWidth: 1,
    borderTopColor: '#404040',
  },
  menuItemText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  deleteMenuText: {
    color: '#ff4444',
  },
  editModal: {
    backgroundColor: '#282828',
    borderRadius: 12,
    margin: 20,
    width: '90%',
    maxWidth: 400,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  editTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  editForm: {
    padding: 20,
  },
  inputLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: '#404040',
    color: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#555',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#404040',
  },
  saveButton: {
    backgroundColor: '#1DB954',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  likeButton: {
    marginRight: 16,
  },
  shareButton: {
    marginRight: 16,
  },
});

export default PlaylistDetailScreen;
```