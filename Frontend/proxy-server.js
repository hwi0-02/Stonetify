const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

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
  target: 'http://192.168.219.105:5000',
  changeOrigin: true,
  pathRewrite: {
    '^/proxy': '', // /proxy 경로를 제거하고 백엔드로 전달
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 Proxy: ${req.method} ${req.originalUrl} -> http://192.168.219.105:5000${req.originalUrl.replace('/proxy', '')}`);
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
    target: 'http://192.168.219.105:5000'
  });
});

const PORT = process.env.PROXY_PORT || 3001;

app.listen(PORT, () => {
  console.log(`🌐 CORS Proxy Server running on port ${PORT}`);
  console.log(`📡 Proxying requests to: http://192.168.219.105:5000`);
  console.log(`🔗 Usage: http://localhost:${PORT}/proxy/api/...`);
});
