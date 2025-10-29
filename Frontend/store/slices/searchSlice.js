import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logout } from './authSlice';

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_HISTORY_ITEMS = 10;

const getStorageKey = (userId) => (userId ? `${SEARCH_HISTORY_KEY}_${userId}` : SEARCH_HISTORY_KEY);

export const loadSearchHistory = createAsyncThunk(
  'search/loadHistory',
  async (_, { rejectWithValue, getState }) => {
    const state = getState();
    const userId = state?.auth?.user?.id;
    const storageKey = getStorageKey(userId);

    try {
      const stored = await AsyncStorage.getItem(storageKey);
      return {
        history: stored ? JSON.parse(stored) : [],
        storageKey,
      };
    } catch (error) {
      console.error('검색 기록을 불러오지 못했습니다.', error);
      return rejectWithValue({
        message: error?.message ?? '검색 기록을 불러오지 못했습니다.',
        storageKey,
      });
    }
  }
);

const persistHistory = async (storageKey, history) => {
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(history));
  } catch (error) {
    console.error('검색 기록을 저장하지 못했습니다.', error);
  }
};

const searchSlice = createSlice({
  name: 'search',
  initialState: {
    history: [],
    popularSearches: ['K-pop', 'Jazz', 'Rock', 'Pop', 'Classical'],
    status: 'idle',
    storageKey: SEARCH_HISTORY_KEY,
  },
  reducers: {
    addRecentSearch: (state, action) => {
      const entry = action.payload;
      if (!entry || !entry.type || !entry.data) {
        return;
      }

      const identifier = entry.data.id || entry.data.spotify_id;
      if (!identifier) {
        return;
      }

      const existingIndex = state.history.findIndex((item) => {
        const currentId = item.data.id || item.data.spotify_id;
        return item.type === entry.type && currentId === identifier;
      });

      if (existingIndex > -1) {
        state.history.splice(existingIndex, 1);
      }

      state.history.unshift(entry);

      if (state.history.length > MAX_HISTORY_ITEMS) {
        state.history = state.history.slice(0, MAX_HISTORY_ITEMS);
      }

      const storageKey = state.storageKey || SEARCH_HISTORY_KEY;
      persistHistory(storageKey, state.history);
    },
    removeRecentSearch: (state, action) => {
      const entry = action.payload;
      const identifier = entry?.data?.id || entry?.data?.spotify_id;

      state.history = state.history.filter((item) => {
        const currentId = item.data.id || item.data.spotify_id;
        return !(item.type === entry.type && currentId === identifier);
      });

      const storageKey = state.storageKey || SEARCH_HISTORY_KEY;
      persistHistory(storageKey, state.history);
    },
    clearSearchHistory: (state) => {
      state.history = [];
      const storageKey = state.storageKey || SEARCH_HISTORY_KEY;
      AsyncStorage.removeItem(storageKey).catch((error) =>
        console.error('검색 기록을 삭제하지 못했습니다.', error)
      );
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSearchHistory.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadSearchHistory.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.storageKey = action.payload?.storageKey || SEARCH_HISTORY_KEY;
        state.history = Array.isArray(action.payload?.history)
          ? action.payload.history
          : [];
      })
      .addCase(loadSearchHistory.rejected, (state, action) => {
        state.status = 'failed';
        if (action.payload?.storageKey) {
          state.storageKey = action.payload.storageKey;
        }
      })
      .addCase(logout.fulfilled, (state) => {
        state.history = [];
        state.storageKey = SEARCH_HISTORY_KEY;
        state.status = 'idle';
      });
  },
});

export const { addRecentSearch, removeRecentSearch, clearSearchHistory } = searchSlice.actions;
export default searchSlice.reducer;
