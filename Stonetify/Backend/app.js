const express = require('express');
const dotenv = require('dotenv').config();
const cors = require('cors');
const { errorHandler } = require('./middleware/errorMiddleware');
const db = require('./models');

const app = express();

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API 라우트 설정
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/playlists', require('./routes/playlistRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/spotify', require('./routes/spotifyRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));

// 데이터베이스 동기화
db.sequelize.sync({ force: false })
  .then(() => {
    console.log('Database synced');
  })
  .catch((err) => {
    console.error('Failed to sync db: ' + err.message);
  });

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));