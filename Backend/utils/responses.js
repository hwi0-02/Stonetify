const { DEFAULT_SUCCESS_MESSAGE, ERROR_MESSAGES } = require('./constants');

const successResponse = (res, { data = null, message = DEFAULT_SUCCESS_MESSAGE, meta, statusCode = 200 }) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: meta || undefined,
  });
};

const buildErrorBody = ({ message, errorCode, details, requestId }) => {
  const body = {
    success: false,
    message: message || ERROR_MESSAGES.INTERNAL,
    errorCode,
  };
  if (details !== undefined) {
    body.details = details;
  }
  if (requestId) {
    body.requestId = requestId;
  }
  return body;
};

module.exports = {
  successResponse,
  buildErrorBody,
};
