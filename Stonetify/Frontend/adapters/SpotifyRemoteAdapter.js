// SpotifyRemoteAdapter (Phase C Stub)
// Placeholder: currently delegates to PreviewAudioAdapter logic until native SDK integration.
// Later: replace internal previewAdapter with real Spotify Remote SDK calls.

import PreviewAudioAdapter from './PreviewAudioAdapter';

export default class SpotifyRemoteAdapter {
  constructor() {
    this.previewFallback = new PreviewAudioAdapter();
    this.statusCb = null;
  }

  async connect(accessToken) {
    // TODO: Implement native SDK connection. For now, no-op.
    this.accessToken = accessToken;
  }

  async load(track, autoPlay = true) {
    // Temporary: delegate to preview (still 30s) until full SDK is wired.
    await this.previewFallback.load(track, autoPlay);
    this.previewFallback.onStatus((s) => this.statusCb && this.statusCb(s));
  }

  async play() { return this.previewFallback.play(); }
  async pause() { return this.previewFallback.pause(); }
  async stop() { return this.previewFallback.stop(); }
  async seek(ms) { return this.previewFallback.seek(ms); }
  async setVolume(v) { return this.previewFallback.setVolume(v); }
  onStatus(cb) { this.statusCb = cb; }
  async dispose() { return this.previewFallback.dispose(); }
}
