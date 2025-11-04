const crypto = require('crypto');
const { COLLECTIONS, RealtimeDBHelpers, isFirebaseReady } = require('../config/firebase');
const { encrypt, decrypt } = require('../utils/encryption');

const inMemoryTokens = new Map();

const DEFAULT_HISTORY_LIMIT = 5;
const DEFAULT_MAX_ROTATIONS_PER_HOUR = 12;

function generateId() {
  if (typeof crypto.randomUUID === 'function') {
    return `mem-${crypto.randomUUID()}`;
  }
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

function upsertInMemory(userId, plainRefreshToken, scope, options = {}) {
  const existing = inMemoryTokens.get(userId);
  const now = Date.now();
  const isRotation = Boolean(plainRefreshToken);
  const enc = isRotation ? encrypt(plainRefreshToken) : null;
  const clientId = options.clientId || existing?.client_id || null;

  if (!existing) {
    if (!isRotation) {
      throw new Error('Refresh token is required for new Spotify token records');
    }
    const rotationWindow = computeRotationWindow(null, now, options);
    const record = {
      id: generateId(),
      user_id: userId,
      refresh_token_enc: enc,
      scope: scope || '',
      version: 1,
      history: [],
      revoked: false,
      created_at: now,
      updated_at: now,
      last_rotation_at: now,
      rotation_count_window: rotationWindow,
      client_id: clientId
    };
    inMemoryTokens.set(userId, record);
    return record;
  }

  const history = isRotation ? buildHistory(existing, options) : (existing.history || []);
  const rotationWindow = isRotation
    ? computeRotationWindow(existing, now, options)
    : (existing.rotation_count_window || { count: 0, window_start: existing.updated_at || now });

  const updated = {
    ...existing,
    refresh_token_enc: enc || existing.refresh_token_enc,
    scope: scope || existing.scope,
    version: (existing.version || 1) + (isRotation ? 1 : 0),
    history,
    revoked: isRotation ? false : existing.revoked,
    updated_at: now,
    last_rotation_at: isRotation ? now : existing.last_rotation_at,
    rotation_count_window: rotationWindow,
    client_id: clientId || existing.client_id || null
  };

  inMemoryTokens.set(userId, updated);
  return updated;
}

class SpotifyTokenModel {
  static async getByUser(userId) {
    if (!isFirebaseReady) {
      return inMemoryTokens.get(userId) || null;
    }
    const docs = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SPOTIFY_TOKENS, 'user_id', userId);
    if (!docs || !docs.length) return null;
    const latest = docs.slice().sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))[0];
    return latest;
  }

  static async upsertRefresh(userId, plainRefreshToken, scope, options = {}) {
    if (!isFirebaseReady) {
      return upsertInMemory(userId, plainRefreshToken, scope, options);
    }

    const existing = await this.getByUser(userId);
    const now = Date.now();
    const isRotation = Boolean(plainRefreshToken);
    const enc = isRotation ? encrypt(plainRefreshToken) : null;

    if (!existing) {
      if (!isRotation) {
        throw new Error('Refresh token is required for new Spotify token records');
      }
      await RealtimeDBHelpers.createDocument(COLLECTIONS.SPOTIFY_TOKENS, {
        user_id: userId,
        refresh_token_enc: enc,
        scope: scope || '',
        version: 1,
        history: [],
        revoked: false,
        created_at: now,
        updated_at: now,
        last_rotation_at: now,
        rotation_count_window: { count: 1, window_start: now },
        client_id: options.clientId || null
      });
      return this.getByUser(userId);
    }

    const historyLimit = options.historyLimit || 5;
    const history = isRotation
      ? (existing.refresh_token_enc ? [existing.refresh_token_enc, ...(existing.history || [])] : (existing.history || []))
      : (existing.history || []);
    const boundedHistory = isRotation ? history.slice(0, historyLimit) : history;

    let rotation_count_window = existing.rotation_count_window;
    if (isRotation) {
      rotation_count_window = computeRotationWindow(existing, now, {
        maxPerHour: options.maxPerHour || 12
      });
    }

    const nextRevoked = isRotation ? false : existing.revoked;
    const docId = existing.id || existing.key;

    await RealtimeDBHelpers.updateDocument(COLLECTIONS.SPOTIFY_TOKENS, docId, {
      refresh_token_enc: enc || existing.refresh_token_enc,
      scope: scope || existing.scope,
      version: (existing.version || 1) + (isRotation ? 1 : 0),
      history: boundedHistory,
      revoked: nextRevoked,
      updated_at: now,
      last_rotation_at: isRotation ? now : existing.last_rotation_at,
      rotation_count_window: isRotation ? rotation_count_window : existing.rotation_count_window,
      client_id: options.clientId || existing.client_id || null
    });

    return this.getByUser(userId);
  }

  static async revoke(userId) {
    if (!isFirebaseReady) {
      const existing = inMemoryTokens.get(userId);
      if (!existing) return;
      inMemoryTokens.set(userId, {
        ...existing,
        revoked: true,
        refresh_token_enc: null,
        updated_at: Date.now()
      });
      return;
    }
    const existing = await this.getByUser(userId);
    if (!existing) return;
    const docId = existing.id || existing.key;
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.SPOTIFY_TOKENS, docId, {
      revoked: true,
      refresh_token_enc: null,
      updated_at: Date.now()
    });
  }

  static async markRevoked(userId) {
    return this.revoke(userId);
  }

  static decryptRefresh(record) {
    if (!record || !record.refresh_token_enc) return null;
    return decrypt(record.refresh_token_enc);
  }
  
  static async delete(id) {
    if (!isFirebaseReady) {
      inMemoryTokens.delete(id); // (메모리 스토어 사용 시)
      return;
    }
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.SPOTIFY_TOKENS, id);
  }
}

module.exports = SpotifyTokenModel;
