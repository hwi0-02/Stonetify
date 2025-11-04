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

export const fetchLikedPosts = createAsyncThunk(
  'post/fetchLikedPosts',
  async (_, thunkAPI) => {
    try {
       const likedPostsData = await apiService.getLikedPosts();
       return Array.isArray(likedPostsData) ? likedPostsData : [];

    } catch (error) {
      const message = error.response?.data?.message || '좋아요한 게시물을 불러오는데 실패했습니다.';
      return thunkAPI.rejectWithValue(message);
    }
  }
);

const initialState = {
  posts: [],
  savedPosts: [],
  status: 'idle',
  error: null,
  savedStatus: 'idle',
  savedError: null,
  likedError: null,
  optimisticLikes: {},
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

const applyOptimisticLikes = (posts, overrides) => {
  if (!Array.isArray(posts) || !overrides) return;
  posts.forEach((post) => {
    const override = overrides[post.id];
    if (!override) return;
    const hasServerMatch =
      post.isLiked === override.isLiked &&
      (post.likesCount ?? 0) === (override.likesCount ?? 0);
    if (hasServerMatch) {
      delete overrides[post.id];
      return;
    }
    post.isLiked = override.isLiked;
    post.likesCount = override.likesCount;
  });
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
        applyOptimisticLikes(state.posts, state.optimisticLikes);
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
        state.optimisticLikes[postId] = { isLiked: liked, likesCount };
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
        const postId = action.payload;
        state.posts = state.posts.filter((post) => post.id !== postId);
        state.savedPosts = state.savedPosts.filter((post) => post.id !== postId);
      })
      .addCase(fetchSavedPosts.pending, (state) => {
        state.savedStatus = 'loading';
        state.savedError = null;
      })
      .addCase(fetchSavedPosts.fulfilled, (state, action) => {
        state.savedStatus = 'succeeded';
        state.savedPosts = Array.isArray(action.payload) ? action.payload : [];
        applyOptimisticLikes(state.savedPosts, state.optimisticLikes);
      })
      .addCase(fetchSavedPosts.rejected, (state, action) => {
        state.savedStatus = 'failed';
        state.savedError = action.payload || action.error?.message || '저장한 피드를 불러오는데 실패했습니다.';
        state.savedPosts = [];
      })
      .addCase(fetchLikedPosts.pending, (state) => {
        state.likedStatus = 'loading';
      })
      .addCase(fetchLikedPosts.fulfilled, (state, action) => {
        state.likedStatus = 'succeeded';
        state.likedPosts = action.payload; 
        state.likedError = null;
      })
      .addCase(fetchLikedPosts.rejected, (state, action) => {
        state.likedStatus = 'failed';
        state.likedError = action.payload;
        state.likedPosts = []; 
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
        state.savedStatus = 'succeeded';
      });
  },
});

export default postSlice.reducer;
