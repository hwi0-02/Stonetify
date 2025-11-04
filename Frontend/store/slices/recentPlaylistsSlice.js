import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'recentPlaylists';
const MAX_RECENT = 20;

const loadFromStorage = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[recentPlaylistsSlice] Failed to load recent playlists:', error);
    return [];
  }
};

const saveToStorage = async (items) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('[recentPlaylistsSlice] Failed to persist recent playlists:', error);
  }
};

export const fetchRecentPlaylists = createAsyncThunk(
  'recentPlaylists/fetchRecentPlaylists',
  async () => {
    return await loadFromStorage();
  }
);

export const addRecentPlaylist = createAsyncThunk(
  'recentPlaylists/addRecentPlaylist',
  async (playlist, { getState }) => {
    if (!playlist || !playlist.id) return getState().recentPlaylists.items;

    const stateItems = getState().recentPlaylists.items || [];
    const filtered = stateItems.filter((item) => item.id !== playlist.id);

    const normalized = {
      id: playlist.id,
      title: playlist.title ?? '',
      description: playlist.description ?? '',
      cover_images: Array.isArray(playlist.cover_images) ? playlist.cover_images : [],
      cover_image_url: playlist.cover_image_url ?? null,
      user: playlist.user ? {
        id: playlist.user.id,
        display_name: playlist.user.display_name,
      } : null,
      updated_at: Date.now(),
    };

    const nextItems = [normalized, ...filtered].slice(0, MAX_RECENT);
    await saveToStorage(nextItems);
    return nextItems;
  }
);

const recentPlaylistsSlice = createSlice({
  name: 'recentPlaylists',
  initialState: {
    items: [],
    status: 'idle',
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecentPlaylists.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchRecentPlaylists.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload ?? [];
      })
      .addCase(fetchRecentPlaylists.rejected, (state) => {
        state.status = 'failed';
      })
      .addCase(addRecentPlaylist.fulfilled, (state, action) => {
        state.items = action.payload ?? state.items;
      });
  },
});

export default recentPlaylistsSlice.reducer;
