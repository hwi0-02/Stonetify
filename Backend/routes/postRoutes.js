// Stonetify/Backend/routes/postRoutes.js

const express = require('express');
const router = express.Router();
const { createPost, getPosts, likePost, updatePost, deletePost, toggleSavePost, getSavedPosts } = require('../controllers/postController');
// ❗ protect와 optionalProtect를 모두 import
const { protect, optionalProtect } = require('../middleware/authMiddleware');

router.route('/')
  .get(optionalProtect, getPosts) // ❗ getPosts에 optionalProtect 적용
  .post(protect, createPost);

router.route('/:id/like').post(protect, likePost);

router.route('/:id')
  .put(protect, updatePost)
  .delete(protect, deletePost);

router.route('/saved/me').get(protect, getSavedPosts);
router.route('/:id/toggle-save').post(protect, toggleSavePost);

module.exports = router;