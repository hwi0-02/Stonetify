const db = require('../config/db');

// 플레이리스트 생성
exports.createPlaylist = async (req, res) => {
  const { title, description, is_public } = req.body;
  const userId = req.user.id;
  if (!title) {
    return res.status(400).json({ status: 'error', message: '플레이리스트 제목은 필수입니다.' });
  }
  try {
    const sql = 'INSERT INTO playlists (user_id, title, description, is_public, created_at) VALUES (?, ?, ?, ?, NOW())';
    const [result] = await db.query(sql, [userId, title, description, is_public === false ? false : true]);
    res.status(201).json({ status: 'success', message: '새로운 플레이리스트가 생성되었습니다.', playlistId: result.insertId });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '서버 내부 오류가 발생했습니다.' });
  }
};

// 특정 플레이리스트 상세 조회
exports.getPlaylistById = async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `SELECT p.*, u.display_name FROM playlists p JOIN users u ON p.user_id = u.id WHERE p.id = ?`;
    const [playlists] = await db.query(sql, [id]);
    if (playlists.length === 0) {
      return res.status(404).json({ status: 'error', message: '플레이리스트를 찾을 수 없습니다.' });
    }
    res.status(200).json({ status: 'success', data: playlists[0] });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '서버 내부 오류가 발생했습니다.' });
  }
};

// 플레이리스트 정보 수정
exports.updatePlaylist = async (req, res) => {
  const { id: playlistId } = req.params;
  const { id: userId } = req.user;
  const { title, description, is_public } = req.body;
  try {
    const [playlists] = await db.query('SELECT user_id FROM playlists WHERE id = ?', [playlistId]);
    if (playlists.length === 0) return res.status(404).json({ status: 'error', message: '플레이리스트를 찾을 수 없습니다.' });
    if (playlists[0].user_id !== userId) return res.status(403).json({ status: 'error', message: '자신이 생성한 플레이리스트만 수정할 수 있습니다.' });
    const sql = 'UPDATE playlists SET title = ?, description = ?, is_public = ? WHERE id = ?';
    await db.query(sql, [title, description, is_public, playlistId]);
    res.status(200).json({ status: 'success', message: '플레이리스트 정보가 수정되었습니다.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '서버 내부 오류가 발생했습니다.' });
  }
};

// 플레이리스트 삭제
exports.deletePlaylist = async (req, res) => {
  const { id: playlistId } = req.params;
  const { id: userId } = req.user;
  try {
    const [playlists] = await db.query('SELECT user_id FROM playlists WHERE id = ?', [playlistId]);
    if (playlists.length === 0) return res.status(404).json({ status: 'error', message: '플레이리스트를 찾을 수 없습니다.' });
    if (playlists[0].user_id !== userId) return res.status(403).json({ status: 'error', message: '자신이 생성한 플레이리스트만 삭제할 수 있습니다.' });
    await db.query('DELETE FROM playlist_songs WHERE playlist_id = ?', [playlistId]);
    await db.query('DELETE FROM playlists WHERE id = ?', [playlistId]);
    res.status(200).json({ status: 'success', message: '플레이리스트가 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '서버 내부 오류가 발생했습니다.' });
  }
};

// 플레이리스트에 곡 추가
exports.addSongToPlaylist = async (req, res) => {
  const { id: playlistId } = req.params;
  const { id: userId } = req.user;
  const { spotify_id, title, artist, album, preview_url } = req.body;
  if (!spotify_id || !title || !artist || !album) {
    return res.status(400).json({ status: 'error', message: '곡 정보가 올바르지 않습니다.' });
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [playlists] = await connection.query('SELECT user_id FROM playlists WHERE id = ?', [playlistId]);
    if (playlists.length === 0) throw { status: 404, message: '플레이리스트를 찾을 수 없습니다.' };
    if (playlists[0].user_id !== userId) throw { status: 403, message: '자신이 생성한 플레이리스트에만 곡을 추가할 수 있습니다.' };
    const upsertSql = `INSERT INTO songs (spotify_id, title, artist, album, preview_url) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`;
    const [upsertResult] = await connection.query(upsertSql, [spotify_id, title, artist, album, preview_url]);
    const songId = upsertResult.insertId;
    const [existingLink] = await connection.query('SELECT id FROM playlist_songs WHERE playlist_id = ? AND song_id = ?', [playlistId, songId]);
    if (existingLink.length > 0) throw { status: 409, message: '이미 플레이리스트에 추가된 곡입니다.' };
    const linkSql = 'INSERT INTO playlist_songs (playlist_id, song_id, added_at) VALUES (?, ?, NOW())';
    await connection.query(linkSql, [playlistId, songId]);
    await connection.commit();
    res.status(201).json({ status: 'success', message: '플레이리스트에 곡이 추가되었습니다.' });
  } catch (error) {
    await connection.rollback();
    res.status(error.status || 500).json({ status: 'error', message: error.message || '서버 내부 오류' });
  } finally {
    connection.release();
  }
};

// 플레이리스트에 담긴 곡 목록 조회
exports.getSongsInPlaylist = async (req, res) => {
  const { id: playlistId } = req.params;
  try {
    const sql = `SELECT s.*, ps.added_at FROM songs s JOIN playlist_songs ps ON s.id = ps.song_id WHERE ps.playlist_id = ? ORDER BY ps.added_at ASC`;
    const [songs] = await db.query(sql, [playlistId]);
    res.status(200).json({ status: 'success', data: songs });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '서버 내부 오류가 발생했습니다.' });
  }
};

// 플레이리스트에서 곡 삭제
exports.removeSongFromPlaylist = async (req, res) => {
  const { playlistId, songId } = req.params;
  const { id: userId } = req.user;
  try {
    const [playlists] = await db.query('SELECT user_id FROM playlists WHERE id = ?', [playlistId]);
    if (playlists.length === 0) return res.status(404).json({ status: 'error', message: '플레이리스트를 찾을 수 없습니다.' });
    if (playlists[0].user_id !== userId) return res.status(403).json({ status: 'error', message: '자신의 플레이리스트에 있는 곡만 삭제할 수 있습니다.' });
    const sql = 'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?';
    const [result] = await db.query(sql, [playlistId, songId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: '플레이리스트에서 해당 곡을 찾을 수 없습니다.' });
    }
    res.status(200).json({ status: 'success', message: '플레이리스트에서 곡이 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '서버 내부 오류가 발생했습니다.' });
  }
};

// 플레이리스트 좋아요
exports.likePlaylist = async (req, res) => {
  const { id: playlistId } = req.params;
  const { id: userId } = req.user;
  try {
    const sql = 'INSERT INTO liked_playlists (user_id, playlist_id, liked_at) VALUES (?, ?, NOW())';
    await db.query(sql, [userId, playlistId]);
    res.status(201).json({ status: 'success', message: '플레이리스트에 좋아요를 눌렀습니다.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ status: 'error', message: '이미 좋아요를 누른 플레이리스트입니다.' });
    res.status(500).json({ status: 'error', message: '서버 내부 오류' });
  }
};

// 플레이리스트 좋아요 취소
exports.unlikePlaylist = async (req, res) => {
  const { id: playlistId } = req.params;
  const { id: userId } = req.user;
  try {
    const sql = 'DELETE FROM liked_playlists WHERE user_id = ? AND playlist_id = ?';
    const [result] = await db.query(sql, [userId, playlistId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '좋아요 기록을 찾을 수 없습니다.' });
    }
    res.status(200).json({ status: 'success', message: '플레이리스트 좋아요를 취소했습니다.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '서버 내부 오류' });
  }
};