const jwt = require('jsonwebtoken');
const { User } = require('../models');

const attachUserFromToken = async (token) => {
  if (!token) return null;

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id);
  if (!user) {
    throw new Error('사용자를 찾을 수 없습니다.');
  }
  return user;
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
      console.error('❌ 토큰 검증 실패:', error);
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.status(401).json({ status: 'error', message: '인증에 실패했습니다. 유효하지 않은 토큰입니다.' });
    }
  }

  if (!token) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.status(401).json({ status: 'error', message: '인증에 실패했습니다. 토큰이 없습니다.' });
  }
};

const optionalProtect = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    const token = req.headers.authorization.split(' ')[1];
    try {
      const user = await attachUserFromToken(token);
      req.user = user;
    } catch (error) {
      console.warn('⚠️ optionalProtect token ignored:', error.message);
    }
  }

  next();
};

module.exports = { protect, optionalProtect };