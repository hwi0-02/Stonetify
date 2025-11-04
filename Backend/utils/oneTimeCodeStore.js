// Backend/utils/oneTimeCodeStore.js
// 1회용 코드 저장소 (모바일 토큰 노출 방지)

const crypto = require('crypto');

// 메모리 저장소 (프로덕션에서는 Redis 사용 권장)
const codeStore = new Map();

// 코드 TTL: 60초
const CODE_TTL_MS = 60 * 1000;

/**
 * 1회용 코드 생성 및 저장
 * @param {string} token - JWT 토큰
 * @param {string} provider - OAuth provider (kakao, naver)
 * @returns {string} - 1회용 코드
 */
function issueOneTimeCode(token, provider) {
  const code = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + CODE_TTL_MS;

  codeStore.set(code, {
    token,
    provider,
    expiresAt,
  });

  console.log(`✅ [OneTimeCode] Issued code for ${provider}`);

  // 만료된 코드 정리
  cleanupExpiredCodes();

  return code;
}

/**
 * 1회용 코드로 토큰 교환 (1회만 사용 가능)
 * @param {string} code - 1회용 코드
 * @returns {object|null} - { token, provider } 또는 null
 */
function consumeOneTimeCode(code) {
  const entry = codeStore.get(code);

  if (!entry) {
    console.warn('❌ [OneTimeCode] Code not found or already used:', code);
    return null;
  }

  // 만료 확인
  if (Date.now() > entry.expiresAt) {
    codeStore.delete(code);
    console.warn('⏰ [OneTimeCode] Code expired:', code);
    return null;
  }

  // 1회용 코드이므로 즉시 삭제
  codeStore.delete(code);

  console.log(`✅ [OneTimeCode] Code consumed for ${entry.provider}`);

  return {
    token: entry.token,
    provider: entry.provider,
  };
}

/**
 * 만료된 코드 정리
 */
function cleanupExpiredCodes() {
  const now = Date.now();
  let cleaned = 0;

  for (const [code, entry] of codeStore.entries()) {
    if (now > entry.expiresAt) {
      codeStore.delete(code);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 [OneTimeCode] Cleaned ${cleaned} expired codes`);
  }
}

// 주기적으로 만료된 코드 정리 (5분마다)
setInterval(cleanupExpiredCodes, 5 * 60 * 1000);

module.exports = {
  issueOneTimeCode,
  consumeOneTimeCode,
};
