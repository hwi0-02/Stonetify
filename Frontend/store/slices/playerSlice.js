import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getAdapter, getAdapterType, ensureSpotifyAdapter } from '../../../Frontend/adapters';
import { showToast } from '../../utils/toast';
import { track as analyticsTrack } from '../../utils/analytics';
import { startPlaybackHistory, completePlaybackHistory, getRemoteDevices, transferRemotePlayback } from '../../services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSpotifySession, refreshSpotifyToken } from './spotifySlice';

let lastStatusUpdate = 0;

const initialState = {
  currentTrack: null,
  isPlaying: false,
  status: 'idle',
  error: null,
  volume: 1.0,
  position: 0,
  duration: 0,
  queue: [],
  queueIndex: 0,
  originalQueue: [],
  repeatMode: 'off',
  isShuffle: false,
  seekInProgress: false,
  isTransitioning: false,
  lastActionTS: null,
  playbackDeviceId: null,
  playbackDeviceName: null,
  historyId: null,
  playbackSource: 'spotify_full',
  adapterType: 'spotify_rest',
  lastAdapterSwitch: null,
  isPlayerScreenVisible: false,
};

const getTrackId = (track) => track?.spotify_id ?? track?.spotifyId ?? track?.id ?? track?.song_id ?? track?.track_id ?? track?.songId ?? null;

const normalizeTrack = (track) => {
  if (!track) return null;
  const id = getTrackId(track);
  let uri = track.uri ?? track.spotify_uri ?? track.spotifyUri ?? track.spotifyURI ?? null;

  if (!uri && id && !id.startsWith('-')) {
    uri = id.startsWith('spotify:') ? id : `spotify:track:${id}`;
  }

  console.log('🔄 [normalizeTrack]', {
    originalId: track?.id,
    spotifyId: track?.spotify_id,
    extractedId: id,
    uri: uri,
    trackName: track?.name || track?.title
  });
  
  return {
    ...track,
    id: id ?? track?.id ?? null,
    uri,
  };
};

const findTrackIndexInQueue = (queue, track, fallbackIndex) => {
  if (typeof fallbackIndex === 'number' && fallbackIndex >= 0 && fallbackIndex < queue.length) {
    return fallbackIndex;
  }
  if (!Array.isArray(queue) || !track) return -1;
  const targetId = getTrackId(track);
  const targetUri = track?.uri ?? track?.spotify_uri ?? track?.spotifyUri ?? track?.spotifyURI ?? null;
  return queue.findIndex((candidate) => {
    const candidateId = getTrackId(candidate);
    if (targetId && candidateId && targetId === candidateId) return true;
    const candidateUri = candidate?.uri ?? candidate?.spotify_uri ?? candidate?.spotifyUri ?? candidate?.spotifyURI ?? null;
    if (targetUri && candidateUri && targetUri === candidateUri) return true;
    return false;
  });
};

export const ensurePlaybackAdapter = createAsyncThunk(
  'player/ensurePlaybackAdapter',
  async ({ track }, { getState, dispatch }) => {
    const state = getState();
    const userId = state.auth?.user?.id || state.auth?.user?.userId;
    
    if (!track?.uri && !track?.id) {
      throw new Error('Track missing valid Spotify URI/ID');
    }

    const current = getAdapterType();
    if (current !== 'spotify_rest') {
      ensureSpotifyAdapter(userId);
      dispatch(playerSlice.actions.adapterSwitched({ to: 'spotify_rest', from: current }));
      analyticsTrack('adapter_switch', { to: 'spotify_rest', from: current, reason: 'spotify_only', trackId: track?.id });
    }
    return { type: 'spotify_rest' };
  }
);


export const pauseTrack = createAsyncThunk(
  'player/pauseTrack',
  async (_, { dispatch, rejectWithValue }) => {
    const adapter = getAdapter();
    if (!adapter) return rejectWithValue('재생 중인 곡이 없습니다.');
    try {
      await adapter.pause();
      analyticsTrack('pause', { adapter: getAdapterType() });
      return;
    } catch (error) {
      return rejectWithValue('곡 일시정지에 실패했습니다.');
    }
  }
);

export const resumeTrack = createAsyncThunk(
  'player/resumeTrack',
  async (_, { rejectWithValue }) => {
    const adapter = getAdapter();
    if (!adapter) return rejectWithValue('재생 중인 곡이 없습니다.');
    try {
      await adapter.play();
      analyticsTrack('resume', { adapter: getAdapterType() });
      return;
    } catch (e) {
      return rejectWithValue('재생 재개 실패');
    }
  }
);

export const stopTrack = createAsyncThunk(
  'player/stopTrack',
  async (_, { getState, rejectWithValue }) => {
    const adapter = getAdapter();
    if (!adapter) return;
    try {
      await adapter.stop();
      return;
    } catch (e) {
      return rejectWithValue('정지 실패');
    }
  }
);

export const setVolume = createAsyncThunk(
  'player/setVolume',
  async (vol, { rejectWithValue }) => {
    const adapter = getAdapter();
    if (!adapter) return rejectWithValue('재생 중인 곡이 없습니다.');
    try {
      if (adapter.setVolume) await adapter.setVolume(vol);
      analyticsTrack('volume_change', { adapter: getAdapterType(), volume: vol });
      return vol;
    } catch (e) {
      return rejectWithValue('볼륨 변경 실패');
    }
  }
);

export const playTrack = createAsyncThunk(
  'player/playTrack',
  async (track, { dispatch, rejectWithValue, getState }) => {
    try {
      if (!track) return rejectWithValue('트랙 정보가 없습니다.');

      const reduxState = getState();

      // Check if Spotify token is expired and refresh if needed
      const spotifyState = reduxState.spotify;
      const tokenExpiry = spotifyState?.tokenExpiry;
      const hasRefreshToken = spotifyState?.refreshTokenEnc;

      if (hasRefreshToken && tokenExpiry && Date.now() >= tokenExpiry) {
        console.log('🔄 [playTrack] Token expired, refreshing...');
        try {
          await dispatch(refreshSpotifyToken()).unwrap();
        } catch (refreshError) {
          console.error('🔴 [playTrack] Token refresh failed:', refreshError);
          if (refreshError?.error === 'TOKEN_REVOKED' || refreshError?.requiresReauth) {
            return rejectWithValue({
              message: refreshError?.message || 'Spotify 연결이 만료되었습니다.\n프로필에서 Spotify를 다시 연결해주세요.',
              code: 'TOKEN_REVOKED',
              requiresReauth: true
            });
          }
        }
      }

      // Ensure Spotify adapter is ready
      await dispatch(ensurePlaybackAdapter({ track }));
      const adapterType = getAdapterType();
      const adapter = getAdapter();
      const preferredDeviceId = reduxState?.player?.playbackDeviceId || null;
      
      if (!adapter) {
        return rejectWithValue('Spotify 어댑터를 초기화할 수 없습니다.');
      }
      
      dispatch(playerSlice.actions.setLoading());

      try {
        const userId = reduxState?.auth?.user?.id || reduxState?.auth?.user?.userId;
        if (userId) {
          const devices = await getRemoteDevices(userId);
          const mobileRegex = /(iphone|ipad|android|mobile|ios)/i;
          const autoDevice = devices?.devices?.find((device) => mobileRegex.test(device?.name || ''))
            || devices?.devices?.find((device) => device?.type === 'Smartphone');

          if (autoDevice && autoDevice?.id !== preferredDeviceId) {
            dispatch(playerSlice.actions.setPlaybackDeviceInfo({
              id: autoDevice.id,
              name: autoDevice.name,
            }));
            await transferRemotePlayback({ userId, device_id: autoDevice.id, play: false });
          }
        }
      } catch (deviceError) {
        console.warn('[playerSlice] Device selection failed:', deviceError.message || deviceError);
      }

      await adapter.load(track, true, { deviceId: reduxState?.player?.playbackDeviceId || preferredDeviceId });
      if (track.id) {
        analyticsTrack('play_start', {
          trackId: track.id,
          name: track.name,
          adapter: adapterType,
        });
        try {
          const userRaw = await AsyncStorage.getItem('user');
          if (userRaw) {
            const user = JSON.parse(userRaw);
            const userId = user?.id || user?.userId;
            if (userId) {
              const res = await startPlaybackHistory({ userId, track: { id: track.id, name: track.name, artists: track.artists, uri: track.uri }, playbackSource: 'spotify_full' });
              dispatch(playerSlice.actions.setHistoryId(res.historyId));
            }
          }
        } catch (e) { console.warn('Playback history start failed', e.message); }
      }
      adapter.onStatus((status) => {
        const now = Date.now();
        const throttle = 2500;
        if (now - lastStatusUpdate >= throttle) {
          lastStatusUpdate = now;
          dispatch(playerSlice.actions.updatePlaybackStatus({
            positionMillis: status.positionMillis || 0,
            durationMillis: status.durationMillis || 0,
            isPlaying: status.isPlaying || false,
          }));
        }
        if (status.didJustFinish) {
          dispatch(handleTrackEnd());
        } else if (status.isPlaying) {
          dispatch(playerSlice.actions.setPlaying());
        } else if (!status.isPlaying && !status.didJustFinish) {
          dispatch(playerSlice.actions.setPaused());
        }
      });
      return track;
    } catch (error) {
      console.error('재생 오류:', error);

      if (error.code === 'TOKEN_REVOKED' || error.requiresReauth) {
        console.error('🔴 [playTrack] Spotify token revoked');
        analyticsTrack('spotify_token_revoked', { trackId: track?.id });

        const { clearSpotifySession } = await import('./spotifySlice');
        dispatch(clearSpotifySession({ reason: 'revoked' }));
        try {
          await AsyncStorage.setItem('spotifyNeedsReauth', 'true');
        } catch (storageError) {
          console.warn('Failed to persist spotifyNeedsReauth flag', storageError.message);
        }

        return rejectWithValue({
          message: 'Spotify 연결이 만료되었습니다.\n프로필에서 Spotify를 다시 연결해주세요.',
          code: 'TOKEN_REVOKED',
          requiresReauth: true
        });
      }

      if (error.code === 'NO_ACTIVE_DEVICE') {
        return rejectWithValue({
          message: error.message,
          code: 'NO_ACTIVE_DEVICE'
        });
      }

      analyticsTrack('play_error', { message: error.message, trackId: track?.id, adapter: getAdapterType() });
      return rejectWithValue('곡 재생에 실패했습니다.');
    }
  }
);

export const setPosition = createAsyncThunk(
  'player/setPosition',
  async (position, { rejectWithValue }) => {
    const adapter = getAdapter();
    if (!adapter) return rejectWithValue('재생 중인 곡이 없습니다.');
    try {
      await adapter.seek(position);
      analyticsTrack('seek', { adapter: getAdapterType(), position });
      return position;
    } catch (error) {
      return rejectWithValue('재생 위치 설정에 실패했습니다.');
    }
  }
);

export const loadQueue = createAsyncThunk(
  'player/loadQueue',
  async ({ tracks, startIndex = 0 }, { dispatch }) => {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return { tracks: [], startIndex: 0 };
    }

    const normalizedQueue = tracks
      .map(normalizeTrack)
      .filter(Boolean);

    if (normalizedQueue.length === 0) {
      return { tracks: [], startIndex: 0 };
    }

    const safeIndex = Math.max(0, Math.min(startIndex, normalizedQueue.length - 1));
    dispatch(playerSlice.actions.replaceQueue({ queue: normalizedQueue, queueIndex: safeIndex }));
    await dispatch(playFromQueue(safeIndex));

    return { tracks: normalizedQueue, startIndex: safeIndex };
  }
);

export const playTrackWithPlaylist = (trackInput, playlistInput, explicitIndex) => async (dispatch) => {
  let track = trackInput;
  let playlist = playlistInput;
  let indexHint = explicitIndex;

  if (trackInput && typeof trackInput === 'object' && (trackInput.track || trackInput.playlist || typeof trackInput.index === 'number')) {
    track = trackInput.track ?? trackInput;
    playlist = trackInput.playlist ?? playlistInput;
    indexHint = typeof trackInput.index === 'number' ? trackInput.index : explicitIndex;
  }

  if (!Array.isArray(playlist) || playlist.length === 0) {
    showToast('플레이리스트에 재생할 곡이 없습니다.');
    return;
  }

  const normalizedQueue = playlist
    .map(normalizeTrack)
    .filter(Boolean);

  if (normalizedQueue.length === 0) {
    showToast('플레이리스트에 재생 가능한 곡이 없습니다.');
    return;
  }

  const queueIndex = (() => {
    const hint = findTrackIndexInQueue(normalizedQueue, track, indexHint);
    return hint >= 0 ? hint : 0;
  })();

  const trackToPlay = normalizedQueue[queueIndex];

  dispatch(playerSlice.actions.replaceQueue({ queue: normalizedQueue, queueIndex }));

  try {
    await dispatch(playTrack(trackToPlay)).unwrap();
  } catch (error) {
    const message = typeof error === 'string' ? error : (error?.message || '곡 재생에 실패했습니다.');
    showToast(message);
    throw error;
  } finally {
    dispatch(persistPlaybackState());
  }
};

export const playFromQueue = createAsyncThunk(
  'player/playFromQueue',
  async (index, { getState, dispatch, rejectWithValue }) => {
    const { queue, isTransitioning } = getState().player;
    const isPremium = getState().spotify?.isPremium;
    if (isTransitioning) return rejectWithValue('Transition in progress');
    if (queue.length === 0) return rejectWithValue('Queue empty');
    let candidate = index;
    if (candidate < 0) candidate = 0;
    // Skip logic: only skip missing preview if user is not premium (can't remote full-track yet)
    if (!isPremium) {
      let attempts = 0;
      while (candidate < queue.length && !queue[candidate]?.preview_url && attempts < queue.length) {
        candidate++;
        attempts++;
      }
    }
    if (candidate >= queue.length) {
      showToast('재생 가능한 트랙이 없습니다.');
      return rejectWithValue('No playable tracks ahead');
    }
    dispatch(playerSlice.actions.setTransitioning(true));
    try {
      const track = queue[candidate];
      await dispatch(playTrack(track)).unwrap();
      return { index: candidate, track };
    } catch (e) {
    analyticsTrack('skip', { reason: 'play_failed', trackId: queue[candidate]?.id, adapter: getAdapterType() });
    showToast('해당 트랙 재생 실패, 다음 곡으로 이동합니다.');
    return rejectWithValue(e.message || 'Failed to play from queue');
    } finally {
      dispatch(playerSlice.actions.setTransitioning(false));
      dispatch(persistPlaybackState());
    }
  }
);

export const nextTrack = createAsyncThunk(
  'player/nextTrack',
  async (_, { getState, dispatch }) => {
    const { queueIndex, queue, repeatMode } = getState().player;
    analyticsTrack('next', { adapter: getAdapterType(), queueIndex });
    if (repeatMode === 'track') {
      await dispatch(playFromQueue(queueIndex));
      return;
    }
    if (queueIndex < queue.length - 1) {
      await dispatch(playFromQueue(queueIndex + 1));
    } else if (repeatMode === 'queue') {
      await dispatch(playFromQueue(0));
    } else {
      await dispatch(stopTrack());
    }
    dispatch(persistPlaybackState());
  }
);

export const previousTrack = createAsyncThunk(
  'player/previousTrack',
  async (_, { getState, dispatch }) => {
    const { queueIndex, position } = getState().player;
    analyticsTrack('previous', { adapter: getAdapterType(), queueIndex });
    if (position > 3000) {
      await dispatch(setPosition(0));
      return;
    }
    if (queueIndex > 0) {
      await dispatch(playFromQueue(queueIndex - 1));
    }
    dispatch(persistPlaybackState());
  }
);

export const handleTrackEnd = createAsyncThunk(
  'player/handleTrackEnd',
  async (_, { dispatch, getState }) => {
    const { historyId, position, duration, currentTrack } = getState().player;
    if (historyId) {
      try {
        const userRaw = await AsyncStorage.getItem('user');
        const user = userRaw ? JSON.parse(userRaw) : null;
        const userId = user?.id || user?.userId;
        if (userId) {
          await completePlaybackHistory({ userId, historyId, positionMs: position, durationMs: duration });
          analyticsTrack('play_complete', { trackId: currentTrack?.id, adapter: getAdapterType(), completed: true });
        }
      } catch (e) { console.warn('Playback history finalize failed', e.message); }
      dispatch(playerSlice.actions.clearHistoryId());
    }
    await dispatch(nextTrack());
  }
);

export const toggleRepeatMode = () => (dispatch, getState) => {
  const { repeatMode } = getState().player;
  const order = ['off', 'track', 'queue'];
  const next = order[(order.indexOf(repeatMode) + 1) % order.length];
  dispatch(playerSlice.actions.setRepeatMode(next));
};

export const toggleShuffleMode = createAsyncThunk(
  'player/toggleShuffleMode',
  async (_, { getState, dispatch }) => {
    const { isShuffle, queue, queueIndex, originalQueue } = getState().player;
    if (!isShuffle) {
      if (queue.length <= 1) return { isShuffle: false };
      const current = queue[queueIndex];
      const rest = queue.filter((_, i) => i !== queueIndex);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      const newQueue = [current, ...rest];
      return { isShuffle: true, queue: newQueue, originalQueue: queue, queueIndex: 0 };
    } else {
      if (!originalQueue.length) return { isShuffle: false };
      const current = queue[queueIndex];
      const restoreIndex = originalQueue.findIndex(t => t.id === current.id);
      return { isShuffle: false, queue: originalQueue, originalQueue: [], queueIndex: restoreIndex >= 0 ? restoreIndex : 0 };
    }
  }
);

const STORAGE_KEY = '@stonetify_playback_state_v1';

export const persistPlaybackState = createAsyncThunk(
  'player/persistPlaybackState',
  async (_, { getState }) => {
    try {
      const { player } = getState();
      const snapshot = {
        queue: player.queue.map(t => ({
          id: t.id,
          name: t.name,
          album: t.album,
          artists: t.artists,
          uri: t.uri,
        })),
        queueIndex: player.queueIndex,
        position: player.position,
        repeatMode: player.repeatMode,
        isShuffle: player.isShuffle,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('Persist playback failed', e);
    }
  }
);

export const restorePlaybackState = createAsyncThunk(
  'player/restorePlaybackState',
  async (_, { dispatch }) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!Array.isArray(data.queue) || data.queue.length === 0) return;
      dispatch(playerSlice.actions.restoreState({
        queue: data.queue,
        queueIndex: data.queueIndex || 0,
        position: data.position || 0,
        repeatMode: data.repeatMode || 'off',
        isShuffle: !!data.isShuffle,
      }));
    } catch (e) {
      console.warn('Restore playback failed', e);
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
    setRepeatMode: (state, action) => {
      state.repeatMode = action.payload;
    },
    setTransitioning: (state, action) => { state.isTransitioning = action.payload; },
    updatePlaybackStatus: (state, action) => {
      const { positionMillis, durationMillis, isPlaying } = action.payload;
      if (!state.seekInProgress) state.position = positionMillis;
      if (durationMillis) state.duration = durationMillis;
      state.isPlaying = isPlaying;
    },
    setSeekInProgress: (state, action) => { state.seekInProgress = action.payload; },
    updatePosition: (state, action) => { state.position = action.payload; },
    updateDuration: (state, action) => { state.duration = action.payload; },
    restoreState: (state, action) => {
      const { queue, queueIndex, position, repeatMode, isShuffle } = action.payload;
      state.queue = queue;
      state.queueIndex = queueIndex;
      state.currentTrack = queue[queueIndex] || null;
      state.position = position;
      state.repeatMode = repeatMode;
      state.isShuffle = isShuffle;
      state.status = 'paused';
    },
    replaceQueue: (state, action) => {
      const queue = Array.isArray(action.payload?.queue) ? action.payload.queue : [];
      const queueIndex = typeof action.payload?.queueIndex === 'number' ? action.payload.queueIndex : 0;
      const safeIndex = queue.length > 0 && queueIndex >= 0 && queueIndex < queue.length ? queueIndex : 0;
      state.queue = queue;
      state.queueIndex = safeIndex;
      state.currentTrack = queue[safeIndex] || null;
      state.originalQueue = queue.slice();
      state.isShuffle = false;
      state.position = 0;
      state.duration = 0;
      state.error = null;
      state.lastActionTS = Date.now();
    },
    setPlaybackDeviceId: (state, action) => {
      state.playbackDeviceId = action.payload;
    },
    setPlaybackDeviceInfo: (state, action) => {
      state.playbackDeviceId = action.payload?.id || null;
      state.playbackDeviceName = action.payload?.name || null;
    },
    setHistoryId: (state, action) => { state.historyId = action.payload; },
    clearHistoryId: (state) => { state.historyId = null; },
    adapterSwitched: (state, action) => {
      state.adapterType = action.payload.to;
      state.playbackSource = 'spotify_full';
      state.lastAdapterSwitch = Date.now();
    },
    setPlayerScreenVisible: (state, action) => {
      state.isPlayerScreenVisible = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(playTrack.fulfilled, (state, action) => {
        state.currentTrack = action.payload;
        state.status = 'playing';
        state.isPlaying = true;
        state.error = null;
      })
      .addCase(playTrack.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
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
      .addCase(setVolume.fulfilled, (state, action) => {
        state.volume = action.payload;
      })
      .addCase(stopTrack.fulfilled, (state) => {
        state.isPlaying = false;
        state.status = 'stopped';
        state.position = 0;
        state.duration = 0;
        state.currentTrack = null;
        state.historyId = null;
      })
      .addCase(loadQueue.fulfilled, (state, action) => {
        if (action.payload.tracks.length) {
          state.queue = action.payload.tracks;
          state.queueIndex = action.payload.startIndex;
        }
      })
      .addCase(playFromQueue.fulfilled, (state, action) => {
        if (action.payload) {
          state.queueIndex = action.payload.index;
          state.currentTrack = action.payload.track;
        }
      })
      .addCase(toggleShuffleMode.fulfilled, (state, action) => {
        if (!action.payload) return;
        const { isShuffle, queue, originalQueue, queueIndex } = action.payload;
        if (typeof isShuffle === 'boolean') state.isShuffle = isShuffle;
        if (queue) state.queue = queue;
        if (originalQueue) state.originalQueue = originalQueue;
        if (typeof queueIndex === 'number') state.queueIndex = queueIndex;
      })
      .addCase(persistPlaybackState.rejected, () => {})
      .addCase(restorePlaybackState.rejected, () => {})
      .addCase(restorePlaybackState.fulfilled, () => {});
    builder.addCase(ensurePlaybackAdapter.fulfilled, (state, action) => {
      if (action.payload?.type && state.adapterType !== action.payload.type) {
        state.adapterType = action.payload.type;
        state.playbackSource = 'spotify_full';
      }
    });
  },
});

export const {
  setLoading,
  setPlaying,
  setPaused,
  setRepeatMode,
  setSeekInProgress,
  updatePlaybackStatus,
  updatePosition,
  updateDuration,
  setTransitioning,
  restoreState,
  replaceQueue,
  setPlaybackDeviceId,
  setPlaybackDeviceInfo,
  setHistoryId,
  clearHistoryId,
  adapterSwitched,
  setPlayerScreenVisible,
} = playerSlice.actions;

export default playerSlice.reducer;

export { toggleRepeatMode as toggleRepeat, toggleShuffleMode as toggleShuffle };
