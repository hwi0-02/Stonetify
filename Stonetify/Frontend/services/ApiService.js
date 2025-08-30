import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API 기본 URL 설정 (개발 환경에 맞게 IP 주소 변경 필요)
const API_URL = 'http://192.168.219.105:5000/api/'; 

const api = axios.create({
  baseURL: API_URL,
});

// 요청 시 토큰 자동 추가
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// API 에러 로깅
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('🚨 API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

// 인증 관련 API
export const register = (userData) => api.post('users/register', userData).then(res => res.data);
export const login = (userData) => api.post('users/login', userData).then(res => res.data);
export const getMe = () => api.get('users/me').then(res => res.data);

// 사용자 관련 API
export const followUser = (following_id) => api.post('users/follow', { following_id }).then(res => res.data);
export const unfollowUser = (following_id) => api.delete('users/unfollow', { data: { following_id } }).then(res => res.data);
export const getFollowers = (userId) => api.get(`users/${userId}/followers`).then(res => res.data);
export const getFollowing = (userId) => api.get(`users/${userId}/following`).then(res => res.data);

// 플레이리스트 관련 API
export const createPlaylist = (playlistData) => api.post('playlists', playlistData).then(res => res.data);
export const getMyPlaylists = () => api.get('playlists/me').then(res => res.data);
export const getPlaylistsByUserId = (userId) => api.get(`playlists/user/${userId}`).then(res => res.data);
export const getPlaylistById = (playlistId) => api.get(`playlists/${playlistId}`).then(res => res.data);
export const updatePlaylist = (playlistId, playlistData) => api.put(`playlists/${playlistId}`, playlistData).then(res => res.data);
export const deletePlaylist = (playlistId) => api.delete(`playlists/${playlistId}`).then(res => res.data);
export const addSongToPlaylist = (playlistId, songData) => api.post(`playlists/${playlistId}/songs`, { song: songData }).then(res => res.data);
export const removeSongFromPlaylist = (playlistId, songId) => api.delete(`playlists/${playlistId}/songs/${songId}`).then(res => res.data);
export const toggleLikePlaylist = (playlistId) => api.post(`playlists/${playlistId}/like`).then(res => res.data);
export const getLikedPlaylists = () => api.get('playlists/liked').then(res => res.data);

// 공유 관련 API (개선된 버전)
export const createShareLink = (playlistId) => api.post(`playlists/${playlistId}/share`).then(res => res.data);
export const getSharedPlaylist = (shareId) => api.get(`playlists/shared/${shareId}`).then(res => res.data);
export const getShareStats = (playlistId) => api.get(`playlists/${playlistId}/share/stats`).then(res => res.data);
export const deactivateShareLink = (playlistId) => api.delete(`playlists/${playlistId}/share`).then(res => res.data);
export const updateShareSettings = (playlistId, settings) => api.put(`playlists/${playlistId}/share/settings`, settings).then(res => res.data);

// --- Posts ---
export const getPosts = () => api.get('posts').then(res => res.data);
export const createPost = (postData) => api.post('posts', postData).then(res => res.data);
export const likePost = (postId) => api.post(`posts/${postId}/like`).then(res => res.data);

// --- Spotify ---
export const searchTracks = (query) => api.get(`spotify/search?q=${query}`).then(res => res.data);

// --- Recommendations ---
export const getRecommendedPlaylists = () => api.get('recommendations/playlists').then(res => res.data);
export const getSimilarUsers = () => api.get('recommendations/users').then(res => res.data);
export const getTrendingPlaylists = () => api.get('recommendations/trending').then(res => res.data);

const apiService = {
    register,
    login,
    getMe,
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    createPlaylist,
    getMyPlaylists,
    getPlaylistsByUserId,
    getPlaylistById,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    toggleLikePlaylist,
    getLikedPlaylists,
    createShareLink,
    getSharedPlaylist,
    getShareStats,
    deactivateShareLink,
    updateShareSettings,
    getPosts,
    createPost,
    likePost,
    searchTracks,
    getRecommendedPlaylists,
    getSimilarUsers,
    getTrendingPlaylists,
};

export default apiService;