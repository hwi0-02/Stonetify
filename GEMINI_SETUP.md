# Gemini AI 추천 기능 설정 가이드

## 1. Gemini API 키 발급

1. [Google AI Studio](https://makersuite.google.com/app/apikey)에 접속
2. Google 계정으로 로그인
3. "Get API Key" 또는 "Create API Key" 버튼 클릭
4. API 키 복사

## 2. Backend 환경 변수 설정

`Backend/.env` 파일을 열고 다음 값을 설정하세요:

```env
# Gemini AI
GEMINI_API_KEY=여기에_발급받은_API_키_입력
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_BASE=https://generativelanguage.googleapis.com/v1beta
ENABLE_GEMINI=true
```

### 사용 가능한 모델

- `gemini-2.5-flash` (최신, 빠른 응답)
- `gemini-1.5-flash` (안정적, 빠른 응답)
- `gemini-1.5-pro` (높은 품질, 느린 응답)

## 3. 서버 재시작

Backend 서버를 재시작하세요:

```bash
cd Backend
npm start
```

## 4. 확인 방법

### Backend 로그 확인

서버 시작 시 다음과 같은 로그가 보여야 합니다:
```
[Gemini Client] Starting request with model: gemini-2.5-flash
```

### 에러 메시지

#### API 키가 설정되지 않은 경우
```
[Gemini Client] API key not configured properly
```
→ `.env` 파일에서 `GEMINI_API_KEY`를 확인하세요.

#### 응답 파싱 실패
```
[Gemini Client] Failed to parse as JSON
```
→ 로그에서 `Full raw text`를 확인하고, 프롬프트를 조정하세요.

#### 후보 곡이 없는 경우
```
[Gemini] No candidates found, falling back
```
→ Firebase에 충분한 플레이리스트와 곡 데이터가 있는지 확인하세요.

## 5. 테스트

1. Frontend 앱 실행
2. 홈 화면 새로고침
3. "AI가 추천하는 음악" 섹션 확인

### 예상 결과

- 최대 6개의 추천 곡 카드
- 각 곡마다 추천 이유 표시
- 전체 큐레이션 요약 텍스트
- 후속 질문 (선택사항)

## 6. 문제 해결

### GEMINI_API_KEY is not configured

**원인**: API 키가 설정되지 않았거나 잘못되었습니다.

**해결**:
1. `.env` 파일에 `GEMINI_API_KEY`가 있는지 확인
2. API 키에 따옴표가 없는지 확인
3. 서버를 재시작했는지 확인

### No text content in Gemini response

**원인**: Gemini API 응답 구조가 예상과 다릅니다.

**해결**:
1. Backend 로그에서 `Response data structure` 확인
2. 모델명이 올바른지 확인 (`GEMINI_MODEL`)
3. API 엔드포인트가 올바른지 확인 (`GEMINI_API_BASE`)

### Falling back to traditional recommendations

**원인**: Gemini 기능이 비활성화되었거나 에러가 발생했습니다.

**해결**:
1. `ENABLE_GEMINI=true`로 설정되었는지 확인
2. Backend 로그에서 구체적인 에러 메시지 확인
3. 네트워크 연결 확인

## 7. 성능 최적화

### 캐싱

- AI 추천은 기본적으로 10분간 캐시됩니다
- 같은 사용자가 반복 요청 시 캐시된 결과 반환
- 캐시 시간 조정: `recommendationController.js`의 `CACHE_TTL` 값 변경

### 비용 관리

- Gemini API는 무료 할당량이 있습니다
- 초과 시 요금이 부과될 수 있습니다
- [Google AI Pricing](https://ai.google.dev/pricing) 확인

### Fallback 전략

Gemini 실패 시 자동으로 기존 추천 시스템으로 전환됩니다:
- 사용자는 추천을 계속 받을 수 있습니다
- Backend 로그에 `[Gemini] Falling back` 메시지 기록
- 프론트엔드에는 영향 없음

## 8. 고급 설정

### 프롬프트 커스터마이징

프롬프트를 수정하려면 `Backend/utils/prompts/geminiRecommendationPrompt.js` 파일을 편집하세요.

### 추천 로직 조정

추천 후보 생성 로직을 수정하려면 `Backend/utils/recommendationFeatureBuilder.js` 파일을 편집하세요.

### 디버깅 모드

더 상세한 로그를 보려면 `geminiClient.js`의 `console.log` 주석을 해제하세요.
