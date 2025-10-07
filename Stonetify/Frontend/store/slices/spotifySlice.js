import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as apiService from '../../services/apiService';

const initialState = {
  searchResults: [],
  status: 'idle',
  error: null,
  accessToken: null,
  refreshTokenEnc: null,
  tokenExpiry: null, // epoch ms
  isPremium: false,
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

export const exchangeSpotifyCode = createAsyncThunk(
  'spotify/exchangeCode',
  async (payload, thunkAPI) => {
    try {
      const data = await apiService.exchangeSpotifyCode(payload);
      return data;
    } catch (e) {
      return thunkAPI.rejectWithValue('Spotify 코드 교환 실패');
    }
  }
);

export const refreshSpotifyToken = createAsyncThunk(
  'spotify/refreshToken',
  async (_, thunkAPI) => {
    const state = thunkAPI.getState().spotify;
    if (!state.refreshTokenEnc) return thunkAPI.rejectWithValue('리프레시 토큰 없음');
    try {
      const data = await apiService.refreshSpotifyToken({ refreshTokenEnc: state.refreshTokenEnc, userId: thunkAPI.getState().auth.user?.id || 'anon' });
      return data;
    } catch (e) {
      return thunkAPI.rejectWithValue('Spotify 토큰 갱신 실패');
    }
  }
);

export const getPremiumStatus = createAsyncThunk(
  'spotify/getPremiumStatus',
  async (_, thunkAPI) => {
    try {
      const userId = thunkAPI.getState().auth.user?.id || thunkAPI.getState().auth.user?.userId || 'anon';
      const data = await apiService.getSpotifyPremiumStatus(userId);
      return data;
    } catch (e) {
      return thunkAPI.rejectWithValue('Premium 상태 조회 실패');
    }
  }
);

export const fetchSpotifyProfile = createAsyncThunk(
  'spotify/fetchProfile',
  async (_, thunkAPI) => {
    try {
      const userId = thunkAPI.getState().auth.user?.id || thunkAPI.getState().auth.user?.userId || 'anon';
      const data = await apiService.getSpotifyProfile(userId);
      return data;
    } catch (e) {
      return thunkAPI.rejectWithValue('Spotify 프로필 조회 실패');
    }
  }
);

export const revokeSpotify = createAsyncThunk(
  'spotify/revoke',
  async (_, thunkAPI) => {
    try {
      const userId = thunkAPI.getState().auth.user?.id || 'anon';
      await apiService.revokeSpotifySession(userId);
      return {};
    } catch (e) {
      return thunkAPI.rejectWithValue('Spotify 세션 해제 실패');
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
      })
      .addCase(exchangeSpotifyCode.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshTokenEnc = action.payload.refreshTokenEnc;
        state.tokenExpiry = Date.now() + (action.payload.expiresIn * 1000) - 60000; // renew 60s earlier
        state.isPremium = action.payload.isPremium;
      })
      .addCase(refreshSpotifyToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshTokenEnc = action.payload.refreshTokenEnc;
        state.tokenExpiry = Date.now() + (action.payload.expiresIn * 1000) - 60000;
      })
      .addCase(getPremiumStatus.fulfilled, (state, action) => {
        state.isPremium = action.payload.isPremium;
      })
      .addCase(fetchSpotifyProfile.fulfilled, (state, action) => {
        if (typeof action.payload.isPremium === 'boolean') state.isPremium = action.payload.isPremium;
      });
      builder.addCase(revokeSpotify.fulfilled, (state) => {
        state.accessToken = null;
        state.refreshTokenEnc = null;
        state.tokenExpiry = null;
        state.isPremium = false;
      });
  },
});

export const { clearSearchResults } = spotifySlice.actions;
export default spotifySlice.reducer;