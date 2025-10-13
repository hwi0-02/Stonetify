const { Post, User, Playlist, Song, PostLike, SavedPost } = require('../models');
const asyncHandler = require('express-async-handler');

const parseContent = (rawContent) => {
    if (!rawContent) {
        return { title: '', description: '' };
    }

    if (typeof rawContent === 'object') {
        return {
            title: rawContent.title || '',
            description: rawContent.description || '',
        };
    }

    try {
        const parsed = JSON.parse(rawContent);
        return {
            title: parsed?.title || '',
            description: parsed?.description || '',
        };
    } catch (error) {
        return { title: String(rawContent), description: '' };
    }
};

const buildPlaylistSummary = async (playlist) => {
    if (!playlist) return null;

    const songs = await Song.findByPlaylistId(playlist.id);
    const coverImages = songs.slice(0, 4).map((song) => song.album_cover_url).filter(Boolean);

    return {
        ...playlist,
        cover_images: coverImages,
        cover_image_url: coverImages.length > 0 ? coverImages[0] : null,
        songCount: songs.length,
    };
};

const enrichPost = async (post, viewerId = null) => {
    if (!post) return null;

    const [author, playlist, likeEntries, savedEntry] = await Promise.all([
        User.findById(post.user_id),
        Playlist.findById(post.playlist_id),
        PostLike.findByPostId(post.id),
        viewerId ? SavedPost.findByUserAndPost(viewerId, post.id) : null,
    ]);

    const playlistSummary = await buildPlaylistSummary(playlist);

    return {
        id: post.id,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        content: parseContent(post.content),
        user: author
            ? {
                    id: author.id,
                    display_name: author.display_name,
                    profile_image_url: author.profile_image_url,
                }
            : null,
        playlist: playlistSummary,
        likesCount: likeEntries.length,
        isLiked: viewerId ? likeEntries.some((like) => like.user_id === viewerId) : false,
        isSaved: Boolean(savedEntry),
    };
};

// @desc    Create a post
// @route   POST /api/posts
// @access  Private
const createPost = asyncHandler(async (req, res) => {
    const { playlist_id, content } = req.body;

    if (!req.user || !req.user.id) {
        res.status(401);
        throw new Error('User not authenticated');
    }

    if (!playlist_id || !content) {
        res.status(400);
        throw new Error('Please provide playlist_id and content');
    }

    const playlist = await Playlist.findById(playlist_id);

    if (!playlist || playlist.user_id !== req.user.id) {
        res.status(404);
        throw new Error('Playlist not found or you do not own this playlist');
    }

    const postId = await Post.create({
        user_id: req.user.id,
        playlist_id,
        content,
    });

    const createdPost = await Post.findById(postId);
    const enrichedPost = await enrichPost(createdPost, req.user.id);

    res.status(201).json(enrichedPost);
});

// @desc    Get all posts (feed)
// @route   GET /api/posts
// @access  Public (optional auth)
const getPosts = asyncHandler(async (req, res) => {
    const recentPosts = await Post.getRecentPosts();
    const viewerId = req.user ? req.user.id : null;

    const enrichedPosts = await Promise.all(
        recentPosts.map((post) => enrichPost(post, viewerId))
    );

    res.status(200).json(enrichedPosts.filter(Boolean));
});

// @desc    Like a post
// @route   POST /api/posts/:id/like
// @access  Private
const likePost = asyncHandler(async (req, res) => {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) {
        res.status(404);
        throw new Error('Post not found');
    }

    const result = await PostLike.toggle(userId, postId);
    const likes = await PostLike.findByPostId(postId);

    res.status(200).json({
        liked: result.liked,
        likesCount: likes.length,
    });
});

// @desc    Update a post
// @route   PUT /api/posts/:id
// @access  Private
const updatePost = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { content, playlist_id } = req.body;
    const userId = req.user.id;

    const originalPost = await Post.findById(id);

    if (!originalPost) {
        res.status(404);
        throw new Error('게시물을 찾을 수 없습니다.');
    }

    if (originalPost.user_id !== userId) {
        res.status(403);
        throw new Error('게시물을 수정할 권한이 없습니다.');
    }

    const playlist = await Playlist.findById(playlist_id || originalPost.playlist_id);
    if (!playlist || playlist.user_id !== userId) {
        res.status(404);
        throw new Error('플레이리스트를 찾을 수 없거나 소유하고 있지 않습니다.');
    }

    const updatedPost = await Post.update(id, {
        content,
        playlist_id: playlist.id,
    });

    const enrichedPost = await enrichPost(updatedPost, userId);
    res.status(200).json(enrichedPost);
});

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(id);

    if (!post) {
        res.status(404);
        throw new Error('게시물을 찾을 수 없습니다.');
    }

    if (post.user_id !== userId) {
        res.status(403);
        throw new Error('게시물을 삭제할 권한이 없습니다.');
    }

    await Post.delete(id);

    res.status(200).json({ id, message: '게시물이 삭제되었습니다.' });
});

// @desc    Toggle save/unsave a post
// @route   POST /api/posts/:id/toggle-save
// @access  Private
const toggleSavePost = asyncHandler(async (req, res) => {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) {
        res.status(404);
        throw new Error('게시물을 찾을 수 없습니다.');
    }

    const result = await SavedPost.toggle(userId, postId);
    res.status(200).json(result);
});

// @desc    Get saved posts for current user
// @route   GET /api/posts/saved/me
// @access  Private
const getSavedPosts = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const savedRelations = await SavedPost.findByUserId(userId);

    savedRelations.sort((a, b) => (b.saved_at || 0) - (a.saved_at || 0));

    const posts = await Promise.all(savedRelations.map((relation) => Post.findById(relation.post_id)));
    const enrichedPosts = await Promise.all(
        posts.filter(Boolean).map((post) => enrichPost(post, userId))
    );

    res.status(200).json(enrichedPosts);
});

module.exports = {
    createPost,
    getPosts,
    likePost,
    updatePost,
    deletePost,
    toggleSavePost,
    getSavedPosts,
};