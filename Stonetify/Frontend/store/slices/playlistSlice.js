import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as apiService from '../../services/apiService';

const initialState = {
  userPlaylists: [],
  likedPlaylists: [],
  currentPlaylist: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

// ❗ EXPORT 추가
export const fetchUserPlaylists = createAsyncThunk(
  'playlist/fetchUserPlaylists',
  async (userId, thunkAPI) => {
    try {
      return await apiService.getUserPlaylists(userId);
    } catch (error) {
      return thunkAPI.rejectWithValue('사용자 플레이리스트를 불러오는데 실패했습니다.');
    }
  }
);

// ❗ EXPORT 추가 (이름을 fetchPlaylistById에서 fetchPlaylistDetails로 변경)
export const fetchPlaylistDetails = createAsyncThunk(
  'playlist/fetchPlaylistDetails',
  async (playlistId, thunkAPI) => {
    try {
      return await apiService.getPlaylistById(playlistId);
    } catch (error) {
      return thunkAPI.rejectWithValue('플레이리스트 상세 정보를 불러오는데 실패했습니다.');
    }
  }
);

// ❗ EXPORT 추가 (누락된 함수 생성)
export const fetchLikedPlaylists = createAsyncThunk(
  'playlist/fetchLikedPlaylists',
  async (_, thunkAPI) => {
    try {
      return await apiService.getLikedPlaylists();
    } catch (error) {
      return thunkAPI.rejectWithValue('좋아요한 플레이리스트를 불러오는데 실패했습니다.');
    }
  }
);


export const createPlaylist = createAsyncThunk(
  'playlist/createPlaylist',
  async (playlistData, thunkAPI) => {
      try {
        const newPlaylist = await apiService.createPlaylist(playlistData);
        thunkAPI.dispatch(fetchUserPlaylists(thunkAPI.getState().auth.user.id));
        return newPlaylist;
      } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || '플레이리스트 생성에 실패했습니다.');
      }
  }
);

const playlistSlice = createSlice({
  name: 'playlist',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserPlaylists.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchUserPlaylists.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.userPlaylists = action.payload;
      })
      .addCase(fetchUserPlaylists.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchLikedPlaylists.fulfilled, (state, action) => {
        state.likedPlaylists = action.payload;
      })
      .addCase(fetchPlaylistDetails.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchPlaylistDetails.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.currentPlaylist = action.payload;
      })
      .addCase(fetchPlaylistDetails.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(createPlaylist.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(createPlaylist.fulfilled, (state) => {
        state.status = 'succeeded';
      })
      .addCase(createPlaylist.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export default playlistSlice.reducer;