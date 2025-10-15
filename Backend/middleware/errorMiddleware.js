const { ERROR_CODES, ERROR_MESSAGES } = require('../utils/constants');
const { buildErrorBody } = require('../utils/responses');
const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || res.statusCode || 500;
  const errorCode = err.errorCode || ERROR_CODES.INTERNAL;

  logger.error('Unhandled error', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    error: err,
  });

  const body = buildErrorBody({
    message: err.message || ERROR_MESSAGES.INTERNAL,
    errorCode,
    details: err.details,
    requestId: req.requestId,
  });

  if (process.env.NODE_ENV !== 'production') {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};

module.exports = {
  errorHandler,
};