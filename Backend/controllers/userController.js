const { User, Follow, Playlist, Song } = require('../models');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ==================== UTILITIES ====================
//수정사항 199

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
    
    console.log('🔍 기존 해시 검증 테스트');
    console.log('비밀번호:', password);
    console.log('기존 해시:', existingHash);
    
    const isMatch = await bcrypt.compare(password, existingHash);
    console.log('기존 해시와 매치 결과:', isMatch);
    
    // 다른 가능한 비밀번호들도 테스트해보기
    const testPasswords = ["1111", "test", "password", "홍길동", "admin"];
    const results = {};
    
    for (const testPwd of testPasswords) {
        const match = await bcrypt.compare(testPwd, existingHash);
        results[testPwd] = match;
        console.log(`"${testPwd}" 매치 결과:`, match);
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
    
    console.log('🔧 비밀번호 해시 테스트 시작');
    
    const password = "1111";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    console.log('원본 비밀번호:', password);
    console.log('새 해시:', hashedPassword);
    
    // 해시 검증 테스트
    const isMatch = await bcrypt.compare(password, hashedPassword);
    console.log('해시 검증 결과:', isMatch);
    
    res.json({
        password,
        hashedPassword,
        isMatch
    });
});

// 임시: 비밀번호 재설정 함수 (개발용)
const resetPasswordForEmail = asyncHandler(async (req, res) => {
    const { email, newPassword } = req.body;
    
    console.log('🔧 비밀번호 재설정 요청:', { email, newPassword });
    
    if (!email || !newPassword) {
        res.status(400);
        throw new Error('이메일과 새 비밀번호를 입력해주세요.');
    }
    
    // 사용자 조회
    const user = await User.findByEmail(email);
    if (!user) {
        res.status(404);
        throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    console.log('🔍 기존 사용자 정보:', { id: user.id, email: user.email });
    
    // 비밀번호 해싱
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    console.log('🔒 새 비밀번호 해시:', hashedPassword);
    
    // 해시 검증 테스트
    const testMatch = await bcrypt.compare(newPassword, hashedPassword);
    console.log('🧪 해시 검증 테스트:', testMatch);
    
    // 새 비밀번호로 업데이트 (User.update는 자동으로 해싱하므로 직접 Firebase를 사용)
    const { RealtimeDBHelpers, COLLECTIONS } = require('../config/firebase');
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.USERS, user.id, {
        password: hashedPassword,
        updated_at: Date.now()
    });
    
    console.log('✅ 비밀번호 재설정 완료');
    res.json({ 
        message: '비밀번호가 성공적으로 재설정되었습니다.',
        newHash: hashedPassword
    });
});

// ==================== CONTROLLERS ====================

// 회원가입 (최적화된 버전)
const registerUser = asyncHandler(async (req, res) => {
    const { email, password, display_name } = req.body;
    
    console.log('🔐 회원가입 요청:', { email, display_name });
    
    // 입력 검증
    const validationErrors = validateUserInput(email, password, display_name);
    if (validationErrors.length > 0) {
        console.log('❌ 입력 검증 실패:', validationErrors);
        res.status(400);
        throw new Error(validationErrors.join(' '));
    }

    // 사용자 중복 검사
    console.log('🔍 사용자 중복 검사...');
    const userExists = await User.findByEmail(email);
    if (userExists) {
        console.log('❌ 이미 존재하는 사용자:', email);
        res.status(400);
        throw new Error('이미 존재하는 사용자입니다.');
    }

    //수정사항
    // 비밀번호 해싱
    console.log('🔒 비밀번호 해싱 전:', password);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('🔒 비밀번호 해싱 후:', hashedPassword);

    // 사용자 생성
    console.log('👤 사용자 생성 중...');
    const userId = await User.create({
        email,
        password: hashedPassword,
        display_name,
    });

    if (userId) {
        const user = await User.findById(userId);
        console.log('✅ 회원가입 성공:', { userId, email });
        res.status(201).json(formatUserResponse(user));
    } else {
        console.log('❌ 사용자 생성 실패');
        res.status(400);
        throw new Error('사용자 생성에 실패했습니다.');
    }
});

// 로그인 (최적화된 버전)
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    console.log('🔐 로그인 요청:', { email });
    
    // 입력 검증
    const validationErrors = validateUserInput(email, password);
    if (validationErrors.length > 0) {
        console.log('❌ 입력 검증 실패:', validationErrors);
        res.status(400);
        throw new Error(validationErrors.join(' '));
    }
    
    // 사용자 조회
    console.log('🔍 사용자 조회...');
    const user = await User.findByEmail(email);
    if (!user) {
        console.log('❌ 사용자를 찾을 수 없음:', email);
        res.status(401);
        throw new Error('유효하지 않은 자격 증명입니다.');
    }
    
    // 비밀번호 검증
    console.log('🔒 비밀번호 검증...');
    console.log('입력된 비밀번호:', password);
    console.log('저장된 해시:', user.password);
    
    const isPasswordMatch = await User.validatePassword(user, password);
    console.log('비밀번호 매치 결과:', isPasswordMatch);
    
    if (!isPasswordMatch) {
        console.log('❌ 비밀번호 불일치');
        res.status(401);
        throw new Error('유효하지 않은 자격 증명입니다.');
    }
    
    console.log('✅ 로그인 성공:', { userId: user.id, email });
    
    // Generate JWT token
    const token = generateToken(user.id);
    res.json({
      ...formatUserResponse(user),
      token
    });
});

// 사용자 정보 조회
const getMe = asyncHandler(async (req, res) => {
    // formatUserResponse와 토큰 없이 사용자 데이터 반환
    const user = await User.findById(req.user.id);
    res.status(200).json(formatUserResponse(user));
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

// ==================== ❗❗❗ 새로 추가되는 함수들 ❗❗❗ ====================

// @desc    Get another user's profile
// @route   GET /api/users/:id/profile
// @access  Public (Optional Auth)
const getUserProfile = asyncHandler(async (req, res) => {
    const { id: profileUserId } = req.params;
    const loggedInUserId = req.user ? req.user.id : null;

    const user = await User.findById(profileUserId);
    if (!user) {
        res.status(404);
        throw new Error('사용자를 찾을 수 없습니다.');
    }

    const [playlists, followers, following, isFollowing] = await Promise.all([
        Playlist.findByUserId(profileUserId),
        Follow.getFollowers(profileUserId),
        Follow.getFollowing(profileUserId),
        loggedInUserId ? Follow.isFollowing(loggedInUserId, profileUserId) : false
    ]);

    const publicPlaylists = playlists.filter(p => p.is_public);
    // ❗ --- 수정된 부분 --- ❗
    const playlistsWithCovers = await Promise.all(publicPlaylists.map(async (playlist) => {
        const songs = await Song.findByPlaylistId(playlist.id);
        const coverImages = songs.slice(0, 4).map(song => song.album_cover_url).filter(Boolean);
        return {
            ...playlist,
            cover_image_url: coverImages.length > 0 ? coverImages[0] : null,
            cover_images: coverImages, // ❗ 썸네일 그리드를 위한 4개 이미지 배열 추가
        };
    }));

    res.status(200).json({
        user: { id: user.id, display_name: user.display_name, profile_image_url: user.profile_image_url, bio: user.bio },
        playlists: playlistsWithCovers, // ❗ 커버 이미지가 포함된 플레이리스트 정보
        stats: { followers: followers.length, following: following.length },
        isFollowing,
    });
});

// @desc    Toggle follow/unfollow a user
// @route   POST /api/users/:id/toggle-follow
// @access  Private
const toggleFollow = asyncHandler(async (req, res) => {
    const { id: following_id } = req.params;
    const follower_id = req.user.id;

    if (follower_id === following_id) {
        res.status(400); throw new Error("자기 자신을 팔로우할 수 없습니다.");
    }
    
    const result = await Follow.toggle(follower_id, following_id);
    const followers = await Follow.getFollowers(following_id);

    res.status(200).json({
        isFollowing: result.following,
        followersCount: followers.length,
    });
});

// ==================== EXPORTS ====================

module.exports = {
    registerUser, loginUser, getMe,
    getUserProfile, toggleFollow, // 새로 추가된 함수
    followUser, unfollowUser, getFollowers, getFollowing, // 기존 함수 유지
    resetPasswordForEmail, getUserData, testPasswordHash, verifyExistingHash, // 디버깅용 함수 유지
};