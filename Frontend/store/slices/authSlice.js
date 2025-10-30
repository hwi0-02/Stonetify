import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService'; // default import로 변경
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

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

// 토큰 저장 유틸리티
const saveToken = async (token) => {
  if (token) {
    await AsyncStorage.setItem('token', token);
  }
};

// 회원가입 (최적화된 버전)
export const register = createAsyncThunk('auth/register', async (userData, thunkAPI) => {
  try {
    const data = await apiService.register(userData);
    await saveToken(data.token);
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
    return data;
  } catch (error) {
    const errorMessage = handleAsyncError(error, '로그인에 실패했습니다.');
    return thunkAPI.rejectWithValue(errorMessage);
  }
});

// 로그아웃 (개선된 버전)
export const logout = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.multiRemove(['token', 'user']); // 한 번에 여러 항목 제거
});

// 사용자 정보 조회 (최적화된 버전)
export const getMe = createAsyncThunk('auth/getMe', async (_, thunkAPI) => {
    try {
        return await apiService.getMe();
    } catch (error) {
        const errorMessage = handleAsyncError(error, '사용자 정보를 가져오는데 실패했습니다.');
        return thunkAPI.rejectWithValue(errorMessage);
    }
});

export const updateUserProfile = createAsyncThunk(
  'auth/updateUserProfile',
  async ({ displayName, imageUri, mimeType }, { rejectWithValue, getState }) => {
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

      // ✅ 이미지가 선택된 경우만 처리
      if (imageUri) {
        let localUri = imageUri;

        // 1️⃣ content:// 형태면 앱 디렉토리로 복사
        if (imageUri.startsWith('content://')) {
          const fileName = `profile_${Date.now()}.jpg`;
          const dest = `${FileSystem.cacheDirectory}${fileName}`;
          await FileSystem.copyAsync({ from: imageUri, to: dest });
          localUri = dest;
        }

        // 2️⃣ Base64 읽기 (이제 안전함)
        const base64Data = await FileSystem.readAsStringAsync(localUri, {
          // 일부 환경(웹/구버전)에서 FileSystem.EncodingType가 없을 수 있어 문자열 사용
          encoding: 'base64',
        });

        payload.profile_image_base64 = base64Data;
        payload.profile_image_mime_type =
          mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
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
        state.user = null;
        state.token = null;
        state.followStats = { followers: 0, following: 0 };
      })
      .addCase(getMe.fulfilled, (state, action) => {
        state.user = action.payload;
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
      });
  },
});

export const { resetAuthStatus, updateFollowStats } = authSlice.actions;
export default authSlice.reducer;
