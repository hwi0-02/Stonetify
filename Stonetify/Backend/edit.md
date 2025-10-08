# 🧰 Backend Error Handling Guide (Express + Spotify Integration)

> **프로젝트:** Stonetify Backend  
> **작성일:** 2025-10-08  
> **작성자:** Backend Debug Notes  
> **적용 대상:** Node.js + Express + Firebase + Spotify API Integration

---

## 🎧 1. Spotify OAuth Token Errors (`Refresh token revoked / No stored refresh token`)

### 🔍 오류 로그 예시
Spotify /me failed No stored refresh token
[getAccessTokenForUser] Refresh token revoked by Spotify
Premium status check failed Refresh token has been revoked by Spotify. Please reconnect your Spotify account.

yaml
코드 복사

---

### 🧩 원인 분석

#### 1️⃣ Refresh Token 미저장 또는 덮어쓰기 오류
- Spotify는 **Refresh Token을 최초 로그인 시 한 번만 발급**합니다.  
- 이후 요청에서는 `access_token`만 재발급되며, `refresh_token` 필드는 null 또는 undefined로 내려올 수 있습니다.  
- 코드에서 undefined를 그대로 DB에 덮어쓰면 기존 refresh_token이 사라져 `"No stored refresh token"` 에러 발생.

#### 2️⃣ Spotify 서버에서 기존 Refresh Token 폐기
다음 상황 중 하나일 때, Spotify는 기존 refresh_token을 **revoked(폐기)** 합니다:
- 사용자가 Spotify 계정에서 앱 접근 해제  
- Redirect URI가 Dashboard 설정과 불일치  
- Client Secret 재발급  
- Authorization code 중복 사용  

#### 3️⃣ Firebase / Redis / 캐시에 이전 토큰 잔존
- 무효화된 토큰이 DB나 캐시에 남아있으면 계속 재사용되어 반복적인 오류 발생.

---

### 🧠 로그 진단 포인트

| 로그 메시지 | 의미 |
|--------------|------|
| ✅ `New token obtained with scope: ...` | 새 Access Token 발급 성공 |
| ⚠️ `No stored refresh token` | DB 내 refresh_token 필드 없음 |
| 🔴 `Refresh token revoked by Spotify` | Spotify 서버가 토큰을 무효화함 |
| 🟡 `Check settings on developer.spotify.com/dashboard` | Redirect URI 혹은 클라이언트 설정 문제 가능 |

---

### ✅ 해결 절차 (Spotify 공식 문서 기준)

#### Step 1. Spotify 계정 접근 해제
1. [https://www.spotify.com/account/apps](https://www.spotify.com/account/apps) 접속  
2. **Stonetify** 앱 → `Remove Access` 클릭

---

#### Step 2. 앱 내 토큰 초기화 및 재로그인
- Firebase/Redis에서 해당 사용자(`userId`)의 토큰 데이터 삭제  
- 앱에서 새 로그인 시도 → 새 refresh_token 자동 발급  

---

#### Step 3. 코드 수정 (`exchangeCode` / `SpotifyTokenModel`)
```js
// ❌ 기존 (undefined refresh_token으로 덮어씀)
userToken.refresh_token = data.refresh_token;

// ✅ 수정 (refresh_token이 존재할 때만 덮어쓰기)
if (data.refresh_token) {
  userToken.refresh_token = data.refresh_token;
}
💡 Spotify는 refresh_token을 처음 한 번만 발급하므로, undefined일 경우 기존 값을 유지해야 합니다.
공식 문서에서도 “refresh token is returned only once”로 명시되어 있습니다.

Step 4. Redirect URI 재검증
.env 파일의 Redirect URI가 Spotify Dashboard와 완전히 동일해야 합니다.

env
코드 복사
SPOTIFY_REDIRECT_URI=http://localhost:5000/spotify-callback
대소문자, http/https, 포트번호, 마지막 / 까지 모두 동일해야 합니다.

Spotify Developer Dashboard → Edit Settings → Redirect URIs 에 정확히 등록해야 함.

Step 5. Client Secret 확인
Spotify Dashboard에서 Client Secret을 재발급한 경우,
.env 파일의 SPOTIFY_CLIENT_SECRET 값도 반드시 새 값으로 갱신해야 합니다.

🧾 공식 참고 문서
Spotify Authorization Guide – Code Flow

Refreshing Tokens (Spotify Docs)

⚙️ 요약 테이블
항목	내용
오류 코드	Refresh token revoked, No stored refresh token
주요 원인	refresh_token 미저장, Redirect URI 불일치, 앱 접근 해제
해결 방법	refresh_token 보존 로직 수정 + 새 인증
관련 스코프	streaming, user-modify-playback-state, user-read-private, playlist-modify-private 등

⚡ 2. 기타 Express 관련 경고 참고 (이미 해결됨)
✅ 처리된 항목
항목	상태
X-Forwarded-For header is set but trust proxy is false	✅ 해결 완료 (app.set('trust proxy', 1) 추가됨)

Express 프록시 신뢰 설정 완료로 express-rate-limit 관련 IP 검증 오류는 해소됨.
추가 설정 불필요.

📎 부록
✅ 정상 로그 예시
vbnet
코드 복사
HTTP Server started on port 5000
✅ New token obtained with scope: playlist-read-private playlist-modify-public ...
🎵 Playback success: token verified, playback started
❌ 비정상 로그 예시
pgsql
코드 복사
🔴 Refresh token revoked by Spotify
Spotify /me failed No stored refresh token
Premium status check failed Refresh token has been revoked by Spotify.
🎯 한 줄 요약
“Express 프록시 설정은 완료되었으며,
Spotify refresh_token은 null/undefined로 덮지 말고 기존 값을 유지해야 한다.
앱 접근 해제 후 새 로그인으로 refresh_token을 재발급받으면 반복 오류가 해결된다.”