// express-rate-limit을 활용한 요청 제한 미들웨어 (Redis 저장소는 선택 사항)
const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');
let RedisStore = null;
let redisClient = null;

try {
  // redis 패키지가 설치되지 않은 환경에서도 에러가 발생하지 않도록 지연 로딩한다
  RedisStore = require('rate-limit-redis');
  const redis = require('redis');
  redisClient = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
    }
  });
  redisClient.connect().catch(err => logger.warn('Redis connect failed (fallback to memory store)', { error: err.message }));
} catch (e) {
  logger.warn('Redis store not available, using in-memory rate limiting');
}

function buildLimiter({ windowMs, max, message, prefix }) {
  const baseConfig = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message,
  };
  if (RedisStore && redisClient) {
    baseConfig.store = new RedisStore({
      sendCommand: async (...args) => redisClient.sendCommand(args),
      prefix,
    });
  }
  return rateLimit(baseConfig);
}

// 인증 관련 엔드포인트 제한
const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: '인증 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  prefix: 'rl:auth:'
});

// 재생 제어 관련 엔드포인트 제한
const playbackLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: '재생 제어 요청이 너무 많습니다.',
  prefix: 'rl:playback:'
});

module.exports = { authLimiter, playbackLimiter };
