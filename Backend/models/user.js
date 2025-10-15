const { COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const bcrypt = require('bcryptjs');
const { user: userValidators } = require('../utils/validators');
const { ApiError } = require('../utils/errors');
const { logger } = require('../utils/logger');

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/;

const ensureHashedPassword = async (password) => {
  if (!password) return password;
  if (BCRYPT_HASH_REGEX.test(password)) {
    return password;
  }
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

class User {
  static async create(userData) {
    const payload = userValidators.validateUserCreate(userData);
    const hashedPassword = await ensureHashedPassword(payload.password);

    const displayNameLower = payload.display_name.toLowerCase();
    const emailLower = payload.email.toLowerCase();
    const user = {
      display_name: payload.display_name,
      display_name_lower: displayNameLower,
      email: payload.email,
      email_lower: emailLower,
      password: hashedPassword,
      profile_image_url: null,
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
    if (!email) return null;
    const normalizedEmail = email.toLowerCase();
    const users = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.USERS, 'email_lower', normalizedEmail);
    return users[0] || null;
  }

  static async update(id, userData) {
    const sanitized = userValidators.validateUserUpdate(userData);
    const currentUser = await this.findById(id);
    if (!currentUser) {
      throw ApiError.notFound('사용자를 찾을 수 없습니다.');
    }

    const updateData = {};

    if (sanitized.email && sanitized.email !== currentUser.email) {
  updateData.email = sanitized.email;
  updateData.email_lower = sanitized.email.toLowerCase();
    }

    if (sanitized.display_name && sanitized.display_name !== currentUser.display_name) {
      updateData.display_name = sanitized.display_name;
      updateData.display_name_lower = sanitized.display_name.toLowerCase();
    }

    if (sanitized.profile_image_url !== undefined && sanitized.profile_image_url !== currentUser.profile_image_url) {
      updateData.profile_image_url = sanitized.profile_image_url;
    }

    if (sanitized.password) {
      const hashed = await ensureHashedPassword(sanitized.password);
      if (hashed !== currentUser.password) {
        updateData.password = hashed;
      }
    }

    if (!Object.keys(updateData).length) {
      return currentUser;
    }

    updateData.updated_at = Date.now();

    await RealtimeDBHelpers.updateDocument(COLLECTIONS.USERS, id, updateData);
    return await this.findById(id);
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.USERS, id);
  }

  static async validatePassword(user, password) {
    if (!user.password) {
      return false;
    }
    try {
      return await bcrypt.compare(password, user.password);
    } catch (error) {
      logger.error('Password comparison failed', { error });
      return false;
    }
  }

  // 사용자 검색
  static async searchUsers(query, limit = 10) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    const [byName, byEmail] = await Promise.all([
      RealtimeDBHelpers.queryDocumentsByPrefix(COLLECTIONS.USERS, 'display_name_lower', normalized, { limit }),
      RealtimeDBHelpers.queryDocumentsByPrefix(COLLECTIONS.USERS, 'email_lower', normalized, { limit }),
    ]);

    const merged = [...byName, ...byEmail];
    const deduped = [];
    const seen = new Set();
    for (const user of merged) {
      if (seen.has(user.id)) continue;
      seen.add(user.id);
      deduped.push(user);
      if (limit && deduped.length >= limit) break;
    }

    if (!limit || deduped.length < limit) {
      const remaining = limit ? limit - deduped.length : null;
      const fallback = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.USERS);
      for (const candidate of fallback) {
        if (seen.has(candidate.id)) continue;
        const nameMatch = candidate.display_name?.toLowerCase().includes(normalized);
        const emailMatch = candidate.email?.toLowerCase().includes(normalized);
        if (!nameMatch && !emailMatch) continue;
        deduped.push(candidate);
        seen.add(candidate.id);
        if (remaining && deduped.length >= limit) break;
      }
    }

    return deduped;
  }

  // 모든 사용자 조회 (관리자용)
  static async getAllUsers() {
    return await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.USERS);
  }
}

module.exports = User;