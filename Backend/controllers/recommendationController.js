const { Playlist, User, Song, LikedPlaylist, sequelize } = require('../models');
const asyncHandler = require('express-async-handler');

// 사용자 기반 추천 플레이리스트
const getRecommendedPlaylists = asyncHandler(async (req, res) => {
    const user_id = req.user.id;

    try {
        // 사용자가 좋아요한 플레이리스트들의 장르/태그 분석
        const likedPlaylists = await LikedPlaylist.findAll({
            where: { user_id },
            include: [{
                model: Playlist,
                as: 'playlist',
                include: [{
                    model: Song,
                    as: 'songs',
                    attributes: ['genre', 'mood']
                }]
            }]
        });

        // 인기 플레이리스트 (좋아요 수 기준)
        const popularPlaylists = await Playlist.findAll({
            where: { is_public: true },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'display_name']
                },
                {
                    model: Song,
                    as: 'songs',
                    attributes: ['album_cover_url'],
                    through: { attributes: [] }
                }
            ],
            attributes: {
                include: [
                    [sequelize.fn('COUNT', sequelize.col('liked_playlists.id')), 'like_count']
                ]
            },
            group: ['Playlist.id'],
            order: [[sequelize.literal('like_count'), 'DESC']],
            limit: 10
        });

        // 최근 생성된 플레이리스트
        const recentPlaylists = await Playlist.findAll({
            where: { 
                is_public: true,
                user_id: { [sequelize.Op.ne]: user_id }
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'display_name']
                },
                {
                    model: Song,
                    as: 'songs',
                    attributes: ['album_cover_url'],
                    through: { attributes: [] }
                }
            ],
            order: [['created_at', 'DESC']],
            limit: 10
        });

        // 플레이리스트 썸네일 이미지 처리
        const processPlaylists = (playlists) => {
            return playlists.map(p => {
                const plainPlaylist = p.get({ plain: true });
                const coverImages = plainPlaylist.songs
                    .slice(0, 4)
                    .map(song => song.album_cover_url)
                    .filter(url => url);
                plainPlaylist.cover_images = coverImages;
                delete plainPlaylist.songs;
                return plainPlaylist;
            });
        };

        res.status(200).json({
            popular: processPlaylists(popularPlaylists),
            recent: processPlaylists(recentPlaylists),
            forYou: processPlaylists(recentPlaylists.slice(0, 5)) // 임시로 최근 플레이리스트 사용
        });
    } catch (error) {
        console.error('❌ Error in getRecommendedPlaylists:', error);
        res.status(500).json({ error: error.message });
    }
});

// 유사한 사용자 기반 추천
const getSimilarUsers = asyncHandler(async (req, res) => {
    const user_id = req.user.id;

    try {
        // 현재 사용자가 좋아요한 플레이리스트들
        const userLikes = await LikedPlaylist.findAll({
            where: { user_id },
            attributes: ['playlist_id']
        });

        const likedPlaylistIds = userLikes.map(like => like.playlist_id);

        if (likedPlaylistIds.length === 0) {
            return res.status(200).json([]);
        }

        // 비슷한 취향의 사용자들 찾기
        const similarUsers = await User.findAll({
            where: {
                id: { [sequelize.Op.ne]: user_id }
            },
            include: [{
                model: LikedPlaylist,
                as: 'liked_playlists',
                where: {
                    playlist_id: { [sequelize.Op.in]: likedPlaylistIds }
                },
                required: true
            }],
            attributes: ['id', 'display_name', 'profile_image'],
            group: ['User.id'],
            having: sequelize.literal('COUNT(liked_playlists.id) > 0'),
            order: [[sequelize.literal('COUNT(liked_playlists.id)'), 'DESC']],
            limit: 10
        });

        res.status(200).json(similarUsers);
    } catch (error) {
        console.error('❌ Error in getSimilarUsers:', error);
        res.status(500).json({ error: error.message });
    }
});

// 트렌딩 플레이리스트 (최근 일주일간 가장 많이 공유된)
const getTrendingPlaylists = asyncHandler(async (req, res) => {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const trendingPlaylists = await Playlist.findAll({
            where: { is_public: true },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'display_name']
                },
                {
                    model: Song,
                    as: 'songs',
                    attributes: ['album_cover_url'],
                    through: { attributes: [] }
                }
            ],
            attributes: {
                include: [
                    [sequelize.literal(`(
                        SELECT COALESCE(SUM(share_count), 0)
                        FROM share_links 
                        WHERE share_links.playlist_id = Playlist.id 
                        AND share_links.created_at >= '${oneWeekAgo.toISOString()}'
                    )`), 'trend_score']
                ]
            },
            order: [[sequelize.literal('trend_score'), 'DESC']],
            limit: 20
        });

        const processedPlaylists = trendingPlaylists.map(p => {
            const plainPlaylist = p.get({ plain: true });
            const coverImages = plainPlaylist.songs
                .slice(0, 4)
                .map(song => song.album_cover_url)
                .filter(url => url);
            plainPlaylist.cover_images = coverImages;
            delete plainPlaylist.songs;
            return plainPlaylist;
        });

        res.status(200).json(processedPlaylists);
    } catch (error) {
        console.error('❌ Error in getTrendingPlaylists:', error);
        res.status(500).json({ error: error.message });
    }
});

const getContentBasedPlaylists = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // 1. 사용자가 '좋아요'한 플레이리스트 목록을 가져옵니다.
    const likedPlaylistRelations = await LikedPlaylist.findByUserId(userId);
    if (likedPlaylistRelations.length === 0) {
        // 좋아요한 플레이리스트가 없으면 추천할 수 없으므로 빈 배열을 반환합니다.
        return res.status(200).json([]);
    }

    const likedPlaylistIds = likedPlaylistRelations.map(like => like.playlist_id);

    // 2. '좋아요'한 플레이리스트에 포함된 모든 곡의 아티스트를 수집하여 '취향 프로필'을 만듭니다.
    const artistFrequency = {};
    const likedSongs = await Promise.all(likedPlaylistIds.map(id => Song.findByPlaylistId(id)));
    
    likedSongs.flat().forEach(song => {
        if (song && song.artist) {
            // "Artist A, Artist B"와 같은 문자열을 분리합니다.
            const artists = song.artist.split(',').map(a => a.trim());
            artists.forEach(artistName => {
                artistFrequency[artistName] = (artistFrequency[artistName] || 0) + 1;
            });
        }
    });

    // 3. 모든 공개 플레이리스트 중에서 내가 만들었거나 이미 좋아요한 것은 제외합니다.
    const allPublicPlaylists = await Playlist.findPublicPlaylists();
    const candidatePlaylists = allPublicPlaylists.filter(p => 
        p.user_id !== userId && !likedPlaylistIds.includes(p.id)
    );

    // 4. 후보 플레이리스트들의 '유사도 점수'를 계산합니다.
    const scoredPlaylists = await Promise.all(
        candidatePlaylists.map(async (playlist) => {
            const songs = await Song.findByPlaylistId(playlist.id);
            let score = 0;
            const seenArtists = new Set(); // 한 플레이리스트에서 동일 아티스트 중복 점수 방지

            songs.forEach(song => {
                if (song && song.artist) {
                    const artists = song.artist.split(',').map(a => a.trim());
                    artists.forEach(artistName => {
                        if (artistFrequency[artistName] && !seenArtists.has(artistName)) {
                            score += artistFrequency[artistName]; // 내 취향 프로필에 있는 아티스트일수록 높은 점수
                            seenArtists.add(artistName);
                        }
                    });
                }
            });
            return { playlist, score };
        })
    );

    // 5. 점수가 0보다 큰 플레이리스트만 골라내고, 점수가 높은 순서대로 정렬한 후, 상위 10개를 선택합니다.
    const recommended = scoredPlaylists
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(item => item.playlist);

    // 6. 최종 추천 목록에 커버 이미지를 추가하여 반환합니다.
    const recommendationsWithCovers = await Promise.all(
        recommended.map(async (playlist) => {
            const songs = await Song.findByPlaylistId(playlist.id);
            const coverImages = songs.slice(0, 4).map(song => song.album_cover_url).filter(Boolean);
            return {
                ...playlist,
                cover_images: coverImages,
            };
        })
    );
    
    res.status(200).json(recommendationsWithCovers);
});


module.exports = {
    getRecommendedPlaylists: getContentBasedPlaylists,
    getSimilarUsers: asyncHandler(async(req, res) => { /* ... */ }),
    getTrendingPlaylists: asyncHandler(async(req, res) => { /* ... */ }),
};
