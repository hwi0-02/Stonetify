import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiCache, CacheKeys, CacheTTL } from '../utils/apiCache';

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

const isHttpsUrl = (url) => typeof url === 'string' && url.trim().toLowerCase().startsWith('https://');
const upgradeToHttpsIfPossible = (url) => {
  if (typeof url !== 'string') return null;
  if (isHttpsUrl(url)) return url;

  const trimmed = url.trim();
  if (trimmed.includes('ngrok')) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  return null;
};

const pickHttpsEndpoint = (...candidates) => {
  for (const candidate of candidates) {
    if (isHttpsUrl(candidate)) {
      return candidate;
    }
  }
  for (const candidate of candidates) {
    const upgraded = upgradeToHttpsIfPossible(candidate);
    if (upgraded) {
      return upgraded;
    }
  }
  return null;
};

// ?�경�?API URL ?�정 (최적?�된 버전)
const getApiUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'web') {
      const currentUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
      const isSecureContext = currentUrl.startsWith('https://');
      const isTunnelHost = currentUrl.includes('ngrok') || currentUrl.includes('exp.direct') || currentUrl.includes('expo.dev');
      
      // HTTPS ?�널 모드 감�? �??�록???�버 ?�용
      if (isTunnelHost) {
        if (isSecureContext) {
          const httpsEndpoint = pickHttpsEndpoint(CONFIG.PROXY_API_URL, CONFIG.TUNNEL_API_URL, CONFIG.PRODUCTION_API);
          if (httpsEndpoint) {
            return httpsEndpoint;
          }
          console.warn(
            'Tunnel mode detected over HTTPS, but no HTTPS API endpoint is configured. ' +
            'Configure EXPO_PUBLIC_TUNNEL_API_URL or EXPO_PUBLIC_PROXY_API_URL with an https:// value to avoid mixed-content blocking.'
          );
        }
        return CONFIG.PROXY_API_URL;
      }
      
      // 로컬 ??개발
      return `http://localhost:${CONFIG.BACKEND_PORT}/api/`;
    }
    
    // 모바?�에???�널 모드 감�?
    const hostUri = Constants.expoConfig?.hostUri;
    
    if (hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct'))) {
      // 모바???�널 모드?�서??IP 주소 ?�용
      return CONFIG.TUNNEL_API_URL;
    }
    
    // 안드로이드 에뮬레이터는 10.0.2.2를 통해 호스트(PC)의 localhost에 접근합니다.
    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${CONFIG.BACKEND_PORT}/api/`;
    }

    // ?�반 로컬 ?�트?�크 (iOS 시뮬레이터/실기기 등)
    return CONFIG.LOCAL_API_URL;
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

// 강화된 캐시 사용 (utils/apiCache.js)
const getCacheKey = (url, params) => {
  return apiCache.generateKey(url, params);
};

const getCachedData = (key) => {
  return apiCache.get(key);
};

const setCachedData = (key, data, ttl = CacheTTL.MEDIUM) => {
  apiCache.set(key, data, ttl);
};

const invalidateCacheByUrl = (url) => {
  if (!url) return;
  apiCache.deletePrefix(url);
};

// 인증 관련 엔드포인트 패턴 (캐시 제외 대상)
const AUTH_ENDPOINTS = [
  '/users/login',
  '/users/register',
  '/users/me',
  '/users/auth/social/kakao',
  '/users/auth/social/naver',
  '/social/kakao/auth',
  '/social/naver/auth',
  '/social/kakao/token',
  '/social/naver/token',
  '/social/kakao/login',
  '/social/naver/login',
  '/social/kakao/me',
  '/social/naver/me',
  '/social/kakao/refresh',
  '/social/naver/refresh',
  '/social/kakao/revoke',
  '/social/naver/revoke',
];

const isAuthEndpoint = (url) => {
  if (!url) return false;
  // 정확한 매칭을 위해 url이 엔드포인트를 포함하는지 확인
  return AUTH_ENDPOINTS.some(endpoint => url.includes(endpoint));
};

// 요청 인터셉터 (토큰 자동 추가 + 캐싱)
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // 인증 엔드포인트인지 확인
  const isAuth = isAuthEndpoint(config.url);
  
  // 모든 인증 API 요청에 Cache-Control: no-store 헤더 추가
  if (isAuth) {
    config.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
    config.headers['Pragma'] = 'no-cache';
    config.headers['Expires'] = '0';
  }
  
  // GET 요청 캐싱 확인 (인증 엔드포인트는 완전히 제외)
  if (config.method === 'get' && !isAuth) {
    const cacheKey = getCacheKey(config.url, config.params);
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
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
    // No-op: avoid noisy playback request logging in production
  }
  
  return config;
}, (error) => Promise.reject(error));

// 응답 인터셉터 (에러 처리 및 재시도 로직 + 캐싱)
api.interceptors.response.use(
  (response) => {
    // GET 요청 결과 캐싱 (인증 엔드포인트는 제외)
    if (response.config.method === 'get' && response.status === 200 && !isAuthEndpoint(response.config.url)) {
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
    
    // ?�트?�크 ?�류 ?�시??로직
    if ((error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') && !originalRequest._retry) {
      originalRequest._retry = true;
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return api(originalRequest);
    }
    
    // 401 에러 - 토큰 만료 또는 인증 실패
    if (error.response?.status === 401) {
      const hasAuthHeader = !!originalRequest?.headers?.Authorization;

      // Authorization 헤더 없이 401이 발생하면 토큰 제거 대상이 아니다.
      if (!hasAuthHeader) {
        return Promise.reject(error);
      }

      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken) {
        return Promise.reject(error);
      }

      await AsyncStorage.multiRemove(['token', 'user', 'tokenExpiry']);
    }
    
    return Promise.reject(error);
  }
);

// ==================== API ENDPOINTS ====================

// Authentication APIs
export const register = (userData) => api.post('users/register', userData).then(res => res.data);
export const login = (userData) => api.post('users/login', userData).then(res => res.data);
export const getMe = () =>
  api.get('users/me').then(res => {
    const data = res.data;
    if (data && !data.id) {
      console.warn('⚠️ [apiService] /users/me 응답에 id가 없습니다:', data);
    }
    return data;
  });

// User Management APIs
export const followUser = async (following_id) => {
  try {
    const response = await api.post('users/follow', { following_id });
    invalidateCacheByUrl('users/');
    invalidateCacheByUrl(`users/${following_id}`);
    invalidateCacheByUrl(`users/${following_id}/profile`);
    invalidateCacheByUrl(`users/${following_id}/followers`);
    invalidateCacheByUrl(`users/${following_id}/following`);
    invalidateCacheByUrl('users/me');
    apiCache.clear();
    return response.data;
  } catch (error) {
    console.error('❌ [API Service] followUser 실패:', error);
    throw error;
  }
};
export const unfollowUser = async (following_id) => {
  try {
    const response = await api.delete('users/unfollow', { data: { following_id } });
    invalidateCacheByUrl('users/');
    invalidateCacheByUrl(`users/${following_id}`);
    invalidateCacheByUrl(`users/${following_id}/profile`);
    invalidateCacheByUrl(`users/${following_id}/followers`);
    invalidateCacheByUrl(`users/${following_id}/following`);
    invalidateCacheByUrl('users/me');
    apiCache.clear();
    return response.data;
  } catch (error) {
    console.error('❌ [API Service] unfollowUser 실패:', error);
    throw error;
  }
};
export const getFollowers = (userId) => api.get(`users/${userId}/followers`).then(res => res.data);
export const getFollowing = (userId) => api.get(`users/${userId}/following`).then(res => res.data);
export const getUserProfile = (userId) => api.get(`users/${userId}/profile`).then(res => res.data);
export const toggleFollow = async (userId) => {
  try {
    const response = await api.post(`users/${userId}/toggle-follow`);
    invalidateCacheByUrl('users/');
    invalidateCacheByUrl(`users/${userId}`);
    invalidateCacheByUrl(`users/${userId}/profile`);
    invalidateCacheByUrl(`users/${userId}/followers`);
    invalidateCacheByUrl(`users/${userId}/following`);
    invalidateCacheByUrl('users/me');
    apiCache.clear();
    return response.data;
  } catch (error) {
    console.error('❌ [API Service] toggleFollow 실패:', error);
    throw error;
  }
};
export const updateProfile = (profileData) => api.put('users/profile', profileData).then(res => res.data);
export const deleteAccount = () => api.delete('users/me').then(res => res.data);

// Playlist Management APIs
export const createPlaylist = (playlistData) => api.post('playlists', playlistData).then(res => res.data);
export const getMyPlaylists = () => api.get('playlists/me').then(res => res.data);
export const getPlaylistsByUserId = (userId) => api.get(`playlists/user/${userId}`).then(res => res.data);
export const getPlaylistById = (playlistId) => api.get(`playlists/${playlistId}`).then(res => res.data);
export const updatePlaylist = (playlistId, playlistData) => api.put(`playlists/${playlistId}`, playlistData).then(res => res.data);

export const savePlaylist = async (playlistId) => {
  try {
    const response = await api.post(`playlists/${playlistId}/save`);
    invalidateCacheByUrl('playlists/me');
    invalidateCacheByUrl('playlists/liked');
    return response.data;
  } catch (error) {
    console.error('❌ [API Service] POST 요청 실패:', error);
    throw error;
  }
};

// ?�레?�리?�트 ??��
export const deletePlaylist = async (playlistId) => {
  try {
    const response = await api.delete(`playlists/${playlistId}`);
    invalidateCacheByUrl(`playlists/${playlistId}`);
    invalidateCacheByUrl('playlists/me');
    invalidateCacheByUrl('playlists/liked');
    invalidateCacheByUrl('playlists/');
    invalidateCacheByUrl('playlists');
    return response.data;
  } catch (error) {
    console.error('???�레?�리?�트 ??�� ?�패:', error);
    throw error;
  }
};

// Playlist Song Management APIs
export const addSongToPlaylist = (playlistId, songData) => {
  // Normalize incoming song object (from Spotify search or internal)
  if (!songData || typeof songData !== 'object') {
    throw new Error('곡 데이터가 유효하지 않습니다.');
  }

  const normalizeArtist = () => {
    if (typeof songData.artist === 'string' && songData.artist.trim()) {
      return songData.artist;
    }
    if (Array.isArray(songData.artists)) {
      return songData.artists
        .map((artist) => (typeof artist === 'string' ? artist : artist?.name))
        .filter(Boolean)
        .join(', ');
    }
    if (typeof songData.artists === 'string') {
      return songData.artists;
    }
    return '';
  };

  const normalizeAlbum = () => {
    if (typeof songData.album === 'string') {
      return songData.album;
    }
    if (songData.album?.name) {
      return songData.album.name;
    }
    return '';
  };

  const normalizeAlbumCover = () => {
    if (songData.album_cover_url) return songData.album_cover_url;
    if (songData.albumCoverUrl) return songData.albumCoverUrl;
    if (Array.isArray(songData.album?.images) && songData.album.images.length) {
      return songData.album.images[0]?.url || null;
    }
    return null;
  };

  const normalizeExternalUrl = () => {
    if (typeof songData.external_urls === 'string') return songData.external_urls;
    if (songData.external_urls?.spotify) return songData.external_urls.spotify;
    if (typeof songData.external_url === 'string') return songData.external_url;
    return null;
  };

  const normalized = {
    spotify_id: songData.spotify_id || songData.id || null,
    title: songData.title || songData.name || '',
    artist: normalizeArtist(),
    album: normalizeAlbum(),
    album_cover_url: normalizeAlbumCover(),
    preview_url: songData.preview_url || null,
    duration_ms: songData.duration_ms || null,
    external_urls: normalizeExternalUrl(),
  };
  return api.post(`playlists/${playlistId}/songs`, { song: normalized }).then(res => res.data);
};

// ?�레?�리?�트?�서 �???��
export const removeSongFromPlaylist = async (playlistId, songId) => {
  try {
    const response = await api.delete(`playlists/${playlistId}/songs/${songId}`);
    invalidateCacheByUrl(`playlists/${playlistId}`);
    return response.data;
  } catch (error) {
    console.error('??�???�� ?�패:', error);
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
export const createPost = async (postData) => {
  try {
    const response = await api.post('posts', postData);
    invalidateCacheByUrl('posts');
    invalidateCacheByUrl('posts/saved');
    invalidateCacheByUrl('posts/saved/me');
    return response.data;
  } catch (error) {
    console.error('❌ [API Service] createPost 실패:', error);
    throw error;
  }
};
export const likePost = (postId) => api.post(`posts/${postId}/like`).then(res => res.data);
export const updatePost = async (postId, postData) => {
  try {
    const response = await api.put(`posts/${postId}`, postData);
    invalidateCacheByUrl('posts');
    invalidateCacheByUrl(`posts/${postId}`);
    invalidateCacheByUrl('posts/saved');
    invalidateCacheByUrl('posts/saved/me');
    return response.data;
  } catch (error) {
    console.error('❌ [API Service] updatePost 실패:', error);
    throw error;
  }
};
export const deletePost = async (postId) => {
  try {
    const response = await api.delete(`posts/${postId}`);
    invalidateCacheByUrl('posts');
    invalidateCacheByUrl(`posts/${postId}`);
    invalidateCacheByUrl('posts/saved');
    invalidateCacheByUrl('posts/saved/me');
    return response.data;
  } catch (error) {
    console.error('❌ [API Service] deletePost 실패:', error);
    throw error;
  }
};
export const toggleSavePost = async (postId) => {
  try {
    const response = await api.post(`posts/${postId}/toggle-save`);
    invalidateCacheByUrl('posts');
    invalidateCacheByUrl('posts/saved');
    invalidateCacheByUrl('posts/saved/me');
    return response.data;
  } catch (error) {
    console.error('❌ [API Service] toggleSavePost 실패:', error);
    throw error;
  }
};
export const getSavedPosts = () => api.get('posts/saved/me').then(res => res.data);
export const getLikedPosts = () => api.get('posts/liked').then(res => res.data);

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

// Social Login APIs (Kakao & Naver)
const withRedirectPayload = (payload, redirectUri) => {
  if (redirectUri) {
    return { ...payload, redirectUri };
  }
  return payload;
};

export const createProtectedSocialState = (provider, redirectUri) =>
  api.post('social/state', withRedirectPayload({ provider }, redirectUri)).then(r => r.data);

export const createPublicSocialState = (provider, redirectUri) =>
  api.post('users/auth/social/state', withRedirectPayload({ provider }, redirectUri)).then(r => r.data);

// Kakao Social Login (Token exchange for account linking)
export const kakaoLogin = ({ code, state, redirectUri }) =>
  api.post('social/kakao/token', withRedirectPayload({ code, state }, redirectUri)).then(r => r.data);
export const refreshKakaoToken = () => api.post('social/kakao/refresh').then(r => r.data);
export const getKakaoProfile = () => api.get('social/kakao/me').then(r => r.data);
export const revokeKakao = () => api.post('social/kakao/revoke').then(r => r.data);

// Kakao Social Auth (Login/Signup - main auth method)
export const kakaoAuth = ({ code, state, redirectUri }) =>
  api.post('users/auth/social/kakao', withRedirectPayload({ code, state }, redirectUri)).then(r => r.data);

// Naver Social Login (Token exchange for account linking)
export const naverLogin = ({ code, state, redirectUri }) =>
  api.post('social/naver/token', withRedirectPayload({ code, state }, redirectUri)).then(r => r.data);
export const refreshNaverToken = () => api.post('social/naver/refresh').then(r => r.data);
export const getNaverProfile = () => api.get('social/naver/me').then(r => r.data);
export const revokeNaver = () => api.post('social/naver/revoke').then(r => r.data);

// Naver Social Auth (Login/Signup - main auth method)
export const naverAuth = ({ code, state, redirectUri }) =>
  api.post('users/auth/social/naver', withRedirectPayload({ code, state }, redirectUri)).then(r => r.data);

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
export const healthCheck = () => api.get('../health').then(res => res.data);


// ==================== DEFAULT EXPORT ====================

const apiService = {
  // Authentication
  register,
  login,
  getMe,
  deleteAccount,
  
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
  getLikedPosts,
  
  // Spotify
  searchTracks,
  searchPlaylists,
  exchangeSpotifyCode,
  refreshSpotifyToken,
  getSpotifyPremiumStatus,
  getSpotifyProfile,
  revokeSpotifySession,
  
  // Social Login (Kakao & Naver)
  createProtectedSocialState,
  createPublicSocialState,
  kakaoLogin,
  refreshKakaoToken,
  getKakaoProfile,
  revokeKakao,
  kakaoAuth,
  naverLogin,
  refreshNaverToken,
  getNaverProfile,
  revokeNaver,
  naverAuth,
  
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
  healthCheck,
  
  // Password Reset (new flow)
  requestPasswordReset: (email) => api.post('users/password-reset/request', { email }).then(r => r.data),
  verifyPasswordResetCode: ({ email, code, newPassword }) => api.post('users/password-reset/verify', { email, code, newPassword }).then(r => r.data),
  
  // Internal utilities (for debugging)
  _config: CONFIG,
  _apiUrl: API_URL,
  _isTunnelMode: isTunnelMode,
};

export default apiService;
