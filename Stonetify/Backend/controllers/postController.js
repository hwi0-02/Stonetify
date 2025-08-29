const db = require('../config/db');

/**
 * 게시물 작성 (플레이리스트 없이도 허용)
 */
exports.createPost = async (req, res) => {
  const userId = req.user.id;
  const { content, playlist_id } = req.body;

  if (!content) {
    return res.status(400).json({ message: '게시물 내용을 입력하세요.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO posts (user_id, content, playlist_id)
       VALUES (?, ?, ?)`,
      [userId, content, playlist_id || null] // playlist_id 없으면 NULL 저장
    );

    res.status(201).json({
      message: '게시물 작성 성공',
      postId: result.insertId,
    });
  } catch (error) {
    console.error('게시물 작성 실패:', error);
    res.status(500).json({ message: '게시물 작성 실패' });
  }
};

/**
 * 피드 가져오기
 */
exports.getFeed = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.content, p.playlist_id, p.created_at,
              u.display_name,
              (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as likeCount
       FROM posts p
       JOIN users u ON p.user_id = u.id
       ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('피드 조회 실패:', error);
    res.status(500).json({ message: '피드 조회 실패' });
  }
};

/**
 * 게시물 삭제
 */
exports.deletePost = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [result] = await db.query(
      `DELETE FROM posts WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '게시물을 찾을 수 없거나 권한이 없습니다.' });
    }

    res.json({ message: '게시물 삭제 성공' });
  } catch (error) {
    console.error('게시물 삭제 실패:', error);
    res.status(500).json({ message: '게시물 삭제 실패' });
  }
};

/**
 * 좋아요 추가
 */
exports.likePost = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    await db.query(
      `INSERT IGNORE INTO likes (user_id, post_id) VALUES (?, ?)`,
      [userId, id]
    );
    res.json({ message: '좋아요 성공' });
  } catch (error) {
    console.error('좋아요 실패:', error);
    res.status(500).json({ message: '좋아요 실패' });
  }
};

/**
 * 좋아요 취소
 */
exports.unlikePost = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    await db.query(
      `DELETE FROM likes WHERE user_id = ? AND post_id = ?`,
      [userId, id]
    );
    res.json({ message: '좋아요 취소 성공' });
  } catch (error) {
    console.error('좋아요 취소 실패:', error);
    res.status(500).json({ message: '좋아요 취소 실패' });
  }
};
