import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_HISTORY_KEY = 'search_history'; // 키 이름을 좀 더 명확하게 변경
const MAX_HISTORY_ITEMS = 10; // 저장할 최대 항목 수

// 앱 시작 시 AsyncStorage에서 검색 기록 불러오기
export const loadSearchHistory = createAsyncThunk(
  'search/loadHistory',
  async (_, { rejectWithValue }) => {
    try {
      const jsonValue = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error('Failed to load search history.', e);
      return rejectWithValue(e);
    }
  }
);

const searchSlice = createSlice({
  name: 'search',
  initialState: {
    // history는 이제 {type, data} 객체의 배열이 됩니다.
    history: [], 
    popularSearches: ['K-pop', 'Jazz', 'Rock', 'Pop', 'Classical'],
    status: 'idle',
  },
  // 동기적인 state 변경은 reducers에서 처리하는 것이 더 간단하고 직관적입니다.
  reducers: {
    // 최근 검색어 추가 (가장 중요한 로직)
    addRecentSearch: (state, action) => {
      const newItem = action.payload; // { type: 'track', data: { ... } } 형태의 객체
      
      // 중복 검사: 타입과 id가 모두 같은 항목을 찾습니다.
      const existingIndex = state.history.findIndex(
        item => item.type === newItem.type && item.data.id === newItem.data.id
      );

      // 중복이 있으면 기존 항목을 배열에서 제거합니다.
      if (existingIndex > -1) {
        state.history.splice(existingIndex, 1);
      }
      
      // 새로운 항목을 배열의 맨 앞에 추가합니다.
      state.history.unshift(newItem);

      // 기록은 설정된 최대 개수까지만 유지합니다.
      if (state.history.length > MAX_HISTORY_ITEMS) {
        state.history = state.history.slice(0, MAX_HISTORY_ITEMS);
      }

      // 변경된 history를 AsyncStorage에 저장합니다.
      AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(state.history));
    },
    // 특정 검색 기록 삭제
    removeRecentSearch: (state, action) => {
        const itemToRemove = action.payload; // { type, data }
        state.history = state.history.filter(
            item => !(item.type === itemToRemove.type && item.data.id === itemToRemove.data.id)
        );
        AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(state.history));
    },
    // 모든 검색 기록 삭제
    clearSearchHistory: (state) => {
      state.history = [];
      AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSearchHistory.fulfilled, (state, action) => {
        state.history = action.payload;
        state.status = 'succeeded';
      })
      .addCase(loadSearchHistory.rejected, (state) => {
        state.status = 'failed';
      });
  },
});

// 새로운 액션들을 export 합니다.
export const { addRecentSearch, removeRecentSearch, clearSearchHistory } = searchSlice.actions;

export default searchSlice.reducer;