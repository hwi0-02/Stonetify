const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { ApiError } = require('../utils/errors');
const { logger } = require('../utils/logger');

const attachUserFromToken = async (token) => {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      throw ApiError.unauthorized('사용자를 찾을 수 없습니다.');
    }
    return user;
  } catch (error) {
    logger.warn('Token verification failed', { error, token: token ? token.slice(0, 10) : null });
    throw ApiError.unauthorized('인증에 실패했습니다.');
  }
};

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const user = await attachUserFromToken(token);
      req.user = user;
      return next();
    } catch (error) {
      next(error);
      return;
    }
  }

  if (!token) {
    return next(ApiError.unauthorized('인증에 실패했습니다. 토큰이 없습니다.'));
  }
};

const optionalProtect = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    const token = req.headers.authorization.split(' ')[1];
    try {
      const user = await attachUserFromToken(token);
      req.user = user;
    } catch (error) {
      logger.debug('optionalProtect token ignored', { error });
    }
  }

  next();
};

module.exports = { protect, optionalProtect };