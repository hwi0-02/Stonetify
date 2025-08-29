// C:\Stonetify\Stonetify\Backend\app.js

const express = require('express');
const dotenv = require('dotenv').config();
const cors = require('cors'); // 1. cors 패키지 불러오기
const { errorHandler } = require('./middleware/errorMiddleware');
const db = require('./models');

const app = express();

app.use(cors()); // 2. cors 미들웨어 적용

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/playlists', require('./routes/playlistRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/spotify', require('./routes/spotifyRoutes'));

// Sequelize Sync
db.sequelize.sync({ force: false })
  .then(() => {
    console.log('Database synced');
  })
  .catch((err) => {
    console.error('Failed to sync db: ' + err.message);
  });

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));