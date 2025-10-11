import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// 환경 설정 통합
const CONFIG = {
  LOCAL_IP: '172.31.45.120',
  BACKEND_PORT: 5000,
  PROXY_PORT: 3001,
  TIMEOUT: 15000,
  RETRY_DELAY: 1000,
  PRODUCTION_API: 'http://172.31.45.120:5000/api/',
};

// 환경별 API URL 설정 (최적화된 버전)
const getApiUrl = () => {
  console.log('🔍 API URL 설정 중...');
  console.log('개발 모드:', __DEV__);
  console.log('플랫폼:', Platform.OS);

  if (__DEV__) {
    if (Platform.OS === 'web') {
      // 웹 환경에서 안전한 window 접근
      let currentUrl = '';
      try {
        if (typeof window !== 'undefined' && window.location) {
          currentUrl = window.location.href;
        }
      } catch (error) {
        console.warn('Window 객체 접근 실패:', error);
      }

      console.log('현재 URL:', currentUrl);
      
      // HTTPS 터널 모드 감지 및 프록시 서버 사용
      if (currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'))) {
        console.log('🌐 터널 모드: HTTPS 프록시 서버 사용');
        return `http://localhost:${CONFIG.PROXY_PORT}/proxy/api/`;
      }
      
      // 로컬 웹 개발
      const webUrl = `http://localhost:${CONFIG.BACKEND_PORT}/api/`;
      console.log('🌐 로컬 웹 개발 URL:', webUrl);
      return webUrl;
    }
    
    // 모바일에서 터널 모드 감지
    let hostUri = null;
    try {
      hostUri = Constants.expoConfig?.hostUri;
    } catch (error) {
      console.warn('Constants 접근 실패:', error);
    }

    console.log('Host URI:', hostUri);
    
    if (hostUri) {
      // hostUri 예: "192.168.45.193:8081" → IP만 추출
      const deviceIp = hostUri.split(':')[0];
      const mobileUrl = `http://${deviceIp}:${CONFIG.BACKEND_PORT}/api/`;
      console.log('📱 모바일 네트워크 URL:', mobileUrl);
      return mobileUrl;
     }
    
    // 일반 로컬 네트워크
    const localUrl = `http://${CONFIG.LOCAL_IP}:${CONFIG.BACKEND_PORT}/api/`;
    console.log('📱 일반 로컬 네트워크 URL:', localUrl);
    return localUrl;
  }
  
  // 프로덕션 환경
  console.log('🏭 프로덕션 환경 URL:', CONFIG.PRODUCTION_API);
  return CONFIG.PRODUCTION_API;
};

// 초기화
const API_URL = getApiUrl();
console.log('✅ 최종 API URL:', API_URL);

// 터널 모드 감지 유틸리티 (최적화)
const isTunnelMode = () => {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.location) {
        const currentUrl = window.location.href;
        return currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'));
      }
    } catch (error) {
      console.warn('터널 모드 감지 실패 (웹):', error);
    }
    return false;
  }

  try {
    const hostUri = Constants.expoConfig?.hostUri;
    return hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct'));
  } catch (error) {
    console.warn('터널 모드 감지 실패 (모바일):', error);
    return false;
  }
};


// Axios 인스턴스 생성 (최적화된 설정)
const api = axios.create({
  baseURL: API_URL,
  timeout: CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 (토큰 자동 추가)
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('📤 API 요청:', {
      method: config.method?.toUpperCase(),
      url: config.baseURL + config.url,
      headers: config.headers,
    });
  } catch (error) {
    console.warn('토큰 가져오기 실패:', error);
  }
  return config;
}, (error) => Promise.reject(error));

// 응답 인터셉터 (에러 처리 및 재시도 로직)
api.interceptors.response.use(
  (response) => {
    console.log('📥 API 응답 성공:', {
      status: response.status,
      url: response.config.url,
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    console.error('📥 API 응답 오류:', {
      status: error.response?.status,
      message: error.message,
      code: error.code,
      url: error.config?.url,
    });
    
    // 네트워크 오류 재시도 로직
    if ((error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') && !originalRequest._retry) {
      originalRequest._retry = true;
      console.log('🔄 네트워크 오류로 재시도 중...');
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return api(originalRequest);
    }
    
    // 401 에러 시 토큰 정리 및 로그아웃
    if (error.response?.status === 401) {
      console.log('🔐 인증 만료, 토큰 정리 중...');
      try {
        await AsyncStorage.multiRemove(['token', 'user']);
      } catch (storageError) {
        console.warn('토큰 정리 실패:', storageError);
      }
    }
    
    return Promise.reject(error);
  }
);

// ==================== API ENDPOINTS ====================

// Authentication APIs
export const register = (userData) => api.post('users/register', userData).then(res => res.data);
export const login = (userData) => api.post('users/login', userData).then(res => res.data);
export const getMe = () => api.get('users/me').then(res => res.data);

// User Management APIs
export const followUser = (following_id) => api.post('users/follow', { following_id }).then(res => res.data);
export const unfollowUser = (following_id) => api.delete('users/unfollow', { data: { following_id } }).then(res => res.data);
export const getFollowers = (userId) => api.get(`users/${userId}/followers`).then(res => res.data);
export const getFollowing = (userId) => api.get(`users/${userId}/following`).then(res => res.data);

// Playlist Management APIs
export const createPlaylist = (playlistData) => api.post('playlists', playlistData).then(res => res.data);
export const getMyPlaylists = () => api.get('playlists/me').then(res => res.data);
export const getPlaylistsByUserId = (userId) => api.get(`playlists/user/${userId}`).then(res => res.data);
export const getPlaylistById = (playlistId) => api.get(`playlists/${playlistId}`).then(res => res.data);
export const updatePlaylist = (playlistId, playlistData) => api.put(`playlists/${playlistId}`, playlistData).then(res => res.data);

// 플레이리스트 삭제
export const deletePlaylist = async (playlistId) => {
  try {
    console.log('🗑️ 플레이리스트 삭제 API 호출:', playlistId);
    const response = await api.delete(`playlists/${playlistId}`);
    console.log('✅ 플레이리스트 삭제 성공:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ 플레이리스트 삭제 실패:', error);
    console.error('에러 상태:', error.response?.status);
    console.error('에러 메시지:', error.response?.data);
    throw error;
  }
};

// Playlist Song Management APIs
export const addSongToPlaylist = (playlistId, songData) => {
  // Normalize incoming song object (from Spotify search or internal)
  const normalized = {
    spotify_id: songData.spotify_id || songData.id || null,
    title: songData.title || songData.name || '',
    artist: songData.artist || songData.artists || '',
    album: songData.album || '',
    album_cover_url: songData.album_cover_url || songData.albumCoverUrl || null,
    preview_url: songData.preview_url || null,
    duration_ms: songData.duration_ms || null,
    external_urls: songData.external_urls || songData.external_url || null,
  };
  return api.post(`playlists/${playlistId}/songs`, { song: normalized }).then(res => res.data);
};

// 플레이리스트에서 곡 삭제
export const removeSongFromPlaylist = async (playlistId, songId) => {
  try {
    console.log('🗑️ 곡 삭제 API 호출:', { playlistId, songId });
    const response = await api.delete(`playlists/${playlistId}/songs/${songId}`);
    console.log('✅ 곡 삭제 성공:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ 곡 삭제 실패:', error);
    console.error('에러 상태:', error.response?.status);
    console.error('에러 메시지:', error.response?.data);
    throw error;
  }
};

// Playlist Interaction APIs
export const toggleLikePlaylist = (playlistId) => api.post(`playlists/${playlistId}/like`).then(res => res.data);
export const getLikedPlaylists = () => api.get('playlists/liked').then(res => res.data);

// Playlist Sharing APIs
export const createShareLink = (playlistId) => api.post(`playlists/${playlistId}/share`).then(res => res.data);
export const getSharedPlaylist = (shareId) => api.get(`playlists/shared/${shareId}`).then(res => res.data);
export const getShareStats = (playlistId) => api.get(`playlists/${playlistId}/share/stats`).then(res => res.data);
export const deactivateShareLink = (playlistId) => api.delete(`playlists/${playlistId}/share`).then(res => res.data);
export const updateShareSettings = (playlistId, settings) => api.put(`playlists/${playlistId}/share/settings`, settings).then(res => res.data);

// Post Management APIs
export const getPosts = () => api.get('posts').then(res => res.data);
export const createPost = (postData) => api.post('posts', postData).then(res => res.data);
export const likePost = (postId) => api.post(`posts/${postId}/like`).then(res => res.data);
export const updatePost = (postId, postData) => api.put(`posts/${postId}`, postData).then(res => res.data);
export const deletePost = (postId) => api.delete(`posts/${postId}`).then(res => res.data);
export const toggleSavePost = (postId) => api.post(`posts/${postId}/toggle-save`).then(res => res.data);
export const getSavedPosts = () => api.get('posts/saved/me').then(res => res.data);

export const getUserProfile = (userId) => api.get(`users/${userId}/profile`).then(res => res.data);
export const toggleFollow = (userId) => api.post(`users/${userId}/toggle-follow`).then(res => res.data);

// Spotify Integration APIs
export const searchTracks = (query) => api.get(`spotify/search?q=${encodeURIComponent(query)}`).then(res => res.data);

// Song Like APIs
export const toggleLikeSong = (songIdOrSpotifyId, songPayload) =>
  api.post(`playlists/songs/${encodeURIComponent(songIdOrSpotifyId)}/like`, songPayload ? { song: songPayload } : undefined).then(res => res.data);
export const getMyLikedSongs = () => api.get('playlists/songs/liked/me').then(res => res.data);

// Recommendation APIs
export const getRecommendedPlaylists = () => api.get('recommendations/playlists').then(res => res.data);
export const getSimilarUsers = () => api.get('recommendations/users').then(res => res.data);
export const getTrendingPlaylists = () => api.get('recommendations/trending').then(res => res.data);
export const getRandomPlaylists = () => api.get('playlists/random').then(res => res.data);

// ==================== 수정된 연결 테스트 함수 ====================
export const testConnection = async () => {
  console.log('🔍 연결 테스트 시작...');
  console.log('테스트 URL:', API_URL);

  try {
    // 여러 엔드포인트를 차례대로 시도
    const testEndpoints = [
      'health',           // 헬스체크 엔드포인트 (권장)
      'users/test',       // 기존 테스트 엔드포인트
      'users/me',         // 사용자 정보 (인증 필요 없는 버전이 있다면)
      '',                 // 루트 엔드포인트
    ];

    let lastError = null;

    for (const endpoint of testEndpoints) {
      try {
        console.log(`🔄 ${endpoint || 'root'} 엔드포인트 테스트 중...`);
        
        const response = await axios.get(`${API_URL}${endpoint}`, {
          timeout: 5000, // 5초 타임아웃
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log(`✅ ${endpoint || 'root'} 연결 성공:`, response.status);
        return {
          status: 'success',
          message: '서버 연결 성공',
          endpoint: endpoint || 'root',
          data: response.data,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.log(`❌ ${endpoint || 'root'} 연결 실패:`, error.message);
        lastError = error;
        continue;
      }
    }

    // 모든 엔드포인트 실패
    throw lastError;

  } catch (error) {
    console.error('❌ 모든 연결 테스트 실패:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data,
    });

    // 상세한 에러 정보 반환
    const errorInfo = {
      status: 'error',
      message: '서버 연결 실패',
      details: {
        type: error.code || 'UNKNOWN_ERROR',
        message: error.message,
        status: error.response?.status,
        baseURL: API_URL,
      },
      timestamp: new Date().toISOString(),
    };

    throw errorInfo;
  }
};

// ==================== DEFAULT EXPORT ====================

const apiService = {
  // Authentication
  register,
  login,
  getMe,
  
  // User Management
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  
  // Playlist Management
  createPlaylist,
  getMyPlaylists,
  getPlaylistsByUserId,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  
  // Playlist Songs
  addSongToPlaylist,
  removeSongFromPlaylist,
  
  // Playlist Interactions
  toggleLikePlaylist,
  getLikedPlaylists,
  
  // Playlist Sharing
  createShareLink,
  getSharedPlaylist,
  getShareStats,
  deactivateShareLink,
  updateShareSettings,
  
  // Posts
  getPosts,
  createPost,
  likePost,
  getUserProfile,
  toggleFollow,
  updatePost,
  deletePost,
  toggleSavePost,
  getSavedPosts,
  
  // Spotify
  searchTracks,
  toggleLikeSong,
  getMyLikedSongs,
  
  // Recommendations
  getRecommendedPlaylists,
  getSimilarUsers,
  getTrendingPlaylists,
  getRandomPlaylists,

  // Utilities
  testConnection,
  
  // Internal utilities (for debugging)
  _config: CONFIG,
  _apiUrl: API_URL,
  _isTunnelMode: isTunnelMode,
};

export default apiService;