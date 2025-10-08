# 🔴 Spotify Refresh Token Revoked 오류 처리 완료

## 문제 상황
**"Refresh token revoked"** 오류 발생 시:
- Spotify 서버에서 리프레시 토큰이 만료되거나 폐기됨
- 사용자가 Spotify 계정 설정에서 앱 권한을 철회함
- 보안상의 이유로 Spotify가 토큰을 무효화함
- 장기간 미사용으로 토큰이 자동 만료됨

이 경우 사용자는 재로그인이 필요하며, 서버/클라이언트에서 자동으로 처리해야 합니다.

## ✅ 구현된 솔루션

### 1. Backend: Token Revocation 감지 및 처리

#### `controllers/spotifyPlaybackController.js` - getAccessTokenForUser()
```javascript
async function getAccessTokenForUser(userId){
  // ... existing code ...
  
  try {
    const tokenResp = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const { access_token, expires_in } = tokenResp.data;
    accessCache.set(userId, { accessToken: access_token, expiresAt: Date.now() + (expires_in*1000) });
    return access_token;
  } catch (error) {
    // ✅ Spotify에서 invalid_grant 에러 반환 시 (토큰 폐기됨)
    if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
      console.error('🔴 [getAccessTokenForUser] Refresh token revoked by Spotify:', userId);
      
      // DB에 revoked 상태 저장
      await SpotifyTokenModel.markRevoked(userId);
      
      // 캐시 삭제
      accessCache.delete(userId);
      
      // 커스텀 에러 생성
      const revokedError = new Error('Refresh token has been revoked by Spotify. Please reconnect your account.');
      revokedError.code = 'TOKEN_REVOKED';
      revokedError.requiresReauth = true;
      throw revokedError;
    }
    throw error;
  }
}
```

#### `controllers/spotifyPlaybackController.js` - 공통 에러 핸들러
```javascript
function handlePlaybackError(e, res, operation) {
  // TOKEN_REVOKED 에러 특별 처리
  if (e.code === 'TOKEN_REVOKED' || e.requiresReauth) {
    console.error(\`🔴 [Playback][\${operation}] Token revoked - user needs to reconnect\`);
    return res.status(401).json({
      message: 'Your Spotify session has expired or been revoked. Please reconnect your Spotify account.',
      error: 'TOKEN_REVOKED',
      requiresReauth: true
    });
  }
  
  // 기타 에러 처리...
}
```

#### 모든 Playback 엔드포인트에 적용
- ✅ `exports.getState` - 재생 상태 조회
- ✅ `exports.play` - 재생 시작
- ✅ `exports.pause` - 일시정지
- ✅ `exports.next` - 다음 곡
- ✅ `exports.previous` - 이전 곡
- ✅ `exports.seek` - 구간 이동
- ✅ `exports.setVolume` - 볼륨 조절
- ✅ `exports.getDevices` - 장치 목록
- ✅ `exports.transfer` - 장치 전환

### 2. Backend: SpotifyTokenModel 업데이트

#### `models/spotify_token.js` - markRevoked() 메서드 추가
```javascript
static async markRevoked(userId) {
  // 토큰을 revoked 상태로 표시
  console.log('🔴 [SpotifyTokenModel] Marking token as revoked for user:', userId);
  return this.revoke(userId);
}
```

### 3. Frontend: API Service 인터셉터

#### `services/apiService.js` - 응답 인터셉터
```javascript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // TOKEN_REVOKED 에러 처리
    if (error.response?.status === 401 && error.response?.data?.error === 'TOKEN_REVOKED') {
      console.error('🔴 [API] Spotify token revoked - clearing session');
      
      // 모든 인증 데이터 삭제
      await AsyncStorage.multiRemove(['token', 'user', 'spotifyToken', 'spotifyRefreshToken']);
      
      // 사용자 친화적 에러 메시지
      const revokedError = new Error('Spotify 연결이 만료되었습니다. 다시 로그인해주세요.');
      revokedError.code = 'TOKEN_REVOKED';
      revokedError.requiresReauth = true;
      revokedError.originalError = error;
      
      return Promise.reject(revokedError);
    }
    
    // 기타 에러 처리...
  }
);
```

### 4. Frontend: Redux Spotify Slice

#### `store/slices/spotifySlice.js` - clearSpotifySession 액션
```javascript
const spotifySlice = createSlice({
  name: 'spotify',
  initialState,
  reducers: {
    clearSpotifySession: (state) => {
      // Spotify 인증 상태 초기화
      state.accessToken = null;
      state.refreshTokenEnc = null;
      state.tokenExpiry = null;
      state.isPremium = false;
      state.error = null;
      console.log('🔴 [spotifySlice] Spotify session cleared due to token revocation');
    }
  },
  // ...
});

export const { clearSearchResults, clearSpotifySession } = spotifySlice.actions;
```

### 5. Frontend: Player Slice 에러 처리

#### `store/slices/playerSlice.js` - playTrack 에러 핸들링
```javascript
catch (error) {
  console.error('재생 오류:', error);
  
  // TOKEN_REVOKED 에러 특별 처리
  if (error.code === 'TOKEN_REVOKED' || error.requiresReauth) {
    console.error('🔴 [playTrack] Spotify token revoked');
    analyticsTrack('spotify_token_revoked', { trackId: track?.id });
    
    // Spotify 세션 초기화
    const { clearSpotifySession } = await import('./spotifySlice');
    dispatch(clearSpotifySession());
    
    return rejectWithValue({
      message: 'Spotify 연결이 만료되었습니다.\\n프로필에서 Spotify를 다시 연결해주세요.',
      code: 'TOKEN_REVOKED',
      requiresReauth: true
    });
  }
  
  // 기타 에러 처리...
}
```

### 6. Frontend: Adapter 에러 처리

#### `adapters/index.js` - RestRemoteAdapter.load()
```javascript
try {
  await apiService.playRemote({ userId: this.userId, uris });
  if (!autoPlay) await apiService.pauseRemote(this.userId);
  this._startPolling();
} catch (error) {
  // TOKEN_REVOKED 에러 처리
  if (error.code === 'TOKEN_REVOKED' || error.response?.data?.error === 'TOKEN_REVOKED') {
    console.error('🔴 [RestRemoteAdapter] Spotify token revoked');
    const revokedError = new Error(
      'Spotify 연결이 만료되었습니다.\\n\\n' +
      '프로필 화면에서 Spotify를 다시 연결해주세요.'
    );
    revokedError.code = 'TOKEN_REVOKED';
    revokedError.requiresReauth = true;
    throw revokedError;
  }
  
  // 기타 에러 처리...
}
```

## 🔄 에러 처리 흐름

```
┌─────────────────────────────────────────────────────────┐
│  1. 사용자가 곡 재생 시도                                    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  2. Frontend: RestRemoteAdapter.load()                  │
│     → apiService.playRemote() 호출                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  3. Backend: spotifyPlaybackController.play()           │
│     → spotifyRequest() → getAccessTokenForUser()        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  4. Spotify Token Endpoint 호출                         │
│     → axios.post(SPOTIFY_TOKEN_URL)                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
         ┌───────┴────────┐
         │                │
         ▼                ▼
    ✅ Success      ❌ 400 invalid_grant
         │                │
         │                ▼
         │    ┌───────────────────────────────────┐
         │    │  5. Backend: TOKEN_REVOKED 감지    │
         │    │     → SpotifyTokenModel.markRevoked()│
         │    │     → accessCache.delete()         │
         │    │     → throw TOKEN_REVOKED error    │
         │    └────────────┬──────────────────────┘
         │                 │
         │                 ▼
         │    ┌───────────────────────────────────┐
         │    │  6. Backend: handlePlaybackError() │
         │    │     → res.status(401).json({      │
         │    │         error: 'TOKEN_REVOKED',    │
         │    │         requiresReauth: true       │
         │    │       })                           │
         │    └────────────┬──────────────────────┘
         │                 │
         │                 ▼
         │    ┌───────────────────────────────────┐
         │    │  7. Frontend: API Interceptor      │
         │    │     → AsyncStorage.multiRemove()  │
         │    │     → throw '연결이 만료되었습니다'  │
         │    └────────────┬──────────────────────┘
         │                 │
         │                 ▼
         │    ┌───────────────────────────────────┐
         │    │  8. Frontend: playerSlice.playTrack│
         │    │     → dispatch(clearSpotifySession)│
         │    │     → rejectWithValue({            │
         │    │         code: 'TOKEN_REVOKED',     │
         │    │         message: '다시 연결해주세요' │
         │    │       })                           │
         │    └────────────┬──────────────────────┘
         │                 │
         └─────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  9. UI: 사용자에게 에러 메시지 표시                        │
│     "Spotify 연결이 만료되었습니다.                        │
│      프로필에서 Spotify를 다시 연결해주세요."               │
└─────────────────────────────────────────────────────────┘
```

## 📱 사용자 경험

### Before (수정 전)
```
[곡 재생 시도]
  ↓
❌ "Request failed with status code 400"
  ↓
🤔 사용자 혼란: 무엇이 문제인지 알 수 없음
```

### After (수정 후)
```
[곡 재생 시도]
  ↓
🔴 "Spotify 연결이 만료되었습니다.
    프로필에서 Spotify를 다시 연결해주세요."
  ↓
✅ 명확한 안내:
   1. 프로필 화면으로 이동
   2. "Spotify 연결" 버튼 클릭
   3. Spotify 인증 재수행
   4. 정상 재생 가능
```

## 🧪 테스트 시나리오

### 시나리오 1: 토큰이 Spotify에서 폐기된 경우
1. 사용자가 Spotify 웹사이트에서 앱 권한 철회
2. Stonetify에서 곡 재생 시도
3. **예상 결과:**
   - 백엔드에서 `invalid_grant` 감지
   - DB에 토큰 revoked 상태 저장
   - 프론트엔드에 401 + TOKEN_REVOKED 응답
   - 사용자에게 "연결이 만료되었습니다" 메시지
   - Spotify 세션 자동 클리어

### 시나리오 2: 장기간 미사용 토큰
1. 2-3개월간 앱 미사용
2. Spotify 토큰 자동 만료
3. 앱 실행 후 곡 재생 시도
4. **예상 결과:**
   - 동일한 TOKEN_REVOKED 흐름 실행
   - 자동 로그아웃 및 재연결 안내

### 시나리오 3: 수동 토큰 갱신 실패
1. Spotify API가 일시적으로 `invalid_grant` 반환
2. 재생, 일시정지, 다음곡 등 모든 playback 작업
3. **예상 결과:**
   - 모든 엔드포인트에서 일관된 에러 처리
   - 사용자에게 명확한 재연결 안내

## 🔍 디버깅

### Backend 로그
```bash
# 정상 토큰 갱신
🌐 [spotifyRequest] Making request to Spotify API
✅ [spotifyRequest] Success: 204

# 토큰 폐기 감지
🔴 [getAccessTokenForUser] Refresh token revoked by Spotify: user123
🔴 [SpotifyTokenModel] Marking token as revoked for user: user123
🔴 [Playback][play] Token revoked - user needs to reconnect
```

### Frontend 로그
```bash
# API 응답 에러
❌ [API Response Error] { error: 'TOKEN_REVOKED', requiresReauth: true }

# Adapter 에러
🔴 [RestRemoteAdapter] Spotify token revoked

# Player Slice 처리
🔴 [playTrack] Spotify token revoked

# Spotify Slice 클리어
🔴 [spotifySlice] Spotify session cleared due to token revocation
```

## 📝 수정된 파일 목록

### Backend
- ✅ `controllers/spotifyPlaybackController.js`
  - `getAccessTokenForUser()` - invalid_grant 감지 및 처리
  - `handlePlaybackError()` - 공통 에러 핸들러 추가
  - 모든 exports 함수에 TOKEN_REVOKED 처리 적용

- ✅ `models/spotify_token.js`
  - `markRevoked()` 메서드 추가

### Frontend
- ✅ `services/apiService.js`
  - 응답 인터셉터에 TOKEN_REVOKED 처리 추가
  - AsyncStorage 자동 클리어

- ✅ `store/slices/spotifySlice.js`
  - `clearSpotifySession` 액션 추가

- ✅ `store/slices/playerSlice.js`
  - `playTrack` 에러 핸들링 개선
  - TOKEN_REVOKED 감지 시 clearSpotifySession 호출

- ✅ `adapters/index.js`
  - `RestRemoteAdapter.load()` 에러 처리 개선
  - 사용자 친화적 에러 메시지

## 🎯 기대 효과

1. **자동 세션 정리**
   - 토큰 폐기 시 자동으로 DB 및 캐시 정리
   - 메모리 누수 방지

2. **명확한 사용자 안내**
   - "400 Bad Request" 대신 "연결이 만료되었습니다"
   - 해결 방법 제시 (프로필에서 재연결)

3. **일관된 에러 처리**
   - 모든 Playback 엔드포인트에서 동일한 로직
   - 유지보수 용이

4. **보안 강화**
   - 폐기된 토큰 즉시 삭제
   - 무효한 인증 시도 방지

## 🚀 배포 후 확인사항

- [ ] Backend 로그에서 TOKEN_REVOKED 감지 확인
- [ ] Frontend에서 AsyncStorage 클리어 확인
- [ ] 사용자에게 재연결 메시지 표시 확인
- [ ] 프로필에서 Spotify 재연결 가능 확인
- [ ] 재연결 후 정상 재생 확인

## 📚 참고 자료

- [Spotify Web API - Token Exchange](https://developer.spotify.com/documentation/web-api/tutorials/code-flow)
- [Spotify OAuth Error Codes](https://developer.spotify.com/documentation/web-api/concepts/authorization)
- [Firebase Realtime Database](https://firebase.google.com/docs/database)
