const { Playlist, User, Song, LikedPlaylist } = require('../models');
const asyncHandler = require('express-async-handler');

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
    const playlist = await Playlist.findByPk(id, {
        include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'display_name']
        }, {
            model: Song,
            as: 'songs',
            attributes: ['id', 'title', 'artist', 'album', 'preview_url'],
            through: { attributes: [] } // 중간 테이블 정보 제외
        }]
    });

    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    res.status(200).json(playlist);
});

// 사용자별 플레이리스트 목록 조회 (신규)
const getPlaylistsByUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const playlists = await Playlist.findAll({
        where: { user_id: userId },
        include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'display_name']
        }]
    });
    res.status(200).json(playlists);
});

// 플레이리스트에 담긴 곡 목록 조회
const getSongsInPlaylist = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const playlist = await Playlist.findByPk(id, {
        include: [{
            model: Song,
            as: 'songs',
            attributes: ['id', 'title', 'artist', 'album', 'preview_url'],
            through: { attributes: [] } // 중간 테이블 정보 제외
        }]
    });

    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    res.status(200).json(playlist.songs);
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

    await playlist.destroy();
    res.status(200).json({ message: '플레이리스트가 삭제되었습니다.' });
});

// 플레이리스트에 곡 추가
const addSongToPlaylist = asyncHandler(async (req, res) => {
    const { id: playlistId } = req.params;
    const { id: userId } = req.user;
    const { spotify_id, title, artist, album, preview_url } = req.body;

    if (!spotify_id || !title || !artist || !album) {
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
        where: { spotify_id },
        defaults: { title, artist, album, preview_url }
    });

    const hasSong = await playlist.hasSong(song);
    if (hasSong) {
        res.status(409);
        throw new Error('이미 플레이리스트에 추가된 곡입니다.');
    }

    await playlist.addSong(song);
    res.status(201).json({ message: '플레이리스트에 곡이 추가되었습니다.' });
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
        res.status(200).json({ message: '플레이리스트에서 곡이 삭제되었습니다.' });
    } else {
        res.status(404);
        throw new Error('플레이리스트에서 해당 곡을 찾을 수 없습니다.');
    }
});

// 플레이리스트 좋아요 (신규)
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
        res.status(409);
        throw new Error('이미 좋아요를 누른 플레이리스트입니다.');
    }

    await user.addLikedPlaylist(playlist);
    res.status(201).json({ message: '플레이리스트에 좋아요를 눌렀습니다.' });
});

// 플레이리스트 좋아요 취소 (신규)
const unlikePlaylist = asyncHandler(async (req, res) => {
    const { id: playlistId } = req.params;
    const { id: userId } = req.user;

    const playlist = await Playlist.findByPk(playlistId);
    if (!playlist) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없습니다.');
    }

    const user = await User.findByPk(userId);
    const removed = await user.removeLikedPlaylist(playlist);

    if (removed) {
        res.status(200).json({ message: '플레이리스트 좋아요를 취소했습니다.' });
    } else {
        res.status(404);
        throw new Error('좋아요 기록을 찾을 수 없습니다.');
    }
});

// 좋아요한 플레이리스트 목록 조회 (신규)
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
    createPlaylist,
    getPlaylistById,
    getPlaylistsByUser,
    getSongsInPlaylist,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    likePlaylist,
    unlikePlaylist,
    getLikedPlaylists,
};
