const DEFAULT_SUCCESS_MESSAGE = '요청이 성공적으로 처리되었습니다.';

const ERROR_CODES = {
  VALIDATION: 'validation_error',
  AUTH_REQUIRED: 'auth_required',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  INTERNAL: 'internal_error',
  DEPENDENCY: 'dependency_error',
};

const ERROR_MESSAGES = {
  AUTH_REQUIRED: '인증이 필요합니다.',
  FORBIDDEN: '권한이 없습니다.',
  NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
  VALIDATION: '요청 값을 확인해주세요.',
  RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  INTERNAL: '서버 오류가 발생했습니다.',
};

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const REQUIRED_ENV = {
  GENERAL: ['JWT_SECRET'],
  FIREBASE: [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_CLIENT_ID',
    'FIREBASE_CLIENT_X509_CERT_URL',
    'FIREBASE_DATABASE_URL',
  ],
};

module.exports = {
  DEFAULT_SUCCESS_MESSAGE,
  ERROR_CODES,
  ERROR_MESSAGES,
  PASSWORD_REGEX,
  REQUIRED_ENV,
};
