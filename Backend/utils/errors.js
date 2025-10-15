const { ERROR_CODES, ERROR_MESSAGES } = require('./constants');

class ApiError extends Error {
  constructor({ message, statusCode = 500, errorCode = ERROR_CODES.INTERNAL, details }) {
    super(message || ERROR_MESSAGES.INTERNAL);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = ERROR_MESSAGES.VALIDATION, details) {
    return new ApiError({
      message,
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION,
      details,
    });
  }

  static unauthorized(message = ERROR_MESSAGES.AUTH_REQUIRED, details) {
    return new ApiError({
      message,
      statusCode: 401,
      errorCode: ERROR_CODES.AUTH_REQUIRED,
      details,
    });
  }

  static forbidden(message = ERROR_MESSAGES.FORBIDDEN, details) {
    return new ApiError({
      message,
      statusCode: 403,
      errorCode: ERROR_CODES.FORBIDDEN,
      details,
    });
  }

  static notFound(message = ERROR_MESSAGES.NOT_FOUND, details) {
    return new ApiError({
      message,
      statusCode: 404,
      errorCode: ERROR_CODES.NOT_FOUND,
      details,
    });
  }

  static conflict(message, details) {
    return new ApiError({
      message,
      statusCode: 409,
      errorCode: ERROR_CODES.CONFLICT,
      details,
    });
  }

  static dependency(message, details) {
    return new ApiError({
      message,
      statusCode: 502,
      errorCode: ERROR_CODES.DEPENDENCY,
      details,
    });
  }
}

module.exports = {
  ApiError,
};
