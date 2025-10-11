const { User, Follow } = require('../models');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { admin } = require('../config/firebase');

// ==================== UTILITIES ====================

// JWT 토큰 생성 유틸리티
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// 입력 검증 유틸리티
const validateUserInput = (email, password, display_name = null) => {
  const errors = [];
  
  if (!email) errors.push('이메일을 입력해주세요.');
  if (!password) errors.push('비밀번호를 입력해주세요.');
  if (display_name !== null && !display_name) errors.push('사용자명을 입력해주세요.');
  
  return errors;
};

// ==================== CONTROLLERS ====================

// 임시: 사용자 데이터 조회 함수 (디버깅용)
const getUserData = asyncHandler(async (req, res) => {
    const { email } = req.params;
    
    console.log('🔍 사용자 데이터 조회:', email);
    
    try {
        const user = await User.findByEmail(email);
        if (!user) {
            res.status(404);
            throw new Error('사용자를 찾을 수 없습니다.');
        }
        
        console.log('📋 사용자 데이터:', {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            password_exists: !!user.password,
            password_length: user.password ? user.password.length : 0,
            password_starts_with: user.password ? user.password.substring(0, 10) + '...' : 'null'
        });
        
        res.json({
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            password_exists: !!user.password,
            password_length: user.password ? user.password.length : 0,
            created_at: user.created_at
        });
    } catch (error) {
        console.error('❌ 사용자 데이터 조회 실패:', error);
        res.status(500).json({ error: error.message });
    }
});

// 임시: 기존 해시 검증 함수 (개발용)
const verifyExistingHash = asyncHandler(async (req, res) => {
    const bcrypt = require('bcryptjs');
    
    const password = "1111";
    const existingHash = "$2b$10$rQDfj/cKBXoDVE8Qp5XjeOtEB.I0fb1qBYufvgKb0FqGZYLwXKsH6";
    
    const isMatch = await bcrypt.compare(password, existingHash);
    
    const testPasswords = ["1111", "test", "password", "홍길동", "admin"];
    const results = {};
    
    for (const testPwd of testPasswords) {
        const match = await bcrypt.compare(testPwd, existingHash);
        results[testPwd] = match;
    }
    
    res.json({
        password,
        existingHash,
        isMatch,
        testResults: results
    });
});

// 임시: 비밀번호 해시 테스트 함수 (개발용)
const testPasswordHash = asyncHandler(async (req, res) => {
    const bcrypt = require('bcryptjs');
    const password = "1111";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const isMatch = await bcrypt.compare(password, hashedPassword);
    
    res.json({
        password,
        hashedPassword,
        isMatch
    });
});

// 임시: 비밀번호 재설정 함수 (개발용)
const resetPasswordForEmail = asyncHandler(async (req, res) => {
    const { email, newPassword } = req.body;
    
    if (!email || !newPassword) {
        res.status(400);
        throw new Error('이메일과 새 비밀번호를 입력해주세요.');
    }
    
    const user = await User.findByEmail(email);
    if (!user) {
        res.status(404);
        throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    const { RealtimeDBHelpers, COLLECTIONS } = require('../config/firebase');
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.USERS, user.id, {
        password: hashedPassword,
        updated_at: Date.now()
    });
    
    res.json({ 
        message: '비밀번호가 성공적으로 재설정되었습니다.',
        newHash: hashedPassword
    });
});

// 회원가입 (최적화된 버전)
const registerUser = asyncHandler(async (req, res) => {
    const { email, password, display_name } = req.body;
    
    const validationErrors = validateUserInput(email, password, display_name);
    if (validationErrors.length > 0) {
        res.status(400);
        throw new Error(validationErrors.join(' '));
    }

    const userExists = await User.findByEmail(email);
    if (userExists) {
        res.status(400);
        throw new Error('이미 존재하는 사용자입니다.');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userId = await User.create({
        email,
        password: hashedPassword,
        display_name,
    });

    if (userId) {
        const user = await User.findById(userId);
        console.log('✅ 회원가입 성공:', { userId, email });
        
        try {
            // 1. Firebase Auth에도 사용자 생성 (DB 동기화를 위해 강력 권장)
            await admin.auth().createUser({
                uid: user.id.toString(), // Firebase UID는 반드시 문자열이어야 합니다.
                email: user.email,
                displayName: user.display_name,
            });
            console.log('✅ Firebase Auth 사용자 생성 성공:', { uid: user.id });
        } catch (error) {
            // 이미 Firebase에 해당 UID나 이메일이 존재하는 경우 오류가 발생할 수 있습니다.
            // 이런 경우, 경고만 기록하고 넘어가서 토큰 발급은 계속 진행합니다.
            if (error.code === 'auth/uid-already-exists' || error.code === 'auth/email-already-exists') {
                console.warn('⚠️ Firebase Auth에 이미 사용자가 존재합니다. 커스텀 토큰만 발급합니다.');
            } else {
                res.status(500);
                throw new Error(`Firebase 사용자 생성 실패: ${error.message}`);
            }
        }
        
        const firebaseToken = await admin.auth().createCustomToken(user.id.toString());
        console.log('✅ Firebase 커스텀 토큰 발급 성공');

        res.status(201).json({
            id: user.id,
            display_name: user.display_name,
            email: user.email,
            profile_image_url: user.profile_image_url || null,
            token: generateToken(user.id),
            firebaseToken: firebaseToken,
        });
    } else {
        res.status(400);
        throw new Error('사용자 생성에 실패했습니다.');
    }
});

// 로그인 (최적화된 버전)
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    const validationErrors = validateUserInput(email, password);
    if (validationErrors.length > 0) {
        res.status(400);
        throw new Error(validationErrors.join(' '));
    }
    
    const user = await User.findByEmail(email);
    if (!user || !(await User.validatePassword(user, password))) {
        res.status(401);
        throw new Error('유효하지 않은 자격 증명입니다.');
    }
    
    const firebaseToken = await admin.auth().createCustomToken(user.id);
    console.log('✅ 로그인 성공:', { userId: user.id, email });
    
    res.json({
      id: user.id,
      display_name: user.display_name,
      email: user.email,
      profile_image_url: user.profile_image_url || null,
      token: generateToken(user.id),
      firebaseToken: firebaseToken,
    });
});

// 사용자 정보 조회
const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) {
        res.status(404);
        throw new Error('사용자를 찾을 수 없습니다.');
    }

    const firebaseToken = await admin.auth().createCustomToken(user.id);

    res.status(200).json({
        id: user.id,
        display_name: user.display_name,
        email: user.email,
        profile_image_url: user.profile_image_url || null,
        token: generateToken(user.id),
        firebaseToken: firebaseToken
    });
});

// 계정 삭제

const deleteUserAccount = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    await User.deleteAccount(userId);
    res.status(200).json({ message: '계정이 성공적으로 삭제되었습니다.' });

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
            through: { attributes: [] }
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
    deleteUserAccount,
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    resetPasswordForEmail,
    getUserData,
    testPasswordHash,
    verifyExistingHash,
};
