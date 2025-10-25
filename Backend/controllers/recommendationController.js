const { Playlist, User, Song, LikedPlaylist } = require('../models');
const { RealtimeDBHelpers, COLLECTIONS } = require('../config/firebase');
const asyncHandler = require('express-async-handler');

const shuffleArray = (array) => {
    const cloned = [...array];
    for (let i = cloned.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
    }
    return cloned;
};

const summarizePlaylist = async (playlist, viewerId = null) => {
    if (!playlist) return null;

    const [songs, owner, likeCount, isLiked] = await Promise.all([
        Song.findByPlaylistId(playlist.id),
        User.findById(playlist.user_id),
        LikedPlaylist.getLikeCount(playlist.id),
        viewerId ? LikedPlaylist.isLiked(viewerId, playlist.id) : false,
    ]);

    const coverImages = (songs || [])
        .slice(0, 4)
        .map((song) => song.album_cover_url)
        .filter(Boolean);

    return {
        id: playlist.id,
        title: playlist.title,
        description: playlist.description || '',
        user_id: playlist.user_id,
        user: owner
            ? {
                  id: owner.id,
                  display_name: owner.display_name,
                  profile_image_url: owner.profile_image_url || owner.profile_image || null,
              }
            : null,
        cover_images: coverImages,
        cover_image_url: coverImages[0] || null,
        songCount: songs.length,
        likeCount,
        isLiked: Boolean(isLiked),
        created_at: playlist.created_at || null,
    };
};

const buildArtistFrequency = async (playlistIds) => {
    const frequency = {};
    if (!playlistIds.length) return frequency;

    const songsLists = await Promise.all(playlistIds.map((id) => Song.findByPlaylistId(id)));
    songsLists.flat().forEach((song) => {
        if (!song || !song.artist) return;
        const artists = song.artist.split(',').map((name) => name.trim()).filter(Boolean);
        artists.forEach((artistName) => {
            frequency[artistName] = (frequency[artistName] || 0) + 1;
        });
    });
    return frequency;
};

// 사용자 기반 추천 플레이리스트 (For You)
const getRecommendedPlaylists = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const likedRelations = await LikedPlaylist.findByUserId(userId);
    const likedPlaylistIds = likedRelations.map((like) => like.playlist_id);

    const allPublic = await Playlist.findPublicPlaylists();
    const candidatePlaylists = allPublic.filter(
        (playlist) => playlist.user_id !== userId && !likedPlaylistIds.includes(playlist.id)
    );

    const artistFrequency = await buildArtistFrequency(likedPlaylistIds);

    let scoredPlaylists = [];
    if (Object.keys(artistFrequency).length > 0) {
        scoredPlaylists = await Promise.all(
            candidatePlaylists.map(async (playlist) => {
                const songs = await Song.findByPlaylistId(playlist.id);
                const seenArtists = new Set();
                let score = 0;

                songs.forEach((song) => {
                    if (!song || !song.artist) return;
                    const artists = song.artist.split(',').map((name) => name.trim()).filter(Boolean);
                    artists.forEach((artistName) => {
                        if (artistFrequency[artistName] && !seenArtists.has(artistName)) {
                            score += artistFrequency[artistName];
                            seenArtists.add(artistName);
                        }
                    });
                });

                return { playlist, score };
            })
        );
    }

    const meaningful = scoredPlaylists.filter((item) => item.score > 0);
    let selectedPlaylists;

    if (meaningful.length > 0) {
        selectedPlaylists = meaningful
            .sort((a, b) => b.score - a.score)
            .slice(0, 12)
            .map((item) => item.playlist);
    } else {
        selectedPlaylists = shuffleArray(candidatePlaylists).slice(0, 12);
    }

    const summaries = await Promise.all(selectedPlaylists.map((playlist) => summarizePlaylist(playlist, userId)));
    res.status(200).json(summaries.filter(Boolean));
});

// 유사한 사용자 기반 추천 (좋아요 겹치는 사용자)
const getSimilarUsers = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const allLikes = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.LIKED_PLAYLISTS);
    const myLikes = allLikes.filter((like) => like.user_id === userId);
    if (!myLikes.length) {
        return res.status(200).json([]);
    }

    const likedSet = new Set(myLikes.map((like) => like.playlist_id));

    const overlapMap = new Map();
    allLikes.forEach((like) => {
        if (like.user_id === userId) return;
        if (likedSet.has(like.playlist_id)) {
            overlapMap.set(like.user_id, (overlapMap.get(like.user_id) || 0) + 1);
        }
    });

    const similarUserIds = Array.from(overlapMap.keys());
    if (!similarUserIds.length) {
        return res.status(200).json([]);
    }

    const users = await Promise.all(similarUserIds.map((id) => User.findById(id)));
    const enriched = users
        .filter(Boolean)
        .map((user) => ({
            id: user.id,
            display_name: user.display_name,
            profile_image_url: user.profile_image_url || user.profile_image || null,
            overlapCount: overlapMap.get(user.id) || 0,
        }))
        .sort((a, b) => b.overlapCount - a.overlapCount)
        .slice(0, 10);

    res.status(200).json(enriched);
});

// 트렌딩 플레이리스트 (좋아요 수 기준 Top N)
const getTrendingPlaylists = asyncHandler(async (req, res) => {
    const viewerId = req.user ? req.user.id : null;

    const publicPlaylists = await Playlist.findPublicPlaylists();
    const summaries = await Promise.all(publicPlaylists.map((playlist) => summarizePlaylist(playlist, viewerId)));

    const sorted = summaries
        .filter(Boolean)
        .sort((a, b) => {
            if ((b.likeCount || 0) !== (a.likeCount || 0)) {
                return (b.likeCount || 0) - (a.likeCount || 0);
            }
            return (b.created_at || 0) - (a.created_at || 0);
        })
        .slice(0, 20);

    res.status(200).json(sorted);
});

module.exports = {
    getRecommendedPlaylists,
    getSimilarUsers,
    getTrendingPlaylists,
};
