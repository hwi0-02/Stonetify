// PreviewAudioAdapter - Phase B preparation
// Wraps expo-audio Sound logic behind a simple adapter interface so we can later
// swap in a SpotifyRemoteAdapter without touching Redux slice logic heavily.
// For now this is a thin abstraction around a single Sound instance.

import { Audio } from 'expo-audio';

/**
 * @typedef {Object} PlaybackStatus
 * @property {number} positionMillis
 * @property {number} durationMillis
 * @property {boolean} isPlaying
 * @property {boolean} didJustFinish
 */

/**
 * @callback StatusCallback
 * @param {PlaybackStatus} status
 */

export default class PreviewAudioAdapter {
  constructor() {
    this.sound = null;
    this.statusCb = null;
  }

  /**
   * Load a track preview.
   * @param {Object} track Spotify track object (must contain preview_url)
   * @param {boolean} autoPlay
   */
  async load(track, autoPlay = true, _options = {}) {
    await this.dispose();
    if (!track?.preview_url) throw new Error('No preview_url');
    const { sound } = await Audio.Sound.createAsync(
      { uri: track.preview_url },
      { shouldPlay: !!autoPlay }
    );
    this.sound = sound;
    this.sound.setOnPlaybackStatusUpdate((st) => {
      if (!st.isLoaded) return;
      if (this.statusCb) {
        this.statusCb({
          positionMillis: st.positionMillis || 0,
            durationMillis: st.durationMillis || 0,
          isPlaying: st.isPlaying || false,
          didJustFinish: !!st.didJustFinish,
        });
      }
    });
  }

  async play() {
    if (!this.sound) return;
    await this.sound.playAsync();
  }

  async pause() {
    if (!this.sound) return;
    await this.sound.pauseAsync();
  }

  async stop() {
    if (!this.sound) return;
    try { await this.sound.stopAsync(); } catch {}
  }

  async seek(ms) {
    if (!this.sound) return;
    await this.sound.setPositionAsync(ms);
  }

  async setVolume(v) {
    if (!this.sound) return;
    await this.sound.setVolumeAsync(v);
  }

  onStatus(cb) { this.statusCb = cb; }

  async dispose() {
    if (this.sound) {
      try { await this.sound.unloadAsync(); } catch {}
      this.sound.setOnPlaybackStatusUpdate(null);
      this.sound = null;
    }
  }
}
