import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as apiService from '../../services/apiService';

const initialState = {
  searchResults: [],
  status: 'idle',
  error: null,
  accessToken: null,
  refreshTokenEnc: null,
  tokenExpiry: null, // epoch ms
  isPremium: false,
  requiresReauth: false,
  authStatus: 'idle',
  authError: null,
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
      await AsyncStorage.removeItem('spotifyNeedsReauth');
      return data;
    } catch (e) {
      const message = e?.response?.data?.message
        || e?.response?.data?.error_description
        || e?.response?.data?.error
        || e?.message
        || 'Spotify 코드 교환 실패';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const refreshSpotifyToken = createAsyncThunk(
  'spotify/refreshToken',
  async (_, thunkAPI) => {
    const state = thunkAPI.getState().spotify;
    if (!state.refreshTokenEnc) return thunkAPI.rejectWithValue('리프레시 토큰 없음');
    try {
      const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
        || process.env.SPOTIFY_CLIENT_ID
        || Constants.expoConfig?.extra?.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
        || Constants.expoConfig?.extra?.spotifyClientId;
      const data = await apiService.refreshSpotifyToken({ refreshTokenEnc: state.refreshTokenEnc, userId: thunkAPI.getState().auth.user?.id || 'anon', client_id: clientId });
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
    },
    // Clear all Spotify auth state
    // input: action.payload?.reason ('revoked' | 'proactive_reauth' | string)
    clearSpotifySession: (state, action) => {
      const reason = action?.payload?.reason || 'unknown';
      // Always clear local auth state
      state.accessToken = null;
      state.refreshTokenEnc = null;
      state.tokenExpiry = null;
      state.isPremium = false;
      state.error = null;
      state.requiresReauth = true;
      state.authStatus = 'idle';
      state.authError = null;
      if (reason === 'revoked') {
        console.log('🔴 [spotifySlice] Spotify session cleared (token revoked)');
      } else {
        console.log(`🧹 [spotifySlice] Spotify session cleared (${reason})`);
      }
    },
    resetSpotifyReauthFlag: (state) => {
      state.requiresReauth = false;
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
      .addCase(exchangeSpotifyCode.pending, (state) => {
        state.authStatus = 'loading';
        state.authError = null;
      })
      .addCase(exchangeSpotifyCode.fulfilled, (state, action) => {
        state.authStatus = 'succeeded';
        state.authError = null;
        state.accessToken = action.payload.accessToken;
        state.refreshTokenEnc = action.payload.refreshTokenEnc;
  state.tokenExpiry = Date.now() + (action.payload.expiresIn * 1000) - 60000; // renew 60s earlier
        state.isPremium = action.payload.isPremium;
        state.requiresReauth = false;
      })
      .addCase(exchangeSpotifyCode.rejected, (state, action) => {
        state.authStatus = 'failed';
        state.authError = action.payload || 'Spotify 코드 교환 실패';
      })
      .addCase(refreshSpotifyToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshTokenEnc = action.payload.refreshTokenEnc;
        state.tokenExpiry = Date.now() + (action.payload.expiresIn * 1000) - 60000;
        state.requiresReauth = false;
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
        state.requiresReauth = true;
      });
  },
});

export const { clearSearchResults, clearSpotifySession, resetSpotifyReauthFlag } = spotifySlice.actions;
export default spotifySlice.reducer;
