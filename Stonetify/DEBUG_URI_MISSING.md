# 🔧 Spotify Token Revoked + URI Missing 디버깅 가이드

## 현재 상황 분석

### 백엔드 로그 분석
```
🎵 [Playback][play] Request: {
  userId: '-O_PaWCFN8leSP86pPO-',
  uris: undefined,              ⚠️ 문제 1: URI 없음
  context_uri: undefined,
  position_ms: undefined,
  device_id: undefined
}
🔴 [getAccessTokenForUser] Refresh token revoked by Spotify  ✅ 정상 감지
🔴 [SpotifyTokenModel] Marking token as revoked              ✅ 정상 처리
⚠️ [Playback][play] Could not check devices                 ⚠️ 문제 2: 장치 체크 중 에러
📤 [Playback][play] Sending to Spotify API: {}               ⚠️ 빈 body 전송
🔴 [Playback][play] Token revoked - user needs to reconnect  ✅ 에러 반환
```

### 문제 요약

1. **✅ TOKEN_REVOKED 처리는 정상 작동**
   - Spotify의 `invalid_grant` 에러 감지
   - DB에 revoked 상태 저장
   - 사용자에게 재연결 안내

2. **⚠️ URI가 undefined로 전달됨**
   - 프론트엔드에서 track 객체가 제대로 전달되지 않음
   - 또는 track에 `spotify_id` 필드가 없음

3. **⚠️ 장치 체크 중 TOKEN_REVOKED 에러 발생**
   - 원래는 새 곡 재생 시에만 장치 체크해야 함
   - URI 없을 때는 장치 체크 스킵하도록 수정 완료

## 적용된 수정사항

### 1. Backend: 장치 체크 로직 개선

**Before:**
```javascript
// 항상 장치 체크 → TOKEN_REVOKED 에러로 중단
try {
  const devices = await spotifyRequest(userId, 'get', '/me/player/devices', null);
  // ...
} catch (deviceError) {
  console.error('Could not check devices:', deviceError.message);
  // Continue anyway
}
```

**After:**
```javascript
// URI 있을 때만 장치 체크
if (uris || context_uri) {
  try {
    const devices = await spotifyRequest(userId, 'get', '/me/player/devices', null);
    // ...
  } catch (deviceError) {
    // TOKEN_REVOKED는 즉시 전파
    if (deviceError.code === 'TOKEN_REVOKED' || deviceError.requiresReauth) {
      throw deviceError;
    }
    console.error('Could not check devices:', deviceError.message);
    // Continue anyway
  }
}
```

### 2. Frontend: Track 객체 디버깅 로그 추가

```javascript
async load(track, autoPlay = true) {
  // 전체 track 객체 로깅
  console.log('🎵 [RestRemoteAdapter] Received track object:', {
    fullTrack: track,
    allKeys: track ? Object.keys(track) : []
  });
  
  // Spotify ID 추출
  const spotifyId = track.spotify_id || track.spotifyId || 
                   (track.id && !track.id.startsWith('-') ? track.id : null);
  const uris = track.uri ? [track.uri] : 
               (spotifyId ? [\`spotify:track:\${spotifyId}\`] : []);
  
  console.log('🎵 [RestRemoteAdapter] Loading track:', {
    trackName: track.name || track.title,
    trackId: track.id,
    spotifyId: track.spotify_id || track.spotifyId,
    extractedSpotifyId: spotifyId,
    uri: track.uri,
    finalUris: uris
  });
  
  // URI 없으면 에러
  if (!uris.length) {
    console.error('❌ [RestRemoteAdapter] Track missing valid Spotify URI/ID:', track);
    throw new Error('Track missing valid Spotify URI/ID');
  }
  
  // 재생 시도
  await apiService.playRemote({ userId: this.userId, uris });
}
```

## 🔍 디버깅 단계

### 단계 1: 앱 재시작

```powershell
# Backend
cd Backend
npm start

# Frontend (새 터미널)
cd Frontend
npm start
```

### 단계 2: 곡 재생 시도 및 로그 확인

**프론트엔드 콘솔에서 확인할 내용:**

```javascript
// 1. Track 정규화
🔄 [normalizeTrack] {
  originalId: "???",
  spotifyId: "???",         // ⚠️ 이 값이 있어야 함
  extractedId: "???",
  uri: "???",
  trackName: "곡 제목"
}

// 2. Adapter에서 받은 Track
🎵 [RestRemoteAdapter] Received track object: {
  fullTrack: { ... },       // ⚠️ 전체 객체 확인
  allKeys: ["id", "name", "spotify_id", ...]  // ⚠️ spotify_id 키 있는지 확인
}

// 3. URI 생성 결과
🎵 [RestRemoteAdapter] Loading track: {
  spotifyId: "6rqhFgbbKwnb9MLmUQDhG6",  // ⚠️ 22자 영숫자여야 함
  finalUris: ["spotify:track:6rqhFgbbKwnb9MLmUQDhG6"]  // ⚠️ 정상 URI
}

// 4. API 요청
📡 [API Request] Playback Play: {
  uris: ["spotify:track:6rqhFgbbKwnb9MLmUQDhG6"]  // ⚠️ 이 값이 있어야 함
}
```

**백엔드 콘솔에서 확인할 내용:**

```javascript
// 1. 받은 요청
🎵 [Playback][play] Request: {
  userId: "-O_PaWCFN8leSP86pPO-",
  uris: ["spotify:track:6rqhFgbbKwnb9MLmUQDhG6"],  // ⚠️ 있어야 함
  // ...
}

// 2. TOKEN_REVOKED 감지 (있는 경우)
🔴 [getAccessTokenForUser] Refresh token revoked by Spotify
🔴 [SpotifyTokenModel] Marking token as revoked
🔴 [Playback][play] Token revoked - user needs to reconnect

// 3. 정상 재생 (토큰 정상인 경우)
🔊 [Playback][play] Available devices: 1
🌐 [spotifyRequest] Making request to Spotify API
✅ [spotifyRequest] Success: 204
✅ [Playback][play] Success
```

### 단계 3: 문제별 해결 방법

#### 문제 A: `uris: undefined` (현재 상황)

**증상:**
```
🎵 [Playback][play] Request: { uris: undefined }
```

**원인:**
1. Track 객체에 `spotify_id` 없음
2. Track 객체가 null/undefined
3. Track ID가 Firebase ID (시작이 `-`)

**해결:**
```javascript
// 프론트엔드 로그 확인:
🎵 [RestRemoteAdapter] Received track object: {
  fullTrack: { id: "-O_xxx", name: "...", ... },  // ❌ spotify_id 없음!
  allKeys: ["id", "name", "artist", ...]           // ❌ "spotify_id" 키 없음
}

// 해결 방법:
// 1. 검색 결과 확인 - spotify_id 포함되는지 체크
// 2. DB 데이터 확인 - songs 테이블에 spotify_id 있는지 체크
// 3. playlistController 확인 - songs 반환 시 spotify_id 포함하는지 체크
```

#### 문제 B: TOKEN_REVOKED

**증상:**
```
🔴 [getAccessTokenForUser] Refresh token revoked by Spotify
```

**해결:**
```
1. 프로필 화면으로 이동
2. "Spotify 연결 끊기" 클릭 (있는 경우)
3. "Spotify 연결" 버튼 클릭
4. Spotify 인증 완료
5. 다시 곡 재생 시도
```

#### 문제 C: NO_ACTIVE_DEVICE

**증상:**
```
⚠️ [Playback][play] No active Spotify devices found
```

**해결:**
```
1. 휴대폰에서 Spotify 앱 열기
2. PC에서 Spotify 데스크톱 앱 열기
3. 브라우저에서 open.spotify.com 열기
4. 앱에서 다시 재생 시도
```

## 📊 체크리스트

### 프론트엔드 체크리스트

- [ ] **Track 객체에 spotify_id 있는지 확인**
  ```javascript
  // 콘솔에서 확인:
  🎵 [RestRemoteAdapter] Received track object
  → allKeys 배열에 "spotify_id" 있어야 함
  ```

- [ ] **검색 결과 확인**
  ```javascript
  // Backend: spotifyController.js 확인
  spotify_id: item.id  // ✅ 있어야 함
  ```

- [ ] **플레이리스트 곡 목록 확인**
  ```javascript
  // Backend: Song.findByPlaylistId() 확인
  // songs 테이블의 spotify_id 필드 반환하는지
  ```

- [ ] **normalizeTrack 로그 확인**
  ```javascript
  🔄 [normalizeTrack] { spotifyId: "6rqh..." }
  // spotifyId가 22자 영숫자여야 함
  ```

### 백엔드 체크리스트

- [ ] **TOKEN_REVOKED 처리 작동**
  ```javascript
  🔴 [getAccessTokenForUser] Refresh token revoked
  🔴 [SpotifyTokenModel] Marking token as revoked
  ✅ 정상 작동
  ```

- [ ] **장치 체크 조건부 실행**
  ```javascript
  // uris 있을 때만 실행
  if (uris || context_uri) {
    🔊 [Playback][play] Available devices: X
  }
  ```

- [ ] **에러 응답 형식**
  ```javascript
  {
    message: "...",
    error: "TOKEN_REVOKED",
    requiresReauth: true
  }
  ```

## 🎯 다음 단계

### 즉시 해야 할 일

1. **앱 재시작 후 곡 재생 시도**
2. **프론트엔드 콘솔에서 이 로그들 확인:**
   - `🎵 [RestRemoteAdapter] Received track object`
   - `🎵 [RestRemoteAdapter] Loading track`
   - `📡 [API Request] Playback Play`

3. **로그 결과 공유:**
   ```
   만약 여전히 uris: undefined라면:
   → 전체 track 객체 로그 공유 필요
   → spotify_id가 없는 이유 파악 필요
   ```

### TOKEN_REVOKED 해결

1. **Spotify 재연결:**
   - 프로필 → Spotify 연결 → 인증 완료

2. **확인:**
   ```javascript
   // 재연결 후 프로필에서:
   ✅ "Spotify 연결됨" 표시
   ✅ isPremium 상태 확인
   ```

3. **재생 시도:**
   - 곡 검색 → 플레이리스트 추가 → 재생
   - 이번엔 TOKEN_REVOKED 없어야 함

## 📝 요약

### 수정 완료
✅ TOKEN_REVOKED 에러 처리 (Backend + Frontend)
✅ 장치 체크를 URI 있을 때만 실행
✅ Track 객체 디버깅 로그 추가

### 확인 필요
⚠️ Track 객체에 spotify_id 있는지
⚠️ 프론트엔드 로그에서 finalUris 값
⚠️ 백엔드에 도착하는 uris 값

### 다음 단계
1. 앱 재시작
2. 곡 재생 시도
3. 프론트엔드 + 백엔드 전체 로그 확인
4. 로그에서 `spotify_id` 값 추적

---

**앱을 재시작하고 곡을 재생한 후, 프론트엔드와 백엔드의 전체 로그를 공유해주세요!**
