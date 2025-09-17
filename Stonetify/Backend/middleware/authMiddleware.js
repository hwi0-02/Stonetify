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

module.exports = { protect };