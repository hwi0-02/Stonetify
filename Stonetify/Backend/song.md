# Spotify 곡 재생 구현 계획서 (v1)

현재 상태와 요구: 검색 등을 통해 가져온 Spotify 트랙 객체(현재 `preview_url` 기반 30초 미리듣기만 가능)를 실제 플레이어(UI: `AdvancedPlayer`, `PlayerScreen`)에서 재생/일시정지/정지/추후 다음/이전/셔플/반복 등을 지원하도록 확장한다. 또한 향후 “전체 곡” 재생(Spotify Premium + 공식 SDK 필요)으로 확장 가능한 구조를 마련한다.

---
## 1. 현행 코드 분석 요약
### 1.1 Frontend
- Redux `playerSlice.js`는 단일 `playbackInstance`(expo-audio)로 `preview_url`을 로드하여 재생.
- position / duration 상태 갱신 로직이 미흡: `onPlaybackStatusUpdate`에서 재생 상태는 반영하지만 position, duration 값을 slice에 반영하지 않음.
- `isRepeat`, `isShuffle`만 토글 상태로 존재하며 실제 동작(next/previous 구현) 없음.
- 큐(playlist/track queue) 개념이 전혀 없음 (`currentTrack` 단일).
- `MiniPlayer.js` 비어있음 → 간단한 미니 컨트롤러 필요 가능.
- `AdvancedPlayer`의 Slider는 `duration` / `position`을 사용하나 실제 업데이트가 되지 않아 고정.

### 1.2 Backend
- 아직 Spotify Playback 제어(디바이스 전송, Web Playback SDK token, refresh) 관련 endpoint가 없음.
- 이미 검색 등을 위한 토큰 발급 로직(추정) 존재 하나(파일 미확인), playback scope 포함 여부 미확인.

### 1.3 제약
- Expo + React Native 환경에서 “전체 곡” 스트리밍은 Spotify 정책상 Web Playback SDK(Web 환경) 또는 iOS/Android Spotify SDK (Premium 사용자 필수)를 통해야 하며, 단순 HTTP mp3 스트리밍 불가.
- 현재 구조는 preview 기반으로 MVP 가능. 전체 재생은 향후 “Native module” or “react-native-spotify-remote” 도입 시점에 분리 레이어 필요.

---
## 2. 목표 (Phase 구분)
### Phase A (즉시 개선 / Preview 기반 안정화)
1. 위치/길이(progress) 정확한 반영
2. 큐/플레이리스트 재생 (next/prev, shuffle, repeat)
3. 안정적인 상태 관리 + 에러 처리
4. 재생 중 앱 재로드 시 복원(선택) – AsyncStorage
5. UI 미니 플레이어 추가

### Phase B (준비 작업)
6. Spotify 전체 곡 재생을 위한 추상 레이어 (PlaybackAdapter 인터페이스)
7. 인증/토큰 범위 확장 (user-read-playback-state, user-modify-playback-state, streaming)
8. 백엔드 refresh token + device 관리 엔드포인트 준비

### Phase C (전체 곡 재생 지원 – 향후)
9. Bare workflow 전환(필요 시) 및 `react-native-spotify-remote` / Spotify SDK 연동
10. Adapter 교체 및 QA

---
## 3. 세부 구현 항목 (Phase A)

### 3.1 playerSlice 개선
추가 state:
```ts
queue: [],          // 재생 대기열 (트랙 객체 배열)
queueIndex: 0,      // 현재 인덱스
lastActionTS: null, // 디버깅/동기화용(선택)
seekInProgress: false // 사용자가 슬라이더 드래그 중인지 여부
```
추가 actions/thunks:
- `loadQueue(tracks, startIndex=0)`
- `playFromQueue(index)` (현재 재생 중이면 unload 후 해당 index 재생)
- `nextTrack()` / `previousTrack()`
	- repeat 모드 동작 정의:
		- repeat = false: 마지막 곡 끝나면 stop
		- repeat = true (단일곡 반복?): 옵션 1) track repeat, 옵션 2) queue repeat → `repeatMode: 'off'|'track'|'queue'` 로 확장 권장
- `toggleRepeatMode()` (위 repeatMode 순환)
- `toggleShuffle()` 시 셔플 알고리즘: 현재 곡 제외 나머지 배열 Fisher-Yates → `shuffledOriginalOrder` 저장
- `updatePlaybackStatus({ positionMillis, durationMillis, isPlaying })`
	- `onPlaybackStatusUpdate`에서 dispatch (debounce or throttle 250ms 권장)

### 3.2 onPlaybackStatusUpdate 수정
현재:
```js
if (status.didJustFinish) dispatch(stopTrack())
```
변경:
```js
if (status.isLoaded) {
	dispatch(updatePlaybackStatus({
		positionMillis: status.positionMillis,
		durationMillis: status.durationMillis,
		isPlaying: status.isPlaying,
	}));
	if (status.didJustFinish) {
		// repeatMode 로직
		dispatch(handleTrackEnd()); // 내부에서 next / repeat 판단
	}
}
```

### 3.3 handleTrackEnd 로직 (Thunk)
의사코드:
```js
if (repeatMode==='track') { dispatch(playFromQueue(queueIndex)); return }
if (queueIndex < queue.length-1) { dispatch(nextTrack()) }
else if (repeatMode==='queue') { dispatch(playFromQueue(0)) }
else { dispatch(stopTrack()) }
```

### 3.4 시킹(seek)
슬라이더 드래그 시작 시 `seekInProgress=true` → UI에서 position 표시를 local state로만 업데이트.
드래그 완료 시 `dispatch(setPosition(newPositionMillis))` & `seekInProgress=false`.
`setPosition` thunk 내에서 `playbackInstance.setPositionAsync()` 후 `updatePlaybackStatus` 호출.

### 3.5 MiniPlayer 구현 (`MiniPlayer.js`)
구성: 썸네일(56px), 제목/아티스트 한 줄, Play/Pause, Next, 전체 PlayerScreen 이동 터치 영역.
Redux에서 `currentTrack` 구독. Gesture → `PlayerScreen` navigate.
`AppNavigator` 하단(Tab 위) Portal 또는 absolute 배치.

### 3.6 AdvancedPlayer 개선
- Shuffle/Repeat 버튼에 실제 dispatch 연결.
- Next/Prev 버튼 구현.
- Volume Slider: 0 → mute 아이콘 반영(이미 있음) + long press reset.
- 에러 토스트(예: preview_url 없음)

### 3.7 Preview URL Fallback 전략
일부 트랙은 `preview_url`이 null → 재생 버튼 누르면:
1) 백엔드에 “미리듣기 없음” 기록(optional: 추천 엔진 제외)
2) 사용자 안내 메시지 (Toast) 표시
3) 자동으로 다음 트랙으로 넘어가기 (옵션)

### 3.8 AsyncStorage 복원 (선택)
- 앱 시작 시 마지막 queue + index + position 저장/복원 (단, preview_url 다시 유효성 검사).

### 3.9 에러 처리 & 경계 케이스
- 동일 트랙 다시 재생 시: unload 없이 `playbackInstance.getStatusAsync()`로 상태 확인 후 `playAsync()` (최적화)
- 빠른 next 연타: race condition 방지 → `isTransitioning` flag 또는 재생 thunk 내부에서 직렬화 (Promise queue)
- 네트워크 끊김: `createAsyncThunk` reject → slice.status='error', UI 토스트

---
## 4. Phase B 준비 (전체 곡 재생 구조 설계)
### 4.1 PlaybackAdapter 추상화
인터페이스 (TypeScript 의사):
```ts
interface IPlaybackAdapter {
	load(track: Track, autoPlay: boolean): Promise<void>;
	play(): Promise<void>;
	pause(): Promise<void>;
	stop(): Promise<void>;
	seek(ms: number): Promise<void>;
	setVolume(v: number): Promise<void>;
	onStatus(cb: (status: PlaybackStatus) => void): void; // position, duration, isPlaying, didJustFinish
	dispose(): Promise<void>;
}
```
현재 expo-audio 구현 = `PreviewAudioAdapter`
향후 Spotify SDK 구현 = `SpotifyRemoteAdapter`
`playerSlice`는 adapter를 주입 (전역 singleton or context) → 테스트 용이.

### 4.2 Spotify 전체 곡 재생을 위한 스코프 & Auth
필요 스코프: `user-read-playback-state`, `user-modify-playback-state`, `streaming`, (재생목록 관련 시 `playlist-read-private` 등 추가)
Frontend: `expo-auth-session` PKCE → code → backend 교환 → refresh token 저장 (서버)
Backend: `/api/spotify/auth/login`, `/api/spotify/auth/callback`, `/api/spotify/token/refresh`
Access token 짧은 주기 캐시 + refresh 로직 cron(또는 on-demand)

### 4.3 Device 관리
- Spotify Remote 방식은 실제 Spotify 앱(모바일/데스크톱)이 디바이스.
- Web Playback SDK 사용하는 경우 자체 디바이스 등록 → device_id 획득 후 `transfer playback` 호출.
Redux에 `playbackDeviceId` 상태 추가 가능.

---
## 5. Phase C 개요 (향후)
1. Expo Managed → Bare (또는 Config Plugin) 마이그레이션
2. `react-native-spotify-remote` 설치 및 iOS/Android 설정 (client id, redirect scheme)
3. Adapter 구현 & 기존 PreviewAdapter 대체
4. QA: 권한/프리미엄 계정 없는 사용자 fallback → preview 모드 유지

---
## 6. 구체적 코드 변경 To-Do (Phase A)
번호 | 파일 | 변경 요약
---- | ---- | ---------
1 | `playerSlice.js` | queue, queueIndex, repeatMode, actions(next/prev/shuffle/repeat), updatePlaybackStatus, handleTrackEnd
2 | `playerSlice.js` | onPlaybackStatusUpdate 내부 dispatch 로직 확장 (position/duration 갱신)
3 | `AdvancedPlayer.js` | 버튼 핸들러 연결 (next/prev/shuffle/repeat), progress slider seekInProgress 반영
4 | `MiniPlayer.js` | 신규 구현 (현재 트랙 표시 + play/pause + next)
5 | `PlayerScreen.js` | repeat/shuffle UI(필요 시), position 표시 개선
6 | `spotifySlice.js` | (선택) 검색 결과 playQueue 로딩 기능 유틸 추가
7 | `apiService.js` | (선택) preview_url null 대응 or 메시지 분기
8 | (신규) `adapters/PreviewAudioAdapter.js` | Adapter 패턴 도입 (선택: Phase B 앞당김)

---
## 7. 의사 코드 예시 (핵심 부분)
### 7.1 updatePlaybackStatus
```js
// playerSlice reducers
updatePlaybackStatus: (state, action) => {
	const { positionMillis, durationMillis, isPlaying } = action.payload;
	if (!state.seekInProgress) state.position = positionMillis;
	state.duration = durationMillis ?? state.duration;
	state.isPlaying = isPlaying;
	state.status = isPlaying ? 'playing' : (state.status === 'loading' ? 'loading' : 'paused');
}
```

### 7.2 nextTrack thunk (간략)
```js
export const nextTrack = () => (dispatch, getState) => {
	const { queueIndex, queue, repeatMode } = getState().player;
	if (queueIndex < queue.length - 1) {
		dispatch(playFromQueue(queueIndex + 1));
	} else if (repeatMode === 'queue') {
		dispatch(playFromQueue(0));
	} else {
		dispatch(stopTrack());
	}
}
```

---
## 8. 테스트 시나리오
시나리오 | 기대 결과
---------|---------
단일 트랙 재생 → 일시정지 → 재개 | 상태 전이: playing → paused → playing
슬라이더 드래그 후 놓기 | position 변경 반영 & 이어 재생
트랙 종료 (repeat off) | stopTrack 호출 & status=stopped
트랙 종료 (repeat track) | 같은 트랙 재시작
큐 마지막 곡 종료 (repeat queue) | 첫 곡 재생
셔플 on 상태 next 연속 | 모든 곡 중복 없이 순회 (남은 곡 없을 때만 다시 섞기)
preview_url null 곡 포함 큐 재생 | 해당 곡 skip, 다음 곡 자동 재생 (옵션)

---
## 9. 리스크 & 대응
리스크 | 내용 | 대응
-------|------|----
빠른 연타로 race | unload/load 충돌 | 재생 Thunk 내 mutex (flag) 적용
네트워크 지연 | 로딩 중 UI 오동작 | status=loading 분기 & 버튼 disabled
미리듣기 없는 트랙 다수 | 사용자 경험 저하 | 검색 결과에서 필터 or 회색 처리
전체 곡 재생 전환 시 큰 변경 | 아키텍처 의존성 | Adapter 패턴으로 추상화

---
## 10. 일정(예상)
단계 | 기간(예상)
----|------
Phase A 구현 + QA | 1~2일
Phase B Auth/Adapter + Backend 확장 | 1~2일
Phase C Native SDK 통합 (옵션) | 3~5일 (심사/빌드 포함)

---
## 11. 검토(Checklist)
항목 | 완료 판단 기준
----|---------------
Progress/Duaration 반영 | Slider 이동 & 자연 증가 확인
Next/Prev/End 로직 | 큐 진행 / repeat 모드 정확
Shuffle | 중복 최소, queueIndex 추적 신뢰성
State 일관성 | 빠른 클릭에도 오류/크래시 없음
에러 메시지 | preview_url 없음 등 사용자 피드백
Adapter 설계 문서 | 인터페이스 정의 명확

---
## 12. 2차 자체 검토 메모
1. Position 업데이트: 250ms throttling 필수 (과도한 dispatch 방지) – 구현 시 `Date.now()` 비교 or `lodash.throttle`.
2. Shuffle 시 현재 곡 유지: 현재 인덱스 제외 후 섞고, queueIndex=0으로 맞추거나 별도 배열 관리.
3. Repeat 모드 단일/큐 구분 필요 → boolean 2개보다 enum 권장.
4. Adapter 도입을 Phase A 끝무렵 미리 해두면 Phase C 비용 절감.
5. MiniPlayer는 성능 위해 `React.memo` 적용.
6. 시킹 중에는 status 업데이트가 position을 덮지 않도록 guard.
7. Backend 토큰 확장 시 refresh/expire 시간을 Redis(or memory) 캐시.

---
## 13. 다음 액션 (실제 개발 순서 제안)
1) `playerSlice` state & actions 확장 (queue, repeatMode, updatePlaybackStatus 등)
2) `onPlaybackStatusUpdate` 수정 & position/duration 반영
3) next/previous/handleTrackEnd thunk 구현 및 AdvancedPlayer 버튼 연결
4) MiniPlayer 구현 및 네비게이션 연결
5) Shuffle/Repeat 모드 enum 적용 및 UI 업데이트
6) preview_url null 대응 로직 (skip/토스트)
7) (선택) Adapter 인터페이스 + PreviewAudioAdapter 초안 작성
8) 간단 QA & 로그 확인, 버그 수정

---
## 14. 결론
현 구조는 30초 preview 기반 MVP로 적합하며, 우선 Phase A 개선을 통해 사용자 경험(진행바, 큐, 셔플/반복)을 완성한다. 이후 Adapter 패턴과 인증 스코프 확장으로 전체 곡 재생 가능성을 열어 두는 점이 핵심 전략이다.

---
문서 작성: 2025-10-02

---
# (v2) 전체곡 재생 목표 확장 계획

## A. 개요
이전 v1 문서는 Preview(30초) 중심 MVP를 다루었다. 본 v2에서는 “전체 곡 재생”을 1차 목표로 삼고, Spotify Premium + 정식 SDK / Remote 제어를 통한 스트리밍을 지원하도록 아키텍처와 구현 단계를 확장한다.

## B. 기술 옵션 비교
옵션 | 장점 | 단점 | 비고
-----|------|------|----
Spotify iOS/Android SDK (react-native-spotify-remote) | 네이티브 퍼포먼스, 전체곡 재생 | Premium 필수, 네이티브 설정 필요, Expo Managed 제약 | 권장 (모바일 중심)
Spotify Web Playback SDK + WebView | 구현 쉬움(웹 기반) | RN 네이티브 제약/지연, 백그라운드 재생 한계 | 임시/대안
백엔드 프록시 오디오 스트리밍 | 구현 통제력 | 정책 위반/DRM 문제, 금지 | 사용 금지

최종 선택: Expo Bare(EAS) 또는 Config Plugin 적용 후 `react-native-spotify-remote` 채택.

## C. 요구 스코프 & 권한
필수 스코프: `user-read-playback-state user-modify-playback-state user-read-currently-playing streaming`  
추가(선택): `playlist-read-private user-library-read user-library-modify`

## D. 인증 플로우 (Authorization Code with PKCE)
1. Frontend: Code Verifier/Challenge 생성 → Spotify Autorize URL 브라우저/웹뷰 오픈.
2. Redirect URI (예: `stonetify://auth/spotify`) 수신 → code 획득.
3. Backend로 `code` + `code_verifier` 전달 → `POST /api/spotify/auth/token`.
4. Backend: Client Secret 사용해 Access + Refresh Token 교환 후 DB 저장 (userId 매핑). Access Token만 프론트에 응답.
5. 프론트: 만료 임박 시 Backend `/api/spotify/auth/refresh` 호출 → 새 Access Token 수신.

### D.1 Frontend PKCE 구현 상세
```javascript
// utils/spotifyAuth.js (신규 생성 필요)
import * as Crypto from 'expo-crypto';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const SPOTIFY_CLIENT_ID = 'YOUR_CLIENT_ID';
const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'stonetify' });
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-library-modify'
];

// PKCE 생성
const generateCodeChallenge = async (verifier) => {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier
  );
  return digest
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

export const generateCodeVerifier = () => {
  const randomBytes = Crypto.getRandomBytes(32);
  const verifier = btoa(String.fromCharCode.apply(null, randomBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return verifier;
};

// Authorization URL 생성
export const getAuthorizationUrl = async (codeVerifier) => {
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const authUrl = `https://accounts.spotify.com/authorize?` +
    `client_id=${SPOTIFY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&code_challenge_method=S256` +
    `&code_challenge=${codeChallenge}` +
    `&scope=${encodeURIComponent(SCOPES.join(' '))}`;
  return authUrl;
};
```

### D.2 Backend Token 교환 로직 상세
```javascript
// controllers/spotifyAuthController.js (신규)
const crypto = require('crypto');
const User = require('../models/user');
const { Sequelize } = require('sequelize');

// Token 교환
exports.exchangeToken = async (req, res) => {
  const { code, code_verifier, user_id } = req.body;
  
  if (!code || !code_verifier || !user_id) {
    return res.status(400).json({ error: '필수 파라미터가 누락되었습니다' });
  }

  try {
    const tokenResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        code_verifier: code_verifier
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, refresh_token, expires_in, scope } = tokenResponse.data;
    const expires_at = Date.now() + expires_in * 1000;

    // DB 저장 (암호화 권장)
    await SpotifyToken.upsert({
      user_id,
      access_token: encrypt(access_token),
      refresh_token: encrypt(refresh_token),
      expires_at,
      scope
    });

    // 클라이언트에는 access_token만 반환
    res.json({
      access_token,
      expires_at,
      scope
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({ error: '토큰 교환 실패' });
  }
};

// Token 갱신
exports.refreshToken = async (req, res) => {
  const { user_id } = req.body;

  try {
    const tokenRecord = await SpotifyToken.findOne({ where: { user_id } });
    if (!tokenRecord) {
      return res.status(404).json({ error: '토큰 정보를 찾을 수 없습니다' });
    }

    const refreshResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: decrypt(tokenRecord.refresh_token),
        client_id: process.env.SPOTIFY_CLIENT_ID
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, expires_in } = refreshResponse.data;
    const expires_at = Date.now() + expires_in * 1000;

    await tokenRecord.update({
      access_token: encrypt(access_token),
      expires_at
    });

    res.json({ access_token, expires_at });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: '토큰 갱신 실패' });
  }
};

// 암호화/복호화 유틸 (AES-256-GCM 권장)
function encrypt(text) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encrypted) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### Backend 신규 엔드포인트 (상세)
메서드 | 경로 | 설명 | 요청 Body | 응답
------|------|------|---------|----
POST | /api/spotify/auth/token | code 교환 | {code, code_verifier, user_id} | {access_token, expires_at, scope}
POST | /api/spotify/auth/refresh | refresh token 사용 새 access 발급 | {user_id} | {access_token, expires_at}
GET | /api/spotify/auth/status | 사용자의 Premium 상태 확인 | - | {is_premium, product}
POST | /api/spotify/auth/logout | 토큰 폐기 | {user_id} | {success: true}
GET | /api/spotify/playback/state | (Proxy) 현재 재생 상태 | - | Spotify API response
PUT | /api/spotify/playback/transfer | 디바이스 전환 (device_id) | {device_ids, play} | {success: true}
PUT | /api/spotify/playback/play | track/uri 재생 | {uris, position_ms} | {success: true}
PUT | /api/spotify/playback/pause | 일시정지 | - | {success: true}
POST | /api/spotify/playback/next | 다음 | - | {success: true}
POST | /api/spotify/playback/previous | 이전 | - | {success: true}
PUT | /api/spotify/playback/seek | 재생 위치 이동 | {position_ms} | {success: true}
PUT | /api/spotify/playback/volume | 볼륨 설정 | {volume_percent} | {success: true}
GET | /api/spotify/me/devices | 사용 가능한 디바이스 목록 | - | {devices: []}

## E. 데이터 모델 (상세)

### E.1 spotify_tokens 테이블 (Sequelize Model)
```javascript
// models/spotify_token.js
module.exports = (sequelize, DataTypes) => {
  const SpotifyToken = sequelize.define('SpotifyToken', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    access_token: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'AES-256-GCM 암호화된 access token'
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'AES-256-GCM 암호화된 refresh token'
    },
    expires_at: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'epoch milliseconds'
    },
    scope: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    device_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '마지막으로 사용한 Spotify 디바이스 ID'
    },
    is_premium: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Spotify Premium 사용자 여부'
    }
  }, {
    tableName: 'spotify_tokens',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'], unique: true },
      { fields: ['expires_at'] }
    ]
  });

  SpotifyToken.associate = (models) => {
    SpotifyToken.belongsTo(models.User, {
      foreignKey: 'user_id',
      onDelete: 'CASCADE'
    });
  };

  return SpotifyToken;
};
```

### E.2 playback_history 테이블 (선택 - 재생 이력 추적)
```javascript
// models/playback_history.js
module.exports = (sequelize, DataTypes) => {
  const PlaybackHistory = sequelize.define('PlaybackHistory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    track_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Spotify track ID'
    },
    track_uri: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    track_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    artist_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    played_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    playback_source: {
      type: DataTypes.ENUM('preview', 'spotify'),
      defaultValue: 'preview'
    },
    duration_played_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '실제 재생된 시간 (밀리초)'
    },
    completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: '곡을 끝까지 들었는지 여부'
    }
  }, {
    tableName: 'playback_history',
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'played_at'] },
      { fields: ['track_id'] }
    ]
  });

  PlaybackHistory.associate = (models) => {
    PlaybackHistory.belongsTo(models.User, {
      foreignKey: 'user_id',
      onDelete: 'CASCADE'
    });
  };

  return PlaybackHistory;
};
```

### E.3 Migration 파일
```javascript
// migrations/YYYYMMDDHHMMSS-create-spotify-tokens.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('spotify_tokens', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      access_token: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      refresh_token: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      expires_at: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      scope: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      device_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      is_premium: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('spotify_tokens', ['user_id'], {
      unique: true,
      name: 'spotify_tokens_user_id_unique'
    });

    await queryInterface.addIndex('spotify_tokens', ['expires_at'], {
      name: 'spotify_tokens_expires_at_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('spotify_tokens');
  }
};
```

## F. Frontend 상태 구조 확장

### F.1 spotifyAuthSlice.js (신규 생성)
```javascript
// store/slices/spotifyAuthSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as spotifyAuth from '../../utils/spotifyAuth';

const API_BASE = 'http://your-backend-url/api';

// PKCE 인증 시작
export const initiateSpotifyAuth = createAsyncThunk(
  'spotifyAuth/initiate',
  async (_, { rejectWithValue }) => {
    try {
      const codeVerifier = spotifyAuth.generateCodeVerifier();
      await AsyncStorage.setItem('spotify_code_verifier', codeVerifier);
      
      const authUrl = await spotifyAuth.getAuthorizationUrl(codeVerifier);
      return { authUrl, codeVerifier };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 인증 코드 교환
export const exchangeSpotifyCode = createAsyncThunk(
  'spotifyAuth/exchange',
  async ({ code, userId }, { rejectWithValue }) => {
    try {
      const codeVerifier = await AsyncStorage.getItem('spotify_code_verifier');
      if (!codeVerifier) {
        throw new Error('Code verifier not found');
      }

      const response = await axios.post(`${API_BASE}/spotify/auth/token`, {
        code,
        code_verifier: codeVerifier,
        user_id: userId
      });

      const { access_token, expires_at, scope } = response.data;
      
      // 로컬 저장
      await AsyncStorage.multiSet([
        ['spotify_access_token', access_token],
        ['spotify_expires_at', expires_at.toString()],
        ['spotify_scope', scope]
      ]);
      await AsyncStorage.removeItem('spotify_code_verifier');

      return { accessToken: access_token, expiresAt: expires_at, scope };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || error.message);
    }
  }
);

// 토큰 갱신
export const refreshSpotifyToken = createAsyncThunk(
  'spotifyAuth/refresh',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE}/spotify/auth/refresh`, {
        user_id: userId
      });

      const { access_token, expires_at } = response.data;
      
      await AsyncStorage.multiSet([
        ['spotify_access_token', access_token],
        ['spotify_expires_at', expires_at.toString()]
      ]);

      return { accessToken: access_token, expiresAt: expires_at };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || error.message);
    }
  }
);

// Premium 상태 확인
export const checkPremiumStatus = createAsyncThunk(
  'spotifyAuth/checkPremium',
  async (accessToken, { rejectWithValue }) => {
    try {
      const response = await axios.get('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      return {
        isPremium: response.data.product === 'premium',
        product: response.data.product
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 로그아웃
export const logoutSpotify = createAsyncThunk(
  'spotifyAuth/logout',
  async (userId, { rejectWithValue }) => {
    try {
      await axios.post(`${API_BASE}/spotify/auth/logout`, { user_id: userId });
      await AsyncStorage.multiRemove([
        'spotify_access_token',
        'spotify_expires_at',
        'spotify_scope',
        'spotify_device_id'
      ]);
      return;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  accessToken: null,
  expiresAt: null,
  scope: null,
  isAuthenticating: false,
  error: null,
  playbackDeviceId: null,
  isPremium: null,
  product: null,
  isInitialized: false
};

const spotifyAuthSlice = createSlice({
  name: 'spotifyAuth',
  initialState,
  reducers: {
    setDeviceId: (state, action) => {
      state.playbackDeviceId = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    restoreFromStorage: (state, action) => {
      const { accessToken, expiresAt, scope, deviceId } = action.payload;
      state.accessToken = accessToken;
      state.expiresAt = expiresAt;
      state.scope = scope;
      state.playbackDeviceId = deviceId;
      state.isInitialized = true;
    }
  },
  extraReducers: (builder) => {
    builder
      // initiateSpotifyAuth
      .addCase(initiateSpotifyAuth.pending, (state) => {
        state.isAuthenticating = true;
        state.error = null;
      })
      .addCase(initiateSpotifyAuth.fulfilled, (state) => {
        state.isAuthenticating = false;
      })
      .addCase(initiateSpotifyAuth.rejected, (state, action) => {
        state.isAuthenticating = false;
        state.error = action.payload;
      })
      // exchangeSpotifyCode
      .addCase(exchangeSpotifyCode.pending, (state) => {
        state.isAuthenticating = true;
      })
      .addCase(exchangeSpotifyCode.fulfilled, (state, action) => {
        state.isAuthenticating = false;
        state.accessToken = action.payload.accessToken;
        state.expiresAt = action.payload.expiresAt;
        state.scope = action.payload.scope;
        state.isInitialized = true;
      })
      .addCase(exchangeSpotifyCode.rejected, (state, action) => {
        state.isAuthenticating = false;
        state.error = action.payload;
      })
      // refreshSpotifyToken
      .addCase(refreshSpotifyToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.expiresAt = action.payload.expiresAt;
        state.error = null;
      })
      .addCase(refreshSpotifyToken.rejected, (state, action) => {
        state.error = action.payload;
        // 토큰 갱신 실패 시 로그아웃 처리
        state.accessToken = null;
        state.expiresAt = null;
      })
      // checkPremiumStatus
      .addCase(checkPremiumStatus.fulfilled, (state, action) => {
        state.isPremium = action.payload.isPremium;
        state.product = action.payload.product;
      })
      // logoutSpotify
      .addCase(logoutSpotify.fulfilled, (state) => {
        return { ...initialState, isInitialized: true };
      });
  }
});

export const { setDeviceId, clearError, restoreFromStorage } = spotifyAuthSlice.actions;
export default spotifyAuthSlice.reducer;
```

### F.2 playerSlice.js 확장 필드 (기존 파일 수정)
```javascript
// 추가할 상태
const initialState = {
  // ...기존 상태
  queue: [],              // 재생 대기열
  queueIndex: 0,          // 현재 재생 중인 곡 인덱스
  originalQueue: [],      // 셔플 전 원본 대기열
  repeatMode: 'off',      // 'off' | 'track' | 'queue'
  playbackSource: 'preview', // 'preview' | 'spotify'
  adapterType: 'PreviewAudio', // 'PreviewAudio' | 'SpotifyRemote'
  seekInProgress: false,  // 시킹 중인지 여부
  lastActionTS: null,     // 마지막 액션 타임스탬프 (디버깅용)
  isTransitioning: false, // 트랙 전환 중 플래그 (race condition 방지)
};

// 추가할 액션/thunks
export const loadQueue = createAsyncThunk(
  'player/loadQueue',
  async ({ tracks, startIndex = 0 }, { dispatch, getState }) => {
    // 큐 로드 및 첫 트랙 재생
    return { tracks, startIndex };
  }
);

export const playFromQueue = createAsyncThunk(
  'player/playFromQueue',
  async (index, { dispatch, getState }) => {
    const { queue, isTransitioning } = getState().player;
    if (isTransitioning) return;
    
    if (index < 0 || index >= queue.length) {
      throw new Error('Invalid queue index');
    }
    
    const track = queue[index];
    await dispatch(playTrack(track));
    return index;
  }
);

export const nextTrack = createAsyncThunk(
  'player/nextTrack',
  async (_, { dispatch, getState }) => {
    const { queueIndex, queue, repeatMode } = getState().player;
    
    if (repeatMode === 'track') {
      await dispatch(playFromQueue(queueIndex));
      return;
    }
    
    if (queueIndex < queue.length - 1) {
      await dispatch(playFromQueue(queueIndex + 1));
    } else if (repeatMode === 'queue') {
      await dispatch(playFromQueue(0));
    } else {
      dispatch(stopTrack());
    }
  }
);

export const previousTrack = createAsyncThunk(
  'player/previousTrack',
  async (_, { dispatch, getState }) => {
    const { queueIndex, position } = getState().player;
    
    // 3초 이상 재생했으면 현재 곡 처음으로
    if (position > 3000) {
      dispatch(setPosition(0));
      return;
    }
    
    if (queueIndex > 0) {
      await dispatch(playFromQueue(queueIndex - 1));
    }
  }
);

export const handleTrackEnd = createAsyncThunk(
  'player/handleTrackEnd',
  async (_, { dispatch, getState }) => {
    const { repeatMode, queueIndex, queue } = getState().player;
    
    if (repeatMode === 'track') {
      await dispatch(playFromQueue(queueIndex));
    } else if (queueIndex < queue.length - 1) {
      await dispatch(nextTrack());
    } else if (repeatMode === 'queue') {
      await dispatch(playFromQueue(0));
    } else {
      dispatch(stopTrack());
    }
  }
);

export const toggleRepeatMode = () => (dispatch, getState) => {
  const { repeatMode } = getState().player;
  const modes = ['off', 'track', 'queue'];
  const currentIndex = modes.indexOf(repeatMode);
  const nextMode = modes[(currentIndex + 1) % modes.length];
  dispatch(playerSlice.actions.setRepeatMode(nextMode));
};

export const toggleShuffleMode = createAsyncThunk(
  'player/toggleShuffle',
  async (_, { dispatch, getState }) => {
    const { isShuffle, queue, queueIndex, originalQueue } = getState().player;
    
    if (!isShuffle) {
      // 셔플 활성화: 현재 곡 제외하고 나머지 섞기
      const currentTrack = queue[queueIndex];
      const remaining = queue.filter((_, i) => i !== queueIndex);
      const shuffled = [...remaining].sort(() => Math.random() - 0.5);
      const newQueue = [currentTrack, ...shuffled];
      
      return {
        isShuffle: true,
        queue: newQueue,
        originalQueue: queue,
        queueIndex: 0
      };
    } else {
      // 셔플 비활성화: 원본 큐로 복원
      const currentTrack = queue[queueIndex];
      const originalIndex = originalQueue.findIndex(t => t.id === currentTrack.id);
      
      return {
        isShuffle: false,
        queue: originalQueue,
        originalQueue: [],
        queueIndex: originalIndex >= 0 ? originalIndex : 0
      };
    }
  }
);

// Status 업데이트 (throttled)
let lastStatusUpdate = 0;
export const updatePlaybackStatus = (status) => (dispatch, getState) => {
  const now = Date.now();
  const { seekInProgress } = getState().player;
  
  // 250ms throttling
  if (now - lastStatusUpdate < 250) return;
  lastStatusUpdate = now;
  
  dispatch(playerSlice.actions._updatePlaybackStatus({
    positionMillis: status.positionMillis,
    durationMillis: status.durationMillis,
    isPlaying: status.isPlaying,
    seekInProgress
  }));
};

// Reducers 추가
reducers: {
  // ...기존 reducers
  setRepeatMode: (state, action) => {
    state.repeatMode = action.payload;
  },
  _updatePlaybackStatus: (state, action) => {
    const { positionMillis, durationMillis, isPlaying, seekInProgress } = action.payload;
    if (!seekInProgress) {
      state.position = positionMillis || state.position;
    }
    state.duration = durationMillis || state.duration;
    state.isPlaying = isPlaying;
  },
  setSeekInProgress: (state, action) => {
    state.seekInProgress = action.payload;
  },
  setTransitioning: (state, action) => {
    state.isTransitioning = action.payload;
  },
  setPlaybackSource: (state, action) => {
    state.playbackSource = action.payload; // 'preview' | 'spotify'
  },
  setAdapterType: (state, action) => {
    state.adapterType = action.payload; // 'PreviewAudio' | 'SpotifyRemote'
  }
}
```

## G. PlaybackAdapter 추상화 (최소 인터페이스 재확인)
```ts
interface IPlaybackAdapter {
	load(track, options?: { autoPlay?: boolean }): Promise<void>;
	play(): Promise<void>;
	pause(): Promise<void>;
	stop(): Promise<void>;
	seek(ms: number): Promise<void>;
	setVolume(v: number): Promise<void>;
	onStatus(cb: (status) => void): void; // {position,duration,isPlaying,didJustFinish}
	getCurrentTrack(): any;
	dispose(): Promise<void>;
}
```

구현체:
1. `PreviewAudioAdapter` (기존 expo-audio 활용)
2. `SpotifyRemoteAdapter` (`react-native-spotify-remote` 래핑)

## H. Adapter 교체 전략
1. 앱 부팅 시: `spotifyAuth.accessToken` & Premium 여부 검사.
2. Premium + 토큰 유효 → SpotifyRemoteAdapter 초기화 시도 (실패 시 fallback PreviewAudioAdapter)
3. 플레이 요청 시: preview_url만 있는 트랙 && adapter=SpotifyRemote → Spotify URI 구성(`spotify:track:<id>`) 후 remote play.
4. Preview 모드: 기존 로직 그대로.

## I. Queue 처리 & Spotify 전체곡 연계
현재 queue는 로컬 관리. Spotify 원격 장치와 동기화하려면:
옵션 A) 로컬 queue → track URI 단건씩 play() & handleTrackEnd에서 다음 호출.
옵션 B) Spotify의 특정 사용자 playlist 생성/임시 playlist에 bulk 추가 후 바로 재생 (추가 API 비용 & sync complexity).  
=> 초기엔 옵션 A 채택.

## J. 에러/경계 케이스
케이스 | 처리
-------|----
Premium 아님 | Adapter fallback → preview 모드 + 업셀 UI
Spotify 앱 미설치 | remote init 실패 → fallback
토큰 만료 | refresh 요청 → 실패 시 로그아웃/재인증
네트워크 단절 | offline 표시 + 재시도 버튼

## K. 개발 단계 (전체곡 관점) - 상세 체크리스트

### Phase 1: Backend 인프라 구축 (2-3일)
순서 | 작업 내용 | 예상 시간 | 완료 기준
----|---------|---------|----------
1.1 | DB Migration: spotify_tokens, playback_history 테이블 생성 | 2h | 테이블 생성 및 관계 설정 완료
1.2 | Sequelize Model: SpotifyToken, PlaybackHistory 구현 | 2h | Model 파일 작성 및 associations 설정
1.3 | 암호화 유틸리티 구현 (crypto 모듈) | 1h | encrypt/decrypt 함수 테스트 통과
1.4 | spotifyAuthController 구현 (token 교환/갱신) | 3h | 모든 엔드포인트 구현
1.5 | spotifyPlaybackController 구현 (재생 제어) | 3h | 12개 엔드포인트 구현
1.6 | routes/spotifyAuthRoutes.js 추가 | 1h | 라우팅 설정 완료
1.7 | routes/spotifyPlaybackRoutes.js 추가 | 1h | 라우팅 설정 완료
1.8 | app.js에 라우트 등록 | 0.5h | 서버 재시작 확인
1.9 | .env 환경변수 추가 (ENCRYPTION_KEY 등) | 0.5h | 키 생성 및 설정
1.10 | Postman/Thunder Client로 API 테스트 | 2h | 모든 엔드포인트 테스트

### Phase 2: Frontend 인증 인프라 (2-3일)
순서 | 작업 내용 | 예상 시간 | 완료 기준
----|---------|---------|----------
2.1 | utils/spotifyAuth.js 생성 (PKCE 로직) | 2h | PKCE 생성/검증 구현
2.2 | store/slices/spotifyAuthSlice.js 생성 | 3h | 모든 thunks 구현
2.3 | screens/SpotifyAuthScreen.js 생성 (인증 화면) | 2h | 로그인 버튼 및 리다이렉트 처리
2.4 | expo-auth-session, expo-crypto 설치 | 0.5h | 패키지 설치 확인
2.5 | app.json에 scheme 추가 (stonetify://) | 0.5h | Deep link 테스트
2.6 | AuthNavigator에 SpotifyAuthScreen 추가 | 1h | 네비게이션 연결
2.7 | AsyncStorage 복원 로직 (앱 시작 시) | 1.5h | 토큰 복원 테스트
2.8 | Premium 상태 확인 및 UI 표시 | 1h | Premium/Free 배지 표시
2.9 | 토큰 만료 자동 갱신 로직 | 2h | 백그라운드 갱신 구현
2.10 | 통합 테스트 (실제 Spotify 계정) | 2h | 로그인 플로우 전체 테스트

### Phase 3: Adapter 패턴 구현 (2-3일)
순서 | 작업 내용 | 예상 시간 | 완료 기준
----|---------|---------|----------
3.1 | utils/playback/ 디렉토리 생성 | 0.1h | 폴더 구조 생성
3.2 | IPlaybackAdapter.js 인터페이스 정의 | 1h | 모든 메서드 시그니처 정의
3.3 | PreviewAudioAdapter.js 구현 (기존 로직 이전) | 3h | 기존 expo-audio 로직 래핑
3.4 | AdapterFactory.js 구현 | 1.5h | 어댑터 선택 로직 완성
3.5 | playerSlice.js 리팩터링 (adapter 주입) | 4h | 모든 재생 thunks 수정
3.6 | initializePlaybackAdapter thunk 구현 | 2h | 어댑터 초기화 로직
3.7 | 기존 playTrack/pause/resume 수정 | 2h | adapter 메서드 호출로 변경
3.8 | queue 관련 thunks 구현 (loadQueue, nextTrack, etc) | 3h | 큐 로직 완성
3.9 | repeat/shuffle 로직 구현 | 2h | 모드 전환 및 동작 확인
3.10 | Preview 모드 통합 테스트 | 2h | 기존 기능 정상 동작 확인

### Phase 4: Spotify Remote 통합 (3-5일)
순서 | 작업 내용 | 예상 시간 | 완료 기준
----|---------|---------|----------
4.1 | Expo Managed → Bare workflow 마이그레이션 검토 | 1h | EAS Build vs Bare 결정
4.2 | react-native-spotify-remote 설치 | 1h | 패키지 설치 및 링크
4.3 | iOS 설정 (Info.plist, AppDelegate 수정) | 2h | iOS 빌드 성공
4.4 | Android 설정 (build.gradle, AndroidManifest) | 2h | Android 빌드 성공
4.5 | SpotifyRemoteAdapter.js 구현 | 4h | 모든 메서드 구현
4.6 | 연결/초기화 로직 구현 | 2h | init() 메서드 완성
4.7 | 재생 상태 리스너 구현 | 2h | playerStateChanged 처리
4.8 | 에러 처리 및 fallback 로직 | 2h | Premium 미가입 시 preview 전환
4.9 | AdapterFactory에 SpotifyRemote 통합 | 1h | 자동 어댑터 선택
4.10 | 디바이스 전환 UI 구현 (선택) | 2h | 디바이스 목록 선택
4.11 | iOS 실제 기기 테스트 (Premium 계정) | 2h | 전체 곡 재생 확인
4.12 | Android 실제 기기 테스트 | 2h | 전체 곡 재생 확인

### Phase 5: UI/UX 개선 (2-3일)
순서 | 작업 내용 | 예상 시간 | 완료 기준
----|---------|---------|----------
5.1 | MiniPlayer.js 구현 | 3h | 하단 미니 플레이어 표시
5.2 | AdvancedPlayer.js 큐 표시 추가 | 2h | 다음 재생 목록 UI
5.3 | Next/Previous 버튼 연결 | 1h | 버튼 동작 확인
5.4 | Repeat/Shuffle UI 업데이트 (enum 표시) | 1.5h | 아이콘 상태 변경
5.5 | Progress bar seek 구현 | 2h | 드래그 시킹 동작
5.6 | 재생 소스 표시 (Preview/Spotify 배지) | 1h | 배지 UI 추가
5.7 | 로딩/버퍼링 인디케이터 | 1h | 로딩 상태 표시
5.8 | 에러 Toast 메시지 구현 | 1h | 에러 발생 시 사용자 피드백
5.9 | Premium 업그레이드 안내 모달 | 2h | Free 사용자 안내
5.10 | 접근성 개선 (VoiceOver/TalkBack) | 2h | 스크린 리더 지원

### Phase 6: 최적화 및 QA (2-3일)
순서 | 작업 내용 | 예상 시간 | 완료 기준
----|---------|---------|----------
6.1 | 메모리 누수 검사 (adapter dispose) | 2h | 메모리 프로파일링
6.2 | 네트워크 재시도 로직 구현 | 2h | 연결 끊김 시 재시도
6.3 | 백그라운드 재생 처리 (선택) | 3h | 앱 최소화 시 재생 유지
6.4 | 오디오 세션 관리 (iOS) | 2h | 전화 수신 시 일시정지
6.5 | Race condition 방지 (isTransitioning) | 1.5h | 빠른 버튼 연타 테스트
6.6 | 성능 테스트 (큐 1000곡) | 1h | 대용량 큐 처리
6.7 | 에러 로깅 시스템 통합 (Sentry) | 2h | 에러 추적 설정
6.8 | E2E 테스트 시나리오 작성 | 2h | 주요 플로우 테스트
6.9 | Premium/Free 사용자 시나리오 테스트 | 2h | 양쪽 경우 검증
6.10 | 최종 통합 테스트 | 3h | 모든 기능 종합 확인

### Phase 7: 문서화 및 배포 준비 (1-2일)
순서 | 작업 내용 | 예상 시간 | 완료 기준
----|---------|---------|----------
7.1 | API 문서 작성 (Swagger/Postman) | 2h | 모든 엔드포인트 문서화
7.2 | 코드 주석 보완 | 1h | JSDoc 스타일 주석
7.3 | README 업데이트 (설정 가이드) | 1h | Spotify 연동 가이드
7.4 | 환경변수 템플릿 (.env.example) | 0.5h | 필수 변수 목록
7.5 | 마이그레이션 가이드 작성 | 1h | 기존 사용자 업데이트 방법
7.6 | 배포 스크립트 작성 (EAS Build) | 1.5h | iOS/Android 빌드 자동화
7.7 | 버전 관리 (package.json) | 0.5h | 버전 번호 업데이트
7.8 | 체인지로그 작성 (CHANGELOG.md) | 1h | v2.0 변경사항 정리
7.9 | 팀 리뷰 및 피드백 반영 | 2h | 코드 리뷰 완료
7.10 | 스토어 제출 준비 (스크린샷, 설명) | 2h | 앱 스토어 자료 준비

**총 예상 시간: 약 90-110시간 (2-3주)**

## L. Adapter 패턴 구현 상세

### L.1 IPlaybackAdapter 인터페이스 정의
```javascript
// utils/playback/IPlaybackAdapter.js
/**
 * 재생 어댑터 인터페이스
 * Preview 및 Spotify Remote 재생을 추상화
 */
export default class IPlaybackAdapter {
  /**
   * 트랙 로드
   * @param {Object} track - 재생할 트랙 객체
   * @param {Object} options - { autoPlay: boolean }
   */
  async load(track, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * 재생
   */
  async play() {
    throw new Error('Method not implemented');
  }

  /**
   * 일시정지
   */
  async pause() {
    throw new Error('Method not implemented');
  }

  /**
   * 정지 및 언로드
   */
  async stop() {
    throw new Error('Method not implemented');
  }

  /**
   * 재생 위치 이동
   * @param {number} positionMs - 이동할 위치 (밀리초)
   */
  async seek(positionMs) {
    throw new Error('Method not implemented');
  }

  /**
   * 볼륨 설정
   * @param {number} volume - 볼륨 (0.0 ~ 1.0)
   */
  async setVolume(volume) {
    throw new Error('Method not implemented');
  }

  /**
   * 재생 상태 콜백 등록
   * @param {Function} callback - (status) => void
   * status: { position, duration, isPlaying, didJustFinish }
   */
  onStatus(callback) {
    throw new Error('Method not implemented');
  }

  /**
   * 현재 트랙 정보 반환
   */
  getCurrentTrack() {
    throw new Error('Method not implemented');
  }

  /**
   * 어댑터 정리 및 리소스 해제
   */
  async dispose() {
    throw new Error('Method not implemented');
  }
}
```

### L.2 PreviewAudioAdapter 구현
```javascript
// utils/playback/PreviewAudioAdapter.js
import { Audio } from 'expo-audio';
import IPlaybackAdapter from './IPlaybackAdapter';

export default class PreviewAudioAdapter extends IPlaybackAdapter {
  constructor() {
    super();
    this.sound = null;
    this.currentTrack = null;
    this.statusCallback = null;
    this.statusUpdateInterval = null;
  }

  async load(track, { autoPlay = true } = {}) {
    if (!track.preview_url) {
      throw new Error('이 곡은 미리듣기를 제공하지 않습니다.');
    }

    // 기존 사운드 정리
    if (this.sound) {
      await this.dispose();
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: track.preview_url },
      { shouldPlay: autoPlay },
      this._onPlaybackStatusUpdate.bind(this)
    );

    this.sound = sound;
    this.currentTrack = track;

    // 주기적 상태 업데이트 (250ms)
    this._startStatusPolling();
  }

  async play() {
    if (!this.sound) throw new Error('No sound loaded');
    await this.sound.playAsync();
  }

  async pause() {
    if (!this.sound) throw new Error('No sound loaded');
    await this.sound.pauseAsync();
  }

  async stop() {
    if (this.sound) {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
      this.currentTrack = null;
    }
    this._stopStatusPolling();
  }

  async seek(positionMs) {
    if (!this.sound) throw new Error('No sound loaded');
    await this.sound.setPositionAsync(positionMs);
  }

  async setVolume(volume) {
    if (!this.sound) throw new Error('No sound loaded');
    await this.sound.setVolumeAsync(volume);
  }

  onStatus(callback) {
    this.statusCallback = callback;
  }

  getCurrentTrack() {
    return this.currentTrack;
  }

  async dispose() {
    this._stopStatusPolling();
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (error) {
        console.warn('Error disposing sound:', error);
      }
      this.sound = null;
    }
    this.currentTrack = null;
    this.statusCallback = null;
  }

  // Private methods
  _onPlaybackStatusUpdate(status) {
    if (!status.isLoaded) return;

    const normalizedStatus = {
      position: status.positionMillis || 0,
      duration: status.durationMillis || 0,
      isPlaying: status.isPlaying || false,
      didJustFinish: status.didJustFinish || false
    };

    if (this.statusCallback) {
      this.statusCallback(normalizedStatus);
    }
  }

  _startStatusPolling() {
    this._stopStatusPolling();
    this.statusUpdateInterval = setInterval(async () => {
      if (this.sound) {
        try {
          const status = await this.sound.getStatusAsync();
          this._onPlaybackStatusUpdate(status);
        } catch (error) {
          console.error('Status polling error:', error);
        }
      }
    }, 250);
  }

  _stopStatusPolling() {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }
}
```

### L.3 SpotifyRemoteAdapter 구현
```javascript
// utils/playback/SpotifyRemoteAdapter.js
import SpotifyRemote from 'react-native-spotify-remote';
import IPlaybackAdapter from './IPlaybackAdapter';

export default class SpotifyRemoteAdapter extends IPlaybackAdapter {
  constructor(tokenProvider) {
    super();
    this.tokenProvider = tokenProvider;
    this.currentTrack = null;
    this.statusCallback = null;
    this.playerStateSubscription = null;
    this.isConnected = false;
  }

  async init() {
    try {
      const token = await this.tokenProvider();
      const config = {
        clientID: 'YOUR_SPOTIFY_CLIENT_ID',
        redirectURL: 'stonetify://auth/spotify',
        tokenRefreshURL: 'http://your-backend/api/spotify/auth/refresh',
        tokenSwapURL: 'http://your-backend/api/spotify/auth/token',
        scopes: [
          'user-read-playback-state',
          'user-modify-playback-state',
          'streaming'
        ]
      };

      await SpotifyRemote.connect(config);
      this.isConnected = true;

      // 상태 변경 리스너
      this.playerStateSubscription = SpotifyRemote.addListener(
        'playerStateChanged',
        this._onPlayerStateChanged.bind(this)
      );
    } catch (error) {
      console.error('Spotify Remote connection failed:', error);
      throw error;
    }
  }

  async load(track, { autoPlay = true } = {}) {
    if (!this.isConnected) {
      await this.init();
    }

    const uri = track.uri || `spotify:track:${track.id}`;
    this.currentTrack = track;

    try {
      await SpotifyRemote.playUri(uri);
      if (!autoPlay) {
        await SpotifyRemote.pause();
      }
    } catch (error) {
      console.error('Failed to load track:', error);
      throw new Error('Spotify 재생 실패. Premium 계정이 필요합니다.');
    }
  }

  async play() {
    if (!this.isConnected) throw new Error('Not connected to Spotify');
    await SpotifyRemote.resume();
  }

  async pause() {
    if (!this.isConnected) throw new Error('Not connected to Spotify');
    await SpotifyRemote.pause();
  }

  async stop() {
    if (!this.isConnected) return;
    await SpotifyRemote.pause();
    this.currentTrack = null;
  }

  async seek(positionMs) {
    if (!this.isConnected) throw new Error('Not connected to Spotify');
    await SpotifyRemote.seek(positionMs);
  }

  async setVolume(volume) {
    if (!this.isConnected) throw new Error('Not connected to Spotify');
    // Spotify Remote는 디바이스 볼륨 제어 제한적
    console.warn('Volume control is limited with Spotify Remote');
  }

  onStatus(callback) {
    this.statusCallback = callback;
  }

  getCurrentTrack() {
    return this.currentTrack;
  }

  async dispose() {
    if (this.playerStateSubscription) {
      this.playerStateSubscription.remove();
      this.playerStateSubscription = null;
    }

    if (this.isConnected) {
      try {
        await SpotifyRemote.disconnect();
      } catch (error) {
        console.warn('Error disconnecting Spotify:', error);
      }
      this.isConnected = false;
    }

    this.currentTrack = null;
    this.statusCallback = null;
  }

  // Private methods
  _onPlayerStateChanged(state) {
    if (!state || !state.track) return;

    const normalizedStatus = {
      position: state.playbackPosition || 0,
      duration: state.track.duration || 0,
      isPlaying: !state.isPaused,
      didJustFinish: state.playbackPosition >= state.track.duration - 500
    };

    if (this.statusCallback) {
      this.statusCallback(normalizedStatus);
    }
  }
}
```

### L.4 Adapter Factory (어댑터 선택 로직)
```javascript
// utils/playback/AdapterFactory.js
import PreviewAudioAdapter from './PreviewAudioAdapter';
import SpotifyRemoteAdapter from './SpotifyRemoteAdapter';

export default class AdapterFactory {
  /**
   * 적절한 어댑터 생성
   * @param {Object} options - { isPremium, accessToken, tokenProvider }
   */
  static createAdapter({ isPremium, accessToken, tokenProvider }) {
    // Premium 사용자이고 토큰이 유효한 경우 Spotify Remote 시도
    if (isPremium && accessToken && tokenProvider) {
      try {
        return {
          adapter: new SpotifyRemoteAdapter(tokenProvider),
          type: 'SpotifyRemote',
          source: 'spotify'
        };
      } catch (error) {
        console.warn('Failed to create Spotify adapter, falling back to preview:', error);
      }
    }

    // Fallback: Preview
    return {
      adapter: new PreviewAudioAdapter(),
      type: 'PreviewAudio',
      source: 'preview'
    };
  }

  /**
   * 어댑터 초기화 및 준비
   */
  static async initializeAdapter(adapter, type) {
    if (type === 'SpotifyRemote') {
      await adapter.init();
    }
    return adapter;
  }
}
```

### L.5 playerSlice에 Adapter 통합
```javascript
// store/slices/playerSlice.js 수정
import AdapterFactory from '../../utils/playback/AdapterFactory';

let currentAdapter = null;

// Adapter 초기화 thunk
export const initializePlaybackAdapter = createAsyncThunk(
  'player/initializeAdapter',
  async (_, { getState }) => {
    const { spotifyAuth } = getState();
    const { accessToken, isPremium } = spotifyAuth;

    // 기존 어댑터 정리
    if (currentAdapter) {
      await currentAdapter.dispose();
    }

    const tokenProvider = async () => {
      // 토큰 만료 확인 및 갱신 로직
      const { expiresAt } = getState().spotifyAuth;
      if (Date.now() >= expiresAt - 60000) {
        // 1분 전에 갱신
        await dispatch(refreshSpotifyToken(userId));
        return getState().spotifyAuth.accessToken;
      }
      return accessToken;
    };

    const { adapter, type, source } = AdapterFactory.createAdapter({
      isPremium,
      accessToken,
      tokenProvider
    });

    await AdapterFactory.initializeAdapter(adapter, type);

    // Status 콜백 등록
    adapter.onStatus((status) => {
      dispatch(updatePlaybackStatus(status));
      if (status.didJustFinish) {
        dispatch(handleTrackEnd());
      }
    });

    currentAdapter = adapter;

    return { type, source };
  }
);

// playTrack 수정 (adapter 사용)
export const playTrack = createAsyncThunk(
  'player/playTrack',
  async (track, { dispatch, getState, rejectWithValue }) => {
    try {
      if (!currentAdapter) {
        await dispatch(initializePlaybackAdapter());
      }

      dispatch(playerSlice.actions.setLoading());
      await currentAdapter.load(track, { autoPlay: true });

      return track;
    } catch (error) {
      console.error('재생 오류:', error);
      return rejectWithValue(error.message);
    }
  }
);
```

## M. 보안 & 정책 고려
- Client Secret은 절대 모바일 번들에 포함하지 않는다.
- Refresh Token 암호화 저장 (서버 DB) + Rotation 고려.
- 사용자 로그아웃 시 서버측 refresh token 폐기.

## N. 마이그레이션 체크리스트
항목 | 완료기준
----|---------
Bare 전환 | iOS/Android 빌드 성공
Auth Flow | Premium 계정 로그인 후 access 갱신 OK
Adapter 교체 | remote 연결 시 preview 코드 미사용
Fallback | Premium 아님 / 실패 시 preview 정상 동작
Queue & Repeat | remote + preview 동일 행태
Seek & Volume | 0.5초 이하 지연
에러 로깅 | Sentry/console 내부 구분

## O. 향후 추가 개선
- Crossfade / Gapless (Spotify SDK 설정)
- Loudness Normalization 토글
- 현재 재생과 추천 알고리즘 피드백 연동 (skip 이벤트 수집)
- ‘최근 재생’ 저장 및 세션간 복원

## P. 최종 결론
전체곡 재생은 인증/네이티브 의존성이 있으므로 3단계(Backend 인증 → Adapter 추상화 → Remote Adapter 구현)로 분리하며, preview fallback을 유지해 사용자 경험 저하를 최소화한다.

문서 개정: 2025-10-02 (v2 추가)


## Q. 보안 강화 방안

### Q.1 토큰 암호화 처리 (AES-256-GCM)
```javascript
// utils/encryption.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// .env에서 읽기: openssl rand -hex 32
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

exports.encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

exports.decrypt = (encryptedData) => {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};
```

### Q.2 Rate Limiting 구현
```javascript
// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

// Auth 엔드포인트: 10 requests per 15 minutes
exports.authLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:'
  }),
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: '너무 많은 로그인 요청입니다. 잠시 후 다시 시도해주세요.'
});

// Playback 엔드포인트: 100 requests per minute
exports.playbackLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:playback:'
  }),
  windowMs: 60 * 1000,
  max: 100,
  message: '재생 관련 요청이 너무 많습니다.'
});
```

## R. 테스트 커버리지 및 품질 보증

### R.1 필수 테스트 시나리오
시나리오 | 목적 | 예상 결과 | 우선순위
--------|------|----------|--------
Preview 재생 | 기본 재생 검증 | 30초 미리듣기 가능 | 최상
Spotify 연동재생 재생 (Premium) | 연동재생 스트리밍 | 전체곡 재생 가능 | 최상
Non-Premium 사용자 fallback | 연동재생 실패 | Preview로 자동 전환 | 최상
토큰 만료 자동 갱신 | 인증 유지 | 백그라운드 자동 갱신 | 최상
네트워크 오류 처리 | 에러 처리 | 재연결 및 재생 복구 | 상
큐 1000곡 테스트 | 성능 검증 | 지연 없이 동작 | 상
빠른 버튼 연타 (race condition) | 동시성 | 크래시 방지 | 최상
곡 재생 중단 후 재개 | 상태 관리 | 정확한 위치 재개 복구 | 상

### R.2 보안 테스트 항목
- [ ] SQL Injection 방어 (Sequelize parameterized query)
- [ ] XSS 공격 방어 (입력 sanitization)
- [ ] CSRF 토큰 검증
- [ ] Rate limiting 동작 확인
- [ ] 토큰 암호화/복호화 정확성
- [ ] Refresh token rotation 검증
- [ ] 민감한 정보 로그 제외 확인

## S. 성능 최적화 및 모니터링

### S.1 성능 최적화 체크리스트
항목 | 최적화 방법 | 목표 수치
----|-----------|----------
메모리 사용 | Adapter dispose, 큐 크기 제한 (500곡) | < 100MB
앱 로딩 시간 | Code splitting, Lazy loading | < 3초
재생 시작 | Audio preloading, Adapter 재사용 | < 500ms
UI 반응성 | React.memo, FlatList 최적화 | 60 FPS
API 응답 시간 | 토큰 캐싱, Connection pooling | < 300ms (p95)
번들 크기 | Tree shaking, 중복 제거 | < 10MB

### S.2 모니터링 설정
```javascript
// Sentry 설정
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  beforeSend(event) {
    // 민감한 정보 필터링
    if (event.request) delete event.request.cookies;
    return event;
  }
});

// 에러 전송
Sentry.captureException(error, {
  tags: { feature: 'playback' },
  contexts: { track: { id: track.id } }
});
```

## T. 배포 및 런칭 가이드

### T.1 배포 전 체크리스트
**Backend**
- [ ] 환경변수 production 설정 (.env)
- [ ] Database migration 완료
- [ ] 암호화 키 (ENCRYPTION_KEY) 설정
- [ ] Rate limiting 활성화
- [ ] HTTPS 인증서 설정
- [ ] CORS 정책 설정
- [ ] 로깅 레벨 설정 (info/error)
- [ ] Health check endpoint (/health)
- [ ] 백업 자동화 설정

**Frontend**
- [ ] API 엔드포인트 URL production으로 변경
- [ ] Spotify Client ID production 키 적용
- [ ] Sentry DSN 설정
- [ ] Analytics 키 설정
- [ ] 앱 스토어 및 플레이스토어 빌드 설정 확인
- [ ] Privacy Policy & Terms 링크 추가
- [ ] App Store/Play Store 메타데이터 준비
- [ ] Beta 테스트 완료
- [ ] Production build (eas build --platform all)

### T.2 런칭 모니터링 지표
지표 | 목표 | 측정 도구
----|------|--------
DAU (Daily Active Users) | 1,000+ | Firebase Analytics
앱 안정성 | > 95% | Sentry
Premium 전환율 | > 5% | Custom Analytics
평균 체류 시간 | > 15분 | Firebase
앱 크래시율 | < 1% | Crashlytics
API 평균 응답시간 | < 300ms | Backend Monitoring

## U. 트러블슈팅 가이드

### U.1 일반적인 문제 및 해결
문제 | 원인 | 해결 방법
----|------|--------
토큰 인증 실패 | Access token 만료 | refresh token으로 자동 갱신
Spotify Remote 연결 실패 | Premium 아님 또는 Spotify 앱 미설치 | Preview fallback으로 전환
Preview URL null | 일부 곡 미리듣기 불가능 | 자동 skip 또는 사용자 안내
메모리 누수 | Adapter dispose 누락 | 컴포넌트 unmount 시 dispose 호출
Race condition | 빠른 버튼 연타 | isTransitioning flag 활용
네트워크 타임아웃 | 느린 연결 | Retry 로직 + 사용자 피드백

### U.2 디버깅 팁
```javascript
// 개발 환경 디버깅 로그
if (__DEV__) {
  console.log('[Player] Current state:', {
    track: currentTrack?.name,
    position: position,
    duration: duration,
    isPlaying: isPlaying,
    adapterType: adapterType
  });
}

// Redux DevTools 활성화
const store = configureStore({
  reducer: rootReducer,
  devTools: __DEV__
});
```

## V. 핵심 원칙 및 향후 로드맵

### 핵심 원칙
1. **점진적 개선**: Preview → Spotify 단계적 구현
2. **Fallback 전략**: 항상 작동하는 최소 기능 (Preview)
3. **보안 우선**: 토큰 암호화, Rate limiting 필수
4. **사용자 경험**: 명확한 로딩/에러 피드백
5. **모니터링**: Sentry + Analytics 실시간 추적
6. **최적화**: 메모리 관리, 네트워크 효율화

### 성공 지표 (KPI)
- **기술적 안정성**: 앱 안정성 95%+, 크래시율 1% 미만
- **비즈니스 성과**: DAU 1,000+, Premium 전환율 5%+
- **사용자 만족도**: 앱스토어 평점 4.5+ (5.0 만점)

### 타임라인
**MVP (2주)**: Preview 재생 + 큐 관리 + Repeat/Shuffle
**Beta (4주)**: PKCE 인증 + Adapter 구조 + Spotify Remote
**Production (6주)**: 보안 강화 + 성능 최적화 + 사용자 테스트

### 리스크 및 대응 방안
리스크 | 영향 | 대응 방안
------|------|--------
Spotify API 정책 변경 | 높음 | 공식 문서 주기적 모니터링
Premium 전환율 저조 | 중 | Preview 경험 최적화
네이티브 빌드 설정 문제 | 높음 | EAS Build 사용, CI/CD 구축
토큰 탈취 | 매우 높음 | 암호화 + Rate limiting + 모니터링

---
**최종 작성 날짜: 2025-10-02 (v3 완성 - 전체 앱 개발 마스터 가이드)**

이 계획서는 Stonetify의 전체 앱 개발 단계를 단계별로 정리하기 위한 종합 인덱스입니다.
- **Phase 1-3**: Preview 재생 MVP 완성
- **Phase 4-7**: Spotify Premium 연동재생 재생 구현
- **보안, 테스트, 배포**: 프로덕션 수준 품질 보증

각 단계를 순차적으로 완료 진행하며, 이전 단계가 안정적이면 완료된 후 다음 단계를 진행합니다.

---
# (v4) 현재 구현 상태 기반 실행 재정렬 계획 (2025-10-02)

## 0. 목적
중복된 v1~v3 서술을 통합하고, 이미 완료된 Preview 기반 MVP/Adapter/PKCE 기초를 바탕으로 “데이터 영속 + Remote 전체곡 + 품질 체계”를 가장 빠르게 확보하기 위한 재정렬된 실행 로드맵을 정의한다.

## 1. 현재 스냅샷 요약 (Observed / Assumed)
Done (확인):
- Preview 재생 안정화: 큐, repeat/shuffle(enum), seek, position/duration throttling(≈250ms), track end 처리, skip fallback(toast), state 복원(기초) 구현
- Adapter 레이어: PreviewAudioAdapter 실제 사용, SpotifyRemoteAdapter 스텁 존재, Adapter switch 로직 기초
- PKCE Auth + Access/Refresh flow (in-memory rotation), revoke, premium detection 기초
- Security: AES-256-GCM 유틸, rateLimiter 미들웨어, refresh token rotation in-memory 버전
- Monitoring: Sentry init(front/back) + 최소 analytics (play_start, adapter_switch)
- UI: PlayerScreen 고급 컨트롤, MiniPlayer, toast, basic badges (partial)

Partial:
- Remote Adapter (SpotifyRemote) 실제 SDK 연동 미적용 (stub → preview fallback)
- Token persistence(DB) & rotation 영속성, playback_history 미생성
- Playback control backend endpoints (play/pause/seek/transfer/volume) 다수 미구현 / 미연결
- Analytics 확장 (pause/skip/complete/track_end + funnels) 미구현
- Premium upsell / source badge polish / buffering indicator 미완성
- Device management (list / transfer) 미구현
- Automated tests (unit/integration/E2E) 미작성
- Deployment artifacts (.env.example, migration guide, CI/CD tasks) 미정리

Pending:
- Native SDK/Bare (혹은 Config Plugin) 결정 및 설치
- DB migrations (spotify_tokens, playback_history) 적용 후 코드 연결
- Security hardening (refresh rotation persistence, anomaly detection)
- Performance profiling scripts & load test harness

## 2. 핵심 다음 4주 목표 (SMART)
1. Full-track Premium 재생 (Remote Adapter) 프로덕션 베타: iOS/Android 실기 테스트 통과 & fallback 무결성 유지 (주차 2 종료)
2. Token/Playback 데이터 영속화: DB 기반 rotation + playback_history 95% 이상 기록 성공 (주차 1.5 종료)
3. 안정성 지표: 재생 성공률 ≥95%, Crash율 <1% (Sentry), race-condition 재현 불가 (주차 3 측정)
4. 테스트 커버리지: 핵심 모듈(lines) 60%+, playerSlice & adapters mutation-branch 85%+ (주차 3 말)
5. 문서/배포: README + .env.example + Migration & Native 빌드 가이드 업데이트, EAS 빌드 성공 (주차 4)

## 3. Prioritized Epic Breakdown
EP1 DB & Security Hardening (Week 1)
- M1 Migration: spotify_tokens / playback_history / indices (idempotent)
- M2 Model wiring: encryption at DAO layer, rotation persistence (version, previous_refresh_at, attempt_count)
- M3 Controller refactor: exchange/refresh now hitting DB, rotation rules enforced (reuse existing in-memory logic)
- M4 playback_history write hook: (play_start, track_end|skip) + duration_played_ms + completed flag
- M5 Audit logs: security events (refresh_rotation_violation, revoke, premium_status_change)

EP2 Remote Playback Enablement (Week 1-2 overlap)
- R1 Decide Bare vs Config Plugin (doc trade-offs) → spike 0.5d
- R2 Add build scripts / app.json scheme confirm / native dependencies install
- R3 Implement SpotifyRemoteAdapter real methods (init/connect/listener/load/seek/cleanup)
- R4 Backend playback endpoints minimal set (play/pause/seek/next/previous/state) — align naming
- R5 Adapter selection refinement (retry + timed fallback + telemetry)
- R6 Device list & transfer (optional gating if time)

EP3 Analytics & Observability (Week 2-3)
- A1 Event taxonomy: play_start, play_complete, play_skip, pause, resume, adapter_switch, auth_refresh, error_playback
- A2 Client wrapper expansion + batching (flush on app background)
- A3 Sentry context enrichment (adapterType, premium, queueLength, trackId)
- A4 Funnel dashboards spec (doc only) + lightweight aggregator endpoint (optional)

EP4 Test & Quality Program (Week 3)
- T1 Unit: playerSlice (queue transitions, repeat, shuffle), spotifySlice (auth lifecycle), adapters (mocked)
- T2 Integration: queue load → seek → skip → repeat loop; token expiry triggers refresh; fallback from remote fail
- T3 E2E (Detox or Maestro) minimal flows: login premium, play full track, logout, non-premium fallback scenario
- T4 Performance script: simulate 1k queue operations + rapid next spam (assert no unhandled rejection)
- T5 Security tests: rotation misuse attempt, rate limit, encrypted token roundtrip

EP5 UX Polish & Upsell (Week 3-4)
- U1 Premium upsell modal (feature gating + CTA to open auth / upgrade info)
- U2 Source badge & buffering spinner (adapter status)
- U3 Queue UI expansion (next 3 tracks preview + skip missing preview auto-notice)
- U4 Accessibility labels & dynamic font scaling adjustments
- U5 Offline notice & graceful resume

EP6 Release & Documentation (Week 4)
- D1 README restructure (Quick Start / Architecture / Playback Flow Diagram)
- D2 .env.example + secrets management notes
- D3 Migration guide (v3 → v4) enumerating required env & scripts
- D4 CHANGELOG v4 & semantic version bump
- D5 EAS build pipelines (staging/prod) + health check endpoint finalize

## 4. Dependency Graph (Critical Path)
DB Migrations (EP1-M1) → Token persistence (M2/M3) → Analytics track_end accuracy (needs playback_history entries) → Remote Adapter (EP2) can start in parallel after M1 but before production must integrate M3 refresh logic.
Tests (EP4) require: adapter real + fallback + DB; hence schedule after EP2 R3 & EP1 M3.
Release artifacts (EP6) final after EP4 + EP5.

## 5. Detailed Task Matrix (RICE-ish Lightweight)
| Code | Task | Effort(d) | Impact | Confidence | Notes |
|------|------|----------|--------|------------|-------|
| M1 | Create migrations + run | 0.5 | High | High | Straightforward
| M2 | Model + encryption integration | 0.5 | High | High | Reuse util
| M3 | Refresh rotation persistence | 0.5 | High | Med | Edge cases
| R3 | RemoteAdapter full impl | 1.5 | High | Med | Native SDK unknowns
| R4 | Playback endpoints minimal | 0.5 | Med | High | Use axios proxy style
| A1 | Event taxonomy + constants | 0.25 | Med | High | Foundation
| T1 | playerSlice unit tests | 0.75 | High | High | Reducer deterministic
| T2 | Integration flows | 1 | High | Med | Async timing
| U1 | Upsell modal | 0.5 | Med | High | Simple screen/modal
| D2 | env template | 0.25 | Med | High | Quick win

## 6. Acceptance Criteria (Key Examples)
- Remote Full Track: Premium user plays ≥30s track; adapterType=SpotifyRemote; Sentry event play_complete logged with source=spotify.
- Fallback: For non-premium or connect error → adapterType=PreviewAudio within <800ms; user sees toast ‘Preview mode’. No crash.
- Rotation: After >N (config e.g. 3) refreshes in 5m window, server returns 429 + audit log; normal cadence passes.
- History: playback_history.completed=true for ≥90% of tracks where position ≥ (duration-1s).
- Queue Stress: 1000-track add + shuffle + sequential next produces <1% dropped dispatch (no error logs). 

## 7. Testing Strategy Mapping
| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Jest | slices, adapters (mock natives) |
| Integration | Jest + RN Testing Library | queue flows, auth refresh |
| E2E | Detox/Maestro | full user journeys |
| Performance | Node script + instrumentation | queue ops, next spam |
| Security | Custom jest + supertest | rate limit, rotation, encryption |

## 8. Risk Updates & Mitigations
| Risk | Shift Since v3 | Mitigation |
|------|----------------|-----------|
| Native SDK build friction | Unchanged | Start POC (R1) early Day1 |
| Data inconsistency (in-memory vs DB) | Elevated | M1→M3 prioritized before heavy analytics |
| Event volume noise | New | Add sampling / debounce for rapid seek events |
| Refresh token abuse | Elevated | Rotation persistence + anomaly threshold alerts |

## 9. Observability Enhancements
- Structured log fields: { traceId, userId, adapterType, trackId, queueIndex, action }
- SLO Draft: Playback Start Latency p95 < 800ms; Refresh Failure Rate < 1% daily
- Alert Seeds: (a) play_start→play_complete ratio < 0.85 in 30m, (b) adapter_fallback spike > baseline+30%

## 10. Implementation Order (Concrete Sprint-style Sequencing)
Day 1: M1, M2, R1 spike, docs update (decision log)
Day 2: M3, R3 scaffold, R4 endpoints
Day 3: R3 finalize, A1/A2 analytics expansion, write hooks (M4)
Day 4: A3 Sentry enrichment, T1 unit tests, R5 fallback refinements
Day 5: T2 integration tests, U1 upsell modal, D2 env template
Day 6: T3 E2E initial, performance script, security tests (rate/rotation)
Day 7: U2/U3 polish, A4 funnel spec, fix defects
Day 8-9: EP5 remainder (accessibility/offline), EP4 T4/T5 finalize
Day 10: EP6 docs, changelog, build pipelines, release readiness review

## 11. Refactoring / Clean-Up Targets
- Consolidate duplicate encryption/rate limiting code fragments (retain single canonical section)
- Extract analytics event constants to single module (avoid string drift)
- Centralize adapter initialization side effects (remove scattered try/catch duplicates)

## 12. De-scope Guardrails (If Time Slips)
Priority Keep: M1-4, R3-5, T1-2, A1-3
Can Defer: Device transfer UI, playback_history optional fields (duration_played_ms precision), accessibility polish, funnel backend aggregator

## 13. Definition of Done (Global)
1. All acceptance criteria green in test dashboard
2. Zero high-severity Sentry issues open (last 24h)
3. Lint & test CI passing; coverage thresholds met
4. README & CHANGELOG updated; migrations applied in staging
5. Manual exploratory test checklist signed off (premium + free + offline)

## 14. Immediate Next Action
=> Proceed with EP1-M1: Add Sequelize migration + model integration for spotify_tokens/playback_history; wire refresh controller to DB. (No native changes yet.)

---
v4 작성: 2025-10-02
