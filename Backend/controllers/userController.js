const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Follow, Playlist, Song } = require('../models');
const { successResponse } = require('../utils/responses');
const { ApiError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const { sendPasswordResetCode } = require('../utils/emailService');
const { RealtimeDBHelpers, COLLECTIONS } = require('../config/firebase');

const PASSWORD_RESET_TTL = 10 * 60 * 1000;

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const toAuthPayload = (user) => ({
    id: user.id,
    display_name: user.display_name,
    email: user.email,
    profile_image_url: user.profile_image_url || user.profile_image || null,
    token: generateToken(user.id),
});

const toPublicProfile = (user) => ({
    id: user.id,
    display_name: user.display_name,
    email: user.email,
    profile_image_url: user.profile_image_url || user.profile_image || null,
});

const toPreviewProfile = (user) => ({
    id: user.id,
    display_name: user.display_name,
    profile_image_url: user.profile_image_url || user.profile_image || null,
});

const buildFollowersPreview = async (follows, key) => {
    if (!Array.isArray(follows) || follows.length === 0) {
        return [];
    }
    const uniqueIds = [...new Set(follows.map((follow) => follow[key]))];
    const users = await Promise.all(uniqueIds.map((id) => User.findById(id)));
    const userMap = new Map();
    users.filter(Boolean).forEach((user) => {
        userMap.set(user.id, toPreviewProfile(user));
    });
    return follows.map((follow) => userMap.get(follow[key])).filter(Boolean);
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

const requireFields = (fields) => {
    const missing = Object.entries(fields)
        .filter(([, value]) => value === undefined || value === null || value === '')
        .map(([key]) => key);
    if (missing.length) {
        throw ApiError.badRequest('필수 입력값이 누락되었습니다.', missing.map((field) => ({ field })));
    }
};

const ensureUser = async (id) => {
    const user = await User.findById(id);
    if (!user) {
        throw ApiError.notFound('사용자를 찾을 수 없습니다.');
    }
    return user;
};

const registerUser = asyncHandler(async (req, res) => {
    const { email, password, display_name } = req.body;
    requireFields({ email, password, display_name });

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
        throw ApiError.conflict('이미 존재하는 사용자입니다.');
    }

    const userId = await User.create({ email, password, display_name });
    const createdUser = await ensureUser(userId);
    logger.info('User registered', { userId: createdUser.id });

    successResponse(res, {
        statusCode: 201,
        data: toAuthPayload(createdUser),
        message: '회원가입이 완료되었습니다.',
    });
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    requireFields({ email, password });

    const user = await User.findByEmail(email);
    if (!user) {
        throw ApiError.unauthorized('유효하지 않은 자격 증명입니다.');
    }

    const passwordMatch = await User.validatePassword(user, password);
    if (!passwordMatch) {
        throw ApiError.unauthorized('유효하지 않은 자격 증명입니다.');
    }

    successResponse(res, {
        data: toAuthPayload(user),
        message: '로그인에 성공했습니다.',
    });
});

const getMe = asyncHandler(async (req, res) => {
    const user = await ensureUser(req.user.id);
    successResponse(res, {
        data: toPublicProfile(user),
    });
});

const updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { display_name, profile_image_url, profile_image_base64, profile_image_mime_type } = req.body;

    if (!display_name || !display_name.trim()) {
        throw ApiError.badRequest('닉네임은 필수 항목입니다.', [{ field: 'display_name' }]);
    }

    const updates = { display_name: display_name.trim() };

    if (typeof profile_image_url === 'string') {
        updates.profile_image_url = profile_image_url || null;
    }

    if (typeof profile_image_base64 === 'string' && profile_image_base64.length > 0) {
        const sanitized = profile_image_base64.replace(/^data:[^;]+;base64,/, '');
        const estimatedBytes = Math.ceil((sanitized.length * 3) / 4);
        const maxBytes = 5 * 1024 * 1024;
        if (estimatedBytes > maxBytes) {
            throw ApiError.badRequest('프로필 이미지는 5MB 이하로 업로드해주세요.', [{ field: 'profile_image_base64' }]);
        }
        const mimeType = typeof profile_image_mime_type === 'string' && profile_image_mime_type.startsWith('image/')
            ? profile_image_mime_type
            : 'image/jpeg';
        updates.profile_image_url = `data:${mimeType};base64,${sanitized}`;
    } else if (profile_image_base64 === null) {
        updates.profile_image_url = null;
    }

    const updatedUser = await User.update(userId, updates);

    successResponse(res, {
        data: toPublicProfile(updatedUser),
        message: '프로필이 업데이트되었습니다.',
    });
});

const followUser = asyncHandler(async (req, res) => {
    const followerId = req.user.id;
    const { following_id: followingId } = req.body;
    requireFields({ following_id: followingId });

    if (followerId === followingId) {
        throw ApiError.badRequest('자기 자신을 팔로우할 수 없습니다.');
    }

    await ensureUser(followingId);

    const alreadyFollowing = await Follow.findByFollowerAndFollowing(followerId, followingId);
    if (alreadyFollowing) {
        throw ApiError.conflict('이미 팔로우하고 있는 사용자입니다.');
    }

    const followId = await Follow.create({ follower_id: followerId, following_id: followingId });
    const follow = await Follow.findById(followId);

    successResponse(res, {
        statusCode: 201,
        data: follow,
        message: '팔로우가 완료되었습니다.',
    });
});

const unfollowUser = asyncHandler(async (req, res) => {
    const followerId = req.user.id;
    const { following_id: followingId } = req.body;
    requireFields({ following_id: followingId });

    const deleted = await Follow.deleteByFollowerAndFollowing(followerId, followingId);
    if (!deleted) {
        throw ApiError.notFound('이 사용자를 팔로우하고 있지 않습니다.');
    }

    successResponse(res, {
        message: '언팔로우했습니다.',
    });
});

const getFollowers = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    await ensureUser(userId);

    const follows = await Follow.getFollowers(userId);
    const sorted = [...follows].sort((a, b) => (b.followed_at || 0) - (a.followed_at || 0));
    const followers = await buildFollowersPreview(sorted, 'follower_id');

    successResponse(res, { data: followers });
});

const getFollowing = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    await ensureUser(userId);

    const follows = await Follow.getFollowing(userId);
    const sorted = [...follows].sort((a, b) => (b.followed_at || 0) - (a.followed_at || 0));
    const following = await buildFollowersPreview(sorted, 'following_id');

    successResponse(res, { data: following });
});

const getUserProfile = asyncHandler(async (req, res) => {
    const { id: profileUserId } = req.params;
    const viewerId = req.user ? req.user.id : null;

    const user = await ensureUser(profileUserId);

    const [playlists, followers, following, isFollowing] = await Promise.all([
        Playlist.findByUserId(profileUserId),
        Follow.getFollowers(profileUserId),
        Follow.getFollowing(profileUserId),
        viewerId ? Follow.isFollowing(viewerId, profileUserId) : false,
    ]);

    const publicPlaylists = playlists.filter((playlist) => playlist.is_public !== false);
    const playlistSummaries = await Promise.all(publicPlaylists.map(summarizePlaylist));

    successResponse(res, {
        data: {
            user: {
                id: user.id,
                display_name: user.display_name,
                profile_image_url: user.profile_image_url || user.profile_image || null,
                bio: user.bio || '',
            },
            playlists: playlistSummaries,
            stats: {
                followers: followers.length,
                following: following.length,
            },
            isFollowing,
        },
    });
});

const toggleFollow = asyncHandler(async (req, res) => {
    const { id: followingId } = req.params;
    const followerId = req.user.id;

    if (followerId === followingId) {
        throw ApiError.badRequest('자기 자신을 팔로우할 수 없습니다.');
    }

    await ensureUser(followingId);

    const result = await Follow.toggle(followerId, followingId);
    const followers = await Follow.getFollowers(followingId);

    successResponse(res, {
        data: {
            isFollowing: result.following,
            followersCount: followers.length,
        },
    });
});

const requestPasswordReset = asyncHandler(async (req, res) => {
    const { email } = req.body;
    requireFields({ email });

    const user = await User.findByEmail(email);
    if (!user) {
        successResponse(res, {
            message: '비밀번호 재설정 코드가 전송되었습니다.',
        });
        return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = Date.now() + PASSWORD_RESET_TTL;

    const existing = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PASSWORD_RESETS, 'user_id', user.id);
    await Promise.all(existing.map((rec) => RealtimeDBHelpers.deleteDocument(COLLECTIONS.PASSWORD_RESETS, rec.id)));

    await RealtimeDBHelpers.createDocument(COLLECTIONS.PASSWORD_RESETS, {
        user_id: user.id,
        email: user.email,
        code,
        expires_at,
        created_at: Date.now(),
        used: false,
    });

    try {
        await sendPasswordResetCode(user.email, code);
    } catch (error) {
        logger.error('Password reset email send failed', { error });
        throw ApiError.dependency('이메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }

    successResponse(res, {
        message: '비밀번호 재설정 코드가 이메일로 전송되었습니다.',
    });
});

const verifyPasswordResetCode = asyncHandler(async (req, res) => {
    const { email, code, newPassword } = req.body;
    requireFields({ email, code, newPassword });

    const user = await User.findByEmail(email);
    if (!user) {
        throw ApiError.badRequest('코드가 유효하지 않습니다.');
    }

    const records = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PASSWORD_RESETS, 'user_id', user.id);
    const record = records.find((r) => r.code === code && !r.used);
    if (!record) {
        throw ApiError.badRequest('코드가 유효하지 않습니다.');
    }
    if (Date.now() > record.expires_at) {
        throw ApiError.badRequest('코드가 만료되었습니다. 다시 요청해주세요.');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.USERS, user.id, {
        password: hashedPassword,
        updated_at: Date.now(),
    });
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.PASSWORD_RESETS, record.id, {
        used: true,
        used_at: Date.now(),
    });

    successResponse(res, {
        message: '비밀번호가 재설정되었습니다.',
    });
});

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
    requestPasswordReset,
    verifyPasswordResetCode,
};