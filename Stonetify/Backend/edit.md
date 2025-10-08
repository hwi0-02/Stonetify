# 곡 재생 시 Request failed with status code 400 오류 ✅ 해결 완료

## 문제 원인
Firebase 내부 ID (예: `-O_Pc65ffydCDpn619cc`)가 Spotify API에 전송되고 있었습니다.

데이터베이스의 `songs` 테이블에는 두 가지 ID가 있습니다:
- `id`: Firebase 내부 ID (push key, `-`로 시작)
- `spotify_id`: 실제 Spotify 트랙 ID (22자 영숫자)

## 적용된 수정사항

### 1. Frontend: playerSlice.js - Track ID 우선순위 변경
```javascript
// 변경 전: track.id가 먼저 체크되어 Firebase ID 선택됨
const getTrackId = (track) => track?.id ?? track?.spotify_id ?? ...

// 변경 후: spotify_id를 우선 체크하여 Spotify ID 사용
const getTrackId = (track) => track?.spotify_id ?? track?.spotifyId ?? track?.id ?? ...
```

### 2. Frontend: playerSlice.js - Spotify URI 자동 생성
```javascript
// URI가 없으면 ID로부터 생성 (spotify:track:<id> 형식)
if (!uri && id && !id.startsWith('-')) {
  uri = id.startsWith('spotify:') ? id : `spotify:track:${id}`;
}
```

### 3. Backend: playbackHistoryController.js - Track ID 포맷 검증
```javascript
// Spotify ID 포맷 검증 추가 (22자 영숫자 또는 spotify:track: URI)
const isSpotifyUri = track.id?.startsWith('spotify:track:');
const isSpotifyId = /^[a-zA-Z0-9]{22}$/.test(track.id);
if (!isSpotifyUri && !isSpotifyId) {
  throw new Error(`Invalid Spotify track ID format: ${track.id}`);
}
```

### 4. Backend: spotifyPlaybackController.js - URI 검증
```javascript
// 재생 요청 전 URI 포맷 검증
if (uris && Array.isArray(uris)) {
  for (const uri of uris) {
    if (!uri.startsWith('spotify:track:')) {
      return res.status(400).json({ message: 'Invalid Spotify URI format' });
    }
  }
}
```

## 테스트 방법
1. 앱 재시작 (`npm start` 또는 Expo Go 재실행)
2. 플레이리스트에서 곡 선택하여 재생
3. 이제 정상적으로 재생되어야 함

## ID 포맷 참고
- **Spotify Track ID**: 22자 영숫자 (예: `6rqhFgbbKwnb9MLmUQDhG6`)
- **Spotify Track URI**: `spotify:track:6rqhFgbbKwnb9MLmUQDhG6`
- **Firebase ID**: `-`로 시작하는 push key (예: `-O_Pc65ffydCDpn619cc`) ❌ Spotify API에 사용 불가
