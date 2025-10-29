# Gemini 2.5 Flash 기반 Stonetify 추천 기능 통합 계획

## 1. 현재 구조 및 목표
- **프론트엔드**: `Frontend/` Expo 기반 React Native 앱. Redux(`Frontend/store/`)로 상태 관리, `Frontend/services/apiService.js`를 통해 백엔드 REST API 호출.
- **백엔드**: `Backend/` Express 서버(`Backend/app.js`). Firebase Realtime Database를 도메인 모델(`Backend/models/*.js`)로 감싼 구조이며, Spotify 연동과 추천 로직은 `Backend/controllers/recommendationController.js`, `Backend/routes/recommendationRoutes.js`가 담당.
- **데이터**: Firebase Realtime DB 컬렉션(`users`, `playlists`, `songs`, `liked_playlists`, `playback_history` 등). 일부 Spotify 토큰은 `spotify_tokens` 컬렉션에 저장.
- **목표**: 기존 추천 API에 Gemini 2.5 Flash를 결합해 사용자 취향 이해 → 곡 후보 생성 → 자연어 설명/대화 응답을 제공하는 개인화 추천 플로우 확장.

## 2. Gemini 연동 아키텍처 개요
1. **데이터 준비 레이어**
   - `Backend/models/`와 `RealtimeDBHelpers`를 활용해 플레이리스트, 곡, 좋아요, 재생 이력을 수집/요약.
   - Spotify API (`Backend/controllers/spotifyController.js`, `Backend/controllers/spotifyPlaybackController.js`)로 최신 곡 메타데이터/미리듣기 URL 확보.
2. **추천 후보 생성 레이어**
   - 기존 `getRecommendedPlaylists` 흐름을 확장해 곡/플레이리스트 후보 세트를 구성.
   - 사용자 선호 벡터는 Firebase 데이터 기반으로 간단한 통계(선호 아티스트, 장르, 시간대)를 추출하는 헬퍼를 신설.
3. **Gemini Reasoning 레이어**
   - Google Gemini 2.5 Flash API와 통신하는 모듈을 `Backend/utils/geminiClient.js`에 구현.
   - 후보 세트와 사용자 컨텍스트를 프롬프트로 전달하고, JSON 형태로 추천 결과와 설명을 반환.
4. **API 응답**
   - `Backend/controllers/recommendationController.js`에 Gemini 기반 엔드포인트 추가 (`GET /api/recommendations/gemini` 등).
   - Express Rate Limit과 캐싱(`Backend/utils/cache.js` 신설 고려)으로 호출 수 관리.
5. **프론트 표시**
   - `Frontend/services/apiService.js`에 신규 엔드포인트 메서드 추가 후 Redux slice(`Frontend/store/slices/playlistSlice.js` 또는 별도 slice)에서 상태 관리.
   - 홈 화면(`Frontend/screens/HomeScreen.js`) 또는 신규 “AI 추천” 화면에서 Gemini 설명 + 곡 프리뷰 제공.

## 3. 백엔드 상세 계획
### 3.1 환경 설정
- `.env` (Backend) 에 `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash`, `GEMINI_API_BASE` 추가.

### 3.2 Gemini 클라이언트 모듈 (`Backend/utils/geminiClient.js`)
- `axios` 기반 HTTP 클라이언트 생성.
- 공통 헤더(`Authorization: Bearer`, `Content-Type: application/json`)와 타임아웃(예: 15초) 설정.
- 재시도 로직(429/500 계열 → 지연 후 최대 2회 재시도)과 에러 로깅(`console.error` → Sentry 연동 시 `Sentry.captureException`).
- 함수 시그니처: `callGemini({ systemPrompt, userPrompt, tools })` → JSON 응답 반환.

### 3.3 데이터 어그리게이션 헬퍼 (`Backend/utils/recommendationFeatureBuilder.js`)
- 입력: `userId`.
- 처리:
  - `LikedPlaylist.findByUserId`, `Song.findByPlaylistId`로 선호 아티스트/장르 Frequency Map 생성.
  - `PlaybackHistory.findByUserId`(이미 존재한다면) 또는 `RealtimeDBHelpers.queryDocuments`로 최근 재생 기록을 확보.
  - Spotify API를 통한 음향 특성(`tempo`, `energy`, `danceability`) 조회 함수 재사용 또는 추가 구현.
  - 결과: `{ topArtists, topGenres, recentTracks, moodSignals }`.

### 3.4 후보 선별 로직 통합
- 기존 `getRecommendedPlaylists`와 중복 최소화를 위해 함수 추출:
  - `collectCandidateTracks(userId, { limit })` → 플레이리스트 기반 곡 후보 리스트 반환.
  - 스코어링: 좋아요, 최근 재생, 유사 아티스트 가중치 혼합.
  - 선별된 곡은 `{ title, artist, spotify_track_id, preview_url, cover_image_url, tags }` 포맷으로 정규화.

### 3.5 Gemini 요청/응답 처리
- `buildGeminiPrompt({ userProfile, context, candidates })` 함수에서 시스템 메시지+user 메시지 생성.
- 시스템 메시지 예시:
  ```
  당신은 Stonetify의 음악 큐레이터입니다.
  - 사용자 요약: {json}
  - 반환 형식: JSON. fields = [tracks[], summary, followUpQuestion]
  - tracks[i]: {title, artist, reason, previewUrl, playlistId?, playlistTitle?}
  - summary: 2문장 이상 한국어
  ```
- Gemini 응답은 JSON schema 검증(`ajv` 등) 후 파싱. 실패 시 fallback으로 기존 추천 리스트 반환.

### 3.6 새 API 엔드포인트
- `Backend/routes/recommendationRoutes.js`에 `router.get('/gemini', protect, getGeminiRecommendations);` 추가.
- 컨트롤러(`recommendationController.js`) 신규 핸들러:
  1. 사용자 피쳐 수집.
  2. 후보 곡 10~15개 수집.
  3. Gemini 호출 및 결과 파싱.
  4. 결과와 원본 후보 ID 매핑 후 반환.
- 응답 형식:
  ```json
  {
    "tracks": [
      {
        "id": "spotifyTrackId",
        "title": "...",
        "artist": "...",
        "preview_url": "...",
        "reason": "...",
        "playlist": { "id": "...", "title": "..." }
      }
    ],
    "summary": "...",
    "follow_up": "..."
  }
  ```
- 응답 캐싱: 사용자+컨텍스트 키 기반(`userId + hash(moodInput)`)으로 5~10분 캐시. Redis 미구현 상태이므로 메모리 캐시 or Firebase `recommendations` 컬렉션 활용.

### 3.7 피드백 저장
- 기존 `LikedPlaylist`, `PlaybackHistory` 활용.
- 새로운 피드백 이벤트(`POST /api/recommendations/feedback`) 정의:
  - body: `{ trackId, action: 'like'|'skip'|'play', context }`.
  - Firebase `recommendations_feedback` 컬렉션에 저장하여 Gemini 컨텍스트/후속 추천 강화.

## 4. 프론트엔드 상세 계획
### 4.1 서비스 계층
- `Frontend/services/apiService.js`에 다음 메서드 추가:
  - `getGeminiRecommendations(params)` → `GET /recommendations/gemini`.
  - `postRecommendationFeedback(payload)` → `POST /recommendations/feedback`.
- 터널/로컬 모드 호환을 위해 기존 baseURL 로직 재사용.

### 4.2 Redux 상태
- `Frontend/store/slices/playlistSlice.js` 또는 새 slice(`aiRecommendationSlice.js`)에 상태 정의:
  ```js
  {
    aiTracks: [],
    aiSummary: '',
    followUpQuestion: '',
    status: 'idle'|'loading'|'failed',
    lastContext: null
  }
  ```
- `createAsyncThunk`로 `fetchGeminiRecommendations({ mood, activity })` 구현. 실패 시 fallback으로 `fetchForYouPlaylists`.

### 4.3 UI/UX
- 홈 화면(`Frontend/screens/HomeScreen.js`)에 "AI 추천" 섹션 추가 또는 별도 화면 생성:
  - 카드 디자인: 앨범 아트, 아티스트, 재생 버튼, Gemini 설명 문구.
  - `followUpQuestion`을 CTA로 사용 ("좀 더 신나는 곡도 찾아볼까요?").
- 플레이어(`Frontend/screens/PlayerScreen.js`)에서 Gemini 추천 곡 재생 시 `postRecommendationFeedback('play')` 호출.
- 좋아요/패스 버튼 UX 연결 → Redux action → API 호출.
- 로딩/에러 상태는 `ActivityIndicator`와 토스트(`Alert.alert`) 활용.

### 4.4 옵저버빌리티
- 실패 케이스는 Sentry(`@sentry/react-native`)에 태깅(`category: 'gemini-recommendation'`).
- 네트워크 재시도는 `apiService` 인터셉터를 활용하되, Gemini 엔드포인트는 429 발생 시 사용자에게 "잠시 후 다시 시도" 안내.

## 5. 데이터 확장 및 품질 관리
- Firebase 구조 보완:
  - `recommendations` 컬렉션: `{ user_id, context_hash, tracks, summary, created_at }` 저장해 캐시 및 리포트로 활용.
  - `recommendations_feedback`: `{ user_id, track_id, action, context, created_at }`.
- 주기적 클린업 스크립트(`Backend/scripts/cleanupRecommendations.js`)로 30일 이상 데이터 제거.
- 데이터 검증: 추천 후보가 비어 있을 경우 Gemini 호출 전 조기 종료 → 기본 추천 반환.

## 6. Prompt & Guardrail 전략
- Prompt 버전 관리를 위해 `Backend/utils/prompts/geminiRecommendationPrompt.js`에 템플릿 정의 후 Git으로 버전 관리.
- JSON Schema:
  ```json
  {
    "type": "object",
    "required": ["tracks", "summary"],
    "properties": {
      "tracks": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["title", "artist", "reason"],
          "properties": {
            "title": {"type": "string"},
            "artist": {"type": "string"},
            "reason": {"type": "string"},
            "previewUrl": {"type": "string"},
            "playlistId": {"type": "string"},
            "playlistTitle": {"type": "string"}
          }
        },
        "maxItems": 6
      },
      "summary": {"type": "string"},
      "followUpQuestion": {"type": "string"}
    }
  }
  ```
- 파싱 실패 시 Guardrail: 1) JSON.parse try-catch 2) fallback으로 기존 `getRecommendedPlaylists` 결과와 고정 설명 제공.

## 7. 롤아웃 및 테스트
- **단위 테스트**: `Backend/controllers/__tests__/recommendationController.test.js` 추가, Gemini 호출은 `nock`으로 모킹.
- **통합 테스트**: Expo 앱에서 `fetchGeminiRecommendations` 호출 후 UI 렌더링 확인 (스토리북 or Expo Preview).
- **부하 테스트**: `scripts/load-test.js` 작성해 동시에 50요청 시 응답 시간 측정.
- **릴리즈 플랜**:
  1. 비공개 플래그(`process.env.ENABLE_GEMINI=true`)로 스테이징 배포.
  2. 내부 QA 후, 선택 사용자군(10%)에 기능 노출.
  3. KPI 모니터링(클릭률, 청취 지속시간) 후 전체 오픈.

## 8. 일정 예시 (8주)
1. **1주차**: 요구사항 정리, Gemini API 키 세팅, 데이터 모델 검토.
2. **2주차**: 추천 후보 생성 헬퍼/피쳐 빌더 구현, Firebase 컬렉션 확장.
3. **3주차**: Gemini 클라이언트 및 프롬프트 템플릿 구축, Mock 응답으로 백엔드 API 완성.
4. **4주차**: 프론트엔드 Redux/화면 연동, 기본 UI 완성.
5. **5주차**: 피드백 저장/재학습 루프 연결, 캐시 전략 구현.
6. **6주차**: 통합 테스트, 에러 핸들링 및 Guardrail 강화.
7. **7주차**: 스테이징 배포, 내부 QA 및 성능 튜닝.
8. **8주차**: 베타 런칭, 모니터링/알림 세팅, 피드백 기반 개선.

## 9. 위험 요소 및 대응
- **Gemini API 실패/지연**: 타임아웃 후 기존 추천 API fallback, 사용자 안내 문구 노출.
- **데이터 스파스니스**: 청취/좋아요가 적은 신규 유저는 Spotify 인기 차트 기반 cold-start 시나리오 준비.
- **비용 관리**: 사용자 컨텍스트 변경이 없는 반복 호출은 캐시 반환, 일일 호출량 모니터링 스크립트 추가.
- **프라이버시**: Gemini로 전송하는 데이터는 최소화(곡 메타데이터 및 익명화된 취향 요약)하고 로그에 민감 정보 기록 금지.
