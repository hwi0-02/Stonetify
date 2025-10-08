# 🚨 Spotify 재생 400 오류 해결 가이드

## 문제 상황
Spotify 연결은 성공했지만 곡을 재생하려고 할 때 `AxiosError: Request failed with status code 400` 오류가 발생합니다.

## 주요 원인

### 1️⃣ 활성 Spotify 장치 없음 (가장 흔한 원인)
Spotify Web API는 **반드시 활성화된 재생 장치**가 있어야 합니다.

**해결 방법:**
- ✅ 휴대폰에서 Spotify 앱 열기
- ✅ 컴퓨터에서 Spotify 데스크톱 앱 열기
- ✅ 스마트 스피커 또는 Spotify Connect 지원 장치 사용
- ✅ 브라우저에서 [Spotify Web Player](https://open.spotify.com) 열기

### 2️⃣ Spotify Premium 계정 필요
Spotify Web Playback API는 Premium 계정만 사용 가능합니다.

**확인 방법:**
- Spotify 앱에서 `설정 > 계정 > 구독` 확인
- Premium이 아니면 앱에서 광고가 표시됨

### 3️⃣ Track ID 포맷 오류
Firebase ID가 Spotify ID 대신 전송되는 경우

**해결 완료:**
- ✅ Backend: 검색 결과에 `spotify_id` 포함
- ✅ Frontend: `spotify_id` 우선 사용
- ✅ Adapter: Firebase ID 필터링
- ✅ Backend: URI 포맷 검증

## 적용된 수정사항

### Backend: spotifyPlaybackController.js
```javascript
// ✅ 장치 확인 로직 추가
const devices = await spotifyRequest(userId, 'get', '/me/player/devices', null);
if (!devices?.devices || devices.devices.length === 0) {
  return res.status(400).json({
    message: 'No active Spotify device found. Please open Spotify app on any device first.',
    error: 'NO_ACTIVE_DEVICE'
  });
}

// ✅ 더 명확한 에러 메시지
if (e.response?.status === 404) {
  errorMessage = 'No active device found';
  errorDetails = 'Please open Spotify app on your phone, computer, or any connected device.';
}
```

### Backend: spotifyController.js
```javascript
// ✅ 검색 결과에 spotify_id 포함
const tracks = response.data.tracks.items.map(item => ({
  id: item.id,
  spotify_id: item.id,  // 명시적으로 추가
  uri: item.uri,
  duration_ms: item.duration_ms,
  // ...
}));
```

### Frontend: adapters/index.js
```javascript
// ✅ NO_ACTIVE_DEVICE 오류 처리
catch (error) {
  if (error.response?.data?.error === 'NO_ACTIVE_DEVICE') {
    throw new Error(
      'Spotify 재생 장치를 찾을 수 없습니다.\\n\\n' +
      '휴대폰, 컴퓨터 또는 스피커에서 Spotify 앱을 먼저 열어주세요.'
    );
  }
}
```

### Frontend: apiService.js
```javascript
// ✅ 상세한 요청/응답 로깅
api.interceptors.request.use(async (config) => {
  if (config.url && config.url.includes('playback/play')) {
    console.log('📡 [API Request] Playback Play:', config.data);
  }
});

api.interceptors.response.use(response => response, async (error) => {
  if (originalRequest?.url && originalRequest.url.includes('playback')) {
    console.error('❌ [API Response Error]:', error.response?.data);
  }
});
```

## 테스트 절차

### 1단계: 앱 재시작
```powershell
# Backend
cd Backend
npm start

# Frontend (새 터미널)
cd Frontend
npm start
```

### 2단계: Spotify 장치 준비
**반드시 다음 중 하나를 실행하세요:**
- [ ] 휴대폰에서 Spotify 앱 열기
- [ ] PC에서 Spotify 데스크톱 앱 열기
- [ ] 브라우저에서 https://open.spotify.com 열기
- [ ] Spotify Connect 장치 켜기

### 3단계: 앱에서 재생 테스트
1. Stonetify 앱 열기
2. Spotify 계정 연결 확인
3. 검색에서 곡 찾기
4. 플레이리스트에 추가
5. 곡 재생 시도

### 4단계: 로그 확인
**정상 작동 시:**
```
🎵 [RestRemoteAdapter] Loading track: { spotifyId: '6rqhFgbbKwnb9MLmUQDhG6' }
📡 [API Request] Playback Play: { uris: ['spotify:track:6rqhFgbbKwnb9MLmUQDhG6'] }
🌐 [spotifyRequest] Making request to Spotify API
🔊 [Playback][play] Available devices: 1
✅ [spotifyRequest] Success: 204
✅ [Playback][play] Success
```

**장치 없을 때:**
```
⚠️ [Playback][play] No active Spotify devices found
❌ [API Response Error]: { error: 'NO_ACTIVE_DEVICE' }
```

**Track ID 오류 시:**
```
❌ [RestRemoteAdapter] Invalid Firebase ID detected in URI: spotify:track:-O_xxx
```

## 문제 해결 체크리스트

### 400 오류가 계속 발생하면:

- [ ] **Spotify 앱이 열려있나요?**
  - 휴대폰/PC에서 Spotify 앱 확인
  - Spotify Web Player (open.spotify.com) 열기

- [ ] **Premium 계정인가요?**
  - Spotify 설정에서 구독 확인
  - Free 계정은 Web API 재생 불가

- [ ] **콘솔 로그 확인**
  - `🔊 Available devices: 0` → 장치 없음
  - `❌ Invalid Firebase ID` → Track ID 오류
  - `403 Forbidden` → Premium 필요

- [ ] **Spotify 토큰 유효성**
  - 프로필 화면에서 Spotify 연결 끊고 재연결
  - 토큰이 만료되었을 수 있음

- [ ] **네트워크 연결**
  - Backend 서버 실행 중인지 확인
  - API URL이 올바른지 확인

## Spotify 장치 연결 방법

### 방법 1: 휴대폰 (가장 쉬움)
1. Spotify 앱 열기
2. 아무 곡이나 재생 (일시정지 가능)
3. Stonetify 앱에서 곡 재생

### 방법 2: PC
1. Spotify 데스크톱 앱 다운로드 및 설치
2. 로그인
3. 백그라운드에서 실행
4. Stonetify에서 재생

### 방법 3: Web Player
1. 브라우저에서 open.spotify.com 접속
2. 로그인
3. 탭을 열어둔 채로 유지
4. Stonetify에서 재생

### 방법 4: Spotify Connect
- 스마트 스피커 (Amazon Echo, Google Home)
- 스마트 TV
- 게임 콘솔 (PlayStation, Xbox)
- Sonos 등 오디오 시스템

## API 에러 코드 설명

| Status | 의미 | 해결 방법 |
|--------|------|----------|
| 400 | 잘못된 요청 | Track ID 확인, 장치 확인 |
| 401 | 인증 실패 | Spotify 재연결 필요 |
| 403 | 권한 없음 | Premium 계정 필요 |
| 404 | 장치 없음 | Spotify 앱 열기 |
| 500 | 서버 오류 | Backend 로그 확인 |

## 개발자 디버깅

### Backend 로그 확인
```bash
cd Backend
npm start
# 터미널에서 다음 로그 확인:
# 🎵 [Playback][play] Request
# 🔊 [Playback][play] Available devices
# 🌐 [spotifyRequest] Making request
```

### Frontend 로그 확인
```bash
# Chrome DevTools 또는 Expo 터미널에서:
# 🔄 [normalizeTrack]
# 🎵 [RestRemoteAdapter]
# 📡 [API Request]
```

### Spotify API 직접 테스트
```bash
# 사용자 장치 목록 확인
curl -X GET "https://api.spotify.com/v1/me/player/devices" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 참고 자료
- [Spotify Web API - Playback](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback)
- [Spotify Connect](https://www.spotify.com/us/connect/)
- [Spotify Premium 구독](https://www.spotify.com/premium/)

## 요약

1. ✅ **가장 중요:** Spotify 앱을 휴대폰이나 PC에서 먼저 열어두세요
2. ✅ Premium 계정이 필요합니다
3. ✅ 코드 수정 완료 (Track ID, 장치 확인, 에러 처리)
4. ✅ 앱 재시작 후 테스트
5. ✅ 로그를 확인하여 정확한 오류 파악

**여전히 문제가 발생하면 콘솔 로그 전체를 공유해주세요!**
