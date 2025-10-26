import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// 최근에 본 플레이리스트 불러오기 (localStorage)
export const fetchRecentSongs = createAsyncThunk(
  'recentSongs/fetchRecentSongs',
  async () => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('recentPlaylists');
      if (data) {
        return JSON.parse(data);
      }
    }
    return [];
  }
);

const recentSongsSlice = createSlice({
  name: 'recentSongs',
  initialState: {
    recentSongs: [],
  },
  reducers: {
    addRecentPlaylist: (state, action) => {
      // 이미 있으면 삭제 후 맨 앞으로, 없으면 맨 앞에 추가
      const newList = [
        action.payload,
        ...state.recentSongs.filter(pl => pl.id !== action.payload.id)
      ].slice(0, 20); // 최대 20개만 유지
      state.recentSongs = newList;
      // localStorage에 저장
      if (typeof window !== 'undefined') {
        localStorage.setItem('recentPlaylists', JSON.stringify(newList));
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchRecentSongs.fulfilled, (state, action) => {
      state.recentSongs = action.payload;
    });
  },
});

export const { addRecentPlaylist } = recentSongsSlice.actions;
export default recentSongsSlice.reducer;