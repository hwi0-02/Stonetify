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
      const message = error.response?.data?.message || '플레이리스트 수정에 실패했습니다.';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const deletePlaylist = createAsyncThunk(
  'playlist/deletePlaylist',
  async (playlistId, thunkAPI) => {
    try {
      await apiService.deletePlaylist(playlistId);
      return playlistId; // 성공 시 playlistId를 반환합니다.
    } catch (error) {
      const message = error.response?.data?.message || '플레이리스트 삭제에 실패했습니다.';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// 플레이리스트 공유 링크 생성
export const createShareLinkAsync = createAsyncThunk(
  'playlist/createShareLink',
  async (playlistId, thunkAPI) => {
    try {
      const result = await apiService.createShareLink(playlistId);
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue('공유 링크 생성에 실패했습니다.');
    }
  }
);

// 공유 링크로 플레이리스트 조회
export const fetchSharedPlaylist = createAsyncThunk(
  'playlist/fetchSharedPlaylist',
  async (playlistId, thunkAPI) => {
    try {
      const result = await apiService.getSharedPlaylist(playlistId);
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue('공유 플레이리스트를 불러오는데 실패했습니다.');
    }
  }
);

// 플레이리스트 좋아요 토글
export const toggleLikePlaylist = createAsyncThunk(
  'playlist/toggleLikePlaylist',
  async (playlistId, thunkAPI) => {
    try {
      const result = await apiService.toggleLikePlaylist(playlistId);
      return { playlistId, liked: result.liked };
    } catch (error) {
      return thunkAPI.rejectWithValue('좋아요 처리에 실패했습니다.');
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
      .addCase(createPlaylist.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.userPlaylists.unshift(action.payload);
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
      })
      .addCase(toggleLikePlaylist.fulfilled, (state, action) => {
        const { playlistId, liked } = action.payload;
        // 현재 플레이리스트의 좋아요 상태 업데이트
        if (state.currentPlaylist && state.currentPlaylist.id === playlistId) {
          state.currentPlaylist.liked = liked;
        }
        // 사용자 플레이리스트 목록에서도 업데이트
        const index = state.userPlaylists.findIndex(p => p.id === playlistId);
        if (index !== -1) {
          state.userPlaylists[index].liked = liked;
        }
        // 좋아요한 플레이리스트 목록 업데이트
        if (liked) {
          // 좋아요 추가
          const playlist = state.userPlaylists.find(p => p.id === playlistId);
          if (playlist && !state.likedPlaylists.find(p => p.id === playlistId)) {
            state.likedPlaylists.push(playlist);
          }
        } else {
          // 좋아요 제거
          state.likedPlaylists = state.likedPlaylists.filter(p => p.id !== playlistId);
        }
      })
      .addCase(toggleLikePlaylist.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(createShareLinkAsync.fulfilled, (state, action) => {
        // 공유 링크 생성 성공 시 특별한 상태 업데이트는 필요 없음
        // 필요시 공유 링크를 state에 저장할 수 있음
      })
      .addCase(createShareLinkAsync.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchSharedPlaylist.fulfilled, (state, action) => {
        state.currentPlaylist = action.payload;
        state.status = 'succeeded';
      })
      .addCase(fetchSharedPlaylist.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export default playlistSlice.reducer;