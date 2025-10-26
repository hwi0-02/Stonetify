const { Post, User, Playlist } = require('../models');
const asyncHandler = require('express-async-handler');

// @desc    Create a post
// @route   POST /api/posts
// @access  Private
const createPost = asyncHandler(async (req, res) => {
    const { playlist_id, content } = req.body;
    const user_id = req.user.id;

    if (!playlist_id || !content) {
        res.status(400);
        throw new Error('Please provide playlist_id and content');
    }

    const playlist = await Playlist.findOne({ where: { id: playlist_id, user_id } });
    if (!playlist) {
        res.status(404);
        throw new Error('Playlist not found or you do not own this playlist');
    }

    const post = await Post.create({
        user_id,
        playlist_id,
        content,
    });

    res.status(201).json(post);
});

// @desc    Get all posts (feed)
// @route   GET /api/posts
// @access  Public
const getPosts = asyncHandler(async (req, res) => {
    const posts = await Post.findAll({
        include: [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'display_name', 'profile_image_url'],
            },
            {
                model: Playlist,
                as: 'playlist',
                include: [
                    {
                        model: Song,
                        as: 'songs',
                        attributes: ['id', 'title', 'artist', 'album'],
                        through: { attributes: [] },
                    },
                ],
            },
        ],
        order: [['created_at', 'DESC']],
    });

    res.status(200).json(posts);
});

// @desc    Like a post
// @route   POST /api/posts/:id/like
// @access  Private
const likePost = asyncHandler(async (req, res) => {
    const { id: postId } = req.params;
    const { id: userId } = req.user;

    const post = await Post.findByPk(postId);
    if (!post) {
        res.status(404);
        throw new Error('Post not found');
    }

    const user = await User.findByPk(userId);
    const hasLiked = await user.hasLikedPost(post);

    if (hasLiked) {
        // Unlike
        await user.removeLikedPost(post);
        res.status(200).json({ message: 'Post unliked' });
    } else {
        // Like
        await user.addLikedPost(post);
        res.status(200).json({ message: 'Post liked' });
    }
});

module.exports = {
    createPost,
    getPosts,
    likePost,
};