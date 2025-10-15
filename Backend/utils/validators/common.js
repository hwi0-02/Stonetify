const { ApiError } = require('../errors');
const { ERROR_CODES } = require('../constants');

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const ensureRequiredFields = (data, fields, context) => {
  const missing = fields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });
  if (missing.length) {
    throw new ApiError({
      message: `${context || '요청'}에 필요한 값이 누락되었습니다.`,
      statusCode: 400,
      errorCode: ERROR_CODES.VALIDATION,
      details: missing.map((field) => ({ field })),
    });
  }
};

const coerceBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return Boolean(value);
};

const coerceNumber = (value, defaultValue = null) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
};

const sanitizeOptionalString = (value) => {
  if (value === undefined || value === null) return undefined;
  return sanitizeString(value);
};

module.exports = {
  sanitizeString,
  sanitizeOptionalString,
  ensureRequiredFields,
  coerceBoolean,
  coerceNumber,
};
