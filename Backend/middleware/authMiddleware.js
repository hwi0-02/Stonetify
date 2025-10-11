const jwt = require('jsonwebtoken');
const { User } = require('../models');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 헤더에서 'Bearer ' 부분을 제외하고 실제 토큰만 추출
      token = req.headers.authorization.split(' ')[1];

      // 토큰 검증
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 사용자 정보 조회 (Firebase에서)
      const user = await User.findById(decoded.id);
      if (!user) {
        console.error('❌ 사용자를 찾을 수 없음:', decoded.id);
        return res.status(401).json({ status: 'error', message: '인증에 실패했습니다. 사용자를 찾을 수 없습니다.' });
      }

      // 검증 성공 시, 요청 객체(req)에 사용자 정보 저장
      req.user = user;
      
      next(); // 다음 미들웨어나 컨트롤러로 제어를 넘김
    } catch (error) {
      console.error('❌ 토큰 검증 실패:', error);
      res.status(401).json({ status: 'error', message: '인증에 실패했습니다. 유효하지 않은 토큰입니다.' });
    }
  }

  if (!token) {
    res.status(401).json({ status: 'error', message: '인증에 실패했습니다. 토큰이 없습니다.' });
  }
};

// ❗ --- 새로운 함수 추가 --- ❗
// optionalProtect: 토큰이 있으면 사용자 정보를 추가하고, 없으면 그냥 통과시키는 미들웨어
const optionalProtect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) {
        req.user = user; // 사용자가 있으면 req.user에 할당
      }
    } catch (error) {
      // 토큰이 유효하지 않더라도 오류를 발생시키지 않고 그냥 넘어갑니다.
      console.log('Optional auth: Invalid token.');
    }
  }
  next(); // 토큰이 있든 없든, 유효하든 안하든 다음 단계로 넘어갑니다.
};


module.exports = { protect, optionalProtect }; // ❗ optionalProtect 추가