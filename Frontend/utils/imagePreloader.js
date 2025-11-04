// utils/imagePreloader.js
import { Image } from 'expo-image';

/**
 * 이미지 URL 배열을 미리 로드합니다
 * @param {string[]} imageUrls - 프리로드할 이미지 URL 배열
 * @returns {Promise<void>}
 */
export const preloadImages = async (imageUrls) => {
  try {
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return;
    }

    // 유효한 URL만 필터링
    const validUrls = imageUrls.filter(url =>
      url && typeof url === 'string' && url.trim().length > 0
    );

    if (validUrls.length === 0) {
      return;
    }

    // 병렬로 이미지 프리로드
    await Promise.all(
      validUrls.map(url =>
        Image.prefetch(url)
          .catch(error => {
            // 개별 이미지 로드 실패는 무시 (전체 로딩 차단 방지)
            if (__DEV__) {
              console.warn(`이미지 프리로드 실패: ${url}`, error);
            }
          })
      )
    );

    if (__DEV__) {
      console.log(`✅ ${validUrls.length}개 이미지 프리로드 완료`);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('이미지 프리로드 중 오류 발생:', error);
    }
  }
};

/**
 * 플레이리스트 목록의 커버 이미지를 미리 로드합니다
 * @param {Array} playlists - 플레이리스트 배열
 * @param {number} limit - 프리로드할 최대 개수 (기본값: 10)
 * @returns {Promise<void>}
 */
export const preloadPlaylistImages = async (playlists, limit = 10) => {
  try {
    if (!Array.isArray(playlists) || playlists.length === 0) {
      return;
    }

    const imageUrls = playlists
      .slice(0, limit)
      .flatMap(playlist => {
        const urls = [];

        // 단일 커버 이미지
        if (playlist.cover_image_url) {
          urls.push(playlist.cover_image_url);
        }

        // 다중 커버 이미지 (첫 번째만)
        if (Array.isArray(playlist.cover_images) && playlist.cover_images.length > 0) {
          urls.push(playlist.cover_images[0]);
        }

        return urls;
      })
      .filter(Boolean);

    await preloadImages(imageUrls);
  } catch (error) {
    if (__DEV__) {
      console.warn('플레이리스트 이미지 프리로드 중 오류 발생:', error);
    }
  }
};

/**
 * 포스트 목록의 이미지를 미리 로드합니다
 * @param {Array} posts - 포스트 배열
 * @param {number} limit - 프리로드할 최대 개수 (기본값: 10)
 * @returns {Promise<void>}
 */
export const preloadPostImages = async (posts, limit = 10) => {
  try {
    if (!Array.isArray(posts) || posts.length === 0) {
      return;
    }

    const imageUrls = posts
      .slice(0, limit)
      .flatMap(post => {
        const urls = [];

        // 사용자 프로필 이미지
        if (post.user?.profile_image_url) {
          urls.push(post.user.profile_image_url);
        }

        // 플레이리스트 커버 이미지
        if (post.playlist?.cover_image_url) {
          urls.push(post.playlist.cover_image_url);
        }

        return urls;
      })
      .filter(Boolean);

    await preloadImages(imageUrls);
  } catch (error) {
    if (__DEV__) {
      console.warn('포스트 이미지 프리로드 중 오류 발생:', error);
    }
  }
};

/**
 * 노래 목록의 앨범 커버 이미지를 미리 로드합니다
 * @param {Array} songs - 노래 배열
 * @param {number} limit - 프리로드할 최대 개수 (기본값: 20)
 * @returns {Promise<void>}
 */
export const preloadSongImages = async (songs, limit = 20) => {
  try {
    if (!Array.isArray(songs) || songs.length === 0) {
      return;
    }

    const imageUrls = songs
      .slice(0, limit)
      .map(song => song.album_cover_url)
      .filter(Boolean);

    await preloadImages(imageUrls);
  } catch (error) {
    if (__DEV__) {
      console.warn('노래 이미지 프리로드 중 오류 발생:', error);
    }
  }
};

/**
 * 이미지 크기에 따른 최적화된 URL을 반환합니다
 * @param {string} url - 원본 이미지 URL
 * @param {string} size - 'small' | 'medium' | 'large'
 * @returns {string}
 */
export const getOptimizedImageUrl = (url, size = 'medium') => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // 이미 로컬 이미지이거나 최적화 불필요한 경우
  if (!url.startsWith('http')) {
    return url;
  }

  // 추후 백엔드 썸네일 API 구현 시 사용
  // return `${API_BASE_URL}/images/thumbnail?url=${encodeURIComponent(url)}&size=${size}`;

  // 현재는 원본 URL 반환
  return url;
};

/**
 * 이미지 캐시를 초기화합니다
 * @returns {Promise<void>}
 */
export const clearImageCache = async () => {
  try {
    await Image.clearMemoryCache();
    await Image.clearDiskCache();

    if (__DEV__) {
      console.log('✅ 이미지 캐시 초기화 완료');
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('이미지 캐시 초기화 중 오류 발생:', error);
    }
  }
};
