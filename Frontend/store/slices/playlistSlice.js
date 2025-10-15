import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';
import { createStatusHandlers } from '../utils/statusHelpers';

const initialState = {
  userPlaylists: [],
  likedPlaylists: [],
  recommendedPlaylists: [],
  forYouPlaylists: [],
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

export const fetchRecommendedPlaylists = createAsyncThunk(
  'playlist/fetchRecommendedPlaylists',
  async (_, { rejectWithValue }) => {
    try {
      return await apiService.getRandomPlaylists();
    } catch (error) {
      return rejectWithValue('추천 플레이리스트를 불러오는데 실패했습니다.');
    }
  }
);

export const fetchForYouPlaylists = createAsyncThunk(
  'playlist/fetchForYouPlaylists',
  async (_, { rejectWithValue }) => {
    try {
      return await apiService.getRecommendedPlaylists();
    } catch (error) {
      return rejectWithValue('회원님을 위한 추천을 불러오는데 실패했습니다.');
    }
  }
);


const playlistSlice = createSlice({
  name: 'playlist',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    const { setPending, setFulfilled, setRejected } = createStatusHandlers();
    builder
      // fetchMyPlaylists (내 플레이리스트)
      .addCase(fetchMyPlaylists.pending, (state) => {
        setPending(state);
      })
      .addCase(fetchMyPlaylists.fulfilled, (state, action) => {
        setFulfilled(state);
        state.userPlaylists = action.payload;
      })
      .addCase(fetchMyPlaylists.rejected, (state, action) => {
        setRejected(state, action);
      })
      // fetchPlaylistsByUserId (다른 사용자 플레이리스트)
      .addCase(fetchPlaylistsByUserId.pending, (state) => {
        setPending(state);
      })
      .addCase(fetchPlaylistsByUserId.fulfilled, (state, action) => {
        setFulfilled(state);
        // 이 경우, userPlaylists를 덮어쓸지, 다른 state를 사용할지 결정해야 함.
        // 현재는 프로필 화면에서만 사용하므로, 덮어써도 무방할 수 있음.
        state.userPlaylists = action.payload;
      })
      .addCase(fetchPlaylistsByUserId.rejected, (state, action) => {
        setRejected(state, action);
      })
      // 기타 Thunks
      .addCase(fetchLikedPlaylists.fulfilled, (state, action) => {
        state.likedPlaylists = action.payload;
      })
      .addCase(fetchPlaylistDetails.pending, (state) => {
        setPending(state);
        state.currentPlaylist = null; // 로딩 시작 시 초기화
      })
      .addCase(fetchPlaylistDetails.fulfilled, (state, action) => {
        setFulfilled(state);
        state.currentPlaylist = action.payload;
        
        // Log to verify songs have spotify_id
        if (action.payload?.songs) {
          console.log('📋 [fetchPlaylistDetails] Received songs:', action.payload.songs.length);
          action.payload.songs.forEach((song, idx) => {
            if (!song.spotify_id && !song.spotifyId) {
              console.warn(`⚠️ [fetchPlaylistDetails] Song ${idx} missing spotify_id:`, {
                id: song.id,
                title: song.title || song.name,
                allKeys: Object.keys(song)
              });
            }
          });
        }
      })
      .addCase(fetchPlaylistDetails.rejected, (state, action) => {
        setRejected(state, action);
      })
      .addCase(fetchRecommendedPlaylists.fulfilled, (state, action) => {
        state.recommendedPlaylists = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchRecommendedPlaylists.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(fetchForYouPlaylists.fulfilled, (state, action) => {
        state.forYouPlaylists = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchForYouPlaylists.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(createPlaylist.pending, (state) => {
        setPending(state);
      })
      .addCase(createPlaylist.fulfilled, (state, action) => {
        setFulfilled(state);
        state.userPlaylists.unshift(action.payload);
      })
      .addCase(createPlaylist.rejected, (state, action) => {
        setRejected(state, action);
      })
      .addCase(updatePlaylist.pending, (state) => {
        setPending(state);
      })
      .addCase(updatePlaylist.fulfilled, (state, action) => {
        setFulfilled(state);
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
        setRejected(state, action);
      })
      .addCase(deletePlaylist.pending, (state) => {
        setPending(state);
      })
      .addCase(deletePlaylist.fulfilled, (state, action) => {
        setFulfilled(state);
        const playlistId = action.payload;
        // 사용자 플레이리스트 목록에서 제거
        state.userPlaylists = state.userPlaylists.filter(p => p.id !== playlistId);
        // 현재 플레이리스트가 삭제된 경우 초기화
        if (state.currentPlaylist && state.currentPlaylist.id === playlistId) {
          state.currentPlaylist = null;
        }
      })
      .addCase(deletePlaylist.rejected, (state, action) => {
        setRejected(state, action);
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
        setRejected(state, action);
      })
      .addCase(createShareLinkAsync.fulfilled, (state, action) => {
        // 공유 링크 생성 성공 시 특별한 상태 업데이트는 필요 없음
        // 필요시 공유 링크를 state에 저장할 수 있음
      })
      .addCase(createShareLinkAsync.rejected, (state, action) => {
        setRejected(state, action);
      })
      .addCase(fetchSharedPlaylist.fulfilled, (state, action) => {
        state.currentPlaylist = action.payload;
        setFulfilled(state);
      })
      .addCase(fetchSharedPlaylist.rejected, (state, action) => {
        setRejected(state, action);
      });
  },
});

export default playlistSlice.reducer;