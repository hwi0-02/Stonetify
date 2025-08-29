const axios = require('axios');

let spotifyToken = { value: null, expiresAt: null };

const getSpotifyToken = async () => {
  if (spotifyToken.value && spotifyToken.expiresAt > new Date()) {
    return spotifyToken.value;
  }
  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'),
      },
      data: 'grant_type=client_credentials',
    });
    const { access_token, expires_in } = response.data;
    spotifyToken = {
      value: access_token,
      expiresAt: new Date(new Date().getTime() + (expires_in - 300) * 1000),
    };
    return spotifyToken.value;
  } catch (error) {
    console.error('❌ Spotify 토큰 발급 에러:', error.response ? error.response.data : error.message);
    throw new Error('Spotify 토큰 발급에 실패했습니다.');
  }
};

exports.searchTracks = async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ status: 'error', message: '검색어(q)는 필수입니다.' });
  }
  try {
    const token = await getSpotifyToken();
    const response = await axios.get('https://api.spotify.com/v1/search', {
      headers: { 'Authorization': `Bearer ${token}` },
      params: { q: q, type: 'track', limit: 20, market: 'KR' }
    });
    const tracks = response.data.tracks.items.map(item => ({
      spotify_id: item.id,
      title: item.name,
      artist: item.artists.map(artist => artist.name).join(', '),
      album: item.album.name,
      album_art_url: item.album.images.length > 0 ? item.album.images[0].url : null,
      preview_url: item.preview_url,
    }));
    res.status(200).json({ status: 'success', data: tracks });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '음악 검색 중 오류가 발생했습니다.' });
  }
};