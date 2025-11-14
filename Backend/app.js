const express = require('express');
const path = require('path');
// 저장소 루트에서 실행할 때를 대비해 Backend 디렉터리의 .env를 명시적으로 불러온다
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 환경 변수 검증 (개발 환경에서만 엄격하게 검증)
const { validateEnvironment } = require('./utils/envValidator');
if (process.env.NODE_ENV !== 'production') {
  console.log('\n🔍 개발 환경에서 환경 변수를 검증합니다...\n');
  const envValidation = validateEnvironment();
  // 개발 환경에서는 경고만 표시하고 계속 진행
  if (!envValidation.valid) {
    console.warn('⚠️  일부 환경 변수가 설정되지 않았습니다. 일부 기능이 작동하지 않을 수 있습니다.\n');
  }
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

// 동적 API 응답이 304(Not Modified)로 캐시되지 않도록 ETag를 비활성화
app.disable('etag');

const setNoCacheHeaders = (res) => {
  if (!res) return;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
};

const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

const resolveAppRedirectUri = (envValue, fallbackPath) => {
  const trimmed = (envValue || '').trim();
  if (!trimmed) {
    return `stonetify://${fallbackPath}`;
  }
  if (trimmed.toLowerCase() === 'none') {
    return '';
  }
  return trimmed;
};
app.set('trust proxy', 1);

// CORS 설정 개선 (터널 모드 지원 + 쿠키 인증)
const corsOptions = {
  origin: function (origin, callback) {
    // 개발 환경에서는 모든 origin 허용
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      // 프로덕션에서는 특정 도메인만 허용
      const allowedOriginsEnv = process.env.ALLOWED_RETURN_ORIGINS || '';
      const allowedOrigins = allowedOriginsEnv
        .split(',')
        .map(o => o.trim())
        .filter(o => o.startsWith('http://') || o.startsWith('https://'));
      
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true, // 쿠키 인증 지원
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// 미들웨어 설정
app.use(cors(corsOptions));
const cookieParser = require('cookie-parser');
app.use(cookieParser());
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
app.use('/api/social', require('./routes/socialRoutes'));
app.use('/api/auth', require('./routes/authRoutes')); // 서버 주도 OAuth

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
    var isReactNative = !!window.ReactNativeWebView;
    var isMobile = /android|iphone|ipad|ipod|windows phone/i.test(ua);
    var isAndroid = ua.includes('android');

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
  setNoCacheHeaders(res);
  res.status(200).type('html').send(html);
});

// Kakao OAuth 콜백 페이지
app.get(['/kakao-callback', '/auth/kakao/callback'], (req, res) => {
  const fallbackUri = resolveAppRedirectUri(process.env.KAKAO_APP_REDIRECT_URI, 'kakao-callback');
  const fallbackJson = JSON.stringify(fallbackUri);
  const fallbackIsHttp = fallbackUri ? isHttpUrl(fallbackUri) : false;
  const webFrontendUrl = (process.env.WEB_FRONTEND_URL || process.env.FRONTEND_URL || '').trim();
  const webFrontendJson = JSON.stringify(webFrontendUrl);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Kakao Authorization</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #121212; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { text-align: center; padding: 32px 28px; max-width: 480px; border-radius: 16px; background: rgba(18, 18, 18, 0.85); box-shadow: 0 20px 55px rgba(0, 0, 0, 0.55); border: 1px solid rgba(255,255,255,0.08); }
    h1 { font-size: 1.5rem; margin-bottom: 12px; }
    p { margin: 0 0 16px 0; line-height: 1.5; color: rgba(255,255,255,0.72); }
    a.button { display: inline-block; margin-top: 8px; padding: 10px 14px; border-radius: 10px; background: #FEE500; color: #000; text-decoration: none; font-weight: 600; }
    .hint { font-size: 0.85rem; color: rgba(255,255,255,0.55); margin-top: 10px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>카카오 로그인 완료</h1>
    <p>Stonetify 앱으로 돌아가세요. 자동으로 이동되지 않으면 아래 버튼을 눌러주세요.</p>
    <a id="open-app" class="button" href="#">Stonetify 열기</a>
    <div class="hint">앱이 열리지 않으면 이 페이지 URL을 복사하여 앱에서 다시 시도하세요.</div>
  </main>
  <script>
    (function () {
      var search = window.location.search.slice(1);
      var hash = window.location.hash.slice(1);
      var payload = search || hash ? (search + (hash ? '&' + hash : '')) : '';
  var message = 'expo-auth-session#' + window.location.href;
  var ua = (navigator.userAgent || '').toLowerCase();
  var isReactNative = !!window.ReactNativeWebView;
  var isMobile = /android|iphone|ipad|ipod|windows phone/i.test(ua);
  var isAndroid = ua.includes('android');

      function safePost(target) {
        try {
          if (target && typeof target.postMessage === 'function') {
            target.postMessage(message, '*');
          }
        } catch (e) { console.warn('PostMessage failed:', e); }
      }

      safePost(window.opener);
      safePost(window.parent);
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        try { window.ReactNativeWebView.postMessage(message); } catch (e) {}
      }

      function buildUrl(base) {
        if (!base) return null;
        try {
          var joiner = base.indexOf('?') > -1 ? '&' : '?';
          return payload ? (base + joiner + payload) : base;
        } catch (_) { return base; }
      }

      var fallback = ${fallbackJson};
      var fallbackIsHttp = ${fallbackIsHttp ? 'true' : 'false'};
      var webFrontendUrl = ${webFrontendJson};
      
      // 웹 브라우저 환경 감지 (모바일이 아니고 ReactNative가 아닌 경우)
      var isWebBrowser = !isReactNative && !isMobile && typeof window !== 'undefined' && window.location;
      
      // 웹 브라우저이고 webFrontendUrl이 있으면 프론트엔드로 리다이렉트
      if (isWebBrowser && webFrontendUrl) {
        try {
          var frontendCallbackUrl = webFrontendUrl.replace(/\/$/, '') + '/kakao-callback';
          var redirectUrl = buildUrl(frontendCallbackUrl);
          if (redirectUrl) {
            console.log('[Kakao] Redirecting to frontend:', redirectUrl);
            window.location.href = redirectUrl;
          }
        } catch (e) {
          console.warn('[Kakao] Frontend redirect failed:', e);
        }
        return;
      }
      
      var shouldDeepLink = fallback && typeof fallback === 'string' && fallback.toLowerCase() !== 'none' && !fallbackIsHttp;
      var canDeepLink = shouldDeepLink && (isReactNative || isMobile);
  var schemeUrl = canDeepLink ? buildUrl(fallback) : null;
  var shouldAutoClose = canDeepLink || !!window.opener;

      var androidIntentUrl = null;
      if (isAndroid) {
        try {
          var pkg = ua.includes('expo') ? 'host.exp.exponent' : 'com.yourcompany.stonetify';
          androidIntentUrl = 'intent://kakao-callback' + (payload ? ('?' + payload) : '') + '#Intent;scheme=stonetify;package=' + pkg + ';end';
        } catch (_) {}
      }

      var btn = document.getElementById('open-app');
      if (btn) {
        var manualTarget = (function() {
          if (schemeUrl) return schemeUrl;
          if (androidIntentUrl) return androidIntentUrl;
          if (fallback && typeof fallback === 'string' && fallback.toLowerCase() !== 'none') {
            var candidate = buildUrl(fallback);
            if (!fallbackIsHttp) {
              return candidate || fallback;
            }
            if (candidate && candidate !== window.location.href) {
              return candidate;
            }
          }
          return '#';
        })();
        btn.setAttribute('href', manualTarget);
        btn.addEventListener('click', function() {
          try { window.location.href = manualTarget; } catch (e) {}
        });
      }

      if (canDeepLink) {
        setTimeout(function() {
          try {
            if (schemeUrl) {
              window.location.href = schemeUrl;
            } else if (androidIntentUrl) {
              window.location.href = androidIntentUrl;
            }
          } catch (e) { console.warn('Deep link failed:', e); }
        }, 100);
      }

      if (shouldAutoClose) {
        setTimeout(function () {
          try { window.close(); } catch (_) {}
        }, 1500);
      }
    })();
  </script>
</body>
</html>`;
  setNoCacheHeaders(res);
  res.status(200).type('html').send(html);
});

// Naver OAuth 콜백 페이지
app.get(['/naver-callback', '/auth/naver/callback'], (req, res) => {
  const fallbackUri = resolveAppRedirectUri(process.env.NAVER_APP_REDIRECT_URI, 'naver-callback');
  const fallbackJson = JSON.stringify(fallbackUri);
  const fallbackIsHttp = fallbackUri ? isHttpUrl(fallbackUri) : false;
  const webFrontendUrl = (process.env.WEB_FRONTEND_URL || process.env.FRONTEND_URL || '').trim();
  const webFrontendJson = JSON.stringify(webFrontendUrl);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Naver Authorization</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #121212; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { text-align: center; padding: 32px 28px; max-width: 480px; border-radius: 16px; background: rgba(18, 18, 18, 0.85); box-shadow: 0 20px 55px rgba(0, 0, 0, 0.55); border: 1px solid rgba(255,255,255,0.08); }
    h1 { font-size: 1.5rem; margin-bottom: 12px; }
    p { margin: 0 0 16px 0; line-height: 1.5; color: rgba(255,255,255,0.72); }
    a.button { display: inline-block; margin-top: 8px; padding: 10px 14px; border-radius: 10px; background: #03C75A; color: #fff; text-decoration: none; font-weight: 600; }
    .hint { font-size: 0.85rem; color: rgba(255,255,255,0.55); margin-top: 10px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>네이버 로그인 완료</h1>
    <p>Stonetify 앱으로 돌아가세요. 자동으로 이동되지 않으면 아래 버튼을 눌러주세요.</p>
    <a id="open-app" class="button" href="#">Stonetify 열기</a>
    <div class="hint">앱이 열리지 않으면 이 페이지 URL을 복사하여 앱에서 다시 시도하세요.</div>
  </main>
  <script>
    (function () {
      var search = window.location.search.slice(1);
      var hash = window.location.hash.slice(1);
      var payload = search || hash ? (search + (hash ? '&' + hash : '')) : '';
      var message = 'expo-auth-session#' + window.location.href;
      var ua = (navigator.userAgent || '').toLowerCase();
  var isReactNative = !!window.ReactNativeWebView;
  var isMobile = /android|iphone|ipad|ipod|windows phone/i.test(ua);
  var isAndroid = ua.includes('android');

      function safePost(target) {
        try {
          if (target && typeof target.postMessage === 'function') {
            target.postMessage(message, '*');
          }
        } catch (e) { console.warn('PostMessage failed:', e); }
      }

      safePost(window.opener);
      safePost(window.parent);
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        try { window.ReactNativeWebView.postMessage(message); } catch (e) {}
      }

      function buildUrl(base) {
        if (!base) return null;
        try {
          var joiner = base.indexOf('?') > -1 ? '&' : '?';
          return payload ? (base + joiner + payload) : base;
        } catch (_) { return base; }
      }

      var fallback = ${fallbackJson};
      var fallbackIsHttp = ${fallbackIsHttp ? 'true' : 'false'};
      var webFrontendUrl = ${webFrontendJson};
      
      // 웹 브라우저 환경 감지 (모바일이 아니고 ReactNative가 아닌 경우)
      var isWebBrowser = !isReactNative && !isMobile && typeof window !== 'undefined' && window.location;
      
      // 웹 브라우저이고 webFrontendUrl이 있으면 프론트엔드로 리다이렉트
      if (isWebBrowser && webFrontendUrl) {
        try {
          var frontendCallbackUrl = webFrontendUrl.replace(/\/$/, '') + '/naver-callback';
          var redirectUrl = buildUrl(frontendCallbackUrl);
          if (redirectUrl) {
            console.log('[Naver] Redirecting to frontend:', redirectUrl);
            window.location.href = redirectUrl;
          }
        } catch (e) {
          console.warn('[Naver] Frontend redirect failed:', e);
        }
        return;
      }
      
      var shouldDeepLink = fallback && typeof fallback === 'string' && fallback.toLowerCase() !== 'none' && !fallbackIsHttp;
      var canDeepLink = shouldDeepLink && (isReactNative || isMobile);
  var schemeUrl = canDeepLink ? buildUrl(fallback) : null;
  var shouldAutoClose = canDeepLink || !!window.opener;

      var androidIntentUrl = null;
      if (isAndroid) {
        try {
          var pkg = ua.includes('expo') ? 'host.exp.exponent' : 'com.yourcompany.stonetify';
          androidIntentUrl = 'intent://naver-callback' + (payload ? ('?' + payload) : '') + '#Intent;scheme=stonetify;package=' + pkg + ';end';
        } catch (_) {}
      }

      var btn = document.getElementById('open-app');
      if (btn) {
        var manualTarget = (function() {
          if (schemeUrl) return schemeUrl;
          if (androidIntentUrl) return androidIntentUrl;
          if (fallback && typeof fallback === 'string' && fallback.toLowerCase() !== 'none') {
            var candidate = buildUrl(fallback);
            if (!fallbackIsHttp) {
              return candidate || fallback;
            }
            if (candidate && candidate !== window.location.href) {
              return candidate;
            }
          }
          return '#';
        })();
        btn.setAttribute('href', manualTarget);
        btn.addEventListener('click', function() {
          try { window.location.href = manualTarget; } catch (e) {}
        });
      }

      if (canDeepLink) {
        setTimeout(function() {
          try {
            if (schemeUrl) {
              window.location.href = schemeUrl;
            } else if (androidIntentUrl) {
              window.location.href = androidIntentUrl;
            }
          } catch (e) { console.warn('Deep link failed:', e); }
        }, 100);
      }

      if (shouldAutoClose) {
        setTimeout(function () {
          try { window.close(); } catch (_) {}
        }, 1500);
      }
    })();
  </script>
</body>
</html>`;
  setNoCacheHeaders(res);
  res.status(200).type('html').send(html);
});

// Firebase 연결 로그
console.log('🔥 Firebase Realtime Database 연결됨');

// 헬스 체크 엔드포인트 (프론트엔드 기본 baseURL이 /api/를 포함하므로 두 경로 모두 허용)
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const HTTPS_PORT = process.env.HTTPS_PORT || 5443;

// 포트 바인딩 오류 핸들러
const handleServerError = (error, serverType, port) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`╔══════════════════════════════════════════════════════════════╗`);
    console.error(`║           ❌ ${serverType} 서버 시작 실패 ❌                 ║`);
    console.error(`╚══════════════════════════════════════════════════════════════╝`);
    console.error('');
    console.error(`포트 ${port}이(가) 이미 사용 중입니다.`);
    console.error('');
    console.error('해결 방법:');
    console.error(`  1. 포트 ${port}을(를) 사용 중인 프로세스를 종료하세요`);
    console.error(`  2. .env 파일에서 다른 포트를 설정하세요 (PORT=${port + 1})`);
    console.error('  3. 서버를 재시작하세요');
    console.error('');
    console.error(`╚══════════════════════════════════════════════════════════════╝`);
    process.exit(1);
  } else if (error.code === 'EACCES') {
    console.error(`❌ 포트 ${port}에 바인딩할 권한이 없습니다. 관리자 권한으로 실행하세요.`);
    process.exit(1);
  } else {
    console.error(`❌ ${serverType} 서버 오류:`, error.message);
    process.exit(1);
  }
};

// 개발 환경에서 자체 서명 인증서 생성 및 HTTPS 서버 시작
if (process.env.NODE_ENV !== 'production') {
  // HTTP 서버 시작
  const httpServer = app.listen(PORT, () => {
    console.log(`✅ HTTP Server started on port ${PORT}`);
    console.log(`   URL: http://localhost:${PORT}`);
  });

  httpServer.on('error', (error) => handleServerError(error, 'HTTP', PORT));

  // 자체 서명 인증서로 HTTPS 서버 시작 (개발용)
  try {
    // 간단한 자체 서명 인증서 생성 (실제로는 openssl 등을 사용해야 함)
    const httpsOptions = {
      key: process.env.SSL_KEY_PATH ? fs.readFileSync(process.env.SSL_KEY_PATH) : null,
      cert: process.env.SSL_CERT_PATH ? fs.readFileSync(process.env.SSL_CERT_PATH) : null,
    };

    if (httpsOptions.key && httpsOptions.cert) {
      const httpsServer = https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
        console.log(`✅ HTTPS Server started on port ${HTTPS_PORT}`);
        console.log(`   URL: https://localhost:${HTTPS_PORT}`);
      });
      httpsServer.on('error', (error) => handleServerError(error, 'HTTPS', HTTPS_PORT));
    } else {
      console.log('⚠️  SSL certificates not found. Running HTTP only.');
      console.log('   To enable HTTPS, set SSL_KEY_PATH and SSL_CERT_PATH in .env file');
    }
  } catch (error) {
    console.log('⚠️  HTTPS setup failed:', error.message);
    console.log('   Running HTTP only');
  }
} else {
  // 프로덕션에서는 HTTPS만 사용
  const productionServer = app.listen(PORT, () => {
    console.log(`✅ Production server started on port ${PORT}`);
  });
  productionServer.on('error', (error) => handleServerError(error, 'Production', PORT));
}
