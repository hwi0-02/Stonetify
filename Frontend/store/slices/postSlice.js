import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as apiService from '../../services/apiService';

const initialState = {
  posts: [],
  status: 'idle',
  error: null,
};

export const fetchPosts = createAsyncThunk('post/fetchPosts', async (_, thunkAPI) => {
  try {
    return await apiService.getPosts();
  } catch (error) {
    return thunkAPI.rejectWithValue('피드를 불러오는데 실패했습니다.');
  }
});


const postSlice = createSlice({
  name: 'post',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPosts.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.posts = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        state.posts = []; 
      });
  },
});

export default postSlice.reducer;