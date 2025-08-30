import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as apiService from '../../services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const initialState = {
  user: null,
  token: null,
  status: 'idle',
  error: null,
};

// 회원가입
export const register = createAsyncThunk('auth/register', async (userData, thunkAPI) => {
  try {
    const data = await apiService.register(userData);
    await AsyncStorage.setItem('token', data.token);
    return data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response.data.message || '회원가입에 실패했습니다.');
  }
});

// 로그인
export const login = createAsyncThunk('auth/login', async (userData, thunkAPI) => {
  try {
    const data = await apiService.login(userData);
    await AsyncStorage.setItem('token', data.token);
    return data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response.data.message || '로그인에 실패했습니다.');
  }
});

// 로그아웃
export const logout = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.removeItem('token');
});

// 사용자 정보 조회
export const getMe = createAsyncThunk('auth/getMe', async (_, thunkAPI) => {
    try {
        return await apiService.getMe();
    } catch (error) {
        return thunkAPI.rejectWithValue('사용자 정보를 가져오는데 실패했습니다.');
    }
});

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