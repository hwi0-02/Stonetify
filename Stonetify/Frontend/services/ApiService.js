import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ?�경 ?�정 ?�합
const CONFIG = {
  LOCAL_IP: '192.168.219.105',
  BACKEND_PORT: 5000,
  PROXY_PORT: 3001,
  TIMEOUT: 15000,
  RETRY_DELAY: 1000,
  PRODUCTION_API: 'http://192.168.219.105:5000/api/',
};

// ?�경�?API URL ?�정 (최적?�된 버전)
const getApiUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'web') {
      const currentUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
      
      // HTTPS ?�널 모드 감�? �??�록???�버 ?�용
      if (currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'))) {
        console.log('?�� ?�널 모드: HTTPS ?�록???�버 ?�용');
        return `http://localhost:${CONFIG.PROXY_PORT}/proxy/api/`;
      }
      
      // 로컬 ??개발
      return `http://localhost:${CONFIG.BACKEND_PORT}/api/`;
    }
    
    // 모바?�에???�널 모드 감�?
    const hostUri = Constants.expoConfig?.hostUri;
    
    if (hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct'))) {
      // 모바???�널 모드?�서??IP 주소 ?�용
      return process.env.EXPO_PUBLIC_API_URL || `http://${CONFIG.LOCAL_IP}:${CONFIG.BACKEND_PORT}/api/`;
    }
    
    // 안드로이드 에뮬레이터는 10.0.2.2를 통해 호스트(PC)의 localhost에 접근합니다.
    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${CONFIG.BACKEND_PORT}/api/`;
    }

    // ?�반 로컬 ?�트?�크 (iOS 시뮬레이터/실기기 등)
    return `http://${CONFIG.LOCAL_IP}:${CONFIG.BACKEND_PORT}/api/`;
  }
  
  // ?�로?�션 ?�경
  return CONFIG.PRODUCTION_API;
};

// 초기??
const API_URL = getApiUrl();

// ?�널 모드 감�? ?�틸리티 (최적??
const isTunnelMode = () => {
  if (Platform.OS === 'web') {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    return currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'));
  }
  
  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct'));
};

// Axios ?�스?�스 ?�성 (최적?�된 ?�정)
const api = axios.create({
  baseURL: API_URL,
  timeout: CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ?�청 ?�터?�터 (?�큰 ?�동 추�?)
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// ?�답 ?�터?�터 (?�러 처리 �??�시??로직)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // ?�트?�크 ?�류 ?�시??로직
    if ((error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') && !originalRequest._retry) {
      originalRequest._retry = true;
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return api(originalRequest);
    }
    
    // 401 ?�러 ???�큰 ?�리 �?로그?�웃
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

// ?�레?�리?�트 ??��
export const deletePlaylist = async (playlistId) => {
  try {
    console.log('?���??�레?�리?�트 ??�� API ?�출:', playlistId);
    const response = await api.delete(`playlists/${playlistId}`);
    console.log('???�레?�리?�트 ??�� ?�공:', response.data);
    return response.data;
  } catch (error) {
    console.error('???�레?�리?�트 ??�� ?�패:', error);
    console.error('?�러 ?�태:', error.response?.status);
    console.error('?�러 메시지:', error.response?.data);
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

// ?�레?�리?�트?�서 �???��
export const removeSongFromPlaylist = async (playlistId, songId) => {
  try {
    console.log('?���?�???�� API ?�출:', { playlistId, songId });
    const response = await api.delete(`playlists/${playlistId}/songs/${songId}`);
    console.log('??�???�� ?�공:', response.data);
    return response.data;
  } catch (error) {
    console.error('??�???�� ?�패:', error);
    console.error('?�러 ?�태:', error.response?.status);
    console.error('?�러 메시지:', error.response?.data);
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

// Spotify Auth (PKCE) - Phase B
export const exchangeSpotifyCode = ({ code, code_verifier, redirect_uri, userId }) =>
  api.post('spotify/auth/token', { code, code_verifier, redirect_uri, userId }).then(r => r.data);
export const refreshSpotifyToken = ({ refreshTokenEnc, userId }) =>
  api.post('spotify/auth/refresh', { refreshTokenEnc, userId }).then(r => r.data);
export const getSpotifyPremiumStatus = (userId) => api.get('spotify/auth/premium-status', { headers: { 'x-user-id': userId }}).then(r => r.data);
export const getSpotifyProfile = (userId) => api.get('spotify/me', { headers: { 'x-user-id': userId }}).then(r => r.data);
export const revokeSpotifySession = (userId) => api.post('spotify/auth/revoke', { userId }).then(r => r.data);

// Playback Control (remote full-track preparation) – REST proxy (backend handles access token)
export const getPlaybackState = (userId) => api.get('spotify/playback/state', { headers: { 'x-user-id': userId }}).then(r => r.data);
export const playRemote = ({ userId, uris, context_uri, position_ms, device_id }) =>
  api.put('spotify/playback/play', { uris, context_uri, position_ms, device_id }, { headers: { 'x-user-id': userId }}).then(r => r.data);
export const pauseRemote = (userId) => api.put('spotify/playback/pause', {}, { headers: { 'x-user-id': userId }}).then(r => r.data);
export const nextRemote = (userId) => api.post('spotify/playback/next', {}, { headers: { 'x-user-id': userId }}).then(r => r.data);
export const previousRemote = (userId) => api.post('spotify/playback/previous', {}, { headers: { 'x-user-id': userId }}).then(r => r.data);
export const seekRemote = ({ userId, position_ms }) => api.put('spotify/playback/seek', { position_ms }, { headers: { 'x-user-id': userId }}).then(r => r.data);
export const setRemoteVolume = ({ userId, volume_percent }) => api.put('spotify/playback/volume', { volume_percent }, { headers: { 'x-user-id': userId }}).then(r => r.data);
export const getRemoteDevices = (userId) => api.get('spotify/me/devices', { headers: { 'x-user-id': userId }}).then(r => r.data);
export const transferRemotePlayback = ({ userId, device_id, play = true }) =>
  api.put('spotify/playback/transfer', { device_id, play }, { headers: { 'x-user-id': userId }}).then(r => r.data);

// Playback History APIs
export const startPlaybackHistory = ({ userId, track, playbackSource }) =>
  api.post('spotify/playback/history/start', { userId, track, playbackSource }, { headers: { 'x-user-id': userId }}).then(r => r.data);
export const completePlaybackHistory = ({ userId, historyId, positionMs, durationMs }) =>
  api.post('spotify/playback/history/complete', { userId, historyId, positionMs, durationMs }, { headers: { 'x-user-id': userId }}).then(r => r.data);

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
  exchangeSpotifyCode,
  refreshSpotifyToken,
  getSpotifyPremiumStatus,
  getSpotifyProfile,
  revokeSpotifySession,
  // Remote playback control
  getPlaybackState,
  playRemote,
  pauseRemote,
  nextRemote,
  previousRemote,
  seekRemote,
  setRemoteVolume,
  getRemoteDevices,
  transferRemotePlayback,
  // Playback history
  startPlaybackHistory,
  completePlaybackHistory,
  toggleLikeSong,
  getMyLikedSongs,
  
  // Recommendations
  getRecommendedPlaylists,
  getSimilarUsers,
  getTrendingPlaylists,
  
  // Utilities
  testConnection,
  
  // Password Reset (new flow)
  requestPasswordReset: (email) => api.post('users/password-reset/request', { email }).then(r => r.data),
  verifyPasswordResetCode: ({ email, code, newPassword }) => api.post('users/password-reset/verify', { email, code, newPassword }).then(r => r.data),
  
  // Internal utilities (for debugging)
  _config: CONFIG,
  _apiUrl: API_URL,
  _isTunnelMode: isTunnelMode,
};

export default apiService;

