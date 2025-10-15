const asyncHandler = require('express-async-handler');
const axios = require('axios');
const qs = require('qs');
const { successResponse } = require('../utils/responses');
const { ApiError } = require('../utils/errors');
const { logger } = require('../utils/logger');

const SPOTIFY_ACCOUNTS_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

let spotifyToken = {
    value: null,
    expiresAt: null,
};

// Spotify API Access Token을 얻는 함수
const getSpotifyToken = asyncHandler(async () => {
    // 토큰이 유효하면 기존 토큰 반환
    if (spotifyToken.value && spotifyToken.expiresAt > Date.now()) {
        return spotifyToken.value;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
    throw ApiError.dependency('Spotify API 자격 증명이 설정되지 않았습니다.');
    }

    const authOptions = {
        method: 'post',
        url: SPOTIFY_ACCOUNTS_TOKEN_URL,
        headers: {
            'Authorization': 'Basic ' + (Buffer.from(clientId + ':' + clientSecret).toString('base64')),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: qs.stringify({ grant_type: 'client_credentials' })
    };

    try {
        const response = await axios(authOptions);
        spotifyToken = {
            value: response.data.access_token,
            expiresAt: Date.now() + response.data.expires_in * 1000,
        };
        return spotifyToken.value;
    } catch (error) {
        logger.error('Failed to obtain Spotify client credentials token', { error });
        throw ApiError.dependency('Spotify 토큰 발급에 실패했습니다.');
    }
});

// @설명    Spotify에서 트랙 검색
// @경로   GET /api/spotify/search
// @권한   Private
const searchTracks = asyncHandler(async (req, res) => {
    const query = req.query.q;
    if (!query) {
        throw ApiError.badRequest('검색어를 입력해주세요.', [{ field: 'q' }]);
    }

    const token = await getSpotifyToken();

    const searchOptions = {
        method: 'get',
        url: `${SPOTIFY_API_BASE_URL}/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };

    try {
        const response = await axios(searchOptions);
        const tracks = response.data.tracks.items.map((item) => ({
            id: item.id,
            spotify_id: item.id,
            name: item.name,
            artist: item.artists.map((artist) => artist.name).join(', '),
            album: item.album.name,
            album_cover_url:
                item.album.images.length > 1
                    ? item.album.images[1].url
                    : item.album.images.length > 0
                    ? item.album.images[0].url
                    : null,
            preview_url: item.preview_url,
            duration_ms: item.duration_ms,
            uri: item.uri,
            external_url: item.external_urls?.spotify || null,
        }));

        successResponse(res, { data: tracks });
    } catch (error) {
        logger.error('Spotify track search failed', { error: error.response?.data || error.message });
        throw ApiError.dependency('Spotify 검색에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
});

module.exports = {
    searchTracks,
};