# Stonetify

K-POP 및 인디 음악 팬을 위해 설계된 **Stonetify**는 Spotify 스트리밍 데이터, 커뮤니티 피드, 맞춤 추천을 하나의 앱으로 묶은 모바일/웹 하이브리드 프로젝트입니다. Expo 기반 프런트엔드와 Express 기반 백엔드가 Firebase Realtime Database와 Spotify API를 매개로 실시간 경험을 제공합니다.

## 목차
1. [프로젝트 한눈에 보기](#프로젝트-한눈에-보기)
2. [주요 기능](#주요-기능)
3. [기술 스택](#기술-스택)
4. [디렉터리 구조](#디렉터리-구조)
5. [사전 준비](#사전-준비)
6. [환경 변수](#환경-변수)
7. [로컬 실행 방법](#로컬-실행-방법)
8. [개발 팁](#개발-팁)
9. [기여 & 라이선스](#기여--라이선스)

## 프로젝트 한눈에 보기
- **목표**: Spotify 사용자 경험을 확장해 커뮤니티 피드·추천·소셜 그래프를 통합 제공
- **백엔드**: Express + Firebase Admin SDK + Sequelize(선택적 MySQL) + Kakao/Naver OIDC
- **프런트엔드**: Expo SDK 54, React Native 0.81, Redux Toolkit 기반 상태 관리
- **보안**: JWT, 커스텀 암호화 키, CORS 화이트리스트, Expo 심층 링크 검증
- **배포 대상**: GitHub Actions / Expo EAS / Firebase Hosting or Vercel(콜백 페이지)

## 주요 기능
- **Spotify 연동**: OAuth 2.0 코드 플로우, 토큰 자동 새로고침, 재생 기록 동기화
- **소셜 로그인**: 카카오/네이버/이메일 조합 인증과 Expo Auth Session 연계
- **커뮤니티 피드**: 게시물, 좋아요, 저장, 팔로우, 공유 링크 단일 API 집합 제공
- **플레이리스트 허브**: 사용자 생성/공유 플레이리스트, 드래그 정렬, 인기곡 노출
- **맞춤 추천**: Firebase RTDB + Gemini 기반 프롬프트 엔진(`utils/geminiClient.js`)
- **실시간 알림/딥링크**: `spotify-callback`, `kakao-callback`, `naver-callback` HTML 페이지로 모바일·웹 모두 지원

## 기술 스택
| 영역 | 사용 기술 |
| --- | --- |
| 모바일/웹 클라이언트 | Expo, React Native, React Navigation, Redux Toolkit, Expo AV/Video |
| 서버/API | Node.js 18+, Express, Firebase Admin, Sequelize, Axios, Nodemailer |
| 데이터/인프라 | Firebase Realtime Database, (선택) MySQL, Gemini API |
| 개발 도구 | Nodemon, Expo CLI, PowerShell 터널 스크립트, VS Code, ESLint(선택) |

## 디렉터리 구조
```text
Stonetify/
├─ Backend/
│  ├─ app.js                  # Express 서버 진입점 및 OAuth 콜백 페이지
│  ├─ controllers/            # 사용자, 플레이리스트, 소셜, Spotify 등 도메인 컨트롤러
│  ├─ middleware/             # 인증, 에러, 레이트 리미터
│  ├─ models/                 # Sequelize 모델 (MySQL 또는 향후 확장 대비)
│  ├─ routes/                 # REST API 라우팅 계층
│  ├─ utils/                  # Firebase, Gemini, 이메일, 암호화, 환경 검증 등 유틸
│  └─ scripts/createIndexes.js# Firebase 인덱스 생성 스크립트
└─ Frontend/
   ├─ App.js                  # Expo 루트 컴포넌트
   ├─ components/, screens/   # 피드, 플레이어, 인증 등 UI 모듈
   ├─ navigation/             # Auth/Main 탭 네비게이션 정의
   ├─ hooks/                  # Spotify/소셜 인증 커스텀 훅
   ├─ services/, store/       # API 어댑터 및 Redux 스토어
   └─ proxy-server.js         # 로컬 개발 시 백엔드 프록시 서버
```

## 사전 준비
- Node.js 18 LTS 이상 & npm 9+
- Expo CLI (`npm install -g expo-cli`) 또는 `npx expo`
- Firebase 서비스 계정 JSON (Realtime Database 사용)
- Spotify Developer 앱 (Redirect URI: `https://<backend>/spotify-callback`, `stonetify://spotify-callback` 등)
- Kakao Developers · Naver Developers REST 앱 등록 및 Redirect URI 매칭
- (선택) Gmail 앱 비밀번호 또는 SMTP 계정
- (선택) Gemini API Key, HTTPS 인증서 경로

## 환경 변수
`.env`는 `Backend/.env`에 위치하며, 프런트 전용 값은 `Frontend/.env`(필요 시)로 분리합니다.

| 키 | 설명 | 필수 |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_DATABASE_URL` | Firebase Admin 접속 정보 | ✅ |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_APP_REDIRECT` | Spotify OAuth 설정 및 앱 딥링크 | ✅ |
| `JWT_SECRET` | 서버 JWT 서명 키 (32자 이상 권장) | ✅ |
| `ENCRYPTION_KEY` | 32자 길이 AES 키 (민감 데이터 암호화) | ✅ |
| `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_APP_REDIRECT_URI`, `KAKAO_ALLOWED_REDIRECT_URIS` | 카카오 로그인 & 리디렉션 | ⛔ (카카오 비활성 시 선택) |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_APP_REDIRECT_URI`, `NAVER_ALLOWED_REDIRECT_URIS` | 네이버 로그인 & 리디렉션 | ⛔ |
| `ALLOWED_RETURN_ORIGINS`, `FRONTEND_URL`, `WEB_FRONTEND_URL` | CORS 및 Expo Auth Session 화이트리스트 | ⛔ |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `ENABLE_GEMINI` | 추천 프롬프트용 Gemini 모델 | ⛔ |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | 이메일 전송 계정 | ⛔ |
| `PORT`, `HTTPS_PORT`, `SSL_KEY_PATH`, `SSL_CERT_PATH` | 서버 포트 및 HTTPS 인증서 | ⛔ |
| `EXPO_OWNER`, `EXPO_SLUG` | Expo Auth Session용 URL 조합 | ⛔ |

> `Backend/utils/envValidator.js`가 실행 시 필수 값 누락을 콘솔에 출력하므로, 먼저 `.env`를 채우고 서버를 재시작하세요.

## 로컬 실행 방법
### 1. 저장소 설치
```powershell
cd c:\new4
git clone <repo-url> Stonetify
cd Stonetify
```

### 2. 백엔드 실행
```powershell
cd Backend
npm install
copy .env.example .env   # 예제 파일을 직접 작성했다는 가정, 없으면 새로 생성
npm run dev               # nodemon (Hot reload)
# 또는
npm start                 # 프로덕션 모드
```
- HTTPS 터널링이 필요하면 `SSL_KEY_PATH`, `SSL_CERT_PATH`를 지정하거나 `Frontend/start-tunnel.ps1`로 Expo 터널을 연 뒤 `ALLOWED_RETURN_ORIGINS`에 도메인을 추가하세요.

### 3. 프런트엔드 실행 (Expo)
```powershell
cd Frontend
npm install
npx expo start
# 필요 시 플랫폼별
npx expo start --android
npx expo start --ios
```
- 로컬 백엔드와 통신하려면 `proxy-server.js`를 실행하거나 `app.config.js`에서 API 베이스 URL을 환경 변수로 주입하세요.
- 물리 기기에서 테스트할 경우 Expo Go 또는 EAS 빌드를 사용하고, 백엔드에 공개 URL(터널/클라우드)을 제공해야 합니다.

## 개발 팁
- **Firebase 인덱스**: `Backend/scripts/createIndexes.js`로 추천/검색 인덱스를 한 번에 생성할 수 있습니다.
- **데이터 안전 장치**: Firebase 자격 증명이 비어 있으면 인메모리 모드로 전환되며, 재시작 시 데이터가 삭제됩니다. 콘솔 경고를 확인하세요.
- **API 문서화**: `routes/*Routes.js` + `controllers/*Controller.js`를 함께 보면 엔드포인트, 권한 체크, 레이트 리미터 정책을 파악할 수 있습니다.
- **품질 및 모니터링**: `middleware/errorMiddleware.js`를 확장해 Logtail, CloudWatch 등 원하는 로깅 파이프라인에 연결할 수 있습니다.
- **확장 방향**: `models/` 이하 Sequelize 정의는 향후 MySQL 마이그레이션을 위해 존재하므로, `config/database.js`를 추가하면 바로 관계형 DB로 이관할 수 있습니다.

## 기여 & 라이선스
- 이슈 또는 PR 시 **배경, 재현 절차, 스크린샷**을 포함해주세요.
- 커밋 메시지는 Conventional Commits 또는 `feat/fix/chore` 프리픽스를 권장합니다.
- 라이선스는 아직 명시되지 않았습니다. 배포 전 조직 정책에 맞는 라이선스를 `LICENSE` 파일로 추가하세요.

---
궁금한 점이나 개선 아이디어가 있다면 GitHub 이슈로 알려주세요. Stonetify 팀은 커뮤니티 피드백을 적극 반영합니다.
