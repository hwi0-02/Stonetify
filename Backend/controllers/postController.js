const asyncHandler = require('express-async-handler');
const { Post, User, Playlist, PostLike, SavedPost } = require('../models');
const { successResponse } = require('../utils/responses');
const { ApiError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const { buildPlaylistDetails, ensurePlaylist } = require('../utils/controllerUtils');

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

const serializeContent = (content) => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    try {
        return JSON.stringify(content);
    } catch (error) {
        logger.warn('Failed to serialize post content', { error });
        return String(content);
    }
};

const buildPlaylistSummaryForPost = async (playlist) => {
    if (!playlist) return null;
    const detail = await buildPlaylistDetails(playlist);
    if (!detail) return null;
    return {
        id: detail.id,
        title: detail.title,
        description: detail.description,
        cover_images: detail.cover_images,
        cover_image_url: detail.cover_image_url,
        songCount: detail.song_count,
        user: detail.user,
    };
};

const buildAuthorPreview = (user) =>
    user
        ? {
                id: user.id,
                display_name: user.display_name,
                profile_image_url: user.profile_image_url || user.profile_image || null,
            }
        : null;

const enrichPost = async (post, viewerId = null) => {
    if (!post) return null;

    const [author, playlist, likes, savedEntry] = await Promise.all([
        User.findById(post.user_id),
        post.playlist_id ? Playlist.findById(post.playlist_id) : null,
        PostLike.findByPostId(post.id),
        viewerId ? SavedPost.findByUserAndPost(viewerId, post.id) : null,
    ]);

    const playlistSummary = await buildPlaylistSummaryForPost(playlist);

    return {
        id: post.id,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        content: parseContent(post.content),
        user: buildAuthorPreview(author),
        playlist: playlistSummary,
        likesCount: likes.length,
        isLiked: viewerId ? likes.some((like) => like.user_id === viewerId) : false,
        isSaved: Boolean(savedEntry),
    };
};

const ensureOwnedPlaylist = async (playlistId, userId) =>
    ensurePlaylist(playlistId, {
        requireOwnerId: userId,
        forbiddenMessage: '본인 소유의 플레이리스트만 선택할 수 있습니다.',
    });

const createPost = asyncHandler(async (req, res) => {
    if (!req.user || !req.user.id) {
        throw ApiError.unauthorized('로그인이 필요합니다.');
    }

    const { playlist_id: playlistId, content } = req.body || {};
    if (!playlistId) {
        throw ApiError.badRequest('플레이리스트 ID가 필요합니다.', [{ field: 'playlist_id' }]);
    }
    if (!content) {
        throw ApiError.badRequest('게시물 내용을 입력해주세요.', [{ field: 'content' }]);
    }

    await ensureOwnedPlaylist(playlistId, req.user.id);

    const postId = await Post.create({
        user_id: req.user.id,
        playlist_id: playlistId,
        content: serializeContent(content),
    });

    const createdPost = await Post.findById(postId);
    const enrichedPost = await enrichPost(createdPost, req.user.id);

    logger.info('Post created', { postId, userId: req.user.id });

    successResponse(res, {
        statusCode: 201,
        data: enrichedPost,
        message: '게시물이 생성되었습니다.',
    });
});

const getPosts = asyncHandler(async (req, res) => {
    const recentPosts = await Post.getRecentPosts();
    const viewerId = req.user ? req.user.id : null;

    const enrichedPosts = await Promise.all(recentPosts.map((post) => enrichPost(post, viewerId)));
    successResponse(res, {
        data: enrichedPosts.filter(Boolean),
    });
});

const likePost = asyncHandler(async (req, res) => {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) {
        throw ApiError.notFound('게시물을 찾을 수 없습니다.');
    }

    const result = await PostLike.toggle(userId, postId);
    const likes = await PostLike.findByPostId(postId);

    successResponse(res, {
        data: {
            liked: result.liked,
            likesCount: likes.length,
        },
        message: result.liked ? '게시물을 좋아요했습니다.' : '게시물 좋아요를 취소했습니다.',
    });
});

const updatePost = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { content, playlist_id: playlistId } = req.body || {};

    const originalPost = await Post.findById(id);
    if (!originalPost) {
        throw ApiError.notFound('게시물을 찾을 수 없습니다.');
    }
    if (originalPost.user_id !== userId) {
        throw ApiError.forbidden('게시물을 수정할 권한이 없습니다.');
    }

    const targetPlaylistId = playlistId || originalPost.playlist_id;
    await ensureOwnedPlaylist(targetPlaylistId, userId);

    if (content === undefined && playlistId === undefined) {
        throw ApiError.badRequest('수정할 내용을 입력해주세요.');
    }

    const updatedPost = await Post.update(id, {
        content: content !== undefined ? serializeContent(content) : undefined,
        playlist_id: targetPlaylistId,
    });

    const enrichedPost = await enrichPost(updatedPost, userId);
    successResponse(res, {
        data: enrichedPost,
        message: '게시물이 수정되었습니다.',
    });
});

const deletePost = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(id);
    if (!post) {
        throw ApiError.notFound('게시물을 찾을 수 없습니다.');
    }
    if (post.user_id !== userId) {
        throw ApiError.forbidden('게시물을 삭제할 권한이 없습니다.');
    }

    await Post.delete(id);
    logger.info('Post deleted', { postId: id, userId });

    successResponse(res, {
        data: { id },
        message: '게시물이 삭제되었습니다.',
    });
});

const toggleSavePost = asyncHandler(async (req, res) => {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) {
        throw ApiError.notFound('게시물을 찾을 수 없습니다.');
    }

    const result = await SavedPost.toggle(userId, postId);
    successResponse(res, {
        data: result,
        message: result.saved ? '게시물을 저장했습니다.' : '게시물 저장을 해제했습니다.',
    });
});

const getSavedPosts = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const savedRelations = await SavedPost.findByUserId(userId);
    const sortedRelations = [...savedRelations].sort((a, b) => (b.saved_at || 0) - (a.saved_at || 0));

    const posts = await Promise.all(sortedRelations.map((relation) => Post.findById(relation.post_id)));
    const enrichedPosts = await Promise.all(posts.filter(Boolean).map((post) => enrichPost(post, userId)));

    successResponse(res, {
        data: enrichedPosts,
    });
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