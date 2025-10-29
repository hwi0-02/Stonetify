// Backend/controllers/recommendationController.js

const asyncHandler = require('express-async-handler');

const { Playlist, User, Song, LikedPlaylist } = require('../models');
const { RealtimeDBHelpers, COLLECTIONS } = require('../config/firebase');

const { callGemini, isGeminiEnabled } = require('../utils/geminiClient');
const { buildUserProfile, collectCandidateTracks } = require('../utils/recommendationFeatureBuilder');
const {
  RECOMMENDATION_SYSTEM_PROMPT,
  buildUserPrompt,
  RECOMMENDATION_SCHEMA,
} = require('../utils/prompts/geminiRecommendationPrompt');

/* ----------------------------- 공용 유틸 ----------------------------- */

const shuffleArray = (array) => {
  const cloned = [...array];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
};

const toTs = (v) => (v ? new Date(v).getTime() : 0);

/* --------------------------- in-flight dedupe -------------------------- */
/** 동일 user+context로 동시 요청이 들어오면 한 번만 실행하고 Promise 공유 */
const inFlight = new Map();
const INFLIGHT_TTL = 30 * 1000; // 30s

const getInflightKey = (userId, params) =>
  `gemini:${userId}:${JSON.stringify(params || {})}`;

const withInflight = async (key, exec) => {
  if (inFlight.has(key)) return inFlight.get(key);
  const p = exec().finally(() => {
    setTimeout(() => inFlight.delete(key), INFLIGHT_TTL);
  });
  inFlight.set(key, p);
  return p;
};

/* -------------------------- 요약/정렬 보조 함수 ------------------------- */

const summarizePlaylist = async (playlist, viewerId = null) => {
  if (!playlist) return null;

  const [songsRaw, owner, likeCount, isLiked] = await Promise.all([
    Song.findByPlaylistId(playlist.id),
    User.findById(playlist.user_id),
    LikedPlaylist.getLikeCount(playlist.id),
    viewerId ? LikedPlaylist.isLiked(viewerId, playlist.id) : false,
  ]);

  const songs = songsRaw || [];
  const coverImages = songs
    .slice(0, 4)
    .map((song) => song && song.album_cover_url)
    .filter(Boolean);

  return {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description || '',
    user_id: playlist.user_id,
    user: owner
      ? {
          id: owner.id,
          display_name: owner.display_name,
          profile_image_url: owner.profile_image_url || owner.profile_image || null,
        }
      : null,
    cover_images: coverImages,
    cover_image_url: coverImages[0] || null,
    songCount: songs.length,
    likeCount,
    isLiked: Boolean(isLiked),
    created_at: playlist.created_at || null,
  };
};

const buildArtistFrequency = async (playlistIds) => {
  const frequency = {};
  if (!playlistIds || !playlistIds.length) return frequency;

  const songsLists = await Promise.all(playlistIds.map((id) => Song.findByPlaylistId(id)));
  songsLists.flat().forEach((song) => {
    if (!song || !song.artist) return;
    const artists = String(song.artist)
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    artists.forEach((artistName) => {
      frequency[artistName] = (frequency[artistName] || 0) + 1;
    });
  });
  return frequency;
};

/* ----------------------------- 캐시 (메모리) ---------------------------- */

const recommendationCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10분

const getCacheKey = (userId, context) => {
  return `${userId}:${JSON.stringify(context || {})}`;
};

/* ----------------------------- 컨트롤러들 ------------------------------ */

// 사용자 기반 추천 플레이리스트 (For You)
const getRecommendedPlaylists = asyncHandler(async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const likedRelations = await LikedPlaylist.findByUserId(userId);
  const likedPlaylistIds = (likedRelations || []).map((like) => like.playlist_id);

  const allPublic = await Playlist.findPublicPlaylists();
  const candidatePlaylists = (allPublic || []).filter(
    (playlist) => playlist.user_id !== userId && !likedPlaylistIds.includes(playlist.id)
  );

  const artistFrequency = await buildArtistFrequency(likedPlaylistIds);

  let scoredPlaylists = [];
  if (Object.keys(artistFrequency).length > 0) {
    scoredPlaylists = await Promise.all(
      candidatePlaylists.map(async (playlist) => {
        const songs = (await Song.findByPlaylistId(playlist.id)) || [];
        const seenArtists = new Set();
        let score = 0;

        songs.forEach((song) => {
          if (!song || !song.artist) return;
          const artists = String(song.artist)
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean);
          artists.forEach((artistName) => {
            if (artistFrequency[artistName] && !seenArtists.has(artistName)) {
              score += artistFrequency[artistName];
              seenArtists.add(artistName);
            }
          });
        });

        return { playlist, score };
      })
    );
  }

  const meaningful = scoredPlaylists.filter((item) => item.score > 0);
  let selectedPlaylists;

  if (meaningful.length > 0) {
    selectedPlaylists = meaningful
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((item) => item.playlist);
  } else {
    selectedPlaylists = shuffleArray(candidatePlaylists).slice(0, 12);
  }

  const summaries = await Promise.all(selectedPlaylists.map((playlist) => summarizePlaylist(playlist, userId)));
  res.status(200).json(summaries.filter(Boolean));
});

// 유사한 사용자 기반 추천 (좋아요 겹치는 사용자)
const getSimilarUsers = asyncHandler(async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const allLikes = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.LIKED_PLAYLISTS);
  const myLikes = (allLikes || []).filter((like) => like.user_id === userId);
  if (!myLikes.length) {
    return res.status(200).json([]);
  }

  const likedSet = new Set(myLikes.map((like) => like.playlist_id));

  const overlapMap = new Map();
  (allLikes || []).forEach((like) => {
    if (like.user_id === userId) return;
    if (likedSet.has(like.playlist_id)) {
      overlapMap.set(like.user_id, (overlapMap.get(like.user_id) || 0) + 1);
    }
  });

  const similarUserIds = Array.from(overlapMap.keys());
  if (!similarUserIds.length) {
    return res.status(200).json([]);
  }

  const users = await Promise.all(similarUserIds.map((id) => User.findById(id)));
  const enriched = users
    .filter(Boolean)
    .map((user) => ({
      id: user.id,
      display_name: user.display_name,
      profile_image_url: user.profile_image_url || user.profile_image || null,
      overlapCount: overlapMap.get(user.id) || 0,
    }))
    .sort((a, b) => b.overlapCount - a.overlapCount)
    .slice(0, 10);

  res.status(200).json(enriched);
});

// 트렌딩 플레이리스트 (좋아요 수 기준 Top N)
const getTrendingPlaylists = asyncHandler(async (req, res) => {
  const viewerId = (req.user && req.user.id) || null;

  const publicPlaylists = await Playlist.findPublicPlaylists();
  const summaries = await Promise.all((publicPlaylists || []).map((playlist) => summarizePlaylist(playlist, viewerId)));

  const sorted = summaries
    .filter(Boolean)
    .sort((a, b) => {
      const la = a.likeCount || 0;
      const lb = b.likeCount || 0;
      if (lb !== la) return lb - la;
      return toTs(b.created_at) - toTs(a.created_at);
    })
    .slice(0, 20);

  res.status(200).json(sorted);
});

/* --------------------------- Gemini 기반 추천 --------------------------- */

// 입력 값 화이트리스트 (선택)
const pick = (v, allow) => (allow.includes(v) ? v : undefined);
const moodAllow = ['focus', 'chill', 'happy', 'sad', 'workout', 'party'];
const actAllow = ['study', 'drive', 'run', 'walk', 'read', 'cook'];

const getGeminiRecommendations = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const userId = req.user.id;

  const raw = req.method === 'POST' ? (req.body || {}) : (req.query || {});
  const mood = pick(raw.mood, moodAllow) || undefined;
  const activity = pick(raw.activity, actAllow) || undefined;

  // Gemini 비활성화 시 fallback
  if (!isGeminiEnabled()) {
    console.log('[Gemini] Disabled, falling back to traditional recommendations');
    return getRecommendedPlaylists(req, res);
  }

  // 캐시 확인
  const cacheKey = getCacheKey(userId, { mood, activity });
  const cached = recommendationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[Gemini] Returning cached recommendations');
    return res.status(200).json(cached.data);
  }

  try {
    const inflightKey = getInflightKey(userId, { mood, activity });

    const data = await withInflight(inflightKey, async () => {
      console.log('[Gemini] Starting recommendation for user:', userId);

      // 1) 사용자 프로필 수집
      const userProfile = await buildUserProfile(userId);
      console.log('[Gemini] User profile built:', {
        topArtists: userProfile.topArtists?.length || 0,
        topGenres: userProfile.topGenres?.length || 0,
        recentTracks: userProfile.recentTracks?.length || 0,
      });

      // 2) 후보 곡 수집
      const candidates = await collectCandidateTracks(userId, { limit: 10 });
      console.log('[Gemini] Candidates collected:', candidates.length);

      if (!candidates.length) return null; // 나중에 fallback

      // 3) 프롬프트 구성
      const systemPrompt = RECOMMENDATION_SYSTEM_PROMPT;
      const userPrompt = buildUserPrompt({
        userProfile,
        candidates,
        context: { mood, activity },
      });

      // 4) Gemini 호출
      const geminiResponse = await callGemini({
        systemPrompt,
        userPrompt,
        responseSchema: RECOMMENDATION_SCHEMA,
      });

      if (!geminiResponse?.tracks || !Array.isArray(geminiResponse.tracks)) {
        throw new Error('Invalid Gemini response format');
      }

      // 5) 후보와 매핑 + 후처리(중복/길이 제한)
      const seen = new Set();
      const recommendedTracks = geminiResponse.tracks
        .filter((t) => t && t.spotifyId)
        .filter((t) => {
          if (seen.has(t.spotifyId)) return false;
          seen.add(t.spotifyId);
          return true;
        })
        .map((g) => {
          const c = candidates.find((x) => x.spotify_id === g.spotifyId);
          if (!c) {
            console.warn(`[Gemini] Track not found in candidates: ${g.spotifyId}`);
            return null;
          }
          return {
            id: c.spotify_id,
            spotify_id: c.spotify_id,
            title: c.title,
            artist: c.artist,
            album: c.album,
            album_cover_url: c.album_cover_url,
            preview_url: c.preview_url,
            reason: String(g.reason || '').slice(0, 200),
            playlist: { id: c.playlistId, title: c.playlistTitle },
          };
        })
        .filter(Boolean);

      return {
        tracks: recommendedTracks,
        summary: geminiResponse.summary || '',
        followUpQuestion: geminiResponse.followUpQuestion || null,
        source: 'gemini',
      };
    });

    if (!data) {
      console.log('[Gemini] No candidates → fallback to traditional');
      return getRecommendedPlaylists(req, res);
    }

    // 캐시 저장 (최대 100개)
    recommendationCache.set(cacheKey, { data, timestamp: Date.now() });
    if (recommendationCache.size > 100) {
      const firstKey = recommendationCache.keys().next().value;
      recommendationCache.delete(firstKey);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[Gemini] Recommendation error:', error.message);
    console.error('[Gemini] Error stack:', error.stack);
    const note = [
      `user=${userId}`,
      `mood=${mood || '-'}`,
      `activity=${activity || '-'}`,
      error.response ? `status=${error.response.status}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    console.warn('[Gemini] FALLBACK', note);

    // Gemini 실패 시 기존 추천으로 fallback
    return getRecommendedPlaylists(req, res);
  }
});

// 추천 피드백 저장
const postRecommendationFeedback = asyncHandler(async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { trackId, action, context } = req.body || {};

  if (!trackId || !action) {
    return res.status(400).json({ message: 'trackId and action are required' });
  }

  const validActions = ['like', 'skip', 'play'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ message: 'Invalid action' });
  }

  try {
    const feedbackData = {
      user_id: userId,
      track_id: trackId,
      action,
      context: context || {},
      created_at: Date.now(),
    };

    // Firebase에 피드백 저장
    await RealtimeDBHelpers.createDocument('recommendations_feedback', feedbackData);

    res.status(200).json({
      message: 'Feedback saved successfully',
      feedback: feedbackData,
    });
  } catch (error) {
    console.error('[Feedback] Error saving feedback:', error);
    res.status(500).json({ message: 'Failed to save feedback' });
  }
});

module.exports = {
  getRecommendedPlaylists,
  getSimilarUsers,
  getTrendingPlaylists,
  getGeminiRecommendations,
  postRecommendationFeedback,
};
