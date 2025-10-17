const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const normalizeTarget = (url) => {
  if (!url) {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed
    .replace(/\/api\/?$/i, '')
    .replace(/\/$/, '');
};

const defaultHost = process.env.TUNNEL_FALLBACK_HOST || process.env.BACKEND_HOST || process.env.EXPO_PUBLIC_LOCAL_IP || 'localhost';
const defaultPort = process.env.BACKEND_PORT || process.env.EXPO_PUBLIC_BACKEND_PORT || '5000';
const targetBase = normalizeTarget(
  process.env.TUNNEL_API_URL ||
  process.env.EXPO_PUBLIC_TUNNEL_API_URL ||
  process.env.EXPO_PUBLIC_API_URL
) || `http://${defaultHost}:${defaultPort}`;

const app = express();

// 모든 origin에서 CORS 허용
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// 프록시 설정
const proxy = createProxyMiddleware({
  target: targetBase,
  changeOrigin: true,
  pathRewrite: {
    '^/proxy': '', // /proxy 경로를 제거하고 백엔드로 전달
  },
  onProxyReq: (proxyReq, req, res) => {
    const rewrittenPath = req.originalUrl.replace(/^\/proxy/, '');
    console.log(`🔄 Proxy: ${req.method} ${req.originalUrl} -> ${targetBase}${rewrittenPath}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // HTTPS 환경에서도 작동하도록 헤더 설정
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy Error:', err.message);
    res.status(500).json({ error: 'Proxy server error' });
  }
});

// 프록시 미들웨어 적용
app.use('/proxy', proxy);

// 건강 상태 확인 엔드포인트
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'CORS Proxy Server is running',
    target: targetBase
  });
});

const toPort = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const proxyPort = toPort(process.env.PROXY_PORT || process.env.EXPO_PUBLIC_PROXY_PORT, 3001);

app.listen(proxyPort, () => {
  console.log(`🌐 CORS Proxy Server running on port ${proxyPort}`);
  console.log(`📡 Proxying requests to: ${targetBase}`);
  console.log(`🔗 Usage: http://localhost:${proxyPort}/proxy/api/...`);
});
