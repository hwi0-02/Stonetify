import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ❗반드시 본인의 PC IP 주소로 변경하세요! (e.g., 'http://192.168.1.5:3000/api/')
const API_URL = 'http://172.16.15.66:5000/api/'; 

const api = axios.create({
  baseURL: API_URL,
});

// 요청 인터셉터: 모든 요청에 토큰을 추가
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// --- Auth ---
export const register = (userData) => api.post('users/register', userData).then(res => res.data);
export const login = (userData) => api.post('users/login', userData).then(res => res.data);
export const getMe = () => api.get('users/me').then(res => res.data);

// --- User ---
export const followUser = (following_id) => api.post('users/follow', { following_id }).then(res => res.data);
export const unfollowUser = (following_id) => api.delete('users/unfollow', { data: { following_id } }).then(res => res.data);
export const getFollowers = (userId) => api.get(`users/${userId}/followers`).then(res => res.data);
export const getFollowing = (userId) => api.get(`users/${userId}/following`).then(res => res.data);


// --- Playlists ---
export const createPlaylist = (playlistData) => api.post('playlists', playlistData).then(res => res.data);
export const getUserPlaylists = (userId) => api.get(`playlists/user/${userId}`).then(res => res.data);
export const getPlaylistById = (playlistId) => api.get(`playlists/${playlistId}`).then(res => res.data);
export const likePlaylist = (playlistId) => api.post('playlists/like', { playlistId }).then(res => res.data);
export const getLikedPlaylists = () => api.get('playlists/liked').then(res => res.data);

// --- Posts ---
export const getPosts = () => api.get('posts').then(res => res.data);
export const createPost = (postData) => api.post('posts', postData).then(res => res.data);
export const likePost = (postId) => api.post(`posts/${postId}/like`).then(res => res.data);

// --- Spotify ---
export const searchTracks = (query) => api.get(`spotify/search?q=${query}`).then(res => res.data);