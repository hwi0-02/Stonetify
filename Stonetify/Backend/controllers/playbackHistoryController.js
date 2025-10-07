// Playback History Event Controller
// Provides endpoints for client to record playback lifecycle events.
// POST /api/spotify/playback/history/start { userId, track: { id, name, artists, uri }, playbackSource }
// POST /api/spotify/playback/history/complete { userId, historyId, positionMs, durationMs }
// Optionally used for skip by sending positionMs < durationMs.

const PlaybackHistoryModel = require('../models/playback_history');

function validateTrack(track){
  if(!track || !track.id || !track.name) throw new Error('track.id and track.name required');
}

exports.start = async (req,res) => {
  try {
    const { userId, track, playbackSource } = req.body || {};
    if(!userId) return res.status(400).json({ message: 'userId required' });
    validateTrack(track);
    const id = await PlaybackHistoryModel.createStart({ userId, track, playbackSource });
    res.json({ historyId: id });
  } catch(e){
    console.error('[PlaybackHistory][start]', e.message);
    res.status(500).json({ message: 'failed to start history' });
  }
};

exports.complete = async (req,res) => {
  try {
    const { userId, historyId, positionMs, durationMs } = req.body || {};
    if(!userId) return res.status(400).json({ message: 'userId required' });
    if(!historyId) return res.status(400).json({ message: 'historyId required' });
    await PlaybackHistoryModel.complete(historyId, { positionMs: positionMs || 0, durationMs: durationMs || null });
    res.json({ success: true });
  } catch(e){
    console.error('[PlaybackHistory][complete]', e.message);
    res.status(500).json({ message: 'failed to complete history' });
  }
};
