const express = require('express');
const cors = require('cors');   // ✅ CORS 패키지 불러오기
require('dotenv').config();

const userRoutes = require('./routes/userRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const spotifyRoutes = require('./routes/spotifyRoutes');
const postRoutes = require('./routes/postRoutes');

const app = express();
const port = 3000;

// ✅ CORS 허용 (모든 요청 허용)
app.use(cors());

// ✅ 특정 출처만 허용하려면 이렇게 작성
// app.use(cors({ origin: 'http://localhost:8081' }));

app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/posts', postRoutes);

app.listen(port, () => {
  console.log(`🚀 백엔드 서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
