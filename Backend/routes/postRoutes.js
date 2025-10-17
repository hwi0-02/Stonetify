const express = require('express');
const router = express.Router();
const {
	createPost,
	getPosts,
	likePost,
	updatePost,
	deletePost,
	toggleSavePost,
	getSavedPosts,
} = require('../controllers/postController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');

router.route('/')
	.get(optionalProtect, getPosts)
	.post(protect, createPost);

router.route('/:id/like').post(protect, likePost);

router.route('/:id')
	.put(protect, updatePost)
	.delete(protect, deletePost);

router.route('/:id/toggle-save').post(protect, toggleSavePost);
router.route('/saved/me').get(protect, getSavedPosts);

module.exports = router;