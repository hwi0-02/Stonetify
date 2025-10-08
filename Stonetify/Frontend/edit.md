# ✅ Refresh Token Revoked 오류 수정 완료

## 수정 사항

### 1. Backend - TOKEN_REVOKED 에러 처리 추가
- `spotifyAuthController.js`의 `refreshToken()` 함수에 `invalid_grant` 에러 감지 및 처리 로직 추가
- `getAccessTokenForUser()` 함수에도 동일한 에러 처리 추가
- 토큰이 revoke되면 자동으로 DB에서 표시하고 401 응답 반환

### 2. Frontend - Spotify Scope 확장
- 기존: 4개의 scope (playback만)
- 수정: 12개의 scope (user info, library, playlist, playback 등)
- 이유: Spotify API 전체 기능 사용을 위해 필요한 모든 권한 추가

### 3. Backend - 재로그인 시 이전 토큰 자동 삭제
- `exchangeCode()` 함수에서 새 토큰 발급 전 기존 토큰 완전 삭제
- 중복 세션 문제 방지 및 scope 불일치 해결

### 4. Frontend - 재연결 시 세션 초기화
- Spotify 연결 버튼 클릭 시 기존 세션 완전 제거
- 새로운 scope로 깨끗하게 재인증

## ✅ 현재 상태: TOKEN_REVOKED 감지 정상 작동 중!

백엔드 로그 확인 결과:
- ✅ Token revoked 자동 감지 성공
- ✅ DB에 revoked 상태 저장 완료
- ✅ 재생 요청 시 적절히 차단됨

## 🔧 사용자 조치 필요

### 프론트엔드에서 해야 할 일:
1. **앱 재시작** (프론트엔드만) - 최신 코드 반영
2. **프로필 화면 이동**
3. **"Spotify 연결" 버튼 클릭** - 새로운 12개 scope로 재인증
4. **Spotify 로그인 완료**
5. **곡 재생 테스트**

### 만약 여전히 에러가 발생한다면:

#### A. Spotify Dashboard 확인 필요
https://developer.spotify.com/dashboard
- **Redirect URIs**에 앱에서 사용하는 URI가 **정확히** 등록되어 있는지 확인
- Expo Go 사용 시: `https://auth.expo.dev/@YOUR_USERNAME/YOUR_APP_SLUG` 필수
- 예: `https://auth.expo.dev/@hwi0-02/stonetify`

#### B. 환경변수 확인
프론트엔드 `.env`:
```
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=84d1bbffeb7e419088d64740c137100e
EXPO_PUBLIC_SPOTIFY_REDIRECT_URI=(Spotify Dashboard에 등록된 URI)
```

#### C. Firebase Database 직접 정리 (필요 시)
`spotify_tokens/-O_PaWCFN8leSP86pPO-` 노드 삭제 후 재로그인

## 로그에서 확인해야 할 것

재연결 후 다음 로그가 출력되어야 성공:
```
[exchangeCode] Revoking any existing tokens for user: ...
[exchangeCode] ✅ New token obtained with scope: user-read-email user-read-private ...
```

재생 시도 시:
```
🎵 [Playback][play] Request: { userId: '...', uris: ['spotify:track:...'] }
✅ 200 응답 또는 "No active device" (정상)
```
