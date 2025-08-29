const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, postController.createPost)   // 게시물 작성 (플레이리스트 없어도 가능)
  .get(protect, postController.getFeed);      // 피드 가져오기

router.route('/:id')
  .delete(protect, postController.deletePost); // 게시물 삭제

router.route('/:id/like')
  .post(protect, postController.likePost)      // 좋아요
  .delete(protect, postController.unlikePost); // 좋아요 취소

module.exports = router;
