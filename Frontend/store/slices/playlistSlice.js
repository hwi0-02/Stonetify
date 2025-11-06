import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';

const AI_RECOMMENDATION_CACHE_KEY = 'stonetify.ai.recommendations.cache';

const initialState = {
  userPlaylists: [],
  likedPlaylists: [],
  recommendedPlaylists: [],
  forYouPlaylists: [],
  popularPlaylists: [],
  currentPlaylist: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  // AI 추천 상태
  aiRecommendations: {
    tracks: [],
    summary: '',
    followUpQuestion: '',
    status: 'idle',
    error: null,
    lastUpdatedAt: null,
  },
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

//인기차트용 플레이리스트 가져오기 (홈 화면용)
export const fetchPopularPlaylists = createAsyncThunk(
  'playlist/fetchPopularPlaylists',
  async ({ period, limit }, thunkAPI) => {
    try {
      const result = await apiService.getPopularPlaylists(period, limit);
      return result;
    } catch (error) {
      return thunkAPI.rejectWithValue('인기 플레이리스트를 불러오는데 실패했습니다.');
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
      return {
        playlistId,
        liked: result.liked,
        likeCount: typeof result.likeCount === 'number'
          ? result.likeCount
          : typeof result.like_count === 'number'
            ? result.like_count
            : null,
      };
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

export const savePlaylistAsync = createAsyncThunk(
  'playlist/savePlaylist',
  async (playlistId, { rejectWithValue }) => {
    console.log('🔵 [Redux Thunk] savePlaylistAsync 시작:', playlistId);
    try {
      console.log('📤 [Redux Thunk] apiService.savePlaylist 호출 중...');
      const result = await apiService.savePlaylist(playlistId);
      console.log('✅ [Redux Thunk] apiService.savePlaylist 성공:', result);
      return result;
    } catch (error) {
      console.error('❌ [Redux Thunk] apiService.savePlaylist 실패:', error);
      console.error('❌ [Redux Thunk] 오류 세부정보:', {
        message: error?.message,
        response: error?.response,
        responseData: error?.response?.data,
        responseStatus: error?.response?.status,
        responseStatusText: error?.response?.statusText,
        errorType: typeof error,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });

      const message = error?.response?.data?.message || error?.message || '플레이리스트를 담는 중 문제가 발생했습니다.';
      console.log('🔴 [Redux Thunk] rejectWithValue 호출:', message);
      return rejectWithValue(message);
    }
  }
);

// Gemini AI 추천 가져오기
export const fetchGeminiRecommendations = createAsyncThunk(
  'playlist/fetchGeminiRecommendations',
  async ({ mood, activity } = {}, { rejectWithValue }) => {
    try {
      const result = await apiService.getGeminiRecommendations({ mood, activity });
      const payload = {
        tracks: result?.tracks || [],
        summary: result?.summary || '',
        followUpQuestion: result?.followUpQuestion || '',
        lastUpdatedAt: new Date().toISOString(),
      };
      try {
        await AsyncStorage.setItem(AI_RECOMMENDATION_CACHE_KEY, JSON.stringify(payload));
      } catch (storageError) {
        console.warn('[PlaylistSlice] Failed to cache AI recommendations:', storageError);
      }
      return payload;
    } catch (error) {
      const status = error.response?.status;
      const serverMessage = error.response?.data?.message;
      const detail = status ? `[${status}] ${serverMessage || error.message || '요청 실패'}` : (serverMessage || error.message || 'AI 추천을 불러오는데 실패했습니다.');
      console.warn('[PlaylistSlice] Gemini recommendation failed:', {
        status,
        serverMessage,
        data: error.response?.data,
        message: error.message,
      });
      return rejectWithValue(detail);
    }
  }
);

export const hydrateGeminiRecommendations = createAsyncThunk(
  'playlist/hydrateGeminiRecommendations',
  async (_, { rejectWithValue }) => {
    try {
      const cached = await AsyncStorage.getItem(AI_RECOMMENDATION_CACHE_KEY);
      if (!cached) return null;
      return JSON.parse(cached);
    } catch (error) {
      console.warn('[PlaylistSlice] Failed to hydrate AI recommendations:', error);
      return rejectWithValue(null);
    }
  }
);

// 추천 피드백 전송
export const sendRecommendationFeedback = createAsyncThunk(
  'playlist/sendRecommendationFeedback',
  async ({ trackId, action, context }, { rejectWithValue }) => {
    try {
      return await apiService.postRecommendationFeedback({ trackId, action, context });
    } catch (error) {
      return rejectWithValue('피드백 전송에 실패했습니다.');
    }
  }
);

export const addSongToPlaylistThunk = createAsyncThunk(
  'playlist/addSongToPlaylist',
  async ({ playlistId, songData }, { rejectWithValue }) => {
    try {
      const response = await apiService.addSongToPlaylist(playlistId, songData);
      return { playlistId, response };
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || error.message || '곡 추가에 실패했습니다.',
        status: error.response?.status || null,
      });
    }
  }
);

export const deletePlaylistAsync = createAsyncThunk(
  'playlist/deletePlaylistAsync',
  async (playlistId, { rejectWithValue }) => {
    try {
      await apiService.deletePlaylist(playlistId);
      return playlistId;
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        '플레이리스트 삭제에 실패했습니다.';
      return rejectWithValue(message);
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
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchRecommendedPlaylists.fulfilled, (state, action) => {
        state.recommendedPlaylists = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchRecommendedPlaylists.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(addSongToPlaylistThunk.pending, (state) => {
        state.error = null;
      })
      .addCase(addSongToPlaylistThunk.fulfilled, (state, action) => {
        const { playlistId, response } = action.payload || {};
        const updatedPlaylist =
          response?.playlist ||
          response?.data?.playlist ||
          null;

        if (updatedPlaylist) {
          if (state.currentPlaylist && state.currentPlaylist.id === updatedPlaylist.id) {
            state.currentPlaylist = { ...state.currentPlaylist, ...updatedPlaylist };
          }
          if (Array.isArray(state.userPlaylists)) {
            state.userPlaylists = state.userPlaylists.map((playlist) =>
              playlist.id === updatedPlaylist.id ? { ...playlist, ...updatedPlaylist } : playlist
            );
          }
          return;
        }

        const newSong =
          response?.song ||
          response?.data?.song ||
          response;

        if (!newSong) return;

        if (state.currentPlaylist && state.currentPlaylist.id === playlistId) {
          if (!Array.isArray(state.currentPlaylist.songs)) {
            state.currentPlaylist.songs = [];
          }
          const exists = state.currentPlaylist.songs.some(
            (song) =>
              (song.id && newSong.id && song.id === newSong.id) ||
              (song.spotify_id && newSong.spotify_id && song.spotify_id === newSong.spotify_id)
          );
          if (!exists) {
            state.currentPlaylist.songs = [...state.currentPlaylist.songs, newSong];
          }
        }
      })
      .addCase(addSongToPlaylistThunk.rejected, (state, action) => {
        state.error = action.payload?.message || action.error?.message || '곡 추가에 실패했습니다.';
      })
      .addCase(fetchForYouPlaylists.fulfilled, (state, action) => {
        state.forYouPlaylists = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchForYouPlaylists.rejected, (state, action) => {
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
      .addCase(deletePlaylistAsync.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(deletePlaylistAsync.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const playlistId = action.payload;
        // 사용자 플레이리스트 목록에서 제거
        state.userPlaylists = state.userPlaylists.filter(p => p.id !== playlistId);
        // 현재 플레이리스트가 삭제된 경우 초기화
        if (state.currentPlaylist && state.currentPlaylist.id === playlistId) {
          state.currentPlaylist = null;
        }
      })
      .addCase(deletePlaylistAsync.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(toggleLikePlaylist.fulfilled, (state, action) => {
        const { playlistId, liked, likeCount } = action.payload || {};
        if (!playlistId) {
          return;
        }
        if (typeof liked !== 'boolean') {
          return;
        }
        const likeDelta = liked ? 1 : -1;
        const applyLikeToCollection = (collection) => {
          if (!Array.isArray(collection)) return collection;
          return collection.map((playlist) => {
            if (!playlist || playlist.id !== playlistId) return playlist;
            const next = { ...playlist, liked };
            if (typeof likeCount === 'number') {
              next.like_count = likeCount;
            } else if (typeof next.like_count === 'number') {
              const adjusted = Math.max(0, Number(next.like_count) + likeDelta);
              next.like_count = adjusted;
            }
            return next;
          });
        };

        if (state.currentPlaylist && state.currentPlaylist.id === playlistId) {
          state.currentPlaylist = {
            ...state.currentPlaylist,
            liked,
          };
          if (typeof likeCount === 'number') {
            state.currentPlaylist.like_count = likeCount;
          } else if (typeof state.currentPlaylist.like_count === 'number') {
            state.currentPlaylist.like_count = Math.max(
              0,
              Number(state.currentPlaylist.like_count) + likeDelta
            );
          }
        }

        state.userPlaylists = applyLikeToCollection(state.userPlaylists);
        state.recommendedPlaylists = applyLikeToCollection(state.recommendedPlaylists);
        state.forYouPlaylists = applyLikeToCollection(state.forYouPlaylists);
        state.popularPlaylists = applyLikeToCollection(state.popularPlaylists);

        const ensureLikeMetadata = (playlist) => {
          if (!playlist) return playlist;
          const next = { ...playlist, liked: true };
          if (typeof likeCount === 'number') {
            next.like_count = likeCount;
          }
          return next;
        };

        if (liked) {
          if (!Array.isArray(state.likedPlaylists)) {
            state.likedPlaylists = [];
          }
          const existingIndex = state.likedPlaylists.findIndex((p) => p?.id === playlistId);
          if (existingIndex >= 0) {
            const updated = ensureLikeMetadata(state.likedPlaylists[existingIndex] || { id: playlistId });
            state.likedPlaylists[existingIndex] = updated;
          } else {
            const sourceCollections = [
              state.userPlaylists,
              state.recommendedPlaylists,
              state.forYouPlaylists,
              state.popularPlaylists,
            ];
            let playlistSource = null;
            for (const collection of sourceCollections) {
              if (!Array.isArray(collection)) continue;
              playlistSource = collection.find((p) => p?.id === playlistId);
              if (playlistSource) break;
            }
            if (!playlistSource && state.currentPlaylist?.id === playlistId) {
              playlistSource = state.currentPlaylist;
            }
            const normalized = ensureLikeMetadata(playlistSource || { id: playlistId });
            const { songs, ...rest } = normalized || { id: playlistId };
            state.likedPlaylists = [rest, ...state.likedPlaylists];
          }
        } else {
          if (Array.isArray(state.likedPlaylists)) {
            state.likedPlaylists = state.likedPlaylists.filter((p) => p?.id !== playlistId);
          } else {
            state.likedPlaylists = [];
          }
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
      })
      .addCase(fetchPopularPlaylists.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchPopularPlaylists.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.popularPlaylists = action.payload;
      })
      .addCase(fetchPopularPlaylists.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(savePlaylistAsync.pending, (state) => {
        state.error = null;
      })
      .addCase(savePlaylistAsync.fulfilled, (state, action) => {
        if (!action.payload) return;

        const originId =
          action.payload.saved_from_playlist_id ??
          action.meta?.arg ??
          null;

        const savedPlaylist = {
          ...action.payload,
          saved_from_playlist_id: originId,
        };

        if (!Array.isArray(state.userPlaylists)) {
          state.userPlaylists = [savedPlaylist];
          return;
        }

        const exists = state.userPlaylists.some(
          (playlist) =>
            playlist.id === savedPlaylist.id ||
            (originId && playlist.saved_from_playlist_id === originId)
        );
        if (!exists) {
          state.userPlaylists.unshift(savedPlaylist);
        }
      })
      .addCase(savePlaylistAsync.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Gemini AI 추천
      .addCase(fetchGeminiRecommendations.pending, (state) => {
        state.aiRecommendations.status = 'loading';
        state.aiRecommendations.error = null;
      })
      .addCase(fetchGeminiRecommendations.fulfilled, (state, action) => {
        state.aiRecommendations.status = 'succeeded';
        state.aiRecommendations.tracks = action.payload.tracks || [];
        state.aiRecommendations.summary = action.payload.summary || '';
        state.aiRecommendations.followUpQuestion = action.payload.followUpQuestion || '';
        state.aiRecommendations.lastUpdatedAt = action.payload.lastUpdatedAt || new Date().toISOString();
      })
      .addCase(fetchGeminiRecommendations.rejected, (state, action) => {
        state.aiRecommendations.status = 'failed';
        state.aiRecommendations.error = action.payload;
      })
      .addCase(hydrateGeminiRecommendations.fulfilled, (state, action) => {
        if (!action.payload) return;
        state.aiRecommendations.tracks = action.payload.tracks || [];
        state.aiRecommendations.summary = action.payload.summary || '';
        state.aiRecommendations.followUpQuestion = action.payload.followUpQuestion || '';
        state.aiRecommendations.lastUpdatedAt = action.payload.lastUpdatedAt || null;
        state.aiRecommendations.status = (action.payload.tracks?.length || 0) > 0 ? 'succeeded' : 'idle';
        state.aiRecommendations.error = null;
      })
      .addCase(hydrateGeminiRecommendations.rejected, (state) => {
        // Ignore cache hydration failures to avoid affecting UX
      })
      // 추천 피드백 전송
      .addCase(sendRecommendationFeedback.fulfilled, (state) => {
        // 피드백 전송 성공 시 특별한 상태 변경 없음
      })
      .addCase(sendRecommendationFeedback.rejected, (state, action) => {
        // 피드백 실패는 조용히 처리 (사용자 경험에 영향 최소화)
        console.warn('Recommendation feedback failed:', action.payload);
      });
  },
});

export default playlistSlice.reducer;
