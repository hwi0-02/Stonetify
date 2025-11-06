import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService'; // default import로 변경
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { authenticateWithKakao, authenticateWithNaver } from './socialSlice';

// ==================== INITIAL STATE ====================

const initialState = {
  user: null,
  token: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  followStats: {
    followers: 0,
    following: 0,
  },
};

// ==================== ASYNC THUNKS ====================

// 공통 에러 처리 함수
const handleAsyncError = (error, defaultMessage) => {
  return error.response?.data?.message || error.message || defaultMessage;
};

// 토큰 저장 유틸리티 (만료 시간 함께 저장)
const saveToken = async (token) => {
  if (token) {
    await AsyncStorage.setItem('token', token);
    // 토큰 저장 시간 기록 (7일 후 만료로 가정)
    const expiryTime = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7일
    await AsyncStorage.setItem('tokenExpiry', expiryTime.toString());
  }
};

// 사용자 정보 저장 유틸리티
const saveUser = async (user) => {
  if (user) {
    const { token, ...userWithoutToken } = user;
    await AsyncStorage.setItem('user', JSON.stringify(userWithoutToken));
  }
};

// 회원가입 (최적화된 버전)
export const register = createAsyncThunk('auth/register', async (userData, thunkAPI) => {
  try {
    const data = await apiService.register(userData);
    await saveToken(data.token);
    await saveUser(data);
    return data;
  } catch (error) {
    const errorMessage = handleAsyncError(error, '회원가입에 실패했습니다.');
    return thunkAPI.rejectWithValue(errorMessage);
  }
});

// 로그인 (최적화된 버전)
export const login = createAsyncThunk('auth/login', async (userData, thunkAPI) => {
  try {
    const data = await apiService.login(userData);
    await saveToken(data.token);
    await saveUser(data);
    return data;
  } catch (error) {
    const errorMessage = handleAsyncError(error, '로그인에 실패했습니다.');
    return thunkAPI.rejectWithValue(errorMessage);
  }
});

// 로그아웃 (개선된 버전)
export const logout = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.multiRemove(['token', 'user', 'tokenExpiry']); // 한 번에 여러 항목 제거
});

// 사용자 정보 조회 (최적화된 버전)
export const getMe = createAsyncThunk('auth/getMe', async (_, thunkAPI) => {
    try {
        const userData = await apiService.getMe();
        return userData;
    } catch (error) {
        console.error('❌ [authSlice] getMe API 실패:', error?.response?.status, error?.message);
        const status = error?.response?.status ?? null;
        const errorMessage = handleAsyncError(error, '사용자 정보를 가져오는데 실패했습니다.');
        return thunkAPI.rejectWithValue({ message: errorMessage, status });
    }
});

// 계정 삭제
export const deleteAccount = createAsyncThunk(
  'auth/deleteAccount',
  async (_, thunkAPI) => {
    try {
      const data = await apiService.deleteAccount();
      // 성공 시, 스토리지에서 토큰 등 정보 제거 (로그아웃과 동일)
      await AsyncStorage.multiRemove(['token', 'user']); 
      return data; // { success: true, message: '...' }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '계정 삭제에 실패했습니다.';
      return thunkAPI.rejectWithValue(errorMessage);
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateUserProfile',
  async ({ displayName, imageUri, mimeType, base64Image }, { rejectWithValue, getState }) => {
    try {
      const { user } = getState().auth;

      if (!user || !user.id) {
        return rejectWithValue('사용자 정보를 확인할 수 없습니다. 다시 로그인해주세요.');
      }

      if (!displayName || !displayName.trim()) {
        return rejectWithValue('닉네임을 입력해주세요.');
      }

      const payload = {
        display_name: displayName.trim(),
      };

      const appendImageFromBase64 = (rawBase64, fallbackMimeType) => {
        if (typeof rawBase64 !== 'string') {
          return;
        }

        const trimmed = rawBase64.trim();
        if (!trimmed) {
          return;
        }

        let detectedMime = fallbackMimeType;
        let base64Payload = trimmed;
        const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.*)$/);

        if (dataUrlMatch) {
          if (!detectedMime || !detectedMime.startsWith('image/')) {
            detectedMime = dataUrlMatch[1];
          }
          base64Payload = dataUrlMatch[2];
        }

        const sanitizedBase64 = base64Payload.replace(/\s+/g, '');
        const resolvedMimeType =
          detectedMime && detectedMime.startsWith('image/')
            ? detectedMime
            : 'image/jpeg';

        payload.profile_image_base64 = sanitizedBase64;
        payload.profile_image_mime_type = resolvedMimeType;
      };

      // ✅ base64 문자열이 직접 전달된 경우
      if (typeof base64Image === 'string' && base64Image.trim().length > 0) {
        appendImageFromBase64(base64Image, mimeType);
      // ✅ 이미지 URI가 전달된 경우 (기존 경로 유지)
      } else if (imageUri) {
        let localUri = imageUri;

        if (imageUri.startsWith('content://')) {
          const fileName = `profile_${Date.now()}.jpg`;
          const dest = `${FileSystem.cacheDirectory}${fileName}`;
          await FileSystem.copyAsync({ from: imageUri, to: dest });
          localUri = dest;
        }

        const base64Encoding =
          FileSystem.EncodingType && FileSystem.EncodingType.Base64
            ? FileSystem.EncodingType.Base64
            : 'base64';

        const base64Data = await FileSystem.readAsStringAsync(localUri, {
          encoding: base64Encoding,
        });

        appendImageFromBase64(base64Data, mimeType);
      } else if (base64Image === null || imageUri === null) {
        payload.profile_image_base64 = null;
      }

      const updatedProfile = await apiService.updateProfile(payload);
      return updatedProfile;
    } catch (error) {
      console.error('❌ 프로필 업데이트 오류:', error);
      const errorMessage = error.message || '프로필 업데이트에 실패했습니다.';
      return rejectWithValue(errorMessage);
    }
  }
);


// ==================== SLICE ====================

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetAuthStatus: (state) => {
      state.status = 'idle';
      state.error = null;
    },
    setToken: (state, action) => {
      state.token = action.payload;
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    clearAuth: (state) => {
      // 모든 인증 정보를 완전히 초기화 (401 에러, 토큰 만료 등에 사용)
      state.user = null;
      state.token = null;
      state.status = 'idle';
      state.error = null;
      state.followStats = { followers: 0, following: 0 };
    },
    updateFollowStats(state, action) {
      const {
        followers,
        following,
        followersDelta = 0,
        followingDelta = 0,
      } = action.payload || {};

      const prevFollowers = state.followStats?.followers ?? 0;
      const prevFollowing = state.followStats?.following ?? 0;

      state.followStats = {
        followers:
          typeof followers === 'number'
            ? followers
            : Math.max(0, prevFollowers + followersDelta),
        following:
          typeof following === 'number'
            ? following
            : Math.max(0, prevFollowing + followingDelta),
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(register.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload;
        state.token = action.payload.token;
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(login.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload;
        state.token = action.payload.token;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(logout.fulfilled, (state) => {
        // 로그아웃 시 모든 인증 상태 초기화
        state.user = null;
        state.token = null;
        state.status = 'idle';
        state.error = null;
        state.followStats = { followers: 0, following: 0 };
      })
      .addCase(getMe.fulfilled, (state, action) => {
        state.user = action.payload;
        // getMe 성공 시에도 user 정보 저장
        saveUser(action.payload);
      })
      .addCase(getMe.rejected, (state, action) => {
        // getMe 실패 시: 401/403은 인증 만료로 간주하고 토큰 제거, 그 외에는 기존 세션 유지
        state.status = 'failed';
        const statusCode = action.payload?.status;
        const message =
          (typeof action.payload === 'string' && action.payload) ||
          action.payload?.message ||
          action.error?.message ||
          '사용자 정보를 가져오는데 실패했습니다.';
        state.error = message;

        if (statusCode === 401 || statusCode === 403) {
          state.user = null;
          state.token = null;
        }
      })
      .addCase(deleteAccount.pending, (state) => {
        state.status = 'loading'; 
      })
      .addCase(deleteAccount.fulfilled, (state) => {
        state.status = 'succeeded';
        state.user = null; 
        state.token = null; 
        state.error = null;
      })
      .addCase(deleteAccount.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload; 
      })
      .addCase(updateUserProfile.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.status = 'succeeded';
        if (!state.user) {
          state.user = action.payload;
        } else {
          state.user = {
            ...state.user,
            ...action.payload,
          };
        }
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // 소셜 로그인 (카카오/네이버) 성공 시 사용자 정보 업데이트
      .addCase(authenticateWithKakao.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(authenticateWithKakao.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
        // 소셜 로그인 성공 시 user 정보도 저장 (token은 socialSlice에서 저장)
        saveUser(action.payload.user);
        // 주의: getMe()는 별도로 dispatch되어야 함 (thunk 내부에서는 불가)
      })
      .addCase(authenticateWithKakao.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(authenticateWithNaver.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(authenticateWithNaver.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
        // 소셜 로그인 성공 시 user 정보도 저장 (token은 socialSlice에서 저장)
        saveUser(action.payload.user);
        // 주의: getMe()는 별도로 dispatch되어야 함 (thunk 내부에서는 불가)
      })
      .addCase(authenticateWithNaver.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { resetAuthStatus, setToken, setUser, clearAuth, updateFollowStats } = authSlice.actions;
export default authSlice.reducer;
