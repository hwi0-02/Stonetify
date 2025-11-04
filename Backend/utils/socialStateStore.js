const crypto = require('crypto');

const STATE_TTL_MS = 5 * 60 * 1000; // 5분
// state -> { provider, userId, fingerprint, redirectUri, expiresAt }
const stateStore = new Map();

function cleanupExpired(now = Date.now()) {
  for (const [key, entry] of stateStore.entries()) {
    if (!entry || entry.expiresAt <= now) {
      stateStore.delete(key);
    }
  }
}

function removeExistingOwner({ provider, userId, fingerprint }) {
  if (!provider) return;

  for (const [key, entry] of stateStore.entries()) {
    if (entry.provider !== provider) continue;

    const userMatch = userId && entry.userId === userId;
    const fingerprintMatch = fingerprint && entry.fingerprint === fingerprint;

    if (userMatch || (!userMatch && !entry.userId && !userId && fingerprintMatch)) {
      stateStore.delete(key);
    }
  }
}

function generateStateValue() {
  return crypto.randomBytes(24).toString('hex');
}

function issueState({ provider, userId = null, fingerprint = null, redirectUri = null }) {
  if (!provider) {
    throw new Error('provider is required to issue OAuth state');
  }
  if (!userId && !fingerprint) {
    throw new Error('Either userId or fingerprint is required to issue OAuth state');
  }

  cleanupExpired();
  removeExistingOwner({ provider, userId, fingerprint });

  const state = generateStateValue();
  stateStore.set(state, {
    provider,
    userId: userId || null,
    fingerprint: fingerprint || null,
    redirectUri: redirectUri || null,
    expiresAt: Date.now() + STATE_TTL_MS,
  });

  return state;
}

function consumeState({ provider, userId = null, fingerprint = null, state }) {
  if (!state || !provider) return null;

  cleanupExpired();

  const entry = stateStore.get(state);

  if (!entry) return null;
  if (entry.provider !== provider) return null;
  if (entry.expiresAt <= Date.now()) {
    stateStore.delete(state);
    return null;
  }

  if (entry.userId) {
    if (!userId || entry.userId !== userId) return null;
  } else if (userId) {
    return null;
  }

  if (entry.fingerprint) {
    if (!fingerprint || entry.fingerprint !== fingerprint) return null;
  }

  // Delete only after the state has passed all validation checks so a transient
  // failure (e.g. network retry) does not burn a still-valid state.
  stateStore.delete(state);

  return entry;
}

module.exports = {
  issueState,
  consumeState,
  STATE_TTL_MS,
  __unsafe: {
    cleanupExpired,
    stateStore,
  },
};
