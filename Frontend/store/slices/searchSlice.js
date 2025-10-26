import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_HISTORY_KEY = 'searchHistory';
const MAX_HISTORY_ITEMS = 10;

// 검색 히스토리 로드
export const loadSearchHistory = createAsyncThunk(
  'search/loadHistory',
  async () => {
    try {
      const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('검색 히스토리 로드 실패:', error);
      return [];
    }
  }
);

// 검색어 저장
export const saveSearchTerm = createAsyncThunk(
  'search/saveTerm',
  async (term, { getState }) => {
    try {
      const { search } = getState();
      const newHistory = [term, ...search.history.filter(item => item !== term)]
        .slice(0, MAX_HISTORY_ITEMS);
      
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    } catch (error) {
      console.error('검색어 저장 실패:', error);
      throw error;
    }
  }
);

// 검색 히스토리 삭제
export const clearSearchHistory = createAsyncThunk(
  'search/clearHistory',
  async () => {
    try {
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
      return [];
    } catch (error) {
      console.error('검색 히스토리 삭제 실패:', error);
      throw error;
    }
  }
);

const initialState = {
  history: [],
  recentSearches: [],
  popularSearches: ['K-pop', 'Jazz', 'Rock', 'Pop', 'Classical'],
  status: 'idle',
};

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    addRecentSearch: (state, action) => {
      const term = action.payload;
      state.recentSearches = [term, ...state.recentSearches.filter(item => item !== term)]
        .slice(0, 5);
    },
    removeSearchTerm: (state, action) => {
      state.history = state.history.filter(term => term !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSearchHistory.fulfilled, (state, action) => {
        state.history = action.payload;
        state.status = 'succeeded';
      })
      .addCase(saveSearchTerm.fulfilled, (state, action) => {
        state.history = action.payload;
      })
      .addCase(clearSearchHistory.fulfilled, (state) => {
        state.history = [];
      });
  },
});

export const { addRecentSearch, removeSearchTerm } = searchSlice.actions;
export default searchSlice.reducer;
