const express = require('express');
const path = require('path');
// 저장소 루트에서 실행할 때를 대비해 Backend 디렉터리의 .env를 명시적으로 불러온다
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Sentry 초기화 (DSN이 없으면 아무 동작도 하지 않음)
let Sentry = null;
try {
  Sentry = require('@sentry/node');
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV || 'development'
    });
  }
} catch (e) {
  console.log('Sentry not installed (backend), skipping init');
}
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const { errorHandler } = require('./middleware/errorMiddleware');
// Firebase 초기화 전에 필요한 환경 변수를 확인한다
const requiredFirebaseVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_CLIENT_X509_CERT_URL',
  'FIREBASE_DATABASE_URL'
];
const missingFirebase = requiredFirebaseVars.filter(k => !process.env[k]);
if (missingFirebase.length) {
  console.warn('[Firebase] Missing env vars:', missingFirebase.join(', '));
}
const { db } = require('./config/firebase');

const app = express();
app.set('trust proxy', 1);
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

// Sentry가 활성화된 경우 요청 미들웨어 적용
if (Sentry && Sentry.getCurrentHub().getClient()) {
  app.use(Sentry.Handlers.requestHandler());
}

// 미들웨어 설정
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

// HTTP 압축 미들웨어 추가 (응답 크기 감소)
const compression = require('compression');
app.use(compression());

// API 라우트 매핑
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/playlists', require('./routes/playlistRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/spotify', require('./routes/spotifyRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));

// Expo 및 웹 인증 흐름을 위한 Spotify OAuth 리디렉션 페이지
app.get('/spotify-callback', (req, res) => {
  const fallbackUri = process.env.SPOTIFY_APP_REDIRECT || 'stonetify://spotify-callback';
  const fallbackJson = JSON.stringify(fallbackUri);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Spotify Authorization</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #121212; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { text-align: center; padding: 32px 28px; max-width: 480px; border-radius: 16px; background: rgba(18, 18, 18, 0.85); box-shadow: 0 20px 55px rgba(0, 0, 0, 0.55); border: 1px solid rgba(255,255,255,0.08); }
    h1 { font-size: 1.5rem; margin-bottom: 12px; }
    p { margin: 0 0 16px 0; line-height: 1.5; color: rgba(255,255,255,0.72); }
    a.button { display: inline-block; margin-top: 8px; padding: 10px 14px; border-radius: 10px; background: #1DB954; color: #000; text-decoration: none; font-weight: 600; }
    .hint { font-size: 0.85rem; color: rgba(255,255,255,0.55); margin-top: 10px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Spotify authorization complete</h1>
    <p>You can return to Stonetify. If it doesn't happen automatically, tap the button below.</p>
    <a id="open-app" class="button" href="#">Open Stonetify</a>
    <div class="hint">If the app doesn't open, copy this code page URL and try again from the app.</div>
  </main>
  <script>
    (function () {
      var search = window.location.search.slice(1);
      var hash = window.location.hash.slice(1);
      var payload = search || hash ? (search + (hash ? '&' + hash : '')) : '';
      var message = 'expo-auth-session#' + window.location.href;
      var ua = (navigator.userAgent || '').toLowerCase();

      function safePost(target) {
        try {
          if (target && typeof target.postMessage === 'function') {
            target.postMessage(message, '*');
          }
        } catch (e) {
          console.warn('PostMessage failed:', e);
        }
      }

      safePost(window.opener);
      safePost(window.parent);
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        try {
          window.ReactNativeWebView.postMessage(message);
        } catch (e) {
          console.warn('RN postMessage failed:', e);
        }
      }

      function buildUrl(base) {
        if (!base) return null;
        try {
          var joiner = base.indexOf('?') > -1 ? '&' : '?';
          return payload ? (base + joiner + payload) : base;
        } catch (_) {
          return base;
        }
      }

  var fallback = ${fallbackJson}; // 예시: 'stonetify://spotify-callback'
      var schemeUrl = (fallback && fallback.toLowerCase() !== 'none') ? buildUrl(fallback) : null;

  // 커스텀 스킴이 차단된 경우를 대비한 Android 인텐트 URL
      var androidIntentUrl = null;
      try {
        var pkg = ua.includes('expo') ? 'host.exp.exponent' : 'com.yourcompany.stonetify';
        androidIntentUrl = 'intent://spotify-callback' + (payload ? ('?' + payload) : '') + '#Intent;scheme=stonetify;package=' + pkg + ';end';
      } catch (_) {}

  // 사용자가 수동으로 앱을 여는 버튼 연결
      var btn = document.getElementById('open-app');
      if (btn) {
        var manualTarget = schemeUrl || androidIntentUrl || fallback || '#';
        btn.setAttribute('href', manualTarget);
        btn.addEventListener('click', function() {
          try { window.location.href = manualTarget; } catch (e) {}
        });
      }

  // 페이지 로드 직후 자동으로 딥링크를 시도
      setTimeout(function() {
        try {
          if (schemeUrl) {
            window.location.href = schemeUrl;
          } else if (androidIntentUrl) {
            window.location.href = androidIntentUrl;
          }
        } catch (e) {
          console.warn('Programmatic deep link failed:', e);
        }
      }, 100);

      // 팝업으로 열렸을 경우 창 닫기를 시도 (차단될 수 있음)
      setTimeout(function () { try { window.close(); } catch (_) {} }, 1500);
    })();
  </script>
</body>
</html>`;
  res.status(200).type('html').send(html);
});

// Firebase 연결 로그
console.log('🔥 Firebase Realtime Database 연결됨');

// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

// Sentry 에러 핸들러를 우선 적용
if (Sentry && Sentry.getCurrentHub().getClient()) {
  app.use(Sentry.Handlers.errorHandler());
}
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
