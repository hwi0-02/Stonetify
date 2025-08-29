const { Playlist, User, Song, LikedPlaylist, sequelize } = require('../models');
const asyncHandler = require('express-async-handler');

// 내 플레이리스트 목록 조회 (메인 화면용)
const getMyPlaylists = asyncHandler(async (req, res) => {
    const user_id = req.user.id;

    try {
        const playlists = await Playlist.findAll({
            where: { user_id },
            include: [{
                model: Song,
                as: 'songs',
                attributes: ['album_cover_url'],
                through: { 
                    attributes: []
                }
            }],
            order: [[sequelize.col('created_at'), 'DESC']]
        });

        // 각 플레이리스트에 썸네일용 커버 이미지들(최대 4개) 추가
        const playlistsWithCovers = playlists.map(p => {
            const plainPlaylist = p.get({ plain: true });
            
            // 썸네일용 커버 이미지들 (최대 4개)
            const coverImages = plainPlaylist.songs
                .slice(0, 4)
                .map(song => song.album_cover_url)
                .filter(url => url); // null/undefined 제거
                
            plainPlaylist.cover_images = coverImages;
            // 기존 cover_image_url도 유지 (호환성을 위해)
            plainPlaylist.cover_image_url = coverImages.length > 0 ? coverImages[0] : null;
            
            delete plainPlaylist.songs; // 불필요한 songs 배열 제거
            return plainPlaylist;
        });

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

    const playlist = await Playlist.create({
        user_id,
        title,
        description,
        is_public: is_public === false ? false : true,
    });

    res.status(201).json(playlist);
});

// 특정 플레이리스트 상세 조회
const getPlaylistById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    try {
        const playlist = await Playlist.findByPk(id, {
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'display_name']
            }, {
                model: Song,
                as: 'songs',
                attributes: ['id', 'title', 'artist', 'album', 'album_cover_url', 'preview_url'],
                through: { 
                    attributes: []
                }
            }]
        });

        if (!playlist) {
            res.status(404);
            throw new Error('플레이리스트를 찾을 수 없습니다.');
        }

        const playlistData = playlist.get({ plain: true });
        res.status(200).json(playlistData);
    } catch (error) {
        console.error('❌ Error in getPlaylistById:', error);
        res.status(500).json({ error: error.message });
    }
});

// 사용자별 플레이리스트 목록 조회 (타인 프로필용)
const getPlaylistsByUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    try {
        const playlists = await Playlist.findAll({
            where: { user_id: userId, is_public: true }, // 공개 플레이리스트만
            include: [{
                model: Song,
                as: 'songs',
                attributes: ['album_cover_url'],
                through: { 
                    attributes: []
                }
            }]
        });

        // 각 플레이리스트에 썸네일용 커버 이미지들(최대 4개) 추가
        const playlistsWithCovers = playlists.map(p => {
            const plainPlaylist = p.get({ plain: true });
            
            // 썸네일용 커버 이미지들 (최대 4개)
            const coverImages = plainPlaylist.songs
                .slice(0, 4)
                .map(song => song.album_cover_url)
                .filter(url => url); // null/undefined 제거
                
            plainPlaylist.cover_images = coverImages;
            // 기존 cover_image_url도 유지 (호환성을 위해)
            plainPlaylist.cover_image_url = coverImages.length > 0 ? coverImages[0] : null;
            
            delete plainPlaylist.songs;
            return plainPlaylist;
        });

        res.status(200).json(playlistsWithCovers);
    } catch (error) {
        console.error('❌ Error in getPlaylistsByUser:', error);
        res.status(500).json({ error: error.message });
    }
});

// 플레이리스트 정보 수정
const updatePlaylist = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { id: userId } = req.user;
    const { title, description, is_public } = req.body;

    const playlist = await Playlist.findByPk(id);

    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        res.status(403);
        throw new Error('자신이 생성한 플레이리스트만 수정할 수 있습니다.');
    }

    playlist.title = title || playlist.title;
    playlist.description = description || playlist.description;
    playlist.is_public = is_public === undefined ? playlist.is_public : is_public;

    const updatedPlaylist = await playlist.save();
    res.status(200).json(updatedPlaylist);
});

// 플레이리스트 삭제
const deletePlaylist = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { id: userId } = req.user;

    const playlist = await Playlist.findByPk(id);

    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        res.status(403);
        throw new Error('자신이 생성한 플레이리스트만 삭제할 수 있습니다.');
    }

    // 연관된 데이터들 삭제 (Sequelize의 cascade 삭제가 작동하지 않을 경우를 대비)
    try {
        // playlist_songs 테이블에서 연관 레코드 삭제
        await sequelize.query('DELETE FROM playlist_songs WHERE playlist_id = ?', {
            replacements: [id],
            type: sequelize.QueryTypes.DELETE
        });
        
        // liked_playlists 테이블에서 연관 레코드 삭제
        await sequelize.query('DELETE FROM liked_playlists WHERE playlist_id = ?', {
            replacements: [id],
            type: sequelize.QueryTypes.DELETE
        });
        
        // 플레이리스트 삭제
        await playlist.destroy();
        
        res.status(200).json({ message: '플레이리스트가 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error('플레이리스트 삭제 중 오류:', error);
        res.status(500);
        throw new Error('플레이리스트 삭제 중 오류가 발생했습니다.');
    }
});

// 플레이리스트에 곡 추가
const addSongToPlaylist = asyncHandler(async (req, res) => {
    const { id: playlistId } = req.params;
    const { id: userId } = req.user;
    // spotify_id는 song.id로 받음
    const { song: songData } = req.body;

    if (!songData || !songData.id || !songData.name || !songData.artists || !songData.album) {
        res.status(400);
        throw new Error('곡 정보가 올바르지 않습니다.');
    }

    const playlist = await Playlist.findByPk(playlistId);

    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        res.status(403);
        throw new Error('자신이 생성한 플레이리스트에만 곡을 추가할 수 있습니다.');
    }

    const [song] = await Song.findOrCreate({
        where: { spotify_id: songData.id },
        defaults: { 
            title: songData.name, 
            artist: songData.artists, 
            album: songData.album,
            album_cover_url: songData.album_cover_url,
            preview_url: songData.preview_url
        }
    });

    const hasSong = await playlist.hasSong(song);
    if (hasSong) {
        res.status(409);
        throw new Error('이미 플레이리스트에 추가된 곡입니다.');
    }

    await playlist.addSong(song);
    res.status(201).json({ message: '플레이리스트에 곡이 성공적으로 추가되었습니다.' });
});

// 플레이리스트에서 곡 삭제
const removeSongFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, songId } = req.params;
    const { id: userId } = req.user;

    const playlist = await Playlist.findByPk(playlistId);
    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    if (playlist.user_id !== userId) {
        res.status(403);
        throw new Error('자신의 플레이리스트에 있는 곡만 삭제할 수 있습니다.');
    }

    const song = await Song.findByPk(songId);
    if (!song) {
        res.status(404);
        throw new Error('곡을 찾을 수 없습니다.');
    }

    const removed = await playlist.removeSong(song);
    if (removed) {
        res.status(200).json({ message: '플레이리스트에서 곡이 성공적으로 삭제되었습니다.' });
    } else {
        res.status(404);
        throw new Error('플레이리스트에서 해당 곡을 찾을 수 없습니다.');
    }
});

// 플레이리스트 좋아요
const likePlaylist = asyncHandler(async (req, res) => {
    const { id: playlistId } = req.params;
    const { id: userId } = req.user;

    const playlist = await Playlist.findByPk(playlistId);
    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    const user = await User.findByPk(userId);
    const hasLiked = await user.hasLikedPlaylist(playlist);

    if (hasLiked) {
        await user.removeLikedPlaylist(playlist);
        res.status(200).json({ message: '플레이리스트 좋아요를 취소했습니다.', liked: false });

    } else {
        await user.addLikedPlaylist(playlist);
        res.status(201).json({ message: '플레이리스트에 좋아요를 눌렀습니다.', liked: true });
    }
});


// 좋아요한 플레이리스트 목록 조회
const getLikedPlaylists = asyncHandler(async (req, res) => {
    const { id: userId } = req.user;
    const user = await User.findByPk(userId, {
        include: [{
            model: Playlist,
            as: 'likedPlaylists',
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'display_name']
            }]
        }]
    });

    if (!user) {
        res.status(404);
        throw new Error('사용자를 찾을 수 없습니다.');
    }

    res.status(200).json(user.likedPlaylists);
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
};