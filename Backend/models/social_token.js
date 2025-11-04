// Backend/models/social_token.js
// Firebase-based Social OAuth token persistence

const crypto = require('crypto');
const { COLLECTIONS, RealtimeDBHelpers, isFirebaseReady } = require('../config/firebase');
const { encrypt, decrypt } = require('../utils/encryption');

const inMemoryTokens = new Map();

const DEFAULT_HISTORY_LIMIT = 5;
const DEFAULT_MAX_ROTATIONS_PER_HOUR = 12;

function generateId() {
  if (typeof crypto.randomUUID === 'function') {
    return `social-${crypto.randomUUID()}`;
  }
  return `social-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getTokenKey(userId, provider) {
  return `${userId}_${provider}`;
}

function computeRotationWindow(existing, now, options) {
  const hourMs = 60 * 60 * 1000;
  const maxPerHour = options.maxPerHour || DEFAULT_MAX_ROTATIONS_PER_HOUR;
  let rotationWindow = existing?.rotation_count_window;

  if (!rotationWindow) {
    rotationWindow = { count: 0, window_start: now };
  } else if (now - rotationWindow.window_start > hourMs) {
    rotationWindow = { count: 0, window_start: now };
  }

  rotationWindow = { ...rotationWindow, count: rotationWindow.count + 1 };

  if (rotationWindow.count > maxPerHour) {
    throw new Error('Refresh token rotation rate exceeded');
  }

  return rotationWindow;
}

function buildHistory(existing, options) {
  const historyLimit = options.historyLimit || DEFAULT_HISTORY_LIMIT;
  const previous = existing?.refresh_token_enc
    ? [existing.refresh_token_enc, ...(existing.history || [])]
    : (existing?.history || []);
  return previous.slice(0, historyLimit);
}

function upsertInMemory(userId, provider, tokenData, options = {}) {
  const key = getTokenKey(userId, provider);
  const existing = inMemoryTokens.get(key);
  const now = Date.now();

  const hasNewRefresh = Boolean(tokenData.refresh_token);
  const accessTokenEnc = tokenData.access_token ? encrypt(tokenData.access_token) : null;
  const refreshTokenEnc = hasNewRefresh ? encrypt(tokenData.refresh_token) : null;

  if (!existing) {
    if (!hasNewRefresh) {
      throw new Error('Refresh token is required for new social token records');
    }
    const rotationWindow = computeRotationWindow(null, now, options);
    const record = {
      id: generateId(),
      user_id: userId,
      provider,
      access_token_enc: accessTokenEnc,
      refresh_token_enc: refreshTokenEnc,
      token_type: tokenData.token_type || 'bearer',
      expires_at: tokenData.expires_at || 0,
      scope: tokenData.scope || '',
      provider_user_id: tokenData.provider_user_id || '',
      provider_user_email: tokenData.provider_user_email || '',
      provider_user_name: tokenData.provider_user_name || '',
      version: 1,
      history: [],
      revoked: false,
      created_at: now,
      updated_at: now,
      last_rotation_at: now,
      rotation_count_window: rotationWindow
    };
    inMemoryTokens.set(key, record);
    return record;
  }

  const history = hasNewRefresh ? buildHistory(existing, options) : (existing.history || []);
  const rotationWindow = hasNewRefresh
    ? computeRotationWindow(existing, now, options)
    : (existing.rotation_count_window || { count: 0, window_start: existing.updated_at || now });

  const updated = {
    ...existing,
    access_token_enc: accessTokenEnc || existing.access_token_enc,
    refresh_token_enc: refreshTokenEnc || existing.refresh_token_enc,
    token_type: tokenData.token_type || existing.token_type,
    expires_at: tokenData.expires_at || existing.expires_at,
    scope: tokenData.scope || existing.scope,
    provider_user_id: tokenData.provider_user_id || existing.provider_user_id,
    provider_user_email: tokenData.provider_user_email || existing.provider_user_email,
    provider_user_name: tokenData.provider_user_name || existing.provider_user_name,
    version: (existing.version || 1) + (hasNewRefresh ? 1 : 0),
    history,
    revoked: hasNewRefresh ? false : existing.revoked,
    updated_at: now,
    last_rotation_at: hasNewRefresh ? now : existing.last_rotation_at,
    rotation_count_window: rotationWindow
  };

  inMemoryTokens.set(key, updated);
  return updated;
}

/**
 * Social Token Model
 */
class SocialTokenModel {
  static async getByUser(userId, provider) {
    if (!isFirebaseReady) {
      const key = getTokenKey(userId, provider);
      return inMemoryTokens.get(key) || null;
    }

    const docs = await RealtimeDBHelpers.queryDocumentsMultiple(COLLECTIONS.SOCIAL_TOKENS, [
      { field: 'user_id', operator: '==', value: userId },
      { field: 'provider', operator: '==', value: provider }
    ]);

    if (!docs || !docs.length) return null;

    const latest = docs.slice().sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))[0];
    return latest;
  }

  static async upsertToken(userId, provider, tokenData, options = {}) {
    if (!isFirebaseReady) {
      return upsertInMemory(userId, provider, tokenData, options);
    }

    const existing = await this.getByUser(userId, provider);
    const now = Date.now();
    const hasNewRefresh = Boolean(tokenData.refresh_token);
    const accessTokenEnc = tokenData.access_token ? encrypt(tokenData.access_token) : null;
    const refreshTokenEnc = hasNewRefresh ? encrypt(tokenData.refresh_token) : null;

    if (!existing) {
      if (!hasNewRefresh) {
        throw new Error('Refresh token is required for new social token records');
      }

      const cleanCreateData = Object.fromEntries(
        Object.entries({
          user_id: userId,
          provider,
          access_token_enc: accessTokenEnc,
          refresh_token_enc: refreshTokenEnc,
          token_type: tokenData.token_type || 'bearer',
          expires_at: tokenData.expires_at || 0,
          scope: tokenData.scope || '',
          provider_user_id: tokenData.provider_user_id || '',
          provider_user_email: tokenData.provider_user_email || '',
          provider_user_name: tokenData.provider_user_name || '',
          version: 1,
          history: [],
          revoked: false,
          created_at: now,
          updated_at: now,
          last_rotation_at: now,
          rotation_count_window: { count: 1, window_start: now }
        }).filter(([_, v]) => v !== undefined)
      );

      await RealtimeDBHelpers.createDocument(COLLECTIONS.SOCIAL_TOKENS, cleanCreateData);
      return this.getByUser(userId, provider);
    }

    const historyLimit = options.historyLimit || DEFAULT_HISTORY_LIMIT;
    const history = hasNewRefresh
      ? (existing.refresh_token_enc ? [existing.refresh_token_enc, ...(existing.history || [])] : (existing.history || []))
      : (existing.history || []);
    const boundedHistory = hasNewRefresh ? history.slice(0, historyLimit) : history;

    let rotation_count_window = existing.rotation_count_window;
    if (hasNewRefresh) {
      rotation_count_window = computeRotationWindow(existing, now, {
        maxPerHour: options.maxPerHour || DEFAULT_MAX_ROTATIONS_PER_HOUR
      });
    }

    const nextRevoked = hasNewRefresh ? false : existing.revoked;
    const docId = existing.id || existing.key;

    const updatePayload = Object.fromEntries(
      Object.entries({
        access_token_enc: accessTokenEnc || existing.access_token_enc,
        refresh_token_enc: refreshTokenEnc || existing.refresh_token_enc,
        token_type: tokenData.token_type || existing.token_type,
        expires_at: tokenData.expires_at || existing.expires_at,
        scope: tokenData.scope || existing.scope,
        provider_user_id: tokenData.provider_user_id || existing.provider_user_id,
        provider_user_email: tokenData.provider_user_email || existing.provider_user_email,
        provider_user_name: tokenData.provider_user_name || existing.provider_user_name,
        version: (existing.version || 1) + (hasNewRefresh ? 1 : 0),
        history: boundedHistory,
        revoked: nextRevoked,
        updated_at: now,
        last_rotation_at: hasNewRefresh ? now : existing.last_rotation_at,
        rotation_count_window: hasNewRefresh ? rotation_count_window : existing.rotation_count_window
      }).filter(([_, v]) => v !== undefined)
    );

    await RealtimeDBHelpers.updateDocument(COLLECTIONS.SOCIAL_TOKENS, docId, updatePayload);
    return this.getByUser(userId, provider);
  }

  static async revoke(userId, provider) {
    if (!isFirebaseReady) {
      const key = getTokenKey(userId, provider);
      const existing = inMemoryTokens.get(key);
      if (!existing) return;

      inMemoryTokens.set(key, {
        ...existing,
        revoked: true,
        access_token_enc: null,
        refresh_token_enc: null,
        updated_at: Date.now()
      });
      return;
    }

    const existing = await this.getByUser(userId, provider);
    if (!existing) return;

    const docId = existing.id || existing.key;
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.SOCIAL_TOKENS, docId, {
      revoked: true,
      access_token_enc: null,
      refresh_token_enc: null,
      updated_at: Date.now()
    });
  }

  static decryptToken(record) {
    if (!record) return null;

    return {
      access_token: record.access_token_enc ? decrypt(record.access_token_enc) : null,
      refresh_token: record.refresh_token_enc ? decrypt(record.refresh_token_enc) : null
    };
  }
}

module.exports = SocialTokenModel;
