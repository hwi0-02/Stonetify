const { User, Follow } = require('../models');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ==================== UTILITIES ====================

// JWT 토큰 생성 유틸리티
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// 사용자 응답 포맷 (보안을 위해 비밀번호 제외)
const formatUserResponse = (user) => ({
  id: user.id,
  display_name: user.display_name,
  email: user.email,
  token: generateToken(user.id),
});

// 입력 검증 유틸리티
const validateUserInput = (email, password, display_name = null) => {
  const errors = [];
  
  if (!email) errors.push('이메일을 입력해주세요.');
  if (!password) errors.push('비밀번호를 입력해주세요.');
  if (display_name !== null && !display_name) errors.push('사용자명을 입력해주세요.');
  
  return errors;
};

// ==================== CONTROLLERS ====================

// 회원가입 (최적화된 버전)
const registerUser = asyncHandler(async (req, res) => {
    const { email, password, display_name } = req.body;
    
    // 입력 검증
    const validationErrors = validateUserInput(email, password, display_name);
    if (validationErrors.length > 0) {
        res.status(400);
        throw new Error(validationErrors.join(' '));
    }

    // 사용자 중복 검사
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
        res.status(400);
        throw new Error('이미 존재하는 사용자입니다.');
    }

    // 비밀번호 해싱
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 사용자 생성
    const user = await User.create({
        email,
        password: hashedPassword,
        display_name,
    });

    if (user) {
        res.status(201).json(formatUserResponse(user));
    } else {
        res.status(400);
        throw new Error('사용자 생성에 실패했습니다.');
    }
});

// 로그인 (최적화된 버전)
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    // 입력 검증
    const validationErrors = validateUserInput(email, password);
    if (validationErrors.length > 0) {
        res.status(400);
        throw new Error(validationErrors.join(' '));
    }
    
    // 사용자 조회
    const user = await User.findOne({ where: { email } });
    if (!user) {
        res.status(401);
        throw new Error('유효하지 않은 자격 증명입니다.');
    }
    
    // 비밀번호 검증
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
        res.status(401);
        throw new Error('유효하지 않은 자격 증명입니다.');
    }
    
    res.json(formatUserResponse(user));
});

// 사용자 정보 조회
const getMe = asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password'] }
    });
    res.status(200).json(user);
});


// 사용자 팔로우
const followUser = asyncHandler(async (req, res) => {
    const follower_id = req.user.id;
    const { following_id } = req.body;

    if (follower_id === following_id) {
        res.status(400);
        throw new Error("자기 자신을 팔로우할 수 없습니다.");
    }
    
    const alreadyFollowing = await Follow.findOne({ where: { follower_id, following_id } });
    if(alreadyFollowing) {
        res.status(400);
        throw new Error("이미 팔로우하고 있는 사용자입니다.");
    }

    const follow = await Follow.create({ follower_id, following_id });
    res.status(201).json(follow);
});

// 사용자 언팔로우 (신규)
const unfollowUser = asyncHandler(async (req, res) => {
    const follower_id = req.user.id;
    const { following_id } = req.body;

    const follow = await Follow.findOne({ where: { follower_id, following_id } });
    if (!follow) {
        res.status(404);
        throw new Error("이 사용자를 팔로우하고 있지 않습니다.");
    }

    await follow.destroy();
    res.status(200).json({ message: '성공적으로 언팔로우했습니다.' });
});

// 팔로워 목록 조회 (신규)
const getFollowers = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const user = await User.findByPk(userId, {
        include: [{
            model: User,
            as: 'Followers',
            attributes: ['id', 'display_name', 'profile_image_url'],
            through: { attributes: [] } // 중간 테이블 정보 제외
        }],
        attributes: []
    });
    if(!user) {
        res.status(404);
        throw new Error('사용자를 찾을 수 없습니다.');
    }
    res.status(200).json(user.Followers);
});

// 팔로잉 목록 조회 (신규)
const getFollowing = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const user = await User.findByPk(userId, {
        include: [{
            model: User,
            as: 'Followings',
            attributes: ['id', 'display_name', 'profile_image_url'],
            through: { attributes: [] }
        }],
        attributes: []
    });
    if(!user) {
        res.status(404);
        throw new Error('사용자를 찾을 수 없습니다.');
    }
    res.status(200).json(user.Followings);
});

// ==================== EXPORTS ====================

module.exports = {
    registerUser,
    loginUser,
    getMe,
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
};