const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const saltRounds = 10;

// 사용자 생성 (회원가입)
exports.createUser = async (req, res) => {
  const { email, password, display_name } = req.body;
  if (!email || !password || !display_name) {
    return res.status(400).json({ status: 'error', message: '이메일, 비밀번호, 닉네임은 필수입니다.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const sql = 'INSERT INTO users (email, password, display_name, created_at) VALUES (?, ?, ?, NOW())';
    const [result] = await db.query(sql, [email, hashedPassword, display_name]);
    res.status(201).json({ status: 'success', message: '회원가입이 완료되었습니다.', userId: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: '이미 사용 중인 이메일입니다.' });
    }
    res.status(500).json({ status: 'error', message: '서버 내부 오류가 발생했습니다.' });
  }
};

// 특정 사용자 정보 조회
exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const sql = 'SELECT id, email, display_name, profile_image_url, bio, created_at FROM users WHERE id = ?';
    const [users] = await db.query(sql, [id]);
    if (users.length === 0) {
      return res.status(404).json({ status: 'error', message: '사용자를 찾을 수 없습니다.' });
    }
    res.status(200).json({ status: 'success', data: users[0] });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '서버 내부 오류가 발생했습니다.' });
  }
};

// 사용자 정보 수정
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { display_name, profile_image_url, bio } = req.body;
  if (!display_name && !profile_image_url && !bio) {
    return res.status(400).json({ status: 'error', message: '수정할 정보를 하나 이상 입력해주세요.' });
  }
  try {
    const fields = [], values = [];
    if (display_name) { fields.push('display_name = ?'); values.push(display_name); }
    if (profile_image_url) { fields.push('profile_image_url = ?'); values.push(profile_image_url); }
    if (bio) { fields.push('bio = ?'); values.push(bio); }
    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    const [result] = await db.query(sql, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: '사용자를 찾을 수 없습니다.' });
    }
    res.status(200).json({ status: 'success', message: '사용자 정보가 수정되었습니다.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '서버 내부 오류가 발생했습니다.' });
  }
};

// 사용자 삭제
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const sql = 'DELETE FROM users WHERE id = ?';
    const [result] = await db.query(sql, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: '사용자를 찾을 수 없습니다.' });
    }
    res.status(200).json({ status: 'success', message: '회원 탈퇴가 처리되었습니다.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '서버 내부 오류가 발생했습니다.' });
  }
};

// 사용자 로그인
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ status: 'error', message: '이메일과 비밀번호를 모두 입력해주세요.' });
  }
  try {
    const sql = 'SELECT id, email, password, display_name FROM users WHERE email = ?';
    const [users] = await db.query(sql, [email]);
    if (users.length === 0) {
      return res.status(401).json({ status: 'error', message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ status: 'error', message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const payload = { id: user.id, email: user.email, display_name: user.display_name };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.status(200).json({ status: 'success', message: '로그인에 성공했습니다.', token: token });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '서버 내부 오류가 발생했습니다.' });
  }
};

// 사용자 팔로우
exports.followUser = async (req, res) => {
  const { id: followingId } = req.params;
  const { id: followerId } = req.user;
  if (followingId == followerId) {
    return res.status(400).json({ status: 'error', message: '자기 자신을 팔로우할 수 없습니다.' });
  }
  try {
    const sql = 'INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, NOW())';
    await db.query(sql, [followerId, followingId]);
    res.status(201).json({ status: 'success', message: '사용자를 팔로우했습니다.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: '이미 팔로우한 사용자입니다.' });
    }
    res.status(500).json({ status: 'error', message: '서버 내부 오류' });
  }
};

// 사용자 언팔로우
exports.unfollowUser = async (req, res) => {
  const { id: followingId } = req.params;
  const { id: followerId } = req.user;
  try {
    const sql = 'DELETE FROM follows WHERE follower_id = ? AND following_id = ?';
    const [result] = await db.query(sql, [followerId, followingId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '팔로우 기록을 찾을 수 없습니다.' });
    }
    res.status(200).json({ status: 'success', message: '사용자를 언팔로우했습니다.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '서버 내부 오류' });
  }
};

// 팔로워 목록 조회
exports.getFollowers = async (req, res) => {
  const { id: userId } = req.params;
  const sql = `SELECT u.id, u.display_name, u.profile_image_url FROM users u JOIN follows f ON u.id = f.follower_id WHERE f.following_id = ?`;
  const [followers] = await db.query(sql, [userId]);
  res.status(200).json({ status: 'success', data: followers });
};

// 팔로잉 목록 조회
exports.getFollowing = async (req, res) => {
  const { id: userId } = req.params;
  const sql = `SELECT u.id, u.display_name, u.profile_image_url FROM users u JOIN follows f ON u.id = f.following_id WHERE f.follower_id = ?`;
  const [following] = await db.query(sql, [userId]);
  res.status(200).json({ status: 'success', data: following });
};