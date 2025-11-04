// Adapter registry / manager
// Lightweight REST-based remote adapter using backend proxy endpoints
import apiService from '../../Frontend/services/apiService';

class RestRemoteAdapter {
  constructor(userId) {
    this.userId = userId;
    this.statusCb = null;
    this.pollInterval = null;
    this.currentTrack = null;
    this._suspended = false;
  }
  async connect() {
    // no-op: backend handles token refresh
  }
  async load(track, autoPlay = true, options = {}) {
    this.currentTrack = track;
    const deviceId = options?.deviceId || null;
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
    
    try {
      await apiService.playRemote({ userId: this.userId, uris, device_id: deviceId });
      if (!autoPlay) await apiService.pauseRemote(this.userId);
      this._startPolling();
    } catch (error) {
      // Handle TOKEN_REVOKED error
      if (error.code === 'TOKEN_REVOKED' || error.response?.data?.error === 'TOKEN_REVOKED') {
        console.error('🔴 [RestRemoteAdapter] Spotify token revoked');
        const revokedError = new Error(
          'Spotify 연결이 만료되었습니다.\n\n' +
          '프로필 화면에서 Spotify를 다시 연결해주세요.'
        );
        revokedError.code = 'TOKEN_REVOKED';
        revokedError.requiresReauth = true;
        throw revokedError;
      }
      
      // Handle NO_ACTIVE_DEVICE error specifically
      if (error.response?.data?.error === 'NO_ACTIVE_DEVICE') {
        const userFriendlyError = new Error(
          'Spotify 재생 장치를 찾을 수 없습니다.\n\n' +
          '휴대폰, 컴퓨터 또는 스피커에서 Spotify 앱을 먼저 열어주세요.'
        );
        userFriendlyError.code = 'NO_ACTIVE_DEVICE';
        throw userFriendlyError;
      }
      throw error;
    }
  }
  async play() { await apiService.playRemote({ userId: this.userId }); this.resumePolling(); }
  async pause() { await apiService.pauseRemote(this.userId); this.suspendPolling(); }
  async stop() { await apiService.pauseRemote(this.userId); this._stopPolling(); }
  async seek(ms) { await apiService.seekRemote({ userId: this.userId, position_ms: ms }); }
  async setVolume(v) { await apiService.setRemoteVolume({ userId: this.userId, volume_percent: Math.round(v * 100) }); }
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
        // silent; polling error not fatal
      }
    }, 2500); // remote polling every 2.5s (lighter than preview 250ms push)
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
