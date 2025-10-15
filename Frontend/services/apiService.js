import http, {
  API_CONFIG,
  API_BASE_URL,
  detectTunnelMode,
  handleApiError,
} from './httpClient';

export { handleApiError } from './httpClient';

const extract = (response) => response.data;

const get = (url, config) => http.get(url, config).then(extract);
const post = (url, data, config) => http.post(url, data, config).then(extract);
const put = (url, data, config) => http.put(url, data, config).then(extract);
const del = (url, data, config) => http.delete(url, { ...(config || {}), data }).then(extract);

const withUserHeader = (userId, config = {}) => {
  if (!userId) {
    return config;
  }
  const headers = { ...(config.headers || {}), 'x-user-id': userId };
  return { ...config, headers };
};

// ==================== Authentication ====================

export const register = (payload) => post('users/register', payload);
export const login = (payload) => post('users/login', payload);
export const getMe = () => get('users/me');
export const updateProfile = (payload) => put('users/profile', payload);
export const requestPasswordReset = (payload) => {
  const body = typeof payload === 'string' ? { email: payload } : payload;
  return post('users/password-reset/request', body);
};
export const verifyPasswordResetCode = (payload) => {
  const { email, code, newPassword } = payload || {};
  return post('users/password-reset/verify', { email, code, newPassword });
};
export const testConnection = () => get('users/test');

// ==================== User / Social ====================

export const followUser = (followingId) => post('users/follow', { following_id: followingId });
export const unfollowUser = (followingId) => del('users/unfollow', { following_id: followingId });
export const toggleFollow = (userId) => post(`users/${userId}/toggle-follow`);
export const getFollowers = (userId) => get(`users/${userId}/followers`);
export const getFollowing = (userId) => get(`users/${userId}/following`);
export const getUserProfile = (userId) => get(`users/${userId}/profile`);

// ==================== Playlists ====================

export const getMyPlaylists = () => get('playlists/me');
export const getPlaylistsByUserId = (userId) => get(`playlists/user/${userId}`);
export const getPlaylistById = (playlistId) => get(`playlists/${playlistId}`);
export const searchPlaylists = (query) => get('playlists/search', { params: { q: query } });
export const createPlaylist = (payload) => post('playlists', payload);
export const updatePlaylist = (playlistId, payload) => put(`playlists/${playlistId}`, payload);
export const deletePlaylist = (playlistId) => del(`playlists/${playlistId}`);

export const addSongToPlaylist = (playlistId, song) => post(`playlists/${playlistId}/songs`, { song });
export const removeSongFromPlaylist = (playlistId, songId) => del(`playlists/${playlistId}/songs/${songId}`);

export const toggleLikePlaylist = (playlistId) => post(`playlists/${playlistId}/like`);
export const getLikedPlaylists = () => get('playlists/liked');
export const getRandomPlaylists = () => get('playlists/random');

export const createShareLink = (playlistId) => post(`playlists/${playlistId}/share`);
export const getShareStats = (playlistId) => get(`playlists/${playlistId}/share/stats`);
export const deactivateShareLink = (playlistId) => del(`playlists/${playlistId}/share`);
export const getSharedPlaylist = (shareId) => get(`playlists/shared/${shareId}`);

export const toggleLikeSong = (songId, songPayload) =>
  post(`playlists/songs/${encodeURIComponent(songId)}/like`, songPayload ? { song: songPayload } : undefined);
export const getMyLikedSongs = () => get('playlists/songs/liked/me');

// ==================== Posts ====================

export const getPosts = () => get('posts');
export const createPost = (payload) => post('posts', payload);
export const likePost = (postId) => post(`posts/${postId}/like`);
export const updatePost = (postId, payload) => put(`posts/${postId}`, payload);
export const deletePost = (postId) => del(`posts/${postId}`);
export const toggleSavePost = (postId) => post(`posts/${postId}/toggle-save`);
export const getSavedPosts = () => get('posts/saved/me');

// ==================== Recommendations ====================

export const getRecommendedPlaylists = () => get('recommendations/playlists');
export const getSimilarUsers = () => get('recommendations/users');
export const getTrendingPlaylists = () => get('recommendations/trending');

// ==================== Search ====================

export const searchTracks = (query) => get('spotify/search', { params: { q: query } });

// ==================== Spotify Auth ====================

export const exchangeSpotifyCode = (payload) => post('spotify/auth/token', payload);
export const refreshSpotifyToken = (payload) => post('spotify/auth/refresh', payload);
export const revokeSpotifySession = (userId) => post('spotify/auth/revoke', { userId });
export const getSpotifyPremiumStatus = (userId) => get('spotify/auth/premium-status', withUserHeader(userId));
export const getSpotifyProfile = (userId) => get('spotify/me', withUserHeader(userId));

// ==================== Spotify Playback ====================

export const getPlaybackState = (userId) => get('spotify/playback/state', withUserHeader(userId));
export const playRemote = ({ userId, ...payload }) => put('spotify/playback/play', payload, withUserHeader(userId));
export const pauseRemote = (userId) => put('spotify/playback/pause', {}, withUserHeader(userId));
export const nextRemote = (userId) => post('spotify/playback/next', {}, withUserHeader(userId));
export const previousRemote = (userId) => post('spotify/playback/previous', {}, withUserHeader(userId));
export const seekRemote = ({ userId, position_ms }) => put('spotify/playback/seek', { position_ms }, withUserHeader(userId));
export const setRemoteVolume = ({ userId, volume_percent }) =>
  put('spotify/playback/volume', { volume_percent }, withUserHeader(userId));
export const getRemoteDevices = (userId) => get('spotify/me/devices', withUserHeader(userId));
export const transferRemotePlayback = ({ userId, device_id, play = true }) =>
  put('spotify/playback/transfer', { device_id, play }, withUserHeader(userId));

// ==================== Playback History ====================

export const startPlaybackHistory = ({ userId, track, playbackSource }) =>
  post('spotify/playback/history/start', { userId, track, playbackSource }, withUserHeader(userId));
export const completePlaybackHistory = ({ userId, historyId, positionMs, durationMs, completed }) =>
  post(
    'spotify/playback/history/complete',
    { userId, historyId, positionMs, durationMs, completed },
    withUserHeader(userId),
  );

// ==================== Module Namespace ====================

const apiService = {
  // auth
  register,
  login,
  getMe,
  updateProfile,
  requestPasswordReset,
  verifyPasswordResetCode,
  testConnection,
  // social
  followUser,
  unfollowUser,
  toggleFollow,
  getFollowers,
  getFollowing,
  getUserProfile,
  // playlists
  getMyPlaylists,
  getPlaylistsByUserId,
  getPlaylistById,
  searchPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  toggleLikePlaylist,
  getLikedPlaylists,
  getRandomPlaylists,
  createShareLink,
  getShareStats,
  deactivateShareLink,
  getSharedPlaylist,
  toggleLikeSong,
  getMyLikedSongs,
  // posts
  getPosts,
  createPost,
  likePost,
  updatePost,
  deletePost,
  toggleSavePost,
  getSavedPosts,
  // recommendations
  getRecommendedPlaylists,
  getSimilarUsers,
  getTrendingPlaylists,
  // search
  searchTracks,
  searchPlaylists,
  // spotify auth & playback
  exchangeSpotifyCode,
  refreshSpotifyToken,
  revokeSpotifySession,
  getSpotifyPremiumStatus,
  getSpotifyProfile,
  getPlaybackState,
  playRemote,
  pauseRemote,
  nextRemote,
  previousRemote,
  seekRemote,
  setRemoteVolume,
  getRemoteDevices,
  transferRemotePlayback,
  startPlaybackHistory,
  completePlaybackHistory,
  // utilities
  handleApiError,
  _client: http,
  _config: API_CONFIG,
  _apiUrl: API_BASE_URL,
  _isTunnelMode: detectTunnelMode,
  _rawGet: (url, config) => http.get(url, config),
  _rawPost: (url, data, config) => http.post(url, data, config),
  _rawPut: (url, data, config) => http.put(url, data, config),
  _rawDelete: (url, config) => http.delete(url, config),
};

export default apiService;

