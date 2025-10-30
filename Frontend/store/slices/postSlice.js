import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';

export const fetchPosts = createAsyncThunk(
  'post/fetchPosts',
  async (_, { rejectWithValue }) => {
    try {
      return await apiService.getPosts();
    } catch (error) {
      return rejectWithValue(error.message || '피드를 불러오는데 실패했습니다.');
    }
  }
);

export const createPost = createAsyncThunk(
  'post/createPost',
  async (postData, { rejectWithValue }) => {
    try {
      return await apiService.createPost(postData);
    } catch (error) {
      return rejectWithValue(error.message || '피드 작성에 실패했습니다.');
    }
  }
);

export const toggleLikePost = createAsyncThunk(
  'post/toggleLikePost',
  async (postId, { rejectWithValue }) => {
    try {
      const data = await apiService.likePost(postId);
      return { postId, ...data };
    } catch (error) {
      return rejectWithValue(error.message || '좋아요 처리에 실패했습니다.');
    }
  }
);

export const updatePost = createAsyncThunk(
  'post/updatePost',
  async ({ postId, postData }, { rejectWithValue }) => {
    try {
      return await apiService.updatePost(postId, postData);
    } catch (error) {
      return rejectWithValue(error.message || '피드 수정에 실패했습니다.');
    }
  }
);

export const deletePost = createAsyncThunk(
  'post/deletePost',
  async (postId, { rejectWithValue }) => {
    try {
      await apiService.deletePost(postId);
      return postId;
    } catch (error) {
      return rejectWithValue(error.message || '피드 삭제에 실패했습니다.');
    }
  }
);

export const fetchSavedPosts = createAsyncThunk(
  'post/fetchSavedPosts',
  async (_, { rejectWithValue }) => {
    try {
      return await apiService.getSavedPosts();
    } catch (error) {
      return rejectWithValue(error.message || '저장된 피드를 불러오는데 실패했습니다.');
    }
  }
);

export const toggleSavePost = createAsyncThunk(
  'post/toggleSavePost',
  async (postId, { rejectWithValue }) => {
    try {
      const data = await apiService.toggleSavePost(postId);
      return { postId, ...data };
    } catch (error) {
      return rejectWithValue(error.message || '저장 처리에 실패했습니다.');
    }
  }
);

const initialState = {
  posts: [],
  savedPosts: [],
  status: 'idle',
  error: null,
};

const normalizePosts = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    return Object.keys(payload).map((key) => ({ id: key, ...payload[key] }));
  }

  return [];
};

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
        state.posts = normalizePosts(action.payload);
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        state.posts = [];
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.status = 'succeeded';
        if (action.payload) {
          state.posts.unshift(action.payload);
        }
      })
      .addCase(createPost.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(toggleLikePost.fulfilled, (state, action) => {
        const { postId, liked, likesCount } = action.payload;
        const target = state.posts.find((post) => post.id === postId);
        if (target) {
          target.isLiked = liked;
          target.likesCount = likesCount;
        }
        const savedTarget = state.savedPosts.find((post) => post.id === postId);
        if (savedTarget) {
          savedTarget.isLiked = liked;
          savedTarget.likesCount = likesCount;
        }
      })
      .addCase(updatePost.fulfilled, (state, action) => {
        const updatedPost = action.payload;
        if (!updatedPost) return;
        const index = state.posts.findIndex((post) => post.id === updatedPost.id);
        if (index !== -1) {
          state.posts[index] = updatedPost;
        }
        const savedIndex = state.savedPosts.findIndex((post) => post.id === updatedPost.id);
        if (savedIndex !== -1) {
          state.savedPosts[savedIndex] = updatedPost;
        }
      })
      .addCase(deletePost.fulfilled, (state, action) => {
        const deletedId = action.payload;
        const matchesDeleted = (post) => String(post.id) === String(deletedId);
        state.posts = state.posts.filter((post) => !matchesDeleted(post));
        state.savedPosts = state.savedPosts.filter((post) => !matchesDeleted(post));
      })
      .addCase(fetchSavedPosts.fulfilled, (state, action) => {
        state.savedPosts = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(toggleSavePost.fulfilled, (state, action) => {
        const { postId, saved } = action.payload;
        const updateSavedFlag = (post) => {
          if (post.id === postId) {
            post.isSaved = saved;
          }
        };
        state.posts.forEach(updateSavedFlag);

        if (saved) {
          const postToSave = state.posts.find((post) => post.id === postId);
          if (postToSave && !state.savedPosts.some((post) => post.id === postId)) {
            state.savedPosts.unshift(postToSave);
          }
        } else {
          state.savedPosts = state.savedPosts.filter((post) => post.id !== postId);
        }
      });
  },
});

export default postSlice.reducer;