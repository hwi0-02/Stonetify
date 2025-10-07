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
