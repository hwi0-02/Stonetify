import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// 최근에 본 곡을 불러오는 비동기 thunk 예시
export const fetchRecentSongs = createAsyncThunk(
  'recentSongs/fetchRecentSongs',
  async () => {
    // 실제 API 호출로 대체
    return [
      { id: 1, name: '최근 곡 1', artist: '아티스트 1' },
      { id: 2, name: '최근 곡 2', artist: '아티스트 2' },
    ];
  }
);

const recentSongsSlice = createSlice({
  name: 'recentSongs',
  initialState: {
    recentSongs: [],
  },
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchRecentSongs.fulfilled, (state, action) => {
      state.recentSongs = action.payload;
    });
  },
});

export default recentSongsSlice.reducer;