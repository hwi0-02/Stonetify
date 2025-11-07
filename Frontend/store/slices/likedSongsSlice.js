import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../../services/apiService';

const initialState = {
  map: {},
  list: [],
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
      const response = await apiService.toggleLikeSong(key, song);
      return { song, liked: response.liked };
    } catch (e) {
      return thunkAPI.rejectWithValue('곡 좋아요 처리에 실패했습니다.');
    }
  }
);

const getKeys = (song) => {
  if (!song) return [];
  const keys = [];
  if (song.id) keys.push(song.id);
  if (song.spotify_id) keys.push(song.spotify_id);
  return keys;
};

const removeByKeys = (list, keys) => {
  if (!Array.isArray(list) || !keys?.length) return list || [];
  return list.filter((s) => {
    const sid = s?.id;
    const ssid = s?.spotify_id;
    return !keys.includes(sid) && !keys.includes(ssid);
  });
};

const likedSongsSlice = createSlice({
  name: 'likedSongs',
  initialState,
  reducers: {
    toggleLocal(state, action) {
      const song = action.payload || {};
      const keys = getKeys(song);
      if (keys.length === 0) return;
      const curr = keys.some(k => !!state.map[k]);
      keys.forEach(k => { state.map[k] = !curr; });
      if (!curr) {
        state.list = [{ ...song, liked_at: Date.now() }, ...removeByKeys(state.list, keys)];
      } else {
        state.list = removeByKeys(state.list, keys);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLikedSongs.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchLikedSongs.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const seen = new Set();
        const unique = [];
        for (const s of (action.payload || [])) {
          const k1 = s?.id;
          const k2 = s?.spotify_id;
          const tag = k1 ? `id:${k1}` : (k2 ? `sp:${k2}` : null);
          if (!tag) continue;
          if (seen.has(k1 || k2)) continue;
          seen.add(k1 || k2);
          unique.push(s);
        }
        state.list = unique;
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
      .addCase(toggleLikeSongThunk.pending, (state, action) => {
        // 낙관적 업데이트 - 즉시 UI 반영
        const song = action.meta.arg || {};
        const keys = getKeys(song);
        if (keys.length === 0) return;
        const curr = keys.some(k => !!state.map[k]);
        keys.forEach(k => { state.map[k] = !curr; });
        if (!curr) {
          state.list = [{ ...song, liked_at: Date.now() }, ...removeByKeys(state.list, keys)];
        } else {
          state.list = removeByKeys(state.list, keys);
        }
      })
      .addCase(toggleLikeSongThunk.fulfilled, (state, action) => {
        // 서버 응답으로 최종 상태 확정
        const { song, liked } = action.payload || {};
        if (!song) return;
        const keys = getKeys(song);
        if (keys.length === 0) return;

        // 서버가 반환한 liked 값으로 최종 상태 설정
        keys.forEach(k => { state.map[k] = liked; });
        if (liked) {
          // 좋아요 추가
          state.list = [{ ...song, liked_at: Date.now() }, ...removeByKeys(state.list, keys)];
        } else {
          // 좋아요 제거
          state.list = removeByKeys(state.list, keys);
        }
      })
      .addCase(toggleLikeSongThunk.rejected, (state, action) => {
        // 실패 시 롤백
        const song = action.meta.arg || {};
        const keys = getKeys(song);
        if (keys.length === 0) return;
        const curr = keys.some(k => !!state.map[k]);
        keys.forEach(k => { state.map[k] = !curr; });
        if (curr) {
          state.list = [{ ...song, liked_at: Date.now() }, ...removeByKeys(state.list, keys)];
        } else {
          state.list = removeByKeys(state.list, keys);
        }
      });
  }
});

export const { toggleLocal } = likedSongsSlice.actions;
export default likedSongsSlice.reducer;
