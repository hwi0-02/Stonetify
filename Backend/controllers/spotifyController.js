// C:\Stonetify\Stonetify\Backend\controllers\spotifyController.js

const asyncHandler = require('express-async-handler');
const axios = require('axios');
const qs = require('qs');

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
        throw new Error('Spotify API credentials are not configured in .env file');
    }

    const authOptions = {
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'Authorization': 'Basic ' + (Buffer.from(clientId + ':' + clientSecret).toString('base64')),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: qs.stringify({ grant_type: 'client_credentials' })
    };

    const response = await axios(authOptions);
    
    spotifyToken = {
        value: response.data.access_token,
        expiresAt: Date.now() + response.data.expires_in * 1000,
    };
    
    return spotifyToken.value;
});

// @desc    Search tracks on Spotify
// @route   GET /api/spotify/search
// @access  Private
const searchTracks = asyncHandler(async (req, res) => {
    const query = req.query.q;
    if (!query) {
        res.status(400);
        throw new Error('Search query is required');
    }

    const token = await getSpotifyToken();

    const searchOptions = {
        method: 'get',
        url: `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
        headers: {
            'Authorization': 'Bearer ' + token
        }
    };
    
    const response = await axios(searchOptions);
    
    // 프론트엔드가 사용하기 쉬운 형태로 데이터 가공
    const tracks = response.data.tracks.items.map(item => ({
        id: item.id,
        name: item.name,
        artists: item.artists.map(artist => artist.name).join(', '),
        album: item.album.name,
        album_cover_url: item.album.images.length > 1 ? item.album.images[1].url : (item.album.images.length > 0 ? item.album.images[0].url : null),
        preview_url: item.preview_url
    }));

    res.status(200).json(tracks);
});

module.exports = {
    searchTracks,
};