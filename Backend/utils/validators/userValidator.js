const { ApiError } = require('../errors');
const { PASSWORD_REGEX } = require('../constants');

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const validateEmail = (email) => {
  const sanitized = sanitizeString(email).toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!sanitized || !emailRegex.test(sanitized)) {
    throw ApiError.badRequest('유효한 이메일을 입력해주세요.', [{ field: 'email' }]);
  }
  return sanitized;
};

const validatePassword = (password, { required }) => {
  if (password === undefined || password === null) {
    if (required) {
      throw ApiError.badRequest('비밀번호를 입력해주세요.', [{ field: 'password' }]);
    }
    return undefined;
  }
  const sanitized = sanitizeString(password);
  if (!PASSWORD_REGEX.test(sanitized)) {
    throw ApiError.badRequest('비밀번호는 8자 이상이며 문자와 숫자를 포함해야 합니다.', [{ field: 'password' }]);
  }
  return sanitized;
};

const validateDisplayName = (displayName, { required }) => {
  if (displayName === undefined || displayName === null) {
    if (required) {
      throw ApiError.badRequest('닉네임을 입력해주세요.', [{ field: 'display_name' }]);
    }
    return undefined;
  }
  const sanitized = sanitizeString(displayName);
  if (!sanitized) {
    throw ApiError.badRequest('닉네임을 입력해주세요.', [{ field: 'display_name' }]);
  }
  return sanitized;
};

const validateUserCreate = (data) => {
  const email = validateEmail(data.email);
  const password = validatePassword(data.password, { required: true });
  const displayName = validateDisplayName(data.display_name, { required: true });

  return {
    email,
    password,
    display_name: displayName,
    profile_image_url: data.profile_image_url || null,
  };
};

const validateUserUpdate = (data) => {
  const payload = {};

  if (data.email !== undefined) {
    payload.email = validateEmail(data.email);
  }

  if (data.password !== undefined) {
    payload.password = validatePassword(data.password, { required: false });
  }

  if (data.display_name !== undefined) {
    payload.display_name = validateDisplayName(data.display_name, { required: false });
  }

  if (data.profile_image_url !== undefined) {
    payload.profile_image_url = data.profile_image_url || null;
  }

  if (!Object.keys(payload).length) {
    throw ApiError.badRequest('업데이트할 항목이 없습니다.');
  }

  return payload;
};

module.exports = {
  validateUserCreate,
  validateUserUpdate,
};
