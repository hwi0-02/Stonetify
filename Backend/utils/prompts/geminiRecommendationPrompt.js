/**
 * Gemini 추천 프롬프트 템플릿
 */

const RECOMMENDATION_SYSTEM_PROMPT = `You are a music curator AI for Stonetify.

CRITICAL: You MUST respond with ONLY valid JSON. No other text before or after the JSON.

Your task:
1. Analyze user's music taste
2. Select up to 4 tracks from the candidate list
3. Provide personalized reasons in Korean

Response format (MUST be valid JSON):
{
  "tracks": [
    {
      "spotifyId": "exact spotify_id from candidates",
      "reason": "Korean explanation (1-2 sentences)"
    }
  ],
  "summary": "Overall curation summary in Korean (1-2 sentences)",
  "followUpQuestion": "Optional follow-up question in Korean"
}

Rules:
- Use ONLY spotifyId values from the provided candidate list
- Write all text fields in Korean
- Keep responses concise and natural
- Return ONLY the JSON object, nothing else`;

/**
 * 사용자 프롬프트 생성 함수
 * @param {Object} params
 * @param {Object} params.userProfile - 사용자 프로필 정보
 * @param {Array} params.candidates - 후보 곡 목록
 * @param {Object} params.context - 추가 컨텍스트 (mood, activity 등)
 * @returns {string} 사용자 프롬프트
 */
function buildUserPrompt({ userProfile, candidates, context = {} }) {
    const sections = [];

    // 1. 사용자 프로필
    sections.push('## 사용자 정보');
    if (userProfile.topArtists?.length) {
        sections.push(`- 선호 아티스트: ${userProfile.topArtists.slice(0, 5).join(', ')}`);
    }
    if (userProfile.topGenres?.length) {
        sections.push(`- 선호 장르: ${userProfile.topGenres.slice(0, 5).join(', ')}`);
    }
    if (userProfile.recentTracks?.length) {
        sections.push(`- 최근 재생: ${userProfile.recentTracks
            .slice(0, 3)
            .map(t => `${t.title} - ${t.artist}`)
            .join(', ')}`);
    }

    // 2. 컨텍스트
    if (context.mood || context.activity) {
        sections.push('\n## 현재 상황');
        if (context.mood) sections.push(`- 분위기: ${context.mood}`);
        if (context.activity) sections.push(`- 활동: ${context.activity}`);
    }

    // 3. 후보 곡 목록
    sections.push('\n## 추천 후보 곡 목록');
    candidates.forEach((track, idx) => {
        sections.push(
            `${idx + 1}. [${track.spotify_id}] ${track.title} - ${track.artist}` +
                (track.album ? ` (${track.album})` : '')
        );
    });

    // 4. 요청사항
    sections.push('\n## 요청');
    sections.push('위 목록에서 사용자에게 가장 어울리는 곡을 최대 4곡 선택하고, 이유를 포함한 JSON 형식으로 응답해주세요.');

    return sections.join('\n');
}

/**
 * JSON 스키마 정의
 */
const RECOMMENDATION_SCHEMA = {
    type: 'object',
    required: ['tracks', 'summary'],
    properties: {
        tracks: {
            type: 'array',
            items: {
                type: 'object',
                required: ['spotifyId', 'reason'],
                properties: {
                    spotifyId: { type: 'string' },
                    reason: { type: 'string' },
                },
            },
            maxItems: 4, // ✅ 줄임
            minItems: 1,
        },
        summary: { type: 'string', minLength: 10 },
        followUpQuestion: { type: 'string' },
    },
};

module.exports = {
    RECOMMENDATION_SYSTEM_PROMPT,
    buildUserPrompt,
    RECOMMENDATION_SCHEMA,
};
