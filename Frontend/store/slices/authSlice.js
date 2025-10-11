import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService'; // default import로 변경
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== INITIAL STATE ====================

const initialState = {
  user: null,
  token: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
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

// ==================== SLICE ====================

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetAuthStatus: (state) => {
      state.status = 'idle';
      state.error = null;
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
      })
      .addCase(getMe.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { resetAuthStatus } = authSlice.actions;
export default authSlice.reducer;