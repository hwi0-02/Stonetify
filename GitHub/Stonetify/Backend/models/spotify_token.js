// Firebase-based Spotify token persistence (replaces in-memory map)
const crypto = require('crypto');
const { COLLECTIONS, RealtimeDBHelpers, isFirebaseReady } = require('../config/firebase');
const { encrypt, decrypt } = require('../utils/encryption');

// Memory fallback for environments where Firebase is not initialized (e.g., missing env vars in development)
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
    // 🔧 FIX: 새 refresh_token이 있을 때만 revoked 해제
    revoked: isRotation ? false : existing.revoked,
    updated_at: now,
    last_rotation_at: isRotation ? now : existing.last_rotation_at,
    rotation_count_window: rotationWindow,
    client_id: clientId || existing.client_id || null
  };

  inMemoryTokens.set(userId, updated);
  return updated;
}

/**
 * Stored shape (in DB): {
 *  id: <generated>,
 *  user_id: string,
 *  refresh_token_enc: string | null,
 *  scope: string,
 *  version: number,
 *  history: string[],
 *  revoked: boolean,
 *  updated_at: number,
 *  created_at: number,
 *  last_rotation_at: number,
 *  rotation_count_window: { count: number, window_start: number }
 * }
 */
class SpotifyTokenModel {
  static async getByUser(userId) {
    if (!isFirebaseReady) {
      return inMemoryTokens.get(userId) || null;
    }
    const docs = await RealtimeDBHelpers.queryDocuments(COLLECTIONS.SPOTIFY_TOKENS, 'user_id', userId);
    if (!docs || !docs.length) return null;
    // 🔧 FIX: 최신(updated_at DESC) 문서를 선호 (중복 문서/정렬 미보장 대비)
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

    // 🔧 FIX: 회전 윈도우 로직 함수화와 동일 기준 사용
    let rotation_count_window = existing.rotation_count_window;
    if (isRotation) {
      rotation_count_window = computeRotationWindow(existing, now, {
        maxPerHour: options.maxPerHour || 12
      });
    }

    // 🔧 FIX: revoked는 "새 refresh_token을 받았을 때"만 false로 되돌림
    const nextRevoked = isRotation ? false : existing.revoked;

    // 🔧 FIX: RealtimeDB doc 식별자 key 호환 처리 (id 또는 key)
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
        // 유지/삭제는 정책 선택: 여기선 안전을 위해 삭제 유지
        refresh_token_enc: null,
        updated_at: Date.now()
      });
      return;
    }
    const existing = await this.getByUser(userId);
    if (!existing) return;
    const docId = existing.id || existing.key; // 🔧 호환 처리
    await RealtimeDBHelpers.updateDocument(COLLECTIONS.SPOTIFY_TOKENS, docId, {
      revoked: true,
      // 정책상 null로 비움 (불필요하면 history에만 보존하는 전략으로 바꿔도 됨)
      refresh_token_enc: null,
      updated_at: Date.now()
    });
  }

  static async markRevoked(userId) {
    console.log('🔴 [SpotifyTokenModel] Marking token as revoked for user:', userId);
    return this.revoke(userId);
  }

  static decryptRefresh(record) {
    if (!record || !record.refresh_token_enc) return null;
    return decrypt(record.refresh_token_enc);
  }
}

module.exports = SpotifyTokenModel;
