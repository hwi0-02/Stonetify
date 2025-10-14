#!/usr/bin/env node
/*
 * Spotify 액세스 토큰을 Web API로 검증하는 간단한 도구입니다.
 *
 * 사용법:
 *   SPOTIFY_TEST_ACCESS_TOKEN="<token>" node scripts/testSpotifyToken.js
 *   # 다른 엔드포인트를 지정하려면
 *   SPOTIFY_TEST_ACCESS_TOKEN="<token>" node scripts/testSpotifyToken.js /v1/me/player
 */

const axios = require('axios');
const dotenv = require('dotenv');

// .env 파일이 있다면 환경 변수를 불러온다
dotenv.config({ path: require('path').resolve(__dirname, '..', '.env') });

const token = process.env.SPOTIFY_TEST_ACCESS_TOKEN || process.env.SPOTIFY_ACCESS_TOKEN;
const endpoint = process.argv[2] || '/v1/me';

if (!token) {
  console.error('[spotify:test] SPOTIFY_TEST_ACCESS_TOKEN 환경 변수가 설정되지 않았습니다.');
  console.error('예시: SPOTIFY_TEST_ACCESS_TOKEN="<token>" node scripts/testSpotifyToken.js');
  process.exit(1);
}

const baseUrl = 'https://api.spotify.com';

(async () => {
  try {
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    console.log(`[spotify:test] 요청: GET ${url}`);

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(`[spotify:test] 상태 코드: ${response.status}`);
    console.log('[spotify:test] 응답 데이터:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error(`[spotify:test] 오류 상태 코드: ${error.response.status}`);
      console.error('[spotify:test] 오류 데이터:', error.response.data);
    } else {
      console.error('[spotify:test] 요청 실패:', error.message);
    }
    process.exit(1);
  }
})();
