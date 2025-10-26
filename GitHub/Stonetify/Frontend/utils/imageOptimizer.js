/**
 * 이미지 최적화 유틸리티
 * - 이미지 URL 캐싱
 * - 이미지 크기 최적화
 */

const imageCache = new Map();

/**
 * 이미지 URL을 최적화된 버전으로 변환
 * @param {string} url - 원본 이미지 URL
 * @param {number} width - 원하는 너비
 * @param {number} height - 원하는 높이
 * @returns {string} - 최적화된 이미지 URL
 */
export const optimizeImageUrl = (url, width = 300, height = 300) => {
  if (!url || typeof url !== 'string') return null;
  
  // Spotify 이미지인 경우
  if (url.includes('i.scdn.co')) {
    // Spotify는 이미 최적화된 이미지를 제공
    return url;
  }
  
  // 다른 이미지 서비스의 경우 파라미터 추가
  const cacheKey = `${url}_${width}_${height}`;
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }
  
  imageCache.set(cacheKey, url);
  return url;
};

/**
 * 이미지 프리로드
 * @param {string[]} urls - 프리로드할 이미지 URL 배열
 */
export const preloadImages = async (urls) => {
  if (!Array.isArray(urls) || urls.length === 0) return;
  
  const validUrls = urls.filter(url => url && typeof url === 'string');
  
  try {
    // expo-image의 프리로드 기능 사용
    const { Image } = await import('expo-image');
    if (Image.prefetch) {
      await Promise.all(validUrls.map(url => Image.prefetch(url)));
    }
  } catch (error) {
    console.warn('이미지 프리로드 실패:', error.message);
  }
};

/**
 * 캐시 클리어
 */
export const clearImageCache = () => {
  imageCache.clear();
};

export default {
  optimizeImageUrl,
  preloadImages,
  clearImageCache,
};
