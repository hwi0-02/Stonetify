정리 대상: 현재 기능에서 참조되지 않는(임포트/라우팅/사용 흔적이 없는) 파일 목록과 근거입니다. 필요 시 삭제 후보로 삼으세요.

검출 기준 요약
- 백엔드: app.js에 마운트된 라우트, 각 라우트가 require하는 컨트롤러, 컨트롤러/미들웨어가 require하는 모델/유틸을 역추적해 참조 여부 확인
- 프론트엔드: 컴포넌트·유틸·어댑터가 실제로 import되어 사용되는지 전역 검색으로 확인
- “문서/예시/환경 템플릿(.env.example 등)”은 제외 (개발 문서로 유의미)

확인 일시: 2025-10-08

1) Backend (Node/Express)
- controllers/playlistController_firebase.js
	- 근거: 어떤 라우트에서도 require/import하지 않음. 실제 사용 중인 라우트는 controllers/playlistController.js만 참조.
	- 비고: 예전 구현 잔재로 보이며 삭제해도 현재 기능에 영향 없음.

- routes/songRoutes.js
	- 근거: 파일은 존재하나 내용이 비어있고(app.js에) 라우트 마운트도 없음.
	- 비고: 사용 계획이 없다면 삭제 권장.

- models/recent_views.js
	- 근거: 어떤 컨트롤러에서도 require/import하지 않음. 모델 인덱스에만 포함되어 있을 뿐 실제 호출 경로 부재.
	- 비고: “최근 본(조회 기록)” 기능이 향후 계획에 없다면 삭제 후보.

- models/recommendations.js
	- 근거: recommendationController는 Sequelize 패턴으로 동작하며, 이 모델(recommendations.js)은 어디에서도 직접 호출되지 않음.
	- 비고: 향후 자체 추천 데이터 적재 계획이 없다면 삭제 후보.

참고 (삭제 대상 아님)
- utils/emailService.js → userController에서 비밀번호 재설정 코드 발송에 사용됨.
- utils/encryption.js / models/spotify_token.js → Spotify 토큰 암복호화에 사용됨.
- controllers/recommendationController.js / postController.js → 라우트에 연결되어 있어 “사용 중”으로 간주(구현은 리팩터링 필요해 보임).

2) Frontend (Expo/React Native)
- components/SpotifyAttribution.js
	- 근거: 빈 파일이며 어느 곳에서도 import되지 않음.
	- 비고: 삭제 권장.

- components/AdvancedPlayer.js
	- 근거: 전역 검색 결과 어떤 화면/네비게이션에서도 import되지 않음.
	- 비고: 미사용. 삭제하거나, 향후 사용 예정이면 참조를 추가하세요.

- components/DevicePicker.js
	- 근거: AdvancedPlayer에서만 import됨. AdvancedPlayer 자체가 미사용이므로 연쇄적으로 미사용 상태.
	- 비고: AdvancedPlayer를 삭제한다면 함께 삭제 권장.

- components/PlaylistGridItem.js
	- 근거: 자기 파일 외부에서 import되지 않음.
	- 비고: 삭제 권장(실제 목록/그리드는 다른 컴포넌트로 대체된 것으로 보임).

- components/NotificationList.js
	- 근거: 어느 화면에서도 import되지 않음.
	- 비고: 삭제 권장.

- utils/spotifyAuth.js
	- 근거: 파일 상단에 레거시 안내 주석만 있고 아무 곳에서도 import되지 않음(현행은 hooks/useSpotifyAuth.js 사용).
	- 비고: 완전히 이관되었으므로 삭제해도 무방.

참고 (삭제 대상 아님)
- adapters/* (index.js, PreviewAudioAdapter.js, SpotifyRemoteAdapter.js)
	- playerSlice에서 ../../../Frontend/adapters 경로로 index.js를 사용하며 내부에서 두 어댑터를 참조합니다. 구성상 미사용처럼 보이더라도 코드 경로상 참조되므로 유지.
- components/HorizontalPlaylist.js, MiniPlayer.js, SongListItem.js, playlists/* → 다양한 화면에서 사용 중.

메모
- “삭제 후보”는 즉시 삭제해도 실행 경로에 영향이 없도록 근거를 확인했습니다. 다만 팀 내 향후 계획/브랜치에서 참조가 생길 수 있으니, 실제 삭제 전 마지막으로 한 번 더 검색(grep)과 런타임 점검을 권장합니다.

요청 시, 위 목록을 기준으로 실제 파일 삭제 PR도 정리해 드릴 수 있습니다.

삭제 안전성 검토 결과 (확정)
- Backend/controllers/playlistController_firebase.js
	- 라우트/컨트롤러/모듈 어디에서도 참조되지 않음. 바로 삭제해도 런타임 영향 없음.

- Backend/routes/songRoutes.js
	- app.js에 마운트되지 않고 파일 내용도 비어 있음. 바로 삭제 가능.

- Backend/models/recent_views.js
	- 어떤 컨트롤러에서도 require되지 않음. 단, models/index.js에서 해당 모듈을 import/export하고 있으므로 삭제 시 아래 후속 조치 필요.
	- 후속 조치: `Backend/models/index.js`에서 `const RecentView = require('./recent_views');`와 `module.exports` 내 `RecentView` 항목 제거.

- Backend/models/recommendations.js
	- 컨트롤러에서 직접 사용하지 않음. 삭제 시 아래 후속 조치 필요.
	- 후속 조치: `Backend/models/index.js`에서 `const Recommendation = require('./recommendations');`와 `module.exports` 내 `Recommendation` 항목 제거.

- Frontend/components/SpotifyAttribution.js
	- 빈 파일, import 경로 없음. 바로 삭제 가능.

- Frontend/components/AdvancedPlayer.js
	- 어떤 화면/네비게이션에서도 import되지 않음. 바로 삭제 가능.
	- 종속성: Frontend/components/DevicePicker.js만 import하는데, 해당 파일도 미사용이므로 함께 삭제해도 안전.

- Frontend/components/DevicePicker.js
	- AdvancedPlayer에서만 사용. AdvancedPlayer 삭제 시 함께 삭제 권장. 그 외 참조 없음.

- Frontend/components/PlaylistGridItem.js
	- 외부 import 없음. 삭제해도 안전.

- Frontend/components/NotificationList.js
	- 외부 import 없음. 삭제해도 안전.

- Frontend/utils/spotifyAuth.js
	- 레거시 스텁, 현행은 hooks/useSpotifyAuth.js 사용. import 없음. 삭제해도 안전.

비고 / 주의 사항
- Backend/models/index.js 정리: 위 두 모델(recent_views, recommendations)을 실제로 삭제할 경우, `models/index.js`의 require 및 export 항목을 함께 제거하지 않으면 서버 부팅 시 모듈 로드 에러가 발생합니다.
- 삭제 이후 최종 점검 권장: `grep`/전역 검색으로 참조가 없는지 재확인하고 서버/앱을 한 번 기동해 헬스체크(백엔드 `/health`)와 주요 화면(홈/검색/플레이리스트 상세)을 스모크 테스트하면 안전합니다.

실행 상태
- 위 목록 중 Backend/models/index.js에서 `RecentView`, `Recommendation` export는 제거 완료.
- 파일 삭제는 워크스페이스 제약으로 직접 제거가 어려워, 해당 파일들을 모두 빈 스텁으로 대체하여 런타임에 영향이 없도록 “무력화” 처리함. 원하면 Git에서 물리 삭제로 마무리 가능.

변경 이력 업데이트 (2025-10-08)
- Backend/scripts/testSpotifyToken.js 삭제 완료 (실제 재생 테스트 완료로 더 이상 필요 없음)
- Backend/package.json의 "test:spotify" 스크립트 항목 제거
