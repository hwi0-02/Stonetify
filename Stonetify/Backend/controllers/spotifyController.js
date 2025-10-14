const asyncHandler = require('express-async-handler');
const axios = require('axios');
const qs = require('qs');

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

// @설명    Spotify에서 트랙 검색
// @경로   GET /api/spotify/search
// @권한   Private
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
    
    // 프론트엔드가 사용하기 쉬운 형태로 데이터 가공
    const tracks = response.data.tracks.items.map(item => ({
        id: item.id,
        spotify_id: item.id,  // ✅ 추가: spotify_id 필드 명시적 포함
        name: item.name,
        artist: item.artists.map(artist => artist.name).join(', '),  // ✅ 수정: 'artists' → 'artist' (단수형으로 통일)
        album: item.album.name,
        album_cover_url: item.album.images.length > 1 ? item.album.images[1].url : (item.album.images.length > 0 ? item.album.images[0].url : null),
        preview_url: item.preview_url,
        duration_ms: item.duration_ms,  // ✅ 추가: duration_ms
        uri: item.uri,  // ✅ 추가: Spotify URI
        external_url: item.external_urls?.spotify  // ✅ 추가: external_url
    }));

    res.status(200).json(tracks);
});

module.exports = {
    searchTracks,
};