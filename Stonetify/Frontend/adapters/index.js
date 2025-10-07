// Adapter registry / manager
import PreviewAudioAdapter from './PreviewAudioAdapter';
import SpotifyRemoteAdapter from './SpotifyRemoteAdapter';
// Lightweight REST-based remote adapter (pre-native) using backend proxy endpoints
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
  async load(track, autoPlay = true) {
    this.currentTrack = track;
    const uris = track.uri ? [track.uri] : (track.id ? [`spotify:track:${track.id}`] : []);
    if (!uris.length) throw new Error('Track missing URI/id');
    await apiService.playRemote({ userId: this.userId, uris });
    if (!autoPlay) await apiService.pauseRemote(this.userId);
    this._startPolling();
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
let currentType = 'preview'; // 'preview' | 'spotify'

export function ensurePreviewAdapter() {
  if (!currentAdapter || currentType !== 'preview') {
    if (currentAdapter && currentAdapter.dispose) currentAdapter.dispose();
    currentAdapter = new PreviewAudioAdapter();
    currentType = 'preview';
  }
  return currentAdapter;
}

export function setAdapter(adapterInstance, type) {
  if (currentAdapter && currentAdapter.dispose) {
    try { currentAdapter.dispose(); } catch {}
  }
  currentAdapter = adapterInstance;
  currentType = type;
}

export function getAdapter() {
  if (!currentAdapter) return ensurePreviewAdapter();
  return currentAdapter;
}

export function getAdapterType() { return currentType; }

export function ensureSpotifyAdapter(accessToken) {
  if (currentType === 'spotify' && currentAdapter) return currentAdapter;
  const adapter = new SpotifyRemoteAdapter();
  adapter.connect(accessToken).catch(e => console.warn('Spotify adapter connect failed (stub)', e.message));
  setAdapter(adapter, 'spotify');
  return adapter;
}

export function ensureRestRemoteAdapter(userId) {
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
