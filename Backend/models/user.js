const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { display_name, email, password } = userData;
    let hashedPassword = password;
    // 이미 해시된 비밀번호인지 확인 (bcrypt 해시 패턴: $2a$ 또는 $2b$ 또는 $2y$)
    if (!/^\$2[aby]\$/.test(password)) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }
    const user = {
      display_name,
      email,
      password: hashedPassword,
      profile_image: null,
      bio: '',
      created_at: Date.now(),
      updated_at: Date.now()
    };
    const userId = await RealtimeDBHelpers.createDocument(COLLECTIONS.USERS, user);
    return userId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.USERS, id);
  }

  static async findByEmail(email) {
    console.log('🔍 findByEmail 호출됨:', email);
    const allUsers = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.USERS);
    console.log('📋 모든 사용자 수:', allUsers.length);
    
    const user = allUsers.find(user => user.email === email);
    if (user) {
      console.log('✅ 사용자 찾음:', { id: user.id, email: user.email, hasPassword: !!user.password });
    } else {
      console.log('❌ 사용자를 찾을 수 없음:', email);
    }
    
    return user || null;
  }

  static async update(id, userData) {
    const updateData = {
      ...userData,
      updated_at: Date.now()
    };
    
    // 비밀번호가 포함된 경우 해싱
    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }
    
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.USERS, id, updateData);
    return await this.findById(id);
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.USERS, id);
  }

  static async validatePassword(user, password) {
    console.log('🔍 validatePassword 호출됨');
    console.log('user 객체:', user);
    console.log('입력된 비밀번호:', password);
    console.log('사용자 해시된 비밀번호:', user.password);
    
    if (!user.password) {
      console.log('❌ 사용자의 비밀번호가 없음');
      return false;
    }
    
    try {
      const result = await bcrypt.compare(password, user.password);
      console.log('bcrypt 비교 결과:', result);
      return result;
    } catch (error) {
      console.error('❌ bcrypt 비교 중 오류:', error);
      return false;
    }
  }

  // 사용자 검색
  static async searchUsers(query, limit = 10) {
    const allUsers = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.USERS);
    
    // 클라이언트 사이드 검색 (display_name과 email)
    const filteredUsers = allUsers.filter(user => {
      const nameMatch = user.display_name && user.display_name.toLowerCase().includes(query.toLowerCase());
      const emailMatch = user.email && user.email.toLowerCase().includes(query.toLowerCase());
      return nameMatch || emailMatch;
    });

    return filteredUsers.slice(0, limit);
  }

  // 모든 사용자 조회 (관리자용)
  static async getAllUsers() {
    return await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.USERS);
  }

  static async deleteAccount(userId) {
    console.log(`[DB Model] User.deleteAccount 호출됨: ${userId}`);
    try {
      // 이 사용자가 생성한 모든 플레이리스트 ID를 찾습니다.
      const userPlaylists = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.PLAYLISTS, 'user_id', userId);
      const playlistIds = userPlaylists.map(p => p.id);

      const deletionPromises = [];

      // 1. 사용자가 만든 모든 플레이리스트와 관련 데이터를 삭제합니다.
      for (const playlistId of playlistIds) {
        // Playlist.delete는 관련 노래, 좋아요 등을 모두 삭제합니다 (기존 모델 재사용)
        deletionPromises.push(require('./playlist').delete(playlistId));
      }

      // 2. 사용자가 누른 모든 플레이리스트 좋아요를 삭제합니다.
      const userLikes = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.LIKED_PLAYLISTS, 'user_id', userId);
      userLikes.forEach(like => {
        deletionPromises.push(RealtimeDBHelpers.deleteDocument(COLLECTIONS.LIKED_PLAYLISTS, like.id));
      });
      
      // 3. (추가) 사용자가 누른 모든 노래 좋아요를 삭제합니다.
      const songLikes = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SONG_LIKES, 'user_id', userId);
      songLikes.forEach(like => {
          deletionPromises.push(RealtimeDBHelpers.deleteDocument(COLLECTIONS.SONG_LIKES, like.id));
      });

      // 4. 마지막으로 사용자 본인 정보를 삭제합니다.
      deletionPromises.push(this.delete(userId));

      await Promise.all(deletionPromises);
      console.log(`[DB Model] 사용자 ${userId} 및 모든 관련 데이터 삭제 완료`);
      return true;
    } catch (error) {
      console.error(`[DB Model] 사용자 ${userId} 계정 삭제 중 오류 발생:`, error);
      throw new Error('계정 관련 데이터를 삭제하는 중 오류가 발생했습니다.');
    }
  }
}

module.exports = User;