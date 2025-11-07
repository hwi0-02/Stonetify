import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as apiService from '../../services/apiService';

const SPOTIFY_STORAGE_KEYS = {
  accessToken: 'stonetify.spotify.accessToken',
  refreshTokenEnc: 'stonetify.spotify.refreshTokenEnc',
  tokenExpiry: 'stonetify.spotify.tokenExpiry',
  isPremium: 'stonetify.spotify.isPremium',
};

const persistSpotifySession = async ({ accessToken, refreshTokenEnc, tokenExpiry, isPremium }) => {
  try {
    const sets = [];
    const removals = [];

    if (typeof accessToken === 'string' && accessToken.length > 0) {
      sets.push([SPOTIFY_STORAGE_KEYS.accessToken, accessToken]);
    } else {
      removals.push(SPOTIFY_STORAGE_KEYS.accessToken);
    }

    if (typeof refreshTokenEnc === 'string' && refreshTokenEnc.length > 0) {
      sets.push([SPOTIFY_STORAGE_KEYS.refreshTokenEnc, refreshTokenEnc]);
    } else {
      removals.push(SPOTIFY_STORAGE_KEYS.refreshTokenEnc);
    }

    if (Number.isFinite(tokenExpiry)) {
      sets.push([SPOTIFY_STORAGE_KEYS.tokenExpiry, String(tokenExpiry)]);
    } else {
      removals.push(SPOTIFY_STORAGE_KEYS.tokenExpiry);
    }

    if (typeof isPremium === 'boolean') {
      sets.push([SPOTIFY_STORAGE_KEYS.isPremium, isPremium ? '1' : '0']);
    } else {
      removals.push(SPOTIFY_STORAGE_KEYS.isPremium);
    }

    if (sets.length > 0) {
      await AsyncStorage.multiSet(sets);
    }
    if (removals.length > 0) {
      await AsyncStorage.multiRemove(removals);
    }
  } catch (error) {
    console.warn('⚠️ Failed to persist Spotify session:', error?.message || error);
  }
};

const clearSpotifySessionStorage = async () => {
  try {
    await AsyncStorage.multiRemove(Object.values(SPOTIFY_STORAGE_KEYS));
  } catch (error) {
    console.warn('⚠️ Failed to clear Spotify session storage:', error?.message || error);
  }
};

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
      console.log('[exchangeSpotifyCode] Sending request with payload:', {
        userId: payload.userId,
        redirectUri: payload.redirect_uri,
        hasCode: !!payload.code,
        hasCodeVerifier: !!payload.code_verifier
      });
      
      const data = await apiService.exchangeSpotifyCode(payload);
      
      console.log('[exchangeSpotifyCode] Received response:', {
        hasAccessToken: !!data.accessToken,
        hasRefreshTokenEnc: !!data.refreshTokenEnc,
        expiresIn: data.expiresIn
      });
      
      if (!data.accessToken || !data.refreshTokenEnc) {
        console.error('[exchangeSpotifyCode] Missing tokens in response');
        return thunkAPI.rejectWithValue('Spotify 토큰을 받지 못했습니다. 다시 시도해주세요.');
      }
      
      const tokenExpiry = Date.now() + (data.expiresIn * 1000) - 60000;
      await persistSpotifySession({
        accessToken: data.accessToken,
        refreshTokenEnc: data.refreshTokenEnc,
        tokenExpiry,
        isPremium: data.isPremium,
      });
      await AsyncStorage.removeItem('spotifyNeedsReauth');
      
      console.log('[exchangeSpotifyCode] Session persisted successfully');
      return { ...data, tokenExpiry };
    } catch (e) {
      console.error('[exchangeSpotifyCode] Error:', {
        status: e?.response?.status,
        error: e?.response?.data?.error,
        message: e?.response?.data?.message || e?.message
      });
      
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
      const userId = thunkAPI.getState().auth.user?.id || thunkAPI.getState().auth.user?.userId;
      if (!userId) return thunkAPI.rejectWithValue('사용자 ID가 없습니다');

      const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
        || process.env.SPOTIFY_CLIENT_ID
        || Constants.expoConfig?.extra?.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
        || Constants.expoConfig?.extra?.spotifyClientId;

      const data = await apiService.refreshSpotifyToken({ userId, client_id: clientId });
      const tokenExpiry = Date.now() + (data.expiresIn * 1000) - 60000;
      await persistSpotifySession({
        accessToken: data.accessToken,
        refreshTokenEnc: data.refreshTokenEnc,
        tokenExpiry,
        isPremium: data.isPremium,
      });
      return { ...data, tokenExpiry };
    } catch (e) {
      const errorMessage = e?.response?.data?.message || e?.message || 'Spotify 토큰 갱신 실패';

      // Handle TOKEN_REVOKED error
      if (e?.response?.data?.error === 'TOKEN_REVOKED' || e?.response?.data?.requiresReauth) {
        await clearSpotifySessionStorage();
        return thunkAPI.rejectWithValue({
          message: errorMessage,
          error: 'TOKEN_REVOKED',
          requiresReauth: true
        });
      }

      return thunkAPI.rejectWithValue(errorMessage);
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
      await clearSpotifySessionStorage();
      return {};
    } catch (e) {
      return thunkAPI.rejectWithValue('Spotify 세션 해제 실패');
    }
  }
);

export const hydrateSpotifySession = createAsyncThunk(
  'spotify/hydrateSession',
  async (_, thunkAPI) => {
    try {
      const entries = await AsyncStorage.multiGet(Object.values(SPOTIFY_STORAGE_KEYS));
      const map = entries.reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

      const accessToken = map[SPOTIFY_STORAGE_KEYS.accessToken] || null;
      const refreshTokenEnc = map[SPOTIFY_STORAGE_KEYS.refreshTokenEnc] || null;
      const tokenExpiryStr = map[SPOTIFY_STORAGE_KEYS.tokenExpiry] || null;
      const isPremiumRaw = map[SPOTIFY_STORAGE_KEYS.isPremium];
      const tokenExpiry = tokenExpiryStr ? parseInt(tokenExpiryStr, 10) : null;

      return {
        accessToken,
        refreshTokenEnc,
        tokenExpiry: Number.isFinite(tokenExpiry) ? tokenExpiry : null,
        isPremium: isPremiumRaw === '1' ? true : isPremiumRaw === '0' ? false : null,
      };
    } catch (error) {
      console.warn('⚠️ Failed to hydrate Spotify session:', error?.message || error);
      return thunkAPI.rejectWithValue('Spotify 세션 복원 실패');
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
    clearSpotifySession: (state) => {
      // Always clear local auth state
      state.accessToken = null;
      state.refreshTokenEnc = null;
      state.tokenExpiry = null;
      state.isPremium = false;
      state.error = null;
      state.requiresReauth = true;
      state.authStatus = 'idle';
      state.authError = null;
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
        state.tokenExpiry = action.payload.tokenExpiry ?? null;
        if (typeof action.payload.isPremium === 'boolean') {
          state.isPremium = action.payload.isPremium;
        }
        state.requiresReauth = false;
      })
      .addCase(exchangeSpotifyCode.rejected, (state, action) => {
        state.authStatus = 'failed';
        state.authError = action.payload || 'Spotify 코드 교환 실패';
      })
      .addCase(refreshSpotifyToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshTokenEnc = action.payload.refreshTokenEnc;
        state.tokenExpiry = action.payload.tokenExpiry ?? null;
        if (typeof action.payload.isPremium === 'boolean') {
          state.isPremium = action.payload.isPremium;
        }
        state.requiresReauth = false;
        state.authError = null;
      })
      .addCase(refreshSpotifyToken.rejected, (state, action) => {
        // Handle TOKEN_REVOKED error
        if (action.payload?.error === 'TOKEN_REVOKED' || action.payload?.requiresReauth) {
          state.accessToken = null;
          state.refreshTokenEnc = null;
          state.tokenExpiry = null;
          state.requiresReauth = true;
          state.authError = action.payload?.message || 'Spotify 연결이 만료되었습니다.';
        } else {
          state.authError = action.payload?.message || action.payload || 'Spotify 토큰 갱신 실패';
        }
      })
      .addCase(getPremiumStatus.fulfilled, (state, action) => {
        state.isPremium = action.payload.isPremium;
      })
      .addCase(fetchSpotifyProfile.fulfilled, (state, action) => {
        if (typeof action.payload.isPremium === 'boolean') state.isPremium = action.payload.isPremium;
      });
      builder
        .addCase(revokeSpotify.fulfilled, (state) => {
          state.accessToken = null;
          state.refreshTokenEnc = null;
          state.tokenExpiry = null;
          state.isPremium = false;
          state.requiresReauth = true;
        })
        .addCase(hydrateSpotifySession.fulfilled, (state, action) => {
          if (!action.payload) {
            return;
          }
          const { accessToken, refreshTokenEnc, tokenExpiry, isPremium } = action.payload;
          state.accessToken = accessToken || null;
          state.refreshTokenEnc = refreshTokenEnc || null;
          state.tokenExpiry = Number.isFinite(tokenExpiry) ? tokenExpiry : null;
          if (typeof isPremium === 'boolean') {
            state.isPremium = isPremium;
          }
          state.requiresReauth = !refreshTokenEnc;
        })
        .addCase(hydrateSpotifySession.rejected, (state) => {
          state.accessToken = null;
          state.refreshTokenEnc = null;
          state.tokenExpiry = null;
        });
  },
});

export const { clearSearchResults, clearSpotifySession, resetSpotifyReauthFlag } = spotifySlice.actions;

export const clearSpotifySessionWithStorage = (payload) => async (dispatch) => {
  await clearSpotifySessionStorage();
  dispatch(clearSpotifySession(payload));
};

export default spotifySlice.reducer;
