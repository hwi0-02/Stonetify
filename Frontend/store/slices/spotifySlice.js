import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as apiService from '../../services/apiService';

const initialState = {
  searchResults: [],
  status: 'idle',
  error: null,
};

// ❗ EXPORT 추가
export const searchTracks = createAsyncThunk(
  'spotify/searchTracks',
  async (query, thunkAPI) => {
    if (!query.trim()) return [];
    try {
      return await apiService.searchTracks(query);
    } catch (error) {
      return thunkAPI.rejectWithValue('곡 검색에 실패했습니다.');
    }
  }
);

const spotifySlice = createSlice({
  name: 'spotify',
  initialState,
  reducers: {
    clearSearchResults: (state) => {
        state.searchResults = [];
        state.status = 'idle';
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchTracks.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(searchTracks.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.searchResults = action.payload;
      })
      .addCase(searchTracks.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { clearSearchResults } = spotifySlice.actions;
export default spotifySlice.reducer;