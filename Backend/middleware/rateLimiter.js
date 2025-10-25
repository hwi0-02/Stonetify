// express-rate-limit을 활용한 요청 제한 미들웨어 (메모리 기반)
const rateLimit = require('express-rate-limit');

function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message,
  });
}

// 인증 관련 엔드포인트 제한
const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: '인증 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
});

// 재생 제어 관련 엔드포인트 제한
const playbackLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: '재생 제어 요청이 너무 많습니다.',
});

module.exports = { authLimiter, playbackLimiter };
