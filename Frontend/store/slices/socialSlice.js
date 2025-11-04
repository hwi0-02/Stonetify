import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as apiService from '../../services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const initialState = {
  kakao: {
    accessToken: null,
    tokenExpiry: null,
    profile: null,
    isConnected: false,
    status: 'idle',
    error: null,
  },
  naver: {
    accessToken: null,
    tokenExpiry: null,
    profile: null,
    isConnected: false,
    status: 'idle',
    error: null,
  },
};

// 토큰 저장 유틸리티 (authSlice의 saveToken과 동일한 방식)
const persistJwtToken = async (token) => {
  if (!token) {
    return;
  }
  
  try {
    await AsyncStorage.setItem('token', token);
    const expiryTime = Date.now() + (30 * 24 * 60 * 60 * 1000);
    await AsyncStorage.setItem('tokenExpiry', expiryTime.toString());
  } catch (error) {
    console.error('❌ [socialSlice] AsyncStorage 토큰 저장 실패:', error);
    throw error; // 에러를 상위로 전파하여 thunk에서 처리
  }
};

// Kakao 계정 연동 (로그인된 사용자)
export const loginWithKakao = createAsyncThunk(
  'social/loginWithKakao',
  async ({ code, state, redirectUri }, thunkAPI) => {
    try {
      const data = await apiService.kakaoLogin({ code, state, redirectUri });
      return data;
    } catch (error) {
      const message = error?.response?.data?.message || '카카오 계정 연동에 실패했습니다.';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Naver 계정 연동 (로그인된 사용자)
export const loginWithNaver = createAsyncThunk(
  'social/loginWithNaver',
  async ({ code, state, redirectUri }, thunkAPI) => {
    try {
      const data = await apiService.naverLogin({ code, state, redirectUri });
      return data;
    } catch (error) {
      const message = error?.response?.data?.message || '네이버 계정 연동에 실패했습니다.';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Kakao 소셜 로그인/회원가입 (✅ Spotify 패턴)
export const authenticateWithKakao = createAsyncThunk(
  'social/authenticateWithKakao',
  async ({ code, state, redirectUri }, thunkAPI) => {
    try {
      // 1. API 호출
      const data = await apiService.kakaoAuth({ code, state, redirectUri });
      
      // 2. 토큰 검증
      if (!data.token) {
        return thunkAPI.rejectWithValue('서버로부터 토큰을 받지 못했습니다.');
      }

      
      // 3. AsyncStorage에 토큰 저장 (JWT 영속화)
      await persistJwtToken(data.token);
      
      // 4. 성공 데이터 반환 (authSlice에서 Redux 상태 업데이트)
      return data;
    } catch (error) {
      // 5. 에러 처리
      const message = error?.response?.data?.message 
        || error?.message 
        || '카카오 로그인에 실패했습니다.';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Naver 소셜 로그인/회원가입 (✅ Spotify 패턴)
export const authenticateWithNaver = createAsyncThunk(
  'social/authenticateWithNaver',
  async ({ code, state, redirectUri }, thunkAPI) => {
    try {
      // 1. API 호출
      const data = await apiService.naverAuth({ code, state, redirectUri });
      
      // 2. 토큰 검증
      if (!data.token) {
        return thunkAPI.rejectWithValue('서버로부터 토큰을 받지 못했습니다.');
      }

      
      // 3. AsyncStorage에 토큰 저장 (JWT 영속화)
      await persistJwtToken(data.token);
      
      // 4. 성공 데이터 반환 (authSlice에서 Redux 상태 업데이트)
      return data;
    } catch (error) {
      // 5. 에러 처리
      const message = error?.response?.data?.message 
        || error?.message 
        || '네이버 로그인에 실패했습니다.';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Kakao 프로필 조회
export const fetchKakaoProfile = createAsyncThunk(
  'social/fetchKakaoProfile',
  async (_, thunkAPI) => {
    try {
      const data = await apiService.getKakaoProfile();
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue('카카오 프로필 조회에 실패했습니다.');
    }
  }
);

// Naver 프로필 조회
export const fetchNaverProfile = createAsyncThunk(
  'social/fetchNaverProfile',
  async (_, thunkAPI) => {
    try {
      const data = await apiService.getNaverProfile();
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue('네이버 프로필 조회에 실패했습니다.');
    }
  }
);

// Kakao 연동 해제
export const revokeKakao = createAsyncThunk(
  'social/revokeKakao',
  async (_, thunkAPI) => {
    try {
      await apiService.revokeKakao();
      return true;
    } catch (error) {
      return thunkAPI.rejectWithValue('카카오 연동 해제에 실패했습니다.');
    }
  }
);

// Naver 연동 해제
export const revokeNaver = createAsyncThunk(
  'social/revokeNaver',
  async (_, thunkAPI) => {
    try {
      await apiService.revokeNaver();
      return true;
    } catch (error) {
      return thunkAPI.rejectWithValue('네이버 연동 해제에 실패했습니다.');
    }
  }
);

const socialSlice = createSlice({
  name: 'social',
  initialState,
  reducers: {
    clearSocialError: (state, action) => {
      const provider = action.payload;
      if (state[provider]) {
        state[provider].error = null;
      }
    },
    clearKakaoSession: (state) => {
      state.kakao.accessToken = null;
      state.kakao.tokenExpiry = null;
      state.kakao.profile = null;
      state.kakao.isConnected = false;
      state.kakao.status = 'idle';
      state.kakao.error = null;
    },
    clearNaverSession: (state) => {
      state.naver.accessToken = null;
      state.naver.tokenExpiry = null;
      state.naver.profile = null;
      state.naver.isConnected = false;
      state.naver.status = 'idle';
      state.naver.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Kakao 계정 연동 (로그인된 사용자)
      .addCase(loginWithKakao.pending, (state) => {
        state.kakao.status = 'loading';
        state.kakao.error = null;
      })
      .addCase(loginWithKakao.fulfilled, (state, action) => {
        state.kakao.status = 'succeeded';
        state.kakao.isConnected = true;
        state.kakao.accessToken = action.payload.accessToken || null;
        state.kakao.tokenExpiry = action.payload.expiresIn
          ? Date.now() + action.payload.expiresIn * 1000
          : null;
        state.kakao.profile = action.payload.providerUser || state.kakao.profile;
      })
      .addCase(loginWithKakao.rejected, (state, action) => {
        state.kakao.status = 'failed';
        state.kakao.error = action.payload;
      })
      // Naver 계정 연동 (로그인된 사용자)
      .addCase(loginWithNaver.pending, (state) => {
        state.naver.status = 'loading';
        state.naver.error = null;
      })
      .addCase(loginWithNaver.fulfilled, (state, action) => {
        state.naver.status = 'succeeded';
        state.naver.isConnected = true;
        state.naver.accessToken = action.payload.accessToken || null;
        state.naver.tokenExpiry = action.payload.expiresIn
          ? Date.now() + action.payload.expiresIn * 1000
          : null;
        state.naver.profile = action.payload.providerUser || state.naver.profile;
      })
      .addCase(loginWithNaver.rejected, (state, action) => {
        state.naver.status = 'failed';
        state.naver.error = action.payload;
      })
      // Kakao 소셜 로그인/회원가입
      .addCase(authenticateWithKakao.pending, (state) => {
        state.kakao.status = 'loading';
        state.kakao.error = null;
      })
      .addCase(authenticateWithKakao.fulfilled, (state, action) => {
        state.kakao.status = 'succeeded';
        state.kakao.isConnected = true;
        state.kakao.accessToken = null;
        state.kakao.tokenExpiry = null;
        if (action.payload.user) {
          state.kakao.profile = {
            id: action.payload.user.kakaoId,
            name: action.payload.user.displayName,
            profileImage: action.payload.user.profileImage,
          };
        }
      })
      .addCase(authenticateWithKakao.rejected, (state, action) => {
        state.kakao.status = 'failed';
        state.kakao.isConnected = false;
        state.kakao.error = action.payload;
      })
      // Naver 소셜 로그인/회원가입
      .addCase(authenticateWithNaver.pending, (state) => {
        state.naver.status = 'loading';
        state.naver.error = null;
      })
      .addCase(authenticateWithNaver.fulfilled, (state, action) => {
        state.naver.status = 'succeeded';
        state.naver.isConnected = true;
        state.naver.accessToken = null;
        state.naver.tokenExpiry = null;
        if (action.payload.user) {
          state.naver.profile = {
            id: action.payload.user.naverId,
            name: action.payload.user.displayName,
            profileImage: action.payload.user.profileImage,
          };
        }
      })
      .addCase(authenticateWithNaver.rejected, (state, action) => {
        state.naver.status = 'failed';
        state.naver.isConnected = false;
        state.naver.error = action.payload;
      })
      // Kakao 프로필 조회
      .addCase(fetchKakaoProfile.fulfilled, (state, action) => {
        state.kakao.profile = action.payload;
      })
      // Naver 프로필 조회
      .addCase(fetchNaverProfile.fulfilled, (state, action) => {
        state.naver.profile = action.payload;
      })
      // Kakao 연동 해제
      .addCase(revokeKakao.fulfilled, (state) => {
        state.kakao.accessToken = null;
        state.kakao.tokenExpiry = null;
        state.kakao.profile = null;
        state.kakao.isConnected = false;
      })
      // Naver 연동 해제
      .addCase(revokeNaver.fulfilled, (state) => {
        state.naver.accessToken = null;
        state.naver.tokenExpiry = null;
        state.naver.profile = null;
        state.naver.isConnected = false;
      });
  },
});

export const { clearSocialError, clearKakaoSession, clearNaverSession } = socialSlice.actions;
export default socialSlice.reducer;
