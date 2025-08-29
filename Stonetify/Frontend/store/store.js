import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import playlistReducer from './slices/playlistSlice';
import postReducer from './slices/postSlice';
import spotifyReducer from './slices/spotifySlice';
import playerReducer from './slices/playerSlice'; // ❗ 추가

export const store = configureStore({
  reducer: {
    auth: authReducer,
    playlist: playlistReducer,
    post: postReducer,
    spotify: spotifyReducer,
    player: playerReducer, // ❗ 추가
  },
  // 미들웨어 설정 추가 (redux-thunk의 에러 방지)
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: false,
  }),
});
