const { User, Follow, Playlist, Song } = require('../models');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendPasswordResetCode } = require('../utils/emailService');
const { RealtimeDBHelpers, COLLECTIONS } = require('../config/firebase');

// 비밀번호 재설정 코드 유효시간 (ms)
const PASSWORD_RESET_TTL = 10 * 60 * 1000; // 10분

// ==================== 유틸리티 ====================

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
    profile_image_url: user.profile_image_url || user.profile_image || null,
    token: generateToken(user.id),
});

const serializeUserProfile = (user) => ({
    id: user.id,
    display_name: user.display_name,
    email: user.email,
    profile_image_url: user.profile_image_url || user.profile_image || null,
});

const buildUserPreview = (user) => ({
    id: user.id,
    display_name: user.display_name,
    profile_image_url: user.profile_image_url || user.profile_image || null,
});

const getUserPreviewsFromFollows = async (follows, key) => {
    if (!Array.isArray(follows) || follows.length === 0) {
        return [];
    }

    const uniqueIds = [...new Set(follows.map((follow) => follow[key]))];
    const users = await Promise.all(uniqueIds.map((id) => User.findById(id)));
    const userMap = new Map();

    for (const user of users) {
        if (user) {
            userMap.set(user.id, buildUserPreview(user));
        }
    }

    return follows
        .map((follow) => userMap.get(follow[key]))
        .filter(Boolean);
};

const summarizePlaylist = async (playlist) => {
    const songs = await Song.findByPlaylistId(playlist.id);
    const coverImages = songs
        .slice(0, 4)
        .map((song) => song.album_cover_url)
        .filter(Boolean);

    return {
        id: playlist.id,
        title: playlist.title,
        description: playlist.description || '',
        is_public: playlist.is_public !== false,
        created_at: playlist.created_at,
        updated_at: playlist.updated_at,
        user_id: playlist.user_id,
        cover_image_url: coverImages[0] || null,
        cover_images: coverImages,
        song_count: songs.length,
    };
};

// 입력 검증 유틸리티
const validateUserInput = (email, password, display_name = null) => {
  const errors = [];
  
  if (!email) errors.push('이메일을 입력해주세요.');
  if (!password) errors.push('비밀번호를 입력해주세요.');
  if (display_name !== null && !display_name) errors.push('사용자명을 입력해주세요.');
  
  return errors;
};

// ==================== 컨트롤러 ====================

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

    // 이메일 중복 검사
    console.log('🔍 이메일 중복 검사...');
    const userExists = await User.findByEmail(email);
    if (userExists) {
        console.log('❌ 이미 존재하는 사용자:', email);
        res.status(400);
        throw new Error('이미 존재하는 사용자입니다.');
    }

    console.log('🔍 닉네임 중복 검사...');
    // (참고: User 모델에 findByDisplayName이 구현되어 있어야 합니다.)
    // (아마 User.findByEmail과 비슷하게 구현되어 있을 것입니다.)
    const displayNameExists = await User.findByDisplayName(display_name);
    if (displayNameExists) {
        console.log('❌ 이미 사용 중인 닉네임:', display_name);
        res.status(400); // 400 또는 409
        // 이 메시지가 authSlice를 통해 프론트엔드로 전달됩니다.
        throw new Error('이미 사용 중인 닉네임입니다.');
    }
    
    // 비밀번호 해싱
    console.log('🔒 비밀번호 해싱...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

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
    
    // JWT 토큰을 새로 생성한다
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

// 프로필 업데이트
const updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { display_name, profile_image_url, profile_image_base64, profile_image_mime_type } = req.body;

    if (!display_name || !display_name.trim()) {
        res.status(400);
        throw new Error('닉네임은 필수 항목입니다.');
    }

    const updates = { display_name: display_name.trim() };

    // 우선 명시적으로 전달된 URL 처리 (주로 기존 이미지 유지용)
    if (typeof profile_image_url === 'string') {
        updates.profile_image_url = profile_image_url || null;
    }

    if (typeof profile_image_base64 === 'string' && profile_image_base64.length > 0) {
        const sanitizedBase64 = profile_image_base64.replace(/^data:[^;]+;base64,/, '');
        const estimatedBytes = Math.ceil((sanitizedBase64.length * 3) / 4);
        const maxBytes = 5 * 1024 * 1024; // 5MB 제한

        if (estimatedBytes > maxBytes) {
            res.status(413);
            throw new Error('프로필 이미지는 5MB 이하로 업로드해주세요.');
        }

        const mimeType = (typeof profile_image_mime_type === 'string' && profile_image_mime_type.startsWith('image/'))
            ? profile_image_mime_type
            : 'image/jpeg';

        updates.profile_image_url = `data:${mimeType};base64,${sanitizedBase64}`;
    } else if (profile_image_base64 === null) {
        // 명시적으로 null이 전달된 경우 기존 이미지를 제거
        updates.profile_image_url = null;
    }

    const updatedUser = await User.update(userId, updates);

    res.status(200).json(serializeUserProfile(updatedUser));
});


// 사용자 팔로우
const followUser = asyncHandler(async (req, res) => {
    const follower_id = req.user.id;
    const { following_id } = req.body;

    if (!following_id) {
        res.status(400);
        throw new Error('팔로우할 사용자를 지정해주세요.');
    }

    if (follower_id === following_id) {
        res.status(400);
        throw new Error("자기 자신을 팔로우할 수 없습니다.");
    }

    const alreadyFollowing = await Follow.findByFollowerAndFollowing(follower_id, following_id);
    if (alreadyFollowing) {
        res.status(400);
        throw new Error("이미 팔로우하고 있는 사용자입니다.");
    }

    const followId = await Follow.create({ follower_id, following_id });
    const follow = await Follow.findById(followId);

    res.status(201).json(
        follow || {
            id: followId,
            follower_id,
            following_id,
        }
    );
});

// 사용자 언팔로우 (신규)
const unfollowUser = asyncHandler(async (req, res) => {
    const follower_id = req.user.id;
    const { following_id } = req.body;

    const deleted = await Follow.deleteByFollowerAndFollowing(follower_id, following_id);
    if (!deleted) {
        res.status(404);
        throw new Error("이 사용자를 팔로우하고 있지 않습니다.");
    }
    res.status(200).json({ message: '성공적으로 언팔로우했습니다.' });
});

// 팔로워 목록 조회 (신규)
const getFollowers = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const targetUser = await User.findById(userId);
    if (!targetUser) {
        res.status(404);
        throw new Error('사용자를 찾을 수 없습니다.');
    }

    const follows = await Follow.getFollowers(userId);
    const sorted = [...follows].sort((a, b) => (b.followed_at || 0) - (a.followed_at || 0));
    const followers = await getUserPreviewsFromFollows(sorted, 'follower_id');

    res.status(200).json(followers);
});

// 팔로잉 목록 조회 (신규)
const getFollowing = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const targetUser = await User.findById(userId);
    if (!targetUser) {
        res.status(404);
        throw new Error('사용자를 찾을 수 없습니다.');
    }

    const follows = await Follow.getFollowing(userId);
    const sorted = [...follows].sort((a, b) => (b.followed_at || 0) - (a.followed_at || 0));
    const followings = await getUserPreviewsFromFollows(sorted, 'following_id');

    res.status(200).json(followings);
});

// @desc    프로필 정보 조회 (공개 + 선택 인증)
// @route   GET /api/users/:id/profile
// @access  Public (Optional Auth)
const getUserProfile = asyncHandler(async (req, res) => {
    const { id: profileUserId } = req.params;
    const viewerId = req.user ? req.user.id : null;

    const user = await User.findById(profileUserId);
    if (!user) {
        res.status(404);
        throw new Error('사용자를 찾을 수 없습니다.');
    }

    const [playlists, followers, following, isFollowing] = await Promise.all([
        Playlist.findByUserId(profileUserId),
        Follow.getFollowers(profileUserId),
        Follow.getFollowing(profileUserId),
        viewerId ? Follow.isFollowing(viewerId, profileUserId) : false,
    ]);

    const publicPlaylists = playlists.filter((playlist) => playlist.is_public !== false);
    const playlistsWithSummaries = await Promise.all(publicPlaylists.map(summarizePlaylist));

    res.status(200).json({
        user: {
            id: user.id,
            display_name: user.display_name,
            profile_image_url: user.profile_image_url || user.profile_image || null,
            bio: user.bio || '',
        },
        playlists: playlistsWithSummaries,
        stats: {
            followers: followers.length,
            following: following.length,
        },
        isFollowing,
    });
});

// @desc    팔로우 토글
// @route   POST /api/users/:id/toggle-follow
// @access  Private
const toggleFollow = asyncHandler(async (req, res) => {
    const { id: following_id } = req.params;
    const follower_id = req.user.id;

    if (follower_id === following_id) {
        res.status(400);
        throw new Error("자기 자신을 팔로우할 수 없습니다.");
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
    registerUser,
    loginUser,
    getMe,
    getUserProfile,
    toggleFollow,
    updateProfile,
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    resetPasswordForEmail, // 개발용 임시 함수
    getUserData, // 디버깅용 임시 함수
    testPasswordHash, // 해시 테스트용
    verifyExistingHash, // 기존 해시 검증용
    requestPasswordReset: asyncHandler(async (req, res) => {
        const { email } = req.body;
        if (!email) {
            res.status(400);
            throw new Error('이메일을 입력해주세요.');
        }
        const user = await User.findByEmail(email);
        if (!user) {
            // 사용자 존재 여부를 노출하지 않음
            return res.status(200).json({ message: '비밀번호 재설정 코드가 전송되었습니다(실제 존재 여부 비공개).' });
        }

        // 6자리 코드 생성
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expires_at = Date.now() + PASSWORD_RESET_TTL;

        // 기존 코드 무효화 (같은 사용자에 대해)
        const existing = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PASSWORD_RESETS, 'user_id', user.id);
        for (const rec of existing) {
            await RealtimeDBHelpers.deleteDocument(COLLECTIONS.PASSWORD_RESETS, rec.id);
        }

        // 새 코드 저장
        await RealtimeDBHelpers.createDocument(COLLECTIONS.PASSWORD_RESETS, {
            user_id: user.id,
            email: user.email,
            code,
            expires_at,
            created_at: Date.now(),
            used: false
        });

        // 이메일 발송
        try {
            await sendPasswordResetCode(user.email, code);
        } catch (e) {
            console.error('비밀번호 재설정 이메일 전송 실패:', e.message);
            res.status(500);
            throw new Error('이메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }

        res.status(200).json({ message: '비밀번호 재설정 코드가 이메일로 전송되었습니다.' });
    }),
    verifyPasswordResetCode: asyncHandler(async (req, res) => {
        const { email, code, newPassword } = req.body;
        if (!email || !code || !newPassword) {
            res.status(400);
            throw new Error('이메일, 코드, 새 비밀번호를 모두 입력해주세요.');
        }
        const user = await User.findByEmail(email);
        if (!user) {
            res.status(400);
            throw new Error('코드가 유효하지 않습니다.');
        }
        const records = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PASSWORD_RESETS, 'user_id', user.id);
        const record = records.find(r => r.code === code && !r.used);
        if (!record) {
            res.status(400);
            throw new Error('코드가 유효하지 않습니다.');
        }
        if (Date.now() > record.expires_at) {
            res.status(400);
            throw new Error('코드가 만료되었습니다. 다시 요청해주세요.');
        }
        // 비밀번호 해시 후 저장
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await RealtimeDBHelpers.updateDocument(COLLECTIONS.USERS, user.id, { password: hashedPassword, updated_at: Date.now() });
        await RealtimeDBHelpers.updateDocument(COLLECTIONS.PASSWORD_RESETS, record.id, { used: true, used_at: Date.now() });
        res.status(200).json({ message: '비밀번호가 재설정되었습니다.' });
    })
};