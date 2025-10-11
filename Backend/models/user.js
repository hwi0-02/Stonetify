const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { display_name, email, password } = userData;
    
    // 비밀번호 해싱
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
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
}

module.exports = User;