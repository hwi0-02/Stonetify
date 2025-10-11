// store/slices/postSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService'; 

// 비동기 Thunk 정의
export const fetchPosts = createAsyncThunk(
  'posts/fetchPosts',
  async (_, { rejectWithValue }) => {
    try {
      const posts = await apiService.getPosts();
      return posts;
    } catch (error) {
      return rejectWithValue(error.message || '포스트를 불러오는데 실패했습니다.');
    }
  }
);

export const createPost = createAsyncThunk(
  'posts/createPost',
  async (postData, { rejectWithValue }) => {
    try {
      // apiService에 정의된 createPost 함수를 호출합니다.
      const newPost = await apiService.createPost(postData);
      return newPost; // 성공 시 서버로부터 받은 새 포스트 객체를 반환
    } catch (error) {
      return rejectWithValue(error.message || '포스트 생성에 실패했습니다.');
    }
  }
);


export const toggleLikePost = createAsyncThunk(
  'posts/toggleLike',
  async (postId, { rejectWithValue }) => {
    try {
      const data = await apiService.likePost(postId);
      return { postId, ...data }; // { postId, liked, likesCount }
    } catch (error) {
      return rejectWithValue(error.message || '좋아요 처리에 실패했습니다.');
    }
  }
);

export const updatePost = createAsyncThunk(
  'posts/updatePost',
  async ({ postId, postData }, { rejectWithValue }) => {
    try {
      const updatedPost = await apiService.updatePost(postId, postData);
      return updatedPost;
    } catch (error) {
      return rejectWithValue(error.message || '게시글 수정에 실패했습니다.');
    }
  }
);

export const deletePost = createAsyncThunk(
  'posts/deletePost',
  async (postId, { rejectWithValue }) => {
    try {
      await apiService.deletePost(postId);
      return postId; // 성공 시 삭제된 포스트의 ID를 반환
    } catch (error) {
      return rejectWithValue(error.message || '게시글 삭제에 실패했습니다.');
    }
  }
);

export const fetchSavedPosts = createAsyncThunk('posts/fetchSaved', async (_, { rejectWithValue }) => {
    try { return await apiService.getSavedPosts(); } catch (e) { return rejectWithValue(e.message); }
});

export const toggleSavePost = createAsyncThunk('posts/toggleSave', async (postId, { rejectWithValue }) => {
    try {
        const data = await apiService.toggleSavePost(postId);
        return { postId, ...data };
    } catch (e) { return rejectWithValue(e.message); }
});

const initialState = {
  posts: [],
  savedPosts: [],
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

const postSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // 포스트 목록 불러오기
      .addCase(fetchPosts.pending, (state) => {
        state.status = 'loading';
      })

      
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const postsData = action.payload; // 서버에서 받은 포스트 목록으로 교체

        // 수정된 부분: Firebase의 고유 키를 각 post 객체의 id로 매핑합니다.
    if (postsData && typeof postsData === 'object' && !Array.isArray(postsData)) {
      // Object.keys()로 키 배열을 만든 후, map을 사용해 새 배열을 생성합니다.
      state.posts = Object.keys(postsData).map(key => ({
        id: key, // Firebase의 고유 키를 'id' 속성에 할당
        ...postsData[key] // 기존 게시물 데이터 복사
      }));
    } else {
      state.posts = postsData || [];
    }
      })


      .addCase(fetchPosts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        state.posts = []; // 실패 시에도 빈 배열로 초기화
      })
      // ★★★ 포스트 생성 (가장 중요) ★★★
      .addCase(createPost.pending, (state) => {
        // 필요하다면 생성 중 상태 표시
        state.status = 'loading';
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // 새로 생성된 포스트(action.payload)를 기존 posts 배열의 맨 앞에 추가
        state.posts.unshift(action.payload);
      })
      .addCase(createPost.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        // 실패에 대한 UI 피드백 (예: Alert)은 WriteFeedScreen에서 처리
      })
      
      .addCase(toggleLikePost.fulfilled, (state, action) => {
        const { postId, liked, likesCount } = action.payload;
        const post = state.posts.find(p => p.id === postId);
        if (post) {
          post.isLiked = liked;
          post.likesCount = likesCount;
        }
      })

      .addCase(updatePost.fulfilled, (state, action) => {
        const updatedPost = action.payload;
        const index = state.posts.findIndex(post => post.id === updatedPost.id);
        if (index !== -1) {
          state.posts[index] = updatedPost; // 기존 게시물을 수정된 버전으로 교체
        }
      })

      .addCase(deletePost.fulfilled, (state, action) => {
        const deletedPostId = action.payload;
        // state.posts 배열에서 삭제된 게시물을 제거
        state.posts = state.posts.filter(post => post.id !== deletedPostId);
      })

      .addCase(fetchSavedPosts.fulfilled, (state, action) => {
        state.savedPosts = action.payload;
      })
      .addCase(toggleSavePost.fulfilled, (state, action) => {
        const { postId, saved } = action.payload;
        const toggle = (post) => { if (post.id === postId) post.isSaved = saved; };
        state.posts.forEach(toggle);
        
        // '저장한 피드 목록'도 업데이트
        if (saved) { // 저장된 경우, 목록에 추가 (중복 방지)
            const postToAdd = state.posts.find(p => p.id === postId);
            if (postToAdd && !state.savedPosts.some(p => p.id === postId)) {
                state.savedPosts.unshift(postToAdd);
            }
        } else { // 저장 취소된 경우, 목록에서 제거
            state.savedPosts = state.savedPosts.filter(p => p.id !== postId);
        }
      });
  },
});

export default postSlice.reducer;
