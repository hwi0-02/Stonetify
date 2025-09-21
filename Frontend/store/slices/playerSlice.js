import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Audio } from 'expo-audio';

let playbackInstance = null;

const initialState = {
  currentTrack: null,
  isPlaying: false,
  status: 'idle', // idle | loading | playing | paused | stopped | error
  error: null,
  volume: 1.0,
  position: 0,
  duration: 0,
  isRepeat: false,
  isShuffle: false,
};

export const playTrack = createAsyncThunk(
  'player/playTrack',
  async (track, { dispatch, rejectWithValue }) => {
    try {
      if (playbackInstance) {
        await playbackInstance.unloadAsync();
      }
      
      if (!track.preview_url) {
        return rejectWithValue('이 곡은 미리듣기를 제공하지 않습니다.');
      }

      dispatch(playerSlice.actions.setLoading());

      const { sound } = await Audio.Sound.createAsync(
        { uri: track.preview_url },
        { shouldPlay: true }
      );
      playbackInstance = sound;

      playbackInstance.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          dispatch(stopTrack());
        }
        if (status.isLoaded && !status.isPlaying && !status.didJustFinish) {
            dispatch(playerSlice.actions.setPaused());
        } else if (status.isLoaded && status.isPlaying) {
            dispatch(playerSlice.actions.setPlaying());
        }
      });

      return track;
    } catch (error) {
      console.error('재생 오류:', error);
      return rejectWithValue('곡 재생에 실패했습니다.');
    }
  }
);

export const pauseTrack = createAsyncThunk(
  'player/pauseTrack',
  async (_, { dispatch, rejectWithValue }) => {
    if (!playbackInstance) return rejectWithValue('재생 중인 곡이 없습니다.');
    try {
      await playbackInstance.pauseAsync();
      return;
    } catch (error) {
      return rejectWithValue('곡 일시정지에 실패했습니다.');
    }
  }
);

export const resumeTrack = createAsyncThunk(
  'player/resumeTrack',
  async (_, { dispatch, rejectWithValue }) => {
    if (!playbackInstance) return rejectWithValue('재생 중인 곡이 없습니다.');
    try {
      await playbackInstance.playAsync();
      return;
    } catch (error) {
      return rejectWithValue('곡 재생 재개에 실패했습니다.');
    }
  }
);

export const stopTrack = createAsyncThunk(
  'player/stopTrack',
  async (_, { dispatch, rejectWithValue }) => {
    if (!playbackInstance) return rejectWithValue('재생 중인 곡이 없습니다.');
    try {
      await playbackInstance.unloadAsync();
      playbackInstance = null;
      return;
    } catch (error) {
      return rejectWithValue('곡 정지에 실패했습니다.');
    }
  }
);

// 볼륨 설정
export const setVolume = createAsyncThunk(
  'player/setVolume',
  async (volume, { rejectWithValue }) => {
    if (!playbackInstance) return rejectWithValue('재생 중인 곡이 없습니다.');
    try {
      await playbackInstance.setVolumeAsync(volume);
      return volume;
    } catch (error) {
      return rejectWithValue('볼륨 설정에 실패했습니다.');
    }
  }
);

// 재생 위치 설정
export const setPosition = createAsyncThunk(
  'player/setPosition',
  async (position, { rejectWithValue }) => {
    if (!playbackInstance) return rejectWithValue('재생 중인 곡이 없습니다.');
    try {
      await playbackInstance.setPositionAsync(position);
      return position;
    } catch (error) {
      return rejectWithValue('재생 위치 설정에 실패했습니다.');
    }
  }
);

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setLoading: (state) => {
        state.status = 'loading';
    },
    setPlaying: (state) => {
        state.status = 'playing';
        state.isPlaying = true;
    },
    setPaused: (state) => {
        state.status = 'paused';
        state.isPlaying = false;
    },
    toggleRepeat: (state) => {
        state.isRepeat = !state.isRepeat;
    },
    toggleShuffle: (state) => {
        state.isShuffle = !state.isShuffle;
    },
    updatePosition: (state, action) => {
        state.position = action.payload;
    },
    updateDuration: (state, action) => {
        state.duration = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(playTrack.fulfilled, (state, action) => {
        state.currentTrack = action.payload;
        state.status = 'playing';
        state.isPlaying = true;
      })
      .addCase(playTrack.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
        state.currentTrack = null;
        state.isPlaying = false;
      })
      .addCase(pauseTrack.fulfilled, (state) => {
        state.status = 'paused';
        state.isPlaying = false;
      })
      .addCase(resumeTrack.fulfilled, (state) => {
        state.status = 'playing';
        state.isPlaying = true;
      })
      .addCase(stopTrack.fulfilled, (state) => {
        state.currentTrack = null;
        state.isPlaying = false;
        state.status = 'stopped';
      });
  },
});

export default playerSlice.reducer;