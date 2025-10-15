// 재생 기록 컨트롤러
// 클라이언트가 재생 시작/완료 이벤트를 기록할 수 있도록 API를 제공한다.
// POST /api/spotify/playback/history/start { userId, track: { id, name, artists, uri }, playbackSource }
// POST /api/spotify/playback/history/complete { userId, historyId, positionMs, durationMs }
// positionMs < durationMs로 전달하면 중간에 넘김(스킵)한 것으로 간주한다.

const asyncHandler = require('express-async-handler');
const PlaybackHistoryModel = require('../models/playback_history');
const { successResponse } = require('../utils/responses');
const { ApiError } = require('../utils/errors');
const { logger } = require('../utils/logger');

const isValidSpotifyTrackId = (trackId) => {
  if (!trackId) return false;
  if (trackId.startsWith('spotify:track:')) {
    const segments = trackId.split(':');
    return segments.length === 3 && /^[a-zA-Z0-9]{22}$/.test(segments[2]);
  }
  return /^[a-zA-Z0-9]{22}$/.test(trackId);
};

const startPlaybackHistory = asyncHandler(async (req, res) => {
  const { userId, track, playbackSource } = req.body || {};

  if (!userId) {
    throw ApiError.badRequest('userId가 필요합니다.', [{ field: 'userId' }]);
  }
  if (!track) {
    throw ApiError.badRequest('track 정보가 필요합니다.', [{ field: 'track' }]);
  }
  if (!isValidSpotifyTrackId(track.id)) {
    throw ApiError.badRequest('유효한 Spotify 트랙 ID가 아닙니다.', [{ field: 'track.id' }]);
  }
  if (!track.name) {
    throw ApiError.badRequest('트랙 이름이 필요합니다.', [{ field: 'track.name' }]);
  }

  const id = await PlaybackHistoryModel.createStart({ userId, track, playbackSource });
  logger.info('Playback history started', { userId, historyId: id, trackId: track.id });

  successResponse(res, {
    statusCode: 201,
    data: { historyId: id },
    message: '재생 기록이 시작되었습니다.',
  });
});

const completePlaybackHistory = asyncHandler(async (req, res) => {
  const { userId, historyId, positionMs, durationMs } = req.body || {};

  if (!userId) {
    throw ApiError.badRequest('userId가 필요합니다.', [{ field: 'userId' }]);
  }
  if (!historyId) {
    throw ApiError.badRequest('historyId가 필요합니다.', [{ field: 'historyId' }]);
  }

  await PlaybackHistoryModel.complete(historyId, {
    positionMs: positionMs ?? 0,
    durationMs: durationMs ?? null,
  });
  logger.debug('Playback history completed', { userId, historyId, positionMs, durationMs });

  successResponse(res, {
    message: '재생 기록이 완료되었습니다.',
  });
});

module.exports = {
  start: startPlaybackHistory,
  complete: completePlaybackHistory,
};
