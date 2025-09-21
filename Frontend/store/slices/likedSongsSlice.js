import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';

// localStorage에서 likedSongs 불러오기
const loadLikedSongs = () => {
  try {
    const data = localStorage.getItem('likedSongs');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// localStorage에 likedSongs 저장
const saveLikedSongs = (songs) => {
  try {
    localStorage.setItem('likedSongs', JSON.stringify(songs));
  } catch {}
};

const initialState = {
  map: {}, // id or spotify_id => true
  list: loadLikedSongs(), // liked songs array
  status: 'idle',
  error: null,
};

export const fetchLikedSongs = createAsyncThunk(
  'likedSongs/fetch',
  async (_, thunkAPI) => {
    try {
      const data = await apiService.getMyLikedSongs();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return thunkAPI.rejectWithValue('좋아요한 곡을 불러오는데 실패했습니다.');
    }
  }
);

export const toggleLikeSongThunk = createAsyncThunk(
  'likedSongs/toggle',
  async (song, thunkAPI) => {
    try {
      const key = song.id || song.spotify_id;
      await apiService.toggleLikeSong(key, song);
      return song;
    } catch (e) {
      return thunkAPI.rejectWithValue('곡 좋아요 처리에 실패했습니다.');
    }
  }
);

const likedSongsSlice = createSlice({
  name: 'likedSongs',
  initialState,
  reducers: {
    addLikedSong: (state, action) => {
      // 이미 있으면 추가하지 않음
      if (!state.list.find(song => song.id === action.payload.id)) {
        state.list.push(action.payload);
        saveLikedSongs(state.list); // localStorage에 저장
      }
    },
    removeLikedSong: (state, action) => {
      state.list = state.list.filter(song => song.id !== action.payload);
      saveLikedSongs(state.list); // localStorage에 저장
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLikedSongs.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchLikedSongs.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.list = action.payload;
        const m = {};
        for (const s of state.list) {
          if (s.id) m[s.id] = true;
          if (s.spotify_id) m[s.spotify_id] = true;
        }
        state.map = m;
      })
      .addCase(fetchLikedSongs.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(toggleLikeSongThunk.fulfilled, (state, action) => {
        const song = action.payload || {};
        const key = song.spotify_id || song.id;
        if (!key) return;
        const curr = !!state.map[key];
        state.map[key] = !curr;
        if (!curr) {
          state.list = [{ ...song, liked_at: Date.now() }, ...state.list];
        } else {
          state.list = state.list.filter(s => (s.id || s.spotify_id) !== key);
        }
      });
  }
});

export const { addLikedSong, removeLikedSong } = likedSongsSlice.actions;
export default likedSongsSlice.reducer;

// 좋아요 여부를 쉽게 확인하는 selector
export const selectIsSongLiked = (state, song) => {
  const key = song.id || song.spotify_id;
  return !!state.likedSongs.map[key];
};
