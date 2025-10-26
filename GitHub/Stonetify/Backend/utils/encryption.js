// AES-256-GCM 암복호화 유틸리티
// 사용 예시: const { encrypt, decrypt } = require('./utils/encryption');
// ENCRYPTION_KEY 환경 변수는 64자리(32바이트) 16진수 문자열이어야 한다.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128비트 nonce 길이

function getKey() {
  if (!process.env.ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY 환경 변수가 설정되지 않았습니다.');
  }
  let keyHex = process.env.ENCRYPTION_KEY.trim();
  if (/^0x/i.test(keyHex)) keyHex = keyHex.slice(2);
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    console.warn('[encryption] Invalid key length:', key.length, 'bytes (expected 32).');
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  }
  return key;
}

function encrypt(plain) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(payload) {
  const key = getKey();
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('암호화된 데이터 형식이 올바르지 않습니다.');
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
