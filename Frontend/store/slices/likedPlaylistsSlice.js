import { createSlice } from '@reduxjs/toolkit';

const loadLikedPlaylists = () => {
  try {
    const data = localStorage.getItem('likedPlaylists');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLikedPlaylists = (playlists) => {
  try {
    localStorage.setItem('likedPlaylists', JSON.stringify(playlists));
  } catch {}
};

const likedPlaylistsSlice = createSlice({
  name: 'likedPlaylists',
  initialState: {
    list: loadLikedPlaylists(),
  },
  reducers: {
    toggleLikePlaylist: (state, action) => {
      const playlist = action.payload;
      const exists = state.list.find(p => p.id === playlist.id);
      if (exists) {
        state.list = state.list.filter(p => p.id !== playlist.id);
      } else {
        state.list = [playlist, ...state.list];
      }
      saveLikedPlaylists(state.list);
    },
  },
});

export const { toggleLikePlaylist } = likedPlaylistsSlice.actions;
export default likedPlaylistsSlice.reducer;