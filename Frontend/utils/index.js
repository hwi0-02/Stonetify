import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const LOCAL_IP = process.env.EXPO_PUBLIC_LOCAL_IP || process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = parseNumber(process.env.EXPO_PUBLIC_BACKEND_PORT || process.env.BACKEND_PORT, 5000);
const PROXY_PORT = parseNumber(process.env.EXPO_PUBLIC_PROXY_PORT || process.env.PROXY_PORT, 3001);
const TUNNEL_API_URL = process.env.EXPO_PUBLIC_TUNNEL_API_URL || process.env.TUNNEL_API_URL || '';
const API_TIMEOUT = parseNumber(process.env.EXPO_PUBLIC_API_TIMEOUT || process.env.API_TIMEOUT, 15000);
const RETRY_DELAY = parseNumber(
  process.env.EXPO_PUBLIC_API_RETRY_DELAY ||
  process.env.EXPO_PUBLIC_RETRY_DELAY ||
  process.env.RETRY_DELAY,
  1000
);

export const storage = {
  async getToken() {
    return await AsyncStorage.getItem('token');
  },
  
  async setToken(token) {
    if (token) {
      await AsyncStorage.setItem('token', token);
    }
  },
  
  async removeToken() {
    await AsyncStorage.removeItem('token');
  },

  async getUser() {
    const userStr = await AsyncStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
  
  async setUser(user) {
    if (user) {
      await AsyncStorage.setItem('user', JSON.stringify(user));
    }
  },
  
  async removeUser() {
    await AsyncStorage.removeItem('user');
  },

  async clearAuth() {
    await AsyncStorage.multiRemove(['token', 'user']);
  }
};

export const network = {
  isTunnelMode() {
    if (Platform.OS === 'web') {
      const currentUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
      return currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'));
    }
    
    const hostUri = Constants.expoConfig?.hostUri;
    return hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct'));
  },

  isDevelopment() {
    return __DEV__;
  },

  isWeb() {
    return Platform.OS === 'web';
  },

  isMobile() {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }
};

export const validation = {
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  isValidPassword(password) {
    if (!password || password.length < 8) return false;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    return hasLetter && hasNumber;
  },

  isValidDisplayName(displayName) {
    if (!displayName) return false;
    const nameRegex = /^[a-zA-Z0-9가-힣]{2,20}$/;
    return nameRegex.test(displayName);
  },

  validateRequired(fields) {
    const errors = [];
    Object.entries(fields).forEach(([key, value]) => {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        errors.push(`${key}을(를) 입력해주세요.`);
      }
    });
    return errors;
  }
};

export const format = {
  errorMessage(error, defaultMessage = '처리 중 오류가 발생했습니다.') {
    return error?.response?.data?.message || error?.message || defaultMessage;
  },

  date(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },

  time(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toTimeString().slice(0, 5);
  },

  timeAgo(date) {
    if (!date) return '';
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return '방금 전';
    if (diffMinutes < 60) return `${diffMinutes}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 30) return `${diffDays}일 전`;
    
    return this.date(date);
  }
};

export const async = {
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  async retry(fn, maxRetries = 3, delayMs = 1000) {
    let lastError;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < maxRetries) {
          await this.delay(delayMs);
        }
      }
    }
    
    throw lastError;
  },

  async withTimeout(promise, timeoutMs) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('작업 시간이 초과되었습니다.')), timeoutMs)
    );
    
    return Promise.race([promise, timeoutPromise]);
  }
};

export const CONSTANTS = {
  API: {
    TIMEOUT: API_TIMEOUT,
    RETRY_DELAY: RETRY_DELAY,
    MAX_RETRIES: 3,
  },

  NETWORK: {
    LOCAL_IP,
    BACKEND_PORT,
    PROXY_PORT,
    TUNNEL_API_URL,
  },

  STORAGE_KEYS: {
    TOKEN: 'token',
    USER: 'user',
  },

  STATUS: {
    IDLE: 'idle',
    LOADING: 'loading',
    SUCCESS: 'succeeded',
    FAILED: 'failed',
  }
};

const utils = {
  storage,
  network,
  validation,
  format,
  async,
  CONSTANTS,
};

export default utils;
