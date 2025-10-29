import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const LOCAL_IP = process.env.EXPO_PUBLIC_LOCAL_IP || process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = parseNumber(process.env.EXPO_PUBLIC_BACKEND_PORT || process.env.BACKEND_PORT, 5000);
const PROXY_PORT = parseNumber(process.env.EXPO_PUBLIC_PROXY_PORT || process.env.PROXY_PORT, 3001);
const TIMEOUT = parseNumber(process.env.EXPO_PUBLIC_API_TIMEOUT || process.env.API_TIMEOUT, 15000);
const RETRY_DELAY = parseNumber(
  process.env.EXPO_PUBLIC_API_RETRY_DELAY ||
  process.env.EXPO_PUBLIC_RETRY_DELAY ||
  process.env.RETRY_DELAY,
  1000
);

const LOCAL_API_URL = process.env.EXPO_PUBLIC_LOCAL_API_URL ||
  process.env.DEV_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  `http://${LOCAL_IP}:${BACKEND_PORT}/api/`;

const TUNNEL_API_URL = process.env.EXPO_PUBLIC_TUNNEL_API_URL ||
  process.env.TUNNEL_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  LOCAL_API_URL;

const PROXY_API_URL = process.env.EXPO_PUBLIC_PROXY_API_URL ||
  process.env.PROXY_API_URL ||
  `http://localhost:${PROXY_PORT}/proxy/api/`;

const PRODUCTION_API = process.env.EXPO_PUBLIC_PROD_API_URL ||
  process.env.PROD_API_URL ||
  LOCAL_API_URL;

// 환경 설정 정보
const CONFIG = {
  LOCAL_IP,
  BACKEND_PORT,
  PROXY_PORT,
  TIMEOUT,
  RETRY_DELAY,
  LOCAL_API_URL,
  TUNNEL_API_URL,
  PROXY_API_URL,
  PRODUCTION_API,
};

// 환경별 API URL 설정(최적화된 버전)
const getApiUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'web') {
      const currentUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
      
      // HTTPS 터널 모드 감지 시 프록시 서버 사용
      if (currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'))) {
        console.log('Tunnel mode detected: using HTTPS proxy endpoint');
        return CONFIG.PROXY_API_URL;
      }
      
      // 로컬 웹 개발
      return `http://localhost:${CONFIG.BACKEND_PORT}/api/`;
    }
    
    // 모바일에서 터널 모드 감지
    const hostUri = Constants.expoConfig?.hostUri;
    
    if (hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct'))) {
      // 모바일 터널 모드에서 터널 API URL 사용
      return CONFIG.TUNNEL_API_URL;
    }
    
    // 안드로이드 에뮬레이터는 10.0.2.2를 통해 호스트(PC)의 localhost에 접근합니다.
    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${CONFIG.BACKEND_PORT}/api/`;
    }

    // 일반 로컬 네트워크(iOS 시뮬레이터/실기기 등)
    return CONFIG.LOCAL_API_URL;
  }
  
  // 프로덕션 환경
  return CONFIG.PRODUCTION_API;
};

// 초기??
const API_URL = getApiUrl();

// 터널 모드 감지 유틸리티(최적화)
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
  // HTTP/2 및 Keep-Alive 최적화
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

// Simple in-memory cache for GET requests
const apiCache = new Map();
const CACHE_TTL = 60000; // 1분

const getCacheKey = (url, params) => {
  return `${url}:${JSON.stringify(params || {})}`;
};

const getCachedData = (key) => {
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  apiCache.delete(key);
  return null;
};

const setCachedData = (key, data) => {
  apiCache.set(key, { data, timestamp: Date.now() });
  // 캐시 크기 제한 (최대 50개)
  if (apiCache.size > 50) {
    const firstKey = apiCache.keys().next().value;
    apiCache.delete(firstKey);
  }
};

const invalidateCacheByUrl = (url) => {
  if (!url) return;
  for (const key of Array.from(apiCache.keys())) {
    if (key.startsWith(`${url}:`)) {
      apiCache.delete(key);
    }
  }
};

// 요청 인터셉터 (토큰 자동 추가 + 캐싱)
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // GET 요청 캐싱 확인
  if (config.method === 'get') {
    const cacheKey = getCacheKey(config.url, config.params);
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      console.log('💾 [Cache Hit]', config.url);
      // 캐시된 데이터를 즉시 반환
      return Promise.reject({
        config,
        response: { data: cachedData, status: 200 },
        fromCache: true,
      });
    }
  }
  
  // 🔍 Detailed logging for playback requests
  if (config.url && config.url.includes('playback/play')) {
    console.log('📡 [API Request] Playback Play:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data
    });
  }
  
  return config;
}, (error) => Promise.reject(error));

// 응답 인터셉터 (에러 처리 및 재시도 로직 + 캐싱)
api.interceptors.response.use(
  (response) => {
    // GET 요청 결과 캐싱
    if (response.config.method === 'get' && response.status === 200) {
      const cacheKey = getCacheKey(response.config.url, response.config.params);
      setCachedData(cacheKey, response.data);
    }
    return response;
  },
  async (error) => {
    // 캐시에서 온 응답은 그대로 반환
    if (error.fromCache) {
      return Promise.resolve(error.response);
    }
    
    const originalRequest = error.config;
    
    // 🔍 Detailed error logging for playback requests
    if (originalRequest?.url && originalRequest.url.includes('playback')) {
      console.error('❌ [API Response Error]', {
        url: originalRequest.url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        requestData: originalRequest.data,
        headers: originalRequest.headers
      });
    }
    
    // Handle TOKEN_REVOKED error - Spotify refresh token expired
    if (error.response?.status === 401 && error.response?.data?.error === 'TOKEN_REVOKED') {
      console.error('🔴 [API] Spotify token revoked - clearing session');
      
      // Clear all auth data
  await AsyncStorage.multiRemove(['spotifyToken', 'spotifyRefreshToken']);
  await AsyncStorage.setItem('spotifyNeedsReauth', 'true');

  // Enhance error with user-friendly message
      const revokedError = new Error('Spotify 연결이 만료되었습니다. 다시 로그인해주세요.');
      revokedError.code = 'TOKEN_REVOKED';
      revokedError.requiresReauth = true;
      revokedError.originalError = error;
      
      return Promise.reject(revokedError);
    }
    
    // 네트워크 오류 재시도 로직
    if ((error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') && !originalRequest._retry) {
      originalRequest._retry = true;
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return api(originalRequest);
    }
    
    // 401 오류 시 토큰 정리 및 로그아웃
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
export const getUserProfile = (userId) => api.get(`users/${userId}/profile`).then(res => res.data);
export const toggleFollow = (userId) => api.post(`users/${userId}/toggle-follow`).then(res => res.data);
export const updateProfile = (profileData) => api.put('users/profile', profileData).then(res => res.data);

// Playlist Management APIs
export const createPlaylist = (playlistData) => api.post('playlists', playlistData).then(res => res.data);
export const getMyPlaylists = () => api.get('playlists/me').then(res => res.data);
export const getPlaylistsByUserId = (userId) => api.get(`playlists/user/${userId}`).then(res => res.data);
export const getPlaylistById = (playlistId) => api.get(`playlists/${playlistId}`).then(res => res.data);
export const updatePlaylist = (playlistId, playlistData) => api.put(`playlists/${playlistId}`, playlistData).then(res => res.data);

export const savePlaylist = async (playlistId) => {
  console.log('🔵 [API Service] savePlaylist 호출:', playlistId);
  console.log('📍 [API Service] API URL:', API_URL);
  console.log('📍 [API Service] 요청 경로:', `playlists/${playlistId}/save`);
  
  try {
    console.log('📤 [API Service] POST 요청 시작...');
    const response = await api.post(`playlists/${playlistId}/save`);
    console.log('✅ [API Service] POST 요청 성공');
    console.log('📦 [API Service] 응답 데이터:', response.data);
    console.log('📊 [API Service] 응답 상태:', response.status);
    invalidateCacheByUrl('playlists/me');
    invalidateCacheByUrl('playlists/liked');
    return response.data;
  } catch (error) {
    console.error('❌ [API Service] POST 요청 실패:', error);
    console.error('❌ [API Service] 오류 타입:', error?.constructor?.name);
    console.error('❌ [API Service] 오류 메시지:', error?.message);
    console.error('❌ [API Service] 응답 상태:', error?.response?.status);
    console.error('❌ [API Service] 응답 데이터:', error?.response?.data);
    console.error('❌ [API Service] 응답 헤더:', error?.response?.headers);
    console.error('❌ [API Service] 요청 설정:', error?.config);
    throw error;
  }
};

// ?�레?�리?�트 ??��
export const deletePlaylist = async (playlistId) => {
  try {
    console.log('플레이리스트 삭제 API 호출:', playlistId);
    const response = await api.delete(`playlists/${playlistId}`);
    console.log('플레이리스트 삭제 성공:', response.data);

    invalidateCacheByUrl(`playlists/${playlistId}`);
    invalidateCacheByUrl('playlists/me');
    invalidateCacheByUrl('playlists/liked');
    invalidateCacheByUrl('playlists/popular');
    invalidateCacheByUrl('playlists/random');
    invalidateCacheByUrl('recommendations/playlists');

    return response.data;
  } catch (error) {
    console.error('플레이리스트 삭제 실패:', error);
    console.error('오류 상태:', error.response?.status);
    console.error('오류 메시지:', error.response?.data);
    throw error;
  }
};

// Playlist Song Management APIs
const getArtistNames = (songData) => {
  if (typeof songData?.artist === 'string' && songData.artist.trim().length > 0) {
    return songData.artist;
  }
  if (Array.isArray(songData?.artists)) {
    const names = songData.artists
      .map((artist) => {
        if (!artist) return null;
        if (typeof artist === 'string') return artist;
        if (typeof artist?.name === 'string') return artist.name;
        if (typeof artist?.title === 'string') return artist.title;
        return null;
      })
      .filter(Boolean);
    return names.join(', ');
  }
  if (typeof songData?.artist?.name === 'string') {
    return songData.artist.name;
  }
  return '';
};

const getArtistList = (songData) => {
  if (Array.isArray(songData?.artists)) {
    return songData.artists
      .map((artist) => {
        if (!artist) return null;
        if (typeof artist === 'string') return artist;
        if (typeof artist?.name === 'string') return artist.name;
        if (typeof artist?.title === 'string') return artist.title;
        return null;
      })
      .filter(Boolean);
  }
  return [];
};

const getAlbumName = (songData) => {
  if (typeof songData?.album === 'string') {
    return songData.album;
  }
  if (typeof songData?.album?.name === 'string') {
    return songData.album.name;
  }
  return songData?.album_name || '';
};

const getAlbumCoverUrl = (songData) => {
  if (songData?.album_cover_url) return songData.album_cover_url;
  if (songData?.albumCoverUrl) return songData.albumCoverUrl;
  if (songData?.thumbnailUrl) return songData.thumbnailUrl;
  if (Array.isArray(songData?.images) && songData.images.length > 0) {
    return songData.images[0]?.url || null;
  }
  if (songData?.album?.images?.length) {
    const [largest, ...rest] = songData.album.images;
    return (
      largest?.url ||
      rest.find((img) => img?.url)?.url ||
      null
    );
  }
  return null;
};

const getExternalUrl = (songData) => {
  if (typeof songData?.external_urls === 'string') return songData.external_urls;
  if (songData?.external_urls?.spotify) return songData.external_urls.spotify;
  if (songData?.external_url) return songData.external_url;
  if (songData?.externalUrl) return songData.externalUrl;
  if (songData?.preview_url) return songData.preview_url;
  return null;
};

const getDurationMs = (songData) => {
  if (typeof songData?.duration_ms === 'number') return songData.duration_ms;
  if (typeof songData?.durationMs === 'number') return songData.durationMs;
  if (typeof songData?.duration?.ms === 'number') return songData.duration.ms;
  if (typeof songData?.duration === 'number') return songData.duration;
  return null;
};

export const addSongToPlaylist = (playlistId, songData) => {
  const artistList = getArtistList(songData);
  const externalUrl = getExternalUrl(songData);

  const normalized = {
    spotify_id: songData.spotify_id || songData.id || songData.spotifyId || null,
    spotify_uri: songData.spotify_uri || songData.uri || null,
    title: songData.title || songData.name || '',
    artist: getArtistNames(songData),
    album: getAlbumName(songData),
    album_cover_url: getAlbumCoverUrl(songData),
    preview_url: songData.preview_url || songData.previewUrl || null,
    duration_ms: getDurationMs(songData),
    external_url: externalUrl,
    external_urls: externalUrl,
  };

  if (artistList.length) {
    normalized.artists = artistList;
  }

  if (songData?.isrc || songData?.external_ids?.isrc) {
    normalized.isrc = songData.isrc || songData.external_ids.isrc;
  }

  if (!normalized.title) {
    normalized.title = songData?.track || '';
  }

  return api
    .post(`playlists/${playlistId}/songs`, { song: normalized })
    .then((res) => {
      invalidateCacheByUrl(`playlists/${playlistId}`);
      invalidateCacheByUrl('playlists/me');
      return res.data;
    });
};

// 플레이리스트에서 곡 삭제
export const removeSongFromPlaylist = async (playlistId, songId) => {
  try {
    console.log('플레이리스트 곡 삭제 API 호출:', { playlistId, songId });
    const response = await api.delete(`playlists/${playlistId}/songs/${songId}`);
    console.log('곡 삭제 성공:', response.data);
    return response.data;
  } catch (error) {
    console.error('곡 삭제 실패:', error);
    console.error('오류 상태:', error.response?.status);
    console.error('오류 메시지:', error.response?.data);
    throw error;
  }
};

// Playlist Interaction APIs
export const toggleLikePlaylist = (playlistId) => api.post(`playlists/${playlistId}/like`).then(res => res.data);
export const getLikedPlaylists = () => api.get('playlists/liked').then(res => res.data);
export const getPopularPlaylists = (period = 'weekly', limit = 50) => api.get(`playlists/popular?period=${period}&limit=${limit}`).then(res => res.data);

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

// Spotify Integration APIs
export const searchTracks = (query) => api.get(`spotify/search?q=${encodeURIComponent(query)}`).then(res => res.data);
export const searchPlaylists = (query) => api.get(`playlists/search?q=${encodeURIComponent(query)}`).then(res => res.data);

// Spotify Auth (PKCE) - Phase B
export const exchangeSpotifyCode = ({ code, code_verifier, redirect_uri, userId, client_id }) =>
  api.post('spotify/auth/token', { code, code_verifier, redirect_uri, userId, client_id }).then(r => r.data);
export const refreshSpotifyToken = ({ refreshTokenEnc, userId, client_id }) =>
  api.post('spotify/auth/refresh', { refreshTokenEnc, userId, client_id }).then(r => r.data);
export const getSpotifyPremiumStatus = (userId) => api.get('spotify/auth/premium-status', { headers: { 'x-user-id': userId }}).then(r => r.data);
export const getSpotifyProfile = (userId) => api.get('spotify/me', { headers: { 'x-user-id': userId }}).then(r => r.data);
export const revokeSpotifySession = (userId) => api.post('spotify/auth/revoke', { userId }).then(r => r.data);

// Playback Control (remote full-track preparation) – REST proxy (backend handles access token)
export const getPlaybackState = (userId) => api.get('spotify/playback/state', { headers: { 'x-user-id': userId }}).then(r => r.data);
export const playRemote = ({ userId, uris, context_uri, position_ms, device_id }) => {
  const payload = { uris, context_uri, position_ms };
  if (device_id) payload.device_id = device_id;
  return api.put('spotify/playback/play', payload, { headers: { 'x-user-id': userId }}).then(r => r.data);
};
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
export const getRandomPlaylists = () => api.get('playlists/random').then(res => res.data);

// Gemini AI Recommendations
export const getGeminiRecommendations = ({ mood, activity } = {}) => {
  const params = new URLSearchParams();
  if (mood) params.append('mood', mood);
  if (activity) params.append('activity', activity);
  const queryString = params.toString();
  return api.get(`recommendations/gemini${queryString ? `?${queryString}` : ''}`).then(res => res.data);
};
export const postRecommendationFeedback = (feedbackData) => api.post('recommendations/feedback', feedbackData).then(res => res.data);

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
  getUserProfile,
  toggleFollow,
  updateProfile,
  
  // Playlist Management
  createPlaylist,
  getMyPlaylists,
  getPlaylistsByUserId,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  savePlaylist,
  
  // Playlist Songs
  addSongToPlaylist,
  removeSongFromPlaylist,
  
  // Playlist Interactions
  toggleLikePlaylist,
  getLikedPlaylists,
  getPopularPlaylists,
  
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
  updatePost,
  deletePost,
  toggleSavePost,
  getSavedPosts,
  
  // Spotify
  searchTracks,
  searchPlaylists,
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
  getRandomPlaylists,
  
  // Gemini AI Recommendations
  getGeminiRecommendations,
  postRecommendationFeedback,
  
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
