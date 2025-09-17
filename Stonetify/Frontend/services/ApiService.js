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
  if (__DEV__) {
    if (Platform.OS === 'web') {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
      
      // HTTPS 터널 모드 감지 및 프록시 서버 사용
      if (currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'))) {
        console.log('🌐 터널 모드: HTTPS 프록시 서버 사용');
        return `http://localhost:${CONFIG.PROXY_PORT}/proxy/api/`;
      }
      
      // 로컬 웹 개발
      return `http://localhost:${CONFIG.BACKEND_PORT}/api/`;
    }
    
    // 모바일에서 터널 모드 감지
    const hostUri = Constants.expoConfig?.hostUri;
    
    if (hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct'))) {
      // 모바일 터널 모드에서는 IP 주소 사용
      return process.env.EXPO_PUBLIC_API_URL || `http://${CONFIG.LOCAL_IP}:${CONFIG.BACKEND_PORT}/api/`;
    }
    
    // 일반 로컬 네트워크
    return `http://${CONFIG.LOCAL_IP}:${CONFIG.BACKEND_PORT}/api/`;
  }
  
  // 프로덕션 환경
  return CONFIG.PRODUCTION_API;
};

// 초기화
const API_URL = getApiUrl();

// 터널 모드 감지 유틸리티 (최적화)
const isTunnelMode = () => {
  if (Platform.OS === 'web') {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    return currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'));
  }
  
  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct'));
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
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// 응답 인터셉터 (에러 처리 및 재시도 로직)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // 네트워크 오류 재시도 로직
    if ((error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') && !originalRequest._retry) {
      originalRequest._retry = true;
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return api(originalRequest);
    }
    
    // 401 에러 시 토큰 정리 및 로그아웃
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['token', 'user']);
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

// Utility APIs
export const testConnection = () => api.get('users/test').then(res => res.data);

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
  
  // Spotify
  searchTracks,
  toggleLikeSong,
  getMyLikedSongs,
  
  // Recommendations
  getRecommendedPlaylists,
  getSimilarUsers,
  getTrendingPlaylists,
  
  // Utilities
  testConnection,
  
  // Internal utilities (for debugging)
  _config: CONFIG,
  _apiUrl: API_URL,
  _isTunnelMode: isTunnelMode,
};

export default apiService;