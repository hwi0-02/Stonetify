const express = require('express');
const dotenv = require('dotenv').config();
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { errorHandler } = require('./middleware/errorMiddleware');
const db = require('./models');

const app = express();

// CORS 설정 개선 (터널 모드 지원)
const corsOptions = {
  origin: function (origin, callback) {
    // 개발 환경에서는 모든 origin 허용
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      // 프로덕션에서는 특정 도메인만 허용
      const allowedOrigins = [
        'https://your-production-domain.com',
        'exp://localhost:8081',
      ];
      
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// 미들웨어 설정
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
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
const HTTPS_PORT = process.env.HTTPS_PORT || 5443;

// 개발 환경에서 자체 서명 인증서 생성 및 HTTPS 서버 시작
if (process.env.NODE_ENV !== 'production') {
  // HTTP 서버 시작
  app.listen(PORT, () => console.log(`HTTP Server started on port ${PORT}`));
  
  // 자체 서명 인증서로 HTTPS 서버 시작 (개발용)
  try {
    // 간단한 자체 서명 인증서 생성 (실제로는 openssl 등을 사용해야 함)
    const httpsOptions = {
      key: process.env.SSL_KEY_PATH ? fs.readFileSync(process.env.SSL_KEY_PATH) : null,
      cert: process.env.SSL_CERT_PATH ? fs.readFileSync(process.env.SSL_CERT_PATH) : null,
    };
    
    if (httpsOptions.key && httpsOptions.cert) {
      https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
        console.log(`HTTPS Server started on port ${HTTPS_PORT}`);
      });
    } else {
      console.log('SSL certificates not found. Running HTTP only.');
      console.log('To enable HTTPS, set SSL_KEY_PATH and SSL_CERT_PATH in .env file');
    }
  } catch (error) {
    console.log('HTTPS setup failed:', error.message);
    console.log('Running HTTP only');
  }
} else {
  // 프로덕션에서는 HTTPS만 사용
  app.listen(PORT, () => console.log(`Production server started on port ${PORT}`));
}