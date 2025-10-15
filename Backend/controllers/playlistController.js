const asyncHandler = require('express-async-handler');
const {
    Playlist,
    Song,
    PlaylistSongs,
    LikedPlaylist,
    ShareLink,
    SongLike,
} = require('../models');
const { successResponse } = require('../utils/responses');
const { ApiError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const {
    buildPlaylistDetails,
    ensurePlaylist,
    normalizeSongForClient,
    sortByDateDesc,
    buildShareUrl,
} = require('../utils/controllerUtils');

const ensureOwnedPlaylist = async (playlistId, userId) =>
    ensurePlaylist(playlistId, {
        requireOwnerId: userId,
        forbiddenMessage: '자신이 생성한 플레이리스트만 사용할 수 있습니다.',
    });

const normalizeSongPayload = (raw, fallbackId) => ({
    spotify_id: raw?.spotify_id || raw?.id || fallbackId,
    title: raw?.title || raw?.name,
    artist: raw?.artist || raw?.artists,
    album: raw?.album || '',
    album_cover_url: raw?.album_cover_url || raw?.albumCoverUrl || null,
    preview_url: raw?.preview_url || raw?.previewUrl || null,
    duration_ms: raw?.duration_ms || raw?.durationMs || null,
    external_urls: raw?.external_urls || raw?.external_url || null,
});

const resolveSongRecord = async ({ songId, payload, createIfMissing = false }) => {
    const key = songId || payload?.spotify_id || payload?.id;
    let song = key ? await Song.findById(key) : null;
    if (!song && key) {
        song = await Song.findBySpotifyId(key);
    }

    if (!song && createIfMissing && payload) {
        const normalized = normalizeSongPayload(payload, key);
        if (!normalized.spotify_id) {
            return null;
        }
        song = await Song.findOrCreate(normalized);
    }

    return song;
};

const getMyPlaylists = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const playlists = await Playlist.findByUserId(userId);
    const detailed = await Promise.all(
        playlists.map((playlist) => buildPlaylistDetails(playlist)),
    );
    const sorted = sortByDateDesc(detailed.filter(Boolean));

    successResponse(res, { data: sorted });
});

const createPlaylist = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { title, description, is_public } = req.body;

    const playlistId = await Playlist.create({
        user_id: userId,
        title,
        description,
        is_public,
    });
    const created = await Playlist.findById(playlistId);
    const detail = await buildPlaylistDetails(created);

    logger.info('Playlist created', { playlistId, userId });

    successResponse(res, {
        statusCode: 201,
        data: detail,
        message: '플레이리스트를 생성했습니다.',
    });
});

const getPlaylistById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const playlist = await ensurePlaylist(id);
    const detail = await buildPlaylistDetails(playlist, { includeSongs: true });

    successResponse(res, { data: detail });
});

const getPlaylistsByUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const playlists = await Playlist.findByUserId(userId);
    const publicPlaylists = playlists.filter((playlist) => playlist.is_public !== false);
    const detailed = await Promise.all(
        publicPlaylists.map((playlist) => buildPlaylistDetails(playlist)),
    );
    const sorted = sortByDateDesc(detailed.filter(Boolean));

    successResponse(res, { data: sorted });
});

const searchPlaylists = asyncHandler(async (req, res) => {
    const { q } = req.query;
    if (!q) {
        successResponse(res, { data: [] });
        return;
    }

    const playlists = await Playlist.searchPlaylists(q);
    const detailed = await Promise.all(
        playlists.map((playlist) => buildPlaylistDetails(playlist)),
    );

    successResponse(res, { data: detailed.filter(Boolean) });
});

const updatePlaylist = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    await ensureOwnedPlaylist(id, userId);

    const updated = await Playlist.update(id, req.body || {});
    const detail = await buildPlaylistDetails(updated);

    successResponse(res, {
        data: detail,
        message: '플레이리스트가 업데이트되었습니다.',
    });
});

const deletePlaylist = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    await ensureOwnedPlaylist(id, userId);

    await Playlist.delete(id);
    logger.info('Playlist deleted', { playlistId: id, userId });

    successResponse(res, {
        message: '플레이리스트가 삭제되었습니다.',
    });
});

const addSongToPlaylist = asyncHandler(async (req, res) => {
        const { id: playlistId } = req.params;
        const userId = req.user.id;
        const { song: rawSong } = req.body || {};

    if (!rawSong) {
        throw ApiError.badRequest('추가할 곡 정보가 필요합니다.');
    }

        await ensureOwnedPlaylist(playlistId, userId);
        const songKey = rawSong.spotify_id || rawSong.id;
        const song = await resolveSongRecord({ songId: songKey, payload: rawSong, createIfMissing: true });
    if (!song) {
        throw ApiError.badRequest('곡 정보를 확인할 수 없습니다.');
    }

    const existingLink = await PlaylistSongs.findByPlaylistAndSong(playlistId, song.id);
    if (existingLink) {
        throw ApiError.conflict('이미 플레이리스트에 있는 곡입니다.');
    }

    await PlaylistSongs.addToPlaylist(playlistId, song.id);
    logger.info('Song added to playlist', { playlistId, songId: song.id, userId });

    successResponse(res, {
        statusCode: 201,
        message: '플레이리스트에 곡을 추가했습니다.',
    });
});

const removeSongFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, songId } = req.params;
    const userId = req.user.id;

    await ensureOwnedPlaylist(playlistId, userId);
    const song = await resolveSongRecord({ songId });
    if (!song) {
        throw ApiError.notFound('곡을 찾을 수 없습니다.');
    }

    let removed = await PlaylistSongs.deleteByPlaylistAndSong(playlistId, song.id);
    if (!removed) {
        const links = await PlaylistSongs.findByPlaylistId(playlistId);
        for (const link of links) {
            const linkSong = await Song.findById(link.song_id);
            if (linkSong && (linkSong.id === song.id || linkSong.spotify_id === song.spotify_id)) {
                await PlaylistSongs.delete(link.id);
                removed = true;
                break;
            }
        }
    }

    if (!removed) {
        throw ApiError.notFound('플레이리스트에서 해당 곡을 찾을 수 없습니다.');
    }

    logger.info('Song removed from playlist', { playlistId, songId: song.id, userId });
    successResponse(res, {
        message: '플레이리스트에서 곡을 삭제했습니다.',
    });
});

const likePlaylist = asyncHandler(async (req, res) => {
    const { id: playlistId } = req.params;
    const userId = req.user.id;
    await ensurePlaylist(playlistId);

    const existing = await LikedPlaylist.findByUserAndPlaylist(userId, playlistId);
    if (existing) {
        await LikedPlaylist.delete(existing.id);
        successResponse(res, {
            data: { liked: false },
            message: '플레이리스트 좋아요를 취소했습니다.',
        });
        return;
    }

    await LikedPlaylist.create({ user_id: userId, playlist_id: playlistId });
    successResponse(res, {
        data: { liked: true },
        message: '플레이리스트를 좋아요했습니다.',
    });
});

const getLikedPlaylists = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const relations = await LikedPlaylist.findByUserId(userId);
    const detailed = await Promise.all(
        relations.map(async (relation) => {
            const playlist = await Playlist.findById(relation.playlist_id);
            if (!playlist) return null;
            const detail = await buildPlaylistDetails(playlist);
            return detail ? { ...detail, liked_at: relation.liked_at || relation.created_at } : null;
        }),
    );

    const sorted = detailed
        .filter(Boolean)
        .sort((a, b) => (b.liked_at || 0) - (a.liked_at || 0));

    successResponse(res, { data: sorted });
});

const createShareLink = asyncHandler(async (req, res) => {
    const { playlist_id: playlistId } = req.params;
    const userId = req.user.id;
    const playlist = await ensureOwnedPlaylist(playlistId, userId);

    const activeLinks = await ShareLink.findActiveByPlaylistId(playlist.id);
    if (activeLinks.length > 0) {
        const link = activeLinks[0];
        successResponse(res, {
            data: {
                share_id: link.id,
                share_url: buildShareUrl(req, link.id),
                created_at: link.created_at,
            },
            message: '이미 생성된 공유 링크가 있습니다.',
        });
        return;
    }

    const shareLink = await ShareLink.findOrCreateForPlaylist(playlist.id, userId);

    successResponse(res, {
        statusCode: 201,
        data: {
            share_id: shareLink.id,
            share_url: buildShareUrl(req, shareLink.id),
            created_at: shareLink.created_at,
        },
        message: '공유 링크를 생성했습니다.',
    });
});

const getSharedPlaylist = asyncHandler(async (req, res) => {
    const { share_id: shareId } = req.params;
    const shareLink = await ShareLink.findById(shareId);
    if (!shareLink || !shareLink.is_active || (shareLink.expires_at && shareLink.expires_at < Date.now())) {
        throw ApiError.notFound('유효하지 않은 공유 링크입니다.');
    }

    await ShareLink.update(shareLink.id, {
        view_count: (shareLink.view_count || 0) + 1,
    });

    const playlist = await ensurePlaylist(shareLink.playlist_id);
    const detail = await buildPlaylistDetails(playlist, { includeSongs: true });

    successResponse(res, {
        data: {
            ...detail,
            shared_at: shareLink.created_at,
        },
    });
});

const getShareStats = asyncHandler(async (req, res) => {
    const { playlist_id: playlistId } = req.params;
    await ensureOwnedPlaylist(playlistId, req.user.id);

    const links = await ShareLink.findByPlaylistId(playlistId);
    const totalViews = links.reduce((sum, link) => sum + (link.view_count || 0), 0);
    const activeLinks = links.filter((link) => link.is_active);

    successResponse(res, {
        data: {
            total_shares: links.length,
            active_shares: activeLinks.length,
            total_views: totalViews,
            share_links: activeLinks.map((link) => ({
                share_id: link.id,
                share_url: buildShareUrl(req, link.id),
                view_count: link.view_count || 0,
                created_at: link.created_at,
            })),
        },
    });
});

const deactivateShareLink = asyncHandler(async (req, res) => {
    const { playlist_id: playlistId } = req.params;
    await ensureOwnedPlaylist(playlistId, req.user.id);

    const links = await ShareLink.findByPlaylistId(playlistId);
    await Promise.all(links.map((link) => ShareLink.deactivate(link.id)));

    successResponse(res, {
        message: '모든 공유 링크를 비활성화했습니다.',
    });
});

const getRandomPlaylists = asyncHandler(async (_req, res) => {
    const publicPlaylists = await Playlist.findPublicPlaylists();
    if (!publicPlaylists?.length) {
        successResponse(res, { data: [] });
        return;
    }

    const shuffled = [...publicPlaylists];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selected = shuffled.slice(0, 10);
    const detailed = await Promise.all(selected.map((playlist) => buildPlaylistDetails(playlist)));

    successResponse(res, { data: detailed.filter(Boolean) });
});

const toggleLikeSong = asyncHandler(async (req, res) => {
    const { songId } = req.params;
    const payloadSong = req.body?.song;
    const song = await resolveSongRecord({ songId, payload: payloadSong, createIfMissing: true });
    if (!song) {
        throw ApiError.notFound('곡을 찾을 수 없습니다.');
    }

    const result = await SongLike.toggle(req.user.id, song.id);
    successResponse(res, { data: { ...result, song: normalizeSongForClient(song) } });
});

const getMyLikedSongs = asyncHandler(async (req, res) => {
    const likes = await SongLike.findByUserId(req.user.id);
    const songs = await Promise.all(
        likes.map(async (like) => {
            const song = await Song.findById(like.song_id);
            if (!song) return null;
            return {
                ...normalizeSongForClient(song),
                liked_at: like.liked_at,
            };
        }),
    );

    const sorted = songs
        .filter(Boolean)
        .sort((a, b) => (b.liked_at || 0) - (a.liked_at || 0));

    successResponse(res, { data: sorted });
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
    toggleLikeSong,
    getMyLikedSongs,
};