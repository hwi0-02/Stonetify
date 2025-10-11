import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage, database, auth } from '../../firebaseConfig'; 
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as databaseRef, update } from 'firebase/database';
import { signInWithCustomToken } from "firebase/auth";

// ==================== INITIAL STATE ====================

const initialState = {
  user: null,
  token: null,
  status: 'idle',
  error: null,
};

// ==================== ASYNC THUNKS ====================

const handleAsyncError = (error, defaultMessage) => {
  return error.response?.data?.message || error.message || defaultMessage;
};

const saveToken = async (token) => {
  if (token) {
    await AsyncStorage.setItem('token', token);
  }
};

export const register = createAsyncThunk('auth/register', async (userData, thunkAPI) => {
  try {
    // 1. 백엔드에서 회원가입 성공 후, 자체 토큰과 firebaseToken을 함께 받습니다.
    const data = await apiService.register(userData);
    await saveToken(data.token);

    // 2. 🔥 추가된 부분: 받은 firebaseToken으로 Firebase에 로그인합니다.
    if (data.firebaseToken) {
      console.log("Firebase 커스텀 토큰으로 로그인 시도 (회원가입 직후)...");
      await signInWithCustomToken(auth, data.firebaseToken);
      console.log("✅ Firebase 로그인 성공 (회원가입 직후)!");
    }

    return data;
  } catch (error) {
    const errorMessage = handleAsyncError(error, '회원가입에 실패했습니다.');
    return thunkAPI.rejectWithValue(errorMessage);
  }
});

export const login = createAsyncThunk('auth/login', async (userData, thunkAPI) => {
  try {
    // 1. 백엔드에 로그인 요청을 보내고 user 정보와 두 개의 토큰을 받습니다.
    const data = await apiService.login(userData);
    await saveToken(data.token);

    // 2. 백엔드에서 받은 firebaseToken으로 Firebase에 로그인합니다.
    if (data.firebaseToken) {
      console.log("Firebase 커스텀 토큰으로 로그인 시도...");
      await signInWithCustomToken(auth, data.firebaseToken);
      console.log("✅ Firebase 익명 로그인 성공!");
    }

    return data;
  } catch (error) {
    const errorMessage = handleAsyncError(error, '로그인에 실패했습니다.');
    return thunkAPI.rejectWithValue(errorMessage);
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.multiRemove(['token', 'user']);
});

export const getMe = createAsyncThunk('auth/getMe', async (_, thunkAPI) => {
    try {
        return await apiService.getMe();
    } catch (error) {
        const errorMessage = handleAsyncError(error, '사용자 정보를 가져오는데 실패했습니다.');
        return thunkAPI.rejectWithValue(errorMessage);
    }
});

// 👇 [수정됨] updateUserProfile 프로필 업데이트
export const updateUserProfile = createAsyncThunk(
  'auth/updateUserProfile',
  async ({ displayName, imageUri }, { rejectWithValue, getState }) => {
    try {
      const user = getState().auth.user;
      if (!user || !user.id) {
        return rejectWithValue('사용자 정보가 없어 업데이트할 수 없습니다.');
      }
      
      const { id: userId } = user;
      let photoURL = user.profile_image_url; 

      // 1. 새 이미지가 있으면 Storage에 업로드하고 새 URL을 받습니다.
      if (imageUri) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const imageRef = storageRef(storage, `profile_images/${userId}/${Date.now()}`);
        
        await uploadBytes(imageRef, blob);
        photoURL = await getDownloadURL(imageRef);
      }

      // 2. 업데이트할 데이터 객체를 만듭니다. (닉네임은 항상 포함)
      const updates = {
        display_name: displayName,
      };

      // 3. photoURL이 유효한 값(null이나 undefined가 아님)일 때만 updates 객체에 추가합니다.
      if (photoURL) {
        updates.profile_image_url = photoURL;
      }
      
      // 4. 최종적으로 만들어진 updates 객체를 Realtime Database에 전송합니다.
      const userDbRef = databaseRef(database, `users/${userId}`);
      await update(userDbRef, updates);
      
      // Redux 상태 업데이트를 위해 최종 데이터를 반환합니다.
      return updates;

    } catch (error) {
      console.error("🔥 프로필 업데이트 실패:", error);
      return rejectWithValue(error.message);
    }
  }
);

// 계정 삭제
export const deleteUserAccount = createAsyncThunk(
  'auth/deleteAccount',
  async (_, thunkAPI) => {
    try {
      await apiService.deleteUserAccount();
      // 성공 시 로그아웃과 동일하게 AsyncStorage를 비웁니다.
      await AsyncStorage.multiRemove(['token', 'user']);
      return; // 성공 시 특별한 payload는 필요 없습니다.
    } catch (error) {
      const errorMessage = handleAsyncError(error, '계정 삭제에 실패했습니다.');
      return thunkAPI.rejectWithValue(errorMessage);
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
      })
      .addCase(updateUserProfile.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.status = 'succeeded';
        if (state.user) {
          // 서버에서 반환된 updates 객체의 내용만 안전하게 업데이트합니다.
          if (action.payload.display_name) {
            state.user.display_name = action.payload.display_name;
          }
          if (action.payload.profile_image_url) {
            state.user.profile_image_url = action.payload.profile_image_url;
          }
        }
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(deleteUserAccount.pending, (state) => {
      state.status = 'loading';
    })
    .addCase(deleteUserAccount.fulfilled, (state) => {
      state.status = 'succeeded';
      state.user = null;
      state.token = null;
      state.error = null;
    })
    .addCase(deleteUserAccount.rejected, (state, action) => {
      state.status = 'failed';
      state.error = action.payload;
    });
  },
});

export const { resetAuthStatus } = authSlice.actions;
export default authSlice.reducer;