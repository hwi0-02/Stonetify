const express = require('express');
const router = express.Router();
const { createPost, getPosts, likePost } = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

// @/api/posts/
router.route('/').post(protect, createPost).get(getPosts);
router.route('/:id/like').post(protect, likePost);

module.exports = router;