import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// 예시: 좋아요한 곡을 불러오는 비동기 thunk
export const fetchLikedTracks = createAsyncThunk(
  'track/fetchLikedTracks',
  async () => {
    // 실제 API 호출로 대체
    // 예시 데이터
    return [
      { id: 1, name: '좋아요 곡 1', artist: '아티스트 1' },
      { id: 2, name: '좋아요 곡 2', artist: '아티스트 2' },
    ];
  }
);

const trackSlice = createSlice({
  name: 'track',
  initialState: {
    likedTracks: [],
  },
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchLikedTracks.fulfilled, (state, action) => {
      state.likedTracks = action.payload;
    });
  },
});

export default trackSlice.reducer;