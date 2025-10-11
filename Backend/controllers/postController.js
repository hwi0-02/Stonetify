// Stonetify/Backend/controllers/postController.js

const { Post, User, Playlist, Song, PostLike, SavedPost } = require('../models');
const asyncHandler = require('express-async-handler');

// 게시물 상세 정보를 합쳐주는 헬퍼 함수
const enrichPost = async (post, userId = null) => {
    if (!post) return null;

    const [user, playlist, likes, savedPost] = await Promise.all([
        User.findById(post.user_id),
        Playlist.findById(post.playlist_id),
        PostLike.findByPostId(post.id),
        userId ? SavedPost.findByUserAndPost(userId, post.id) : null
    ]);

    let enrichedPlaylist = playlist;
    if (playlist) {
        const songs = await Song.findByPlaylistId(playlist.id);
        const coverImages = songs.slice(0, 4).map(song => song.album_cover_url).filter(Boolean);
        enrichedPlaylist = {
            ...playlist,
            cover_image_url: coverImages.length > 0 ? coverImages[0] : null,
            songCount: songs.length,
        };
    }

    let content = { title: '', description: '' };
    try {
        if (post.content && typeof post.content === 'string') {
            content = JSON.parse(post.content);
        }
    } catch (e) {
        content.title = post.content || '';
    }

    // ❗ 현재 로그인한 사용자가 이 게시물을 좋아했는지 확인
    const isLiked = userId ? likes.some(like => like.user_id === userId) : false;
    const isSaved = !!savedPost;

    return {
        id: post.id,
        createdAt: post.created_at,
        content: content, 
        user: user ? { id: user.id, display_name: user.display_name, profile_image_url: user.profile_image_url } : null,
        playlist: enrichedPlaylist,
        likesCount: likes.length, 
        isLiked: isLiked, 
        isSaved: isSaved,
    };
};

// ... createPost 함수는 이전과 동일하게 유지 ...
const createPost = asyncHandler(async (req, res) => {
    const { playlist_id, content } = req.body;
    if (!req.user || !req.user.id) {
        res.status(401); throw new Error('User not authenticated');
    }
    const user_id = req.user.id;
    if (!playlist_id || !content) {
        res.status(400); throw new Error('Please provide playlist_id and content');
    }
    const playlist = await Playlist.findById(playlist_id);
    if (!playlist || playlist.user_id !== user_id) {
        res.status(404); throw new Error('Playlist not found or you do not own this playlist');
    }
    const postId = await Post.create({ user_id, playlist_id, content });
    const newPost = await Post.findById(postId);
    const enrichedNewPost = await enrichPost(newPost, user_id);
    res.status(201).json(enrichedNewPost);
});


// @desc    Get all posts (feed)
// @route   GET /api/posts
// @access  Public (with optional auth)
const getPosts = asyncHandler(async (req, res) => {
    const posts = await Post.getRecentPosts();
    // ❗ 로그인한 사용자 ID를 enrichPost에 전달
    const userId = req.user ? req.user.id : null; 
    const enrichedPosts = await Promise.all(
        (Array.isArray(posts) ? posts.map(post => enrichPost(post, userId)) : [])
    );
    res.status(200).json(enrichedPosts.filter(Boolean));
});

// @desc    Like a post
// @route   POST /api/posts/:id/like
// @access  Private
const likePost = asyncHandler(async (req, res) => {
    const { id: postId } = req.params;
    const { id: userId } = req.user;

    const post = await Post.findById(postId);
    if (!post) {
        res.status(404);
        throw new Error('Post not found');
    }
    
    // ❗ PostLike 모델을 사용하여 좋아요 토글
    const result = await PostLike.toggle(userId, postId);
    const likes = await PostLike.findByPostId(postId);

    res.status(200).json({ 
        liked: result.liked,
        likesCount: likes.length 
    });
});

const updatePost = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { content, playlist_id } = req.body; // 수정할 내용
    const user_id = req.user.id;

    const post = await Post.findById(id);

    if (!post) {
        res.status(404);
        throw new Error('게시물을 찾을 수 없습니다.');
    }

    // 게시물 소유자만 수정 가능
    if (post.user_id !== user_id) {
        res.status(403);
        throw new Error('게시물을 수정할 권한이 없습니다.');
    }

    const updatedPostData = await Post.update(id, { content, playlist_id });
    const enrichedPost = await enrichPost(updatedPostData, user_id);

    res.status(200).json(enrichedPost);
});

const deletePost = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    const post = await Post.findById(id);

    if (!post) {
        res.status(404);
        throw new Error('게시물을 찾을 수 없습니다.');
    }

    // 게시물 소유자만 삭제 가능
    if (post.user_id !== user_id) {
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
    const { id: userId } = req.user;
    const result = await SavedPost.toggle(userId, postId);
    res.status(200).json(result);
});

// @desc    Get all posts saved by the user
// @route   GET /api/posts/saved/me
// @access  Private
const getSavedPosts = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const savedPostRelations = await SavedPost.findByUserId(userId);
    // 저장된 순서(최신순)로 정렬합니다.
    savedPostRelations.sort((a, b) => b.saved_at - a.saved_at);
    
    const postIds = savedPostRelations.map(s => s.post_id);
    const posts = await Promise.all(postIds.map(id => Post.findById(id)));
    const enrichedPosts = await Promise.all(posts.filter(Boolean).map(post => enrichPost(post, userId)));
    
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