// utils/apiCache.js

/**
 * API 응답 캐싱 유틸리티 클래스
 * 메모리 기반 캐시로 중복 API 호출을 방지하고 성능을 향상시킵니다
 */
class APICache {
  constructor() {
    this.cache = new Map();
    this.defaultCacheTime = 5 * 60 * 1000; // 5분 기본 캐시 시간
  }

  /**
   * 캐시 키 생성
   * @param {string} key - 캐시 키
   * @param {object} params - 추가 파라미터 (옵션)
   * @returns {string}
   */
  generateKey(key, params = {}) {
    if (!params || Object.keys(params).length === 0) {
      return key;
    }

    // 파라미터를 정렬하여 일관된 키 생성
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${JSON.stringify(params[k])}`)
      .join('&');

    return `${key}?${sortedParams}`;
  }

  /**
   * 캐시에 데이터 저장
   * @param {string} key - 캐시 키
   * @param {*} data - 저장할 데이터
   * @param {number} ttl - Time To Live (밀리초, 옵션)
   */
  set(key, data, ttl = this.defaultCacheTime) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

  }

  /**
   * 캐시에서 데이터 조회
   * @param {string} key - 캐시 키
   * @returns {*} 캐시된 데이터 또는 null
   */
  get(key) {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    const isExpired = Date.now() - cached.timestamp > cached.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * 특정 키의 캐시 삭제
   * @param {string} key - 캐시 키
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * 패턴과 일치하는 모든 캐시 삭제
   * @param {string} pattern - 삭제할 키 패턴 (정규식 문자열)
   */
  deletePattern(pattern) {
    const regex = new RegExp(pattern);
    let deletedCount = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * 특정 접두사로 시작하는 모든 캐시 삭제
   * @param {string} prefix - 캐시 키 접두사
   */
  deletePrefix(prefix) {
    let deletedCount = 0;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * 모든 캐시 초기화
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 캐시 크기 반환
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }

  /**
   * 만료된 캐시 정리
   * @returns {number} 삭제된 항목 수
   */
  cleanup() {
    let deletedCount = 0;
    const now = Date.now();

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * 캐시 통계 정보 반환
   * @returns {object}
   */
  getStats() {
    let totalSize = 0;
    let expiredCount = 0;
    const now = Date.now();

    for (const [key, value] of this.cache.entries()) {
      totalSize++;
      if (now - value.timestamp > value.ttl) {
        expiredCount++;
      }
    }

    return {
      total: totalSize,
      expired: expiredCount,
      active: totalSize - expiredCount,
    };
  }
}

// 싱글톤 인스턴스 생성
export const apiCache = new APICache();

// 캐시 키 상수
export const CacheKeys = {
  PLAYLIST: 'playlist',
  PLAYLISTS_MY: 'playlists_my',
  PLAYLISTS_LIKED: 'playlists_liked',
  PLAYLISTS_RECOMMENDED: 'playlists_recommended',
  PLAYLISTS_FOR_YOU: 'playlists_for_you',
  PLAYLISTS_POPULAR: 'playlists_popular',
  POST: 'post',
  POSTS: 'posts',
  USER: 'user',
  USER_PROFILE: 'user_profile',
  SEARCH_TRACKS: 'search_tracks',
  SEARCH_PLAYLISTS: 'search_playlists',
  LIKED_SONGS: 'liked_songs',
  RECENT_PLAYLISTS: 'recent_playlists',
};

// 캐시 TTL 상수 (밀리초)
export const CacheTTL = {
  SHORT: 1 * 60 * 1000, // 1분
  MEDIUM: 5 * 60 * 1000, // 5분 (기본값)
  LONG: 15 * 60 * 1000, // 15분
  VERY_LONG: 60 * 60 * 1000, // 1시간
};

// 주기적 캐시 정리 (5분마다)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    apiCache.cleanup();
  }, 5 * 60 * 1000);
}

export default apiCache;
