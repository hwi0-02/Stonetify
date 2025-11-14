// Adapter registry / manager
// Lightweight REST-based remote adapter using backend proxy endpoints
import apiService from '../../Frontend/services/apiService';
import store from '../../Frontend/store/store';
import { refreshSpotifyToken } from '../../Frontend/store/slices/spotifySlice';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage key for last used device
const LAST_DEVICE_KEY = '@stonetify_last_playback_device';

// Helper functions for device persistence
async function getLastUsedDevice(userId) {
  try {
    const key = `${LAST_DEVICE_KEY}:${userId}`;
    const deviceData = await AsyncStorage.getItem(key);
    if (deviceData) {
      const device = JSON.parse(deviceData);
      console.log('📱 [DevicePersistence] Retrieved last used device:', device);
      return device;
    }
  } catch (error) {
    console.warn('⚠️ [DevicePersistence] Failed to retrieve last device:', error.message);
  }
  return null;
}

async function saveLastUsedDevice(userId, deviceId, deviceName) {
  try {
    const key = `${LAST_DEVICE_KEY}:${userId}`;
    const deviceData = {
      id: deviceId,
      name: deviceName,
      timestamp: Date.now()
    };
    await AsyncStorage.setItem(key, JSON.stringify(deviceData));
    console.log('💾 [DevicePersistence] Saved last used device:', deviceData);
  } catch (error) {
    console.warn('⚠️ [DevicePersistence] Failed to save last device:', error.message);
  }
}

class RestRemoteAdapter {
  constructor(userId) {
    this.userId = userId;
    this.statusCb = null;
    this.pollInterval = null;
    this.currentTrack = null;
    this._suspended = false;
    this.retryCount = 0;
    this.maxRetries = 1; // Only retry once for token refresh
    this.lastUsedDeviceId = null;
  }
  async connect() {
    // no-op: backend handles token refresh
  }
  async _refreshTokenAndRetry(retryFn) {
    if (this.retryCount >= this.maxRetries) {
      console.error('🔴 [RestRemoteAdapter] Max retry attempts reached');
      throw new Error('토큰 갱신 재시도 횟수를 초과했습니다.');
    }

    console.log('🔄 [RestRemoteAdapter] Attempting to refresh token...');
    this.retryCount++;

    try {
      await store.dispatch(refreshSpotifyToken()).unwrap();
      console.log('✅ [RestRemoteAdapter] Token refreshed successfully, retrying original request');
      this.retryCount = 0; // Reset on success
      return await retryFn();
    } catch (refreshError) {
      console.error('🔴 [RestRemoteAdapter] Token refresh failed:', refreshError);
      this.retryCount = 0; // Reset for next attempt

      // Re-throw with proper error code
      const error = new Error(
        refreshError?.message ||
        'Spotify 연결이 만료되었습니다.\n프로필에서 Spotify를 다시 연결해주세요.'
      );
      error.code = 'TOKEN_REVOKED';
      error.requiresReauth = true;
      throw error;
    }
  }
  async load(track, autoPlay = true, options = {}) {
    this.currentTrack = track;
    let deviceId = options?.deviceId || null;
    let selectedDeviceName = null;

    // Extract Spotify ID (prioritize spotify_id over id to avoid Firebase IDs)
    const spotifyId = track.spotify_id || track.spotifyId || (track.id && !track.id.startsWith('-') ? track.id : null);
    const uris = track.uri ? [track.uri] : (spotifyId ? [`spotify:track:${spotifyId}`] : []);

    if (!uris.length) {
      console.error('❌ [RestRemoteAdapter] Track missing valid Spotify URI/ID:', track);
      throw new Error('Track missing valid Spotify URI/ID');
    }

    // Validate URI format before sending
    if (uris[0].includes('-O_') || uris[0].startsWith('spotify:track:-')) {
      console.error('❌ [RestRemoteAdapter] Invalid Firebase ID detected in URI:', uris[0]);
      throw new Error(`Invalid track ID format detected: ${uris[0]}`);
    }

    // 디바이스가 지정되지 않은 경우, 자동으로 최적의 디바이스 선택
    if (!deviceId) {
      try {
        console.log('🔍 [RestRemoteAdapter] Fetching available devices...');
        const devicesData = await apiService.getRemoteDevices(this.userId);
        const devices = devicesData?.devices || [];

        if (devices.length > 0) {
          // 우선순위: 1. 마지막으로 사용한 기기 2. 활성 모바일 3. 모바일 4. 활성 디바이스 5. 첫 번째 디바이스
          let selectedDevice = null;

          // 0. 마지막으로 사용한 기기 확인
          const lastDevice = await getLastUsedDevice(this.userId);
          if (lastDevice?.id) {
            selectedDevice = devices.find(d => d.id === lastDevice.id);
            if (selectedDevice) {
              console.log('🎯 [RestRemoteAdapter] Using last used device:', {
                name: selectedDevice.name,
                type: selectedDevice.type,
                isActive: selectedDevice.is_active,
                id: selectedDevice.id
              });
            } else {
              console.log('⚠️ [RestRemoteAdapter] Last used device not available, selecting new device');
            }
          }

          // 1. 활성 상태의 모바일 디바이스 찾기
          if (!selectedDevice) {
            selectedDevice = devices.find(d => d.is_active && d.type === 'Smartphone');
          }

          // 2. 활성이 아니더라도 모바일 디바이스 찾기
          if (!selectedDevice) {
            selectedDevice = devices.find(d => d.type === 'Smartphone');
          }

          // 3. 현재 활성 디바이스 사용
          if (!selectedDevice) {
            selectedDevice = devices.find(d => d.is_active);
          }

          // 4. 첫 번째 사용 가능한 디바이스
          if (!selectedDevice) {
            selectedDevice = devices[0];
          }

          if (selectedDevice) {
            deviceId = selectedDevice.id;
            selectedDeviceName = selectedDevice.name;
            console.log('✅ [RestRemoteAdapter] Selected device:', {
              name: selectedDevice.name,
              type: selectedDevice.type,
              isActive: selectedDevice.is_active,
              id: selectedDevice.id
            });

            // 선택된 디바이스가 활성이 아니면 강제로 전환
            if (!selectedDevice.is_active) {
              console.log('🔄 [RestRemoteAdapter] Forcefully transferring playback to selected device...');
              try {
                // play: true로 강제 활성화
                await apiService.transferRemotePlayback({
                  userId: this.userId,
                  device_id: deviceId,
                  play: true // 강제로 활성화
                });
                console.log('✅ [RestRemoteAdapter] Forcefully activated device');
                // 디바이스 전환 후 잠시 대기
                await new Promise(resolve => setTimeout(resolve, 800));
                // 일시정지하여 디바이스는 활성 상태 유지
                try {
                  await apiService.pauseRemote(this.userId);
                  console.log('✅ [RestRemoteAdapter] Paused to keep device active');
                } catch (pauseError) {
                  console.warn('⚠️ [RestRemoteAdapter] Pause failed (non-fatal):', pauseError.message);
                }
              } catch (transferError) {
                console.warn('⚠️ [RestRemoteAdapter] Device transfer failed, will try direct play:', transferError.message);
              }
            } else {
              console.log('✅ [RestRemoteAdapter] Device already active');
            }
          }
        }
      } catch (devicesError) {
        console.warn('⚠️ [RestRemoteAdapter] Failed to fetch devices, will try without device_id:', devicesError.message);
      }
    }

    const executeLoad = async () => {
      await apiService.playRemote({ userId: this.userId, uris, device_id: deviceId });
      if (!autoPlay) await apiService.pauseRemote(this.userId);
      this._startPolling();

      // 재생 성공 시 사용된 기기 저장
      if (deviceId) {
        this.lastUsedDeviceId = deviceId;
        await saveLastUsedDevice(this.userId, deviceId, selectedDeviceName);

        // Redux 상태에도 저장
        const playerSlice = await import('../../Frontend/store/slices/playerSlice');
        store.dispatch(playerSlice.setPlaybackDeviceInfo({
          id: deviceId,
          name: selectedDeviceName
        }));
      }
    };

    try {
      await executeLoad();
    } catch (error) {
      console.error('🔴 [RestRemoteAdapter] Playback error:', {
        message: error.message,
        code: error.code,
        responseData: error.response?.data,
        status: error.response?.status
      });

      // Handle TOKEN_REVOKED error - try to refresh and retry once
      if ((error.response?.status === 401 || error.code === 'TOKEN_REVOKED' ||
          error.response?.data?.error === 'TOKEN_REVOKED' ||
          error.response?.data?.requiresReauth) && this.retryCount === 0) {
        console.log('🔄 [RestRemoteAdapter] Token error detected, attempting refresh and retry...');
        try {
          return await this._refreshTokenAndRetry(executeLoad);
        } catch (retryError) {
          console.error('🔴 [RestRemoteAdapter] Refresh and retry failed');
          throw retryError;
        }
      }

      // Handle NO_ACTIVE_DEVICE error specifically
      if (error.response?.data?.error === 'NO_ACTIVE_DEVICE') {
        const userFriendlyError = new Error(
          'Spotify 재생 장치를 찾을 수 없습니다.\n\n' +
          '1. 모바일에서 Spotify 앱을 열어주세요\n' +
          '2. 아무 곡이나 재생한 후 정지해주세요\n' +
          '3. 다시 Stonetify에서 재생해보세요'
        );
        userFriendlyError.code = 'NO_ACTIVE_DEVICE';
        throw userFriendlyError;
      }

      // Re-throw with user-friendly message
      const friendlyError = new Error(error.response?.data?.message || error.message || '재생 중 오류가 발생했습니다.');
      friendlyError.code = error.code || error.response?.data?.error;
      throw friendlyError;
    } finally {
      this.retryCount = 0; // Always reset retry count after operation
    }
  }
  async play() {
    const executePlay = async () => {
      await apiService.playRemote({ userId: this.userId });
      this.resumePolling();
    };

    try {
      await executePlay();
    } catch (error) {
      if (this._shouldRetryForTokenError(error)) {
        return await this._refreshTokenAndRetry(executePlay);
      }
      throw error;
    } finally {
      this.retryCount = 0;
    }
  }
  async pause() {
    const executePause = async () => {
      await apiService.pauseRemote(this.userId);
      this.suspendPolling();
    };

    try {
      await executePause();
    } catch (error) {
      if (this._shouldRetryForTokenError(error)) {
        return await this._refreshTokenAndRetry(executePause);
      }
      throw error;
    } finally {
      this.retryCount = 0;
    }
  }
  async stop() {
    const executeStop = async () => {
      await apiService.pauseRemote(this.userId);
      this._stopPolling();
    };

    try {
      await executeStop();
    } catch (error) {
      if (this._shouldRetryForTokenError(error)) {
        return await this._refreshTokenAndRetry(executeStop);
      }
      throw error;
    } finally {
      this.retryCount = 0;
    }
  }
  async seek(ms) {
    const executeSeek = async () => {
      await apiService.seekRemote({ userId: this.userId, position_ms: ms });
    };

    try {
      await executeSeek();
    } catch (error) {
      if (this._shouldRetryForTokenError(error)) {
        return await this._refreshTokenAndRetry(executeSeek);
      }
      throw error;
    } finally {
      this.retryCount = 0;
    }
  }
  async setVolume(v) {
    const executeSetVolume = async () => {
      await apiService.setRemoteVolume({ userId: this.userId, volume_percent: Math.round(v * 100) });
    };

    try {
      await executeSetVolume();
    } catch (error) {
      if (this._shouldRetryForTokenError(error)) {
        return await this._refreshTokenAndRetry(executeSetVolume);
      }
      throw error;
    } finally {
      this.retryCount = 0;
    }
  }
  _shouldRetryForTokenError(error) {
    return (
      this.retryCount === 0 &&
      (error.response?.status === 401 ||
        error.code === 'TOKEN_REVOKED' ||
        error.response?.data?.error === 'TOKEN_REVOKED' ||
        error.response?.data?.requiresReauth)
    );
  }
  onStatus(cb) { this.statusCb = cb; }
  async dispose() { this._stopPolling(); }
  _startPolling() {
    this._stopPolling();
    this.pollInterval = setInterval(async () => {
      if (this._suspended) return;
      try {
        const state = await apiService.getPlaybackState(this.userId);
        if (state && state.item) {
          const pos = state.progress_ms || 0;
          const dur = state.item.duration_ms || 0;
          const playing = !!state.is_playing;
          const finished = !playing && pos >= dur - 500 && dur > 0;
          if (this.statusCb) {
            this.statusCb({ positionMillis: pos, durationMillis: dur, isPlaying: playing, didJustFinish: finished });
          }
        }
      } catch (e) {
        // Handle TOKEN_REVOKED in polling - stop polling silently
        if (e.code === 'TOKEN_REVOKED' || e.response?.data?.error === 'TOKEN_REVOKED') {
          console.warn('⚠️ [RestRemoteAdapter] Token revoked during polling, stopping...');
          this._stopPolling();
          return;
        }
        // silent; other polling errors not fatal
        console.warn('⚠️ [RestRemoteAdapter] Polling error (non-fatal):', e.message);
      }
    }, 1000); // remote polling every 1s for smoother progress bar
  }
  _stopPolling() { if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; } }
  suspendPolling() { this._suspended = true; }
  resumePolling() { this._suspended = false; }
}

let currentAdapter = null;
let currentType = 'spotify_rest'; // only 'spotify_rest'

export function setAdapter(adapterInstance, type) {
  if (currentAdapter && currentAdapter.dispose) {
    try { currentAdapter.dispose(); } catch {}
  }
  currentAdapter = adapterInstance;
  currentType = type;
}

export function getAdapter() {
  return currentAdapter;
}

export function getAdapterType() { return currentType; }

export function ensureSpotifyAdapter(userId) {
  if (currentType === 'spotify_rest' && currentAdapter) return currentAdapter;
  const adapter = new RestRemoteAdapter(userId);
  adapter.connect();
  setAdapter(adapter, 'spotify_rest');
  return adapter;
}

// Global helpers for polling control (used by AppState listeners)
export function suspendAdapterPolling() {
  const a = getAdapter();
  if (a && typeof a.suspendPolling === 'function') a.suspendPolling();
}
export function resumeAdapterPolling() {
  const a = getAdapter();
  if (a && typeof a.resumePolling === 'function') a.resumePolling();
}
