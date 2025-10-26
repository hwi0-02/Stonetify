// 재생 기록 컨트롤러
// 클라이언트가 재생 시작/완료 이벤트를 기록할 수 있도록 API를 제공한다.
// POST /api/spotify/playback/history/start { userId, track: { id, name, artists, uri }, playbackSource }
// POST /api/spotify/playback/history/complete { userId, historyId, positionMs, durationMs }
// positionMs < durationMs로 전달하면 중간에 넘김(스킵)한 것으로 간주한다.

const PlaybackHistoryModel = require('../models/playback_history');

function validateTrack(track){
  if(!track || !track.id || !track.name) throw new Error('track.id and track.name required');
  
  // track.id가 Spotify ID(22자리 영문자/숫자) 또는 spotify:track: URI인지 확인한다.
  // Firebase에서 생성된 ID는 '-'나 '_'를 포함하므로 Spotify에서 사용할 수 없다.
  const isSpotifyUri = track.id?.startsWith('spotify:track:');
  const isSpotifyId = /^[a-zA-Z0-9]{22}$/.test(track.id);
  
  if (!isSpotifyUri && !isSpotifyId) {
    throw new Error(`Invalid Spotify track ID format: ${track.id}. Expected 22-char alphanumeric ID or spotify:track: URI`);
  }
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
