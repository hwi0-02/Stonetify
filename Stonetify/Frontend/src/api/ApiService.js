import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ 중요: 이 IP 주소를 본인 PC의 IP 주소로 변경해야 합니다. (터미널 ipconfig 명령어)
const API_URL = 'http://172.16.15.66:3000/api';

const api = axios.create({ baseURL: API_URL, timeout: 10000 });

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 이메일과 비밀번호로 로그인을 요청합니다.
 */
export const login = (email, password) => api.post('/users/login', { email, password });

/**
 * 새로운 사용자를 등록합니다.
 */
export const signUp = (email, password, displayName) => api.post('/users', { email, password, display_name: displayName });

/**
 * Spotify 트랙을 검색합니다.
 */
export const searchTracks = (query) => api.get(`/spotify/search?q=${query}`);

/**
 * 모든 게시물 피드를 가져옵니다.
 */
export const getFeed = () => api.get('/posts');

/**
 * 특정 플레이리스트에 노래를 추가합니다.
 */
export const addSongToPlaylist = (playlistId, songData) => api.post(`/playlists/${playlistId}/songs`, songData);

/**
 * 새로운 게시물을 작성합니다.
 */
export const createPost = (postData) => api.post('/posts', postData);

/**
 * 현재 로그인된 사용자의 프로필 정보를 가져옵니다.
 */
export const getUserProfile = () => api.get('/users/profile');

/**
 * 새로운 플레이리스트를 생성합니다.
 * @param {object} playlistData - { title: string, description: string }
 */
export const createPlaylist = (playlistData) => api.post('/playlists', playlistData);

export default api;