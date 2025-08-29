import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';

const initialState = {
  userPlaylists: [],
  likedPlaylists: [],
  currentPlaylist: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

// 내 플레이리스트 목록 가져오기 (홈 화면용)
export const fetchMyPlaylists = createAsyncThunk(
  'playlist/fetchMyPlaylists',
  async (_, thunkAPI) => {
    try {
      const result = await apiService.getMyPlaylists();
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue('내 플레이리스트를 불러오는데 실패했습니다.');
    }
  }
);

// 특정 유저의 플레이리스트 목록 가져오기 (프로필 화면용)
export const fetchPlaylistsByUserId = createAsyncThunk(
  'playlist/fetchPlaylistsByUserId',
  async (userId, thunkAPI) => {
    try {
      return await apiService.getPlaylistsByUserId(userId);
    } catch (error) {
      return thunkAPI.rejectWithValue('사용자 플레이리스트를 불러오는데 실패했습니다.');
    }
  }
);

export const fetchPlaylistDetails = createAsyncThunk(
  'playlist/fetchPlaylistDetails',
  async (playlistId, thunkAPI) => {
    try {
      const result = await apiService.getPlaylistById(playlistId);
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue('플레이리스트 상세 정보를 불러오는데 실패했습니다.');
    }
  }
);

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
      const result = await apiService.createPlaylist(playlistData);
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue('플레이리스트 생성에 실패했습니다.');
    }
  }
);

export const updatePlaylist = createAsyncThunk(
  'playlist/updatePlaylist',
  async ({ playlistId, playlistData }, thunkAPI) => {
    try {
      const result = await apiService.updatePlaylist(playlistId, playlistData);
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue('플레이리스트 수정에 실패했습니다.');
    }
  }
);

export const deletePlaylist = createAsyncThunk(
  'playlist/deletePlaylist',
  async (playlistId, thunkAPI) => {
    try {
      await apiService.deletePlaylist(playlistId);
      return playlistId;
    } catch (error) {
      return thunkAPI.rejectWithValue('플레이리스트 삭제에 실패했습니다.');
    }
  }
);

const playlistSlice = createSlice({
  name: 'playlist',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetchMyPlaylists (내 플레이리스트)
      .addCase(fetchMyPlaylists.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchMyPlaylists.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.userPlaylists = action.payload;
      })
      .addCase(fetchMyPlaylists.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // fetchPlaylistsByUserId (다른 사용자 플레이리스트)
      .addCase(fetchPlaylistsByUserId.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchPlaylistsByUserId.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // 이 경우, userPlaylists를 덮어쓸지, 다른 state를 사용할지 결정해야 함.
        // 현재는 프로필 화면에서만 사용하므로, 덮어써도 무방할 수 있음.
        state.userPlaylists = action.payload;
      })
      .addCase(fetchPlaylistsByUserId.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // 기타 Thunks
      .addCase(fetchLikedPlaylists.fulfilled, (state, action) => {
        state.likedPlaylists = action.payload;
      })
      .addCase(fetchPlaylistDetails.pending, (state) => {
        state.status = 'loading';
        state.currentPlaylist = null; // 로딩 시작 시 초기화
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
      })
      .addCase(updatePlaylist.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(updatePlaylist.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // 현재 플레이리스트 업데이트
        if (state.currentPlaylist && state.currentPlaylist.id === action.payload.id) {
          state.currentPlaylist = { ...state.currentPlaylist, ...action.payload };
        }
        // 사용자 플레이리스트 목록에서도 업데이트
        const index = state.userPlaylists.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.userPlaylists[index] = { ...state.userPlaylists[index], ...action.payload };
        }
      })
      .addCase(updatePlaylist.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(deletePlaylist.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(deletePlaylist.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const playlistId = action.payload;
        // 사용자 플레이리스트 목록에서 제거
        state.userPlaylists = state.userPlaylists.filter(p => p.id !== playlistId);
        // 현재 플레이리스트가 삭제된 경우 초기화
        if (state.currentPlaylist && state.currentPlaylist.id === playlistId) {
          state.currentPlaylist = null;
        }
      })
      .addCase(deletePlaylist.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export default playlistSlice.reducer;
