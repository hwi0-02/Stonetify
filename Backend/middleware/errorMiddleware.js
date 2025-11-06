// 오류 타입 분류
const ErrorTypes = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DATABASE: 'DATABASE_ERROR',
  NETWORK: 'NETWORK_ERROR',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE_ERROR',
  INTERNAL: 'INTERNAL_SERVER_ERROR',
};

// HTTP 상태 코드에 따른 오류 타입 매핑
const getErrorType = (statusCode, err) => {
  if (err.name === 'ValidationError') return ErrorTypes.VALIDATION;
  if (err.name === 'CastError') return ErrorTypes.VALIDATION;

  switch (statusCode) {
    case 400:
      return ErrorTypes.VALIDATION;
    case 401:
      return ErrorTypes.AUTHENTICATION;
    case 403:
      return ErrorTypes.AUTHORIZATION;
    case 404:
      return ErrorTypes.NOT_FOUND;
    case 502:
    case 503:
    case 504:
      return ErrorTypes.EXTERNAL_SERVICE;
    default:
      if (statusCode >= 500) return ErrorTypes.INTERNAL;
      return ErrorTypes.VALIDATION;
  }
};

// 사용자 친화적인 오류 메시지 생성
const getUserFriendlyMessage = (statusCode, err) => {
  // 커스텀 메시지가 이미 있으면 사용
  if (err.userMessage) return err.userMessage;

  switch (statusCode) {
    case 400:
      return '요청이 올바르지 않습니다. 입력 내용을 확인해주세요.';
    case 401:
      return '인증이 필요합니다. 로그인해주세요.';
    case 403:
      return '이 작업을 수행할 권한이 없습니다.';
    case 404:
      return '요청하신 리소스를 찾을 수 없습니다.';
    case 409:
      return '이미 존재하는 데이터입니다.';
    case 429:
      return '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.';
    case 500:
      return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    case 502:
    case 503:
      return '서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
    case 504:
      return '서버 응답 시간이 초과되었습니다. 다시 시도해주세요.';
    default:
      return err.message || '알 수 없는 오류가 발생했습니다.';
  }
};

// 오류 로깅
const logError = (err, req, statusCode, errorType) => {
  const logData = {
    timestamp: new Date().toISOString(),
    errorType,
    statusCode,
    message: err.message,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
  };

  // 개발 환경에서는 스택 트레이스 포함
  if (process.env.NODE_ENV !== 'production') {
    logData.stack = err.stack;
  }

  // 500번대 오류는 error 레벨, 나머지는 warn 레벨로 로깅
  if (statusCode >= 500) {
    console.error('❌ [Error]', JSON.stringify(logData, null, 2));
  } else {
    console.warn('⚠️ [Warning]', JSON.stringify(logData, null, 2));
  }
};

const errorHandler = (err, req, res, next) => {
  // 이미 응답이 전송되었으면 다음 핸들러로 전달
  if (res.headersSent) {
    return next(err);
  }

  // 상태 코드 결정
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  // Mongoose validation 오류 처리
  if (err.name === 'ValidationError') {
    statusCode = 400;
  }

  // Mongoose CastError 처리 (잘못된 ID 형식)
  if (err.name === 'CastError') {
    statusCode = 400;
  }

  // 오류 타입 결정
  const errorType = getErrorType(statusCode, err);

  // 사용자 친화적 메시지 생성
  const userMessage = getUserFriendlyMessage(statusCode, err);

  // 오류 로깅
  logError(err, req, statusCode, errorType);

  // 응답 구조
  const errorResponse = {
    success: false,
    error: {
      type: errorType,
      message: userMessage,
      statusCode,
      timestamp: new Date().toISOString(),
    },
  };

  // 개발 환경에서만 상세 정보 제공
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.error.details = {
      originalMessage: err.message,
      stack: err.stack,
      path: req.originalUrl,
      method: req.method,
    };

    // Validation 오류의 경우 필드별 상세 정보 제공
    if (err.name === 'ValidationError' && err.errors) {
      errorResponse.error.validationErrors = Object.keys(err.errors).reduce((acc, key) => {
        acc[key] = err.errors[key].message;
        return acc;
      }, {});
    }
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = {
  errorHandler,
  ErrorTypes,
};