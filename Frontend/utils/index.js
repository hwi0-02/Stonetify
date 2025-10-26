// ==================== Common Utilities for Stonetify ====================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ==================== Storage Utilities ====================

export const storage = {
  // 토큰 관련 저장소 유틸리티
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
  
  // 사용자 정보 저장소 유틸리티
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
  
  // 모든 인증 관련 데이터 제거
  async clearAuth() {
    await AsyncStorage.multiRemove(['token', 'user']);
  }
};

// ==================== Network Utilities ====================

export const network = {
  // 터널 모드 감지
  isTunnelMode() {
    if (Platform.OS === 'web') {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
      return currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'));
    }
    
    const hostUri = Constants.expoConfig?.hostUri;
    return hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct'));
  },
  
  // 개발 환경 감지
  isDevelopment() {
    return __DEV__;
  },
  
  // 웹 환경 감지
  isWeb() {
    return Platform.OS === 'web';
  },
  
  // 모바일 환경 감지
  isMobile() {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }
};

// ==================== Validation Utilities ====================

export const validation = {
  // 이메일 검증
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  // 비밀번호 강도 검증 (최소 8자, 영문+숫자 포함)
  isValidPassword(password) {
    if (!password || password.length < 8) return false;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    return hasLetter && hasNumber;
  },
  
  // 사용자명 검증 (2-20자, 특수문자 제외)
  isValidDisplayName(displayName) {
    if (!displayName) return false;
    const nameRegex = /^[a-zA-Z0-9가-힣]{2,20}$/;
    return nameRegex.test(displayName);
  },
  
  // 필수 필드 검증
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

// ==================== Format Utilities ====================

export const format = {
  // API 에러 메시지 포맷
  errorMessage(error, defaultMessage = '처리 중 오류가 발생했습니다.') {
    return error?.response?.data?.message || error?.message || defaultMessage;
  },
  
  // 날짜 포맷 (YYYY-MM-DD)
  date(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },
  
  // 시간 포맷 (HH:MM)
  time(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toTimeString().slice(0, 5);
  },
  
  // 상대 시간 포맷 (n분 전, n시간 전 등)
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

// ==================== Async Utilities ====================

export const async = {
  // 지연 실행
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // 재시도 로직
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
  
  // 타임아웃이 있는 실행
  async withTimeout(promise, timeoutMs) {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('작업 시간이 초과되었습니다.')), timeoutMs)
    );
    
    return Promise.race([promise, timeoutPromise]);
  }
};

// ==================== Constants ====================

export const CONSTANTS = {
  // API 설정
  API: {
    TIMEOUT: 15000,
    RETRY_DELAY: 1000,
    MAX_RETRIES: 3,
  },
  
  // 네트워크 설정
  NETWORK: {
    LOCAL_IP: '192.168.219.105',
    BACKEND_PORT: 5000,
    PROXY_PORT: 3001,
  },
  
  // 저장소 키
  STORAGE_KEYS: {
    TOKEN: 'token',
    USER: 'user',
  },
  
  // 상태 값
  STATUS: {
    IDLE: 'idle',
    LOADING: 'loading',
    SUCCESS: 'succeeded',
    FAILED: 'failed',
  }
};

// ==================== Default Export ====================

const utils = {
  storage,
  network,
  validation,
  format,
  async,
  CONSTANTS,
};

export default utils;
