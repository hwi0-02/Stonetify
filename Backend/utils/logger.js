const path = require('path');
let Sentry = null;
let sentryEnabled = false;

try {
  Sentry = require('@sentry/node');
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_RELEASE || undefined,
    });
    sentryEnabled = true;
  }
} catch (error) {
  // Sentry is optional; fall through when module is not installed.
}

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

const LEVEL_METHOD = {
  error: 'error',
  warn: 'warn',
  info: 'log',
  debug: isDev ? 'log' : 'debug',
};

const normalizeMeta = (meta) => {
  if (!meta) return undefined;
  if (meta instanceof Error) {
    return { message: meta.message, stack: meta.stack };
  }
  if (typeof meta === 'object') {
    const safeMeta = {};
    for (const [key, value] of Object.entries(meta)) {
      if (value instanceof Error) {
        safeMeta[key] = { message: value.message, stack: value.stack };
      } else {
        safeMeta[key] = value;
      }
    }
    return safeMeta;
  }
  return { detail: meta };
};

const emit = (level, message, meta) => {
  const normalizedMeta = normalizeMeta(meta);
  const method = LEVEL_METHOD[level] || 'log';
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (normalizedMeta) {
    console[method](base, normalizedMeta);
  } else {
    console[method](base);
  }

  if (level === 'error' && sentryEnabled) {
    if (meta instanceof Error) {
      Sentry.captureException(meta);
      return;
    }
    const errorToCapture = normalizedMeta?.error instanceof Error
      ? normalizedMeta.error
      : new Error(message);
    Sentry.captureException(errorToCapture, {
      extra: normalizedMeta,
    });
  }
};

const logger = {
  error: (message, meta) => emit('error', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  info: (message, meta) => emit('info', message, meta),
  debug: (message, meta) => {
    if (isDev) {
      emit('debug', message, meta);
    }
  },
};

const requestLogger = (req, res, next) => {
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  req.requestId = requestId;
  const start = process.hrtime.bigint();
  logger.debug('Incoming request', {
    requestId,
    method: req.method,
    url: req.originalUrl,
  });
  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationMs = Number(durationNs) / 1_000_000;
    logger.info('Request completed', {
      requestId,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });
  next();
};

const getSentry = () => (sentryEnabled ? Sentry : null);

module.exports = {
  logger,
  requestLogger,
  sentryEnabled,
  getSentry,
};
