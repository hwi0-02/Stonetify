const { ApiError } = require('../errors');

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const validateTitle = (title, { required }) => {
  if (title === undefined || title === null) {
    if (required) {
      throw ApiError.badRequest('플레이리스트 제목을 입력해주세요.', [{ field: 'title' }]);
    }
    return undefined;
  }
  const sanitized = sanitizeString(title);
  if (!sanitized) {
    throw ApiError.badRequest('플레이리스트 제목을 입력해주세요.', [{ field: 'title' }]);
  }
  return sanitized;
};

const validateDescription = (description) => {
  if (description === undefined || description === null) {
    return undefined;
  }
  return sanitizeString(description);
};

const validateVisibility = (isPublic) => {
  if (isPublic === undefined || isPublic === null) {
    return undefined;
  }
  return Boolean(isPublic);
};

const validatePlaylistCreate = (data) => {
  const title = validateTitle(data.title, { required: true });
  const description = validateDescription(data.description);
  const isPublic = validateVisibility(data.is_public);

  return {
    title,
    description: description !== undefined ? description : '',
    is_public: isPublic !== undefined ? isPublic : true,
  };
};

const validatePlaylistUpdate = (data) => {
  const payload = {};

  if (data.title !== undefined) {
    payload.title = validateTitle(data.title, { required: false });
  }
  if (data.description !== undefined) {
    payload.description = validateDescription(data.description);
  }
  if (data.is_public !== undefined) {
    payload.is_public = validateVisibility(data.is_public);
  }

  if (!Object.keys(payload).length) {
    throw ApiError.badRequest('업데이트할 항목이 없습니다.');
  }

  return payload;
};

module.exports = {
  validatePlaylistCreate,
  validatePlaylistUpdate,
};
