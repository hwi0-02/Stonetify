const { User, Follow } = require('../models');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 회원가입
const registerUser = asyncHandler(async (req, res) => {
    const { email, password, display_name } = req.body;
    if (!email || !password || !display_name) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
        email,
        password: hashedPassword,
        display_name,
    });

    if (user) {
        res.status(201).json({
            id: user.id,
            display_name: user.display_name,
            email: user.email,
            token: generateToken(user.id),
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// 로그인
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (user && (await bcrypt.compare(password, user.password))) {
        res.json({
            id: user.id,
            display_name: user.display_name,
            email: user.email,
            token: generateToken(user.id),
        });
    } else {
        res.status(400);
        throw new Error('Invalid credentials');
    }
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
        throw new Error("You can't follow yourself");
    }
    
    const alreadyFollowing = await Follow.findOne({ where: { follower_id, following_id } });
    if(alreadyFollowing) {
        res.status(400);
        throw new Error("Already following this user");
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
        throw new Error("You are not following this user");
    }

    await follow.destroy();
    res.status(200).json({ message: 'Unfollowed successfully' });
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
        throw new Error('User not found');
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
        throw new Error('User not found');
    }
    res.status(200).json(user.Followings);
});


const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

module.exports = {
    registerUser,
    loginUser,
    getMe,
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
};