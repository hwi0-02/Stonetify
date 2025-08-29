import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import playlistReducer from './slices/playlistSlice';
import postReducer from './slices/postSlice';
import spotifyReducer from './slices/spotifySlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    playlist: playlistReducer,
    post: postReducer,
    spotify: spotifyReducer,
  },
});