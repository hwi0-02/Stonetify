import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_HISTORY_ITEMS = 10;

export const loadSearchHistory = createAsyncThunk(
  'search/loadHistory',
  async (_, { rejectWithValue }) => {
    try {
      const stored = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('검색 기록을 불러오지 못했습니다.', error);
      return rejectWithValue(error);
    }
  }
);

const persistHistory = async (history) => {
  try {
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
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

      persistHistory(state.history);
    },
    removeRecentSearch: (state, action) => {
      const entry = action.payload;
      const identifier = entry?.data?.id || entry?.data?.spotify_id;

      state.history = state.history.filter((item) => {
        const currentId = item.data.id || item.data.spotify_id;
        return !(item.type === entry.type && currentId === identifier);
      });

      persistHistory(state.history);
    },
    clearSearchHistory: (state) => {
      state.history = [];
      AsyncStorage.removeItem(SEARCH_HISTORY_KEY).catch((error) =>
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
        state.history = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(loadSearchHistory.rejected, (state) => {
        state.status = 'failed';
      });
  },
});

export const { addRecentSearch, removeRecentSearch, clearSearchHistory } = searchSlice.actions;
export default searchSlice.reducer;
