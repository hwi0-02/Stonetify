const asyncHandler = require('express-async-handler');
const axios = require('axios');
const qs = require('qs');

const SPOTIFY_ACCOUNTS_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

let spotifyToken = {
    value: null,
    expiresAt: null,
};

// Spotify API Access Token 획득
const getSpotifyToken = asyncHandler(async () => {
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
        url: SPOTIFY_ACCOUNTS_TOKEN_URL,
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

// Spotify에서 트랙 검색
const searchTracks = asyncHandler(async (req, res) => {
    const query = req.query.q;
    if (!query) {
        res.status(400);
        throw new Error('검색어를 입력해주세요.');
    }

    const token = await getSpotifyToken();

    const searchOptions = {
        method: 'get',
        url: `${SPOTIFY_API_BASE_URL}/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
        headers: {
            'Authorization': 'Bearer ' + token
        }
    };
    
    const response = await axios(searchOptions);

    const tracks = response.data.tracks.items.map(item => ({
        id: item.id,
        spotify_id: item.id,
        name: item.name,
        artist: item.artists.map(artist => artist.name).join(', '),
        album: item.album.name,
        album_cover_url: item.album.images.length > 1 ? item.album.images[1].url : (item.album.images.length > 0 ? item.album.images[0].url : null),
        preview_url: item.preview_url,
        duration_ms: item.duration_ms,
        uri: item.uri,
        external_url: item.external_urls?.spotify
    }));

    res.status(200).json(tracks);
});

module.exports = {
    searchTracks,
};