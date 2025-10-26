import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import playlistReducer from './slices/playlistSlice';
import postReducer from './slices/postSlice';
import spotifyReducer from './slices/spotifySlice';
import playerReducer from './slices/playerSlice';
import notificationReducer from './slices/notificationSlice';
import searchReducer from './slices/searchSlice';
import likedSongsReducer from './slices/likedSongsSlice';
import recentSongsReducer from './slices/recentSongsSlice'; // 추가
import likedPlaylistsReducer from './slices/likedPlaylistsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    playlist: playlistReducer,
    post: postReducer,
    spotify: spotifyReducer,
    player: playerReducer,
    notification: notificationReducer,
    search: searchReducer,
    likedSongs: likedSongsReducer,
    recentSongs: recentSongsReducer, // 추가
    likedPlaylists: likedPlaylistsReducer,
  },
  // 미들웨어 설정 추가 (redux-thunk의 에러 방지)
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: false,
  }),
});
