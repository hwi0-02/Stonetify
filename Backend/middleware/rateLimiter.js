// Rate limiting middleware using express-rate-limit. Redis store optional.
const rateLimit = require('express-rate-limit');
let RedisStore = null;
let redisClient = null;

try {
  // Lazy require to avoid error if redis package not installed yet.
  RedisStore = require('rate-limit-redis');
  const redis = require('redis');
  redisClient = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
    }
  });
  redisClient.connect().catch(err => console.warn('Redis connect failed (fallback to memory store):', err.message));
} catch (e) {
  console.warn('Redis store not available, using in-memory rate limiting');
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

// Authentication sensitive endpoints
const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many auth requests. Please try again later.',
  prefix: 'rl:auth:'
});

// Playback / control endpoints
const playbackLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many playback control requests.',
  prefix: 'rl:playback:'
});

module.exports = { authLimiter, playbackLimiter };
