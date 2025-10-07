🤖 GitHub Copilot 지침 (Instructions)
 Stonetify 프로젝트의 코드 일관성을 유지하고, 개발 생산성을 극대화하며, 기술 스택에 맞는 최적화된 코드를 생성하기 위해 GitHub Copilot이 반드시 준수해야 할 핵심 지침을 정의합니다.
 당신은 이 지침을 엄격히 따라야 하며, 지침을 벗어난 코드는 생성하지 마십시오.
 당신은 다음 내용을 완전히 이해한 후에만 코드를 생성해야 합니다.
 당신은 세계 최고의 소프트웨어 엔지니어이며, 이 지침을 철저히 준수하는 것이 당신의 최우선 과제입니다.
 당신은 항상 답변을 한국어로 작성해야 합니다.

1. 프로젝트 개요 및 기술 스택 분석
이 프로젝트는 사용자 간에 음악 플레이리스트를 공유하고 소통하는 **소셜 음악 플랫폼 'Stonetify'**입니다.

1.1. 기술 스택
구분	기술 스택	세부 사항
주요 언어	JavaScript (ES6+)	React Native, Node.js 환경에서 사용
프론트엔드	React Native / Expo	Expo SDK 53.0.22, React 19.0.0, React Native 0.79.5
백엔드	Node.js / Express	Express 기반 RESTful API 서버
상태 관리	Redux Toolkit	createSlice, createAsyncThunk를 활용
API 통신	Axios	Frontend/services/ApiService.js에 중앙 집중식 인스턴스 정의 및 인터셉터 사용
데이터베이스	Firebase Realtime DB	Firebase Admin SDK를 통해 RealtimeDBHelpers로 접근
인증/보안	JWT (JSON Web Token)	토큰 기반 인증 (jsonwebtoken), bcryptjs 암호화
빌드 도구	Expo CLI / Babel	babel-preset-expo 사용

Sheets로 내보내기
2. 프론트엔드 (React Native / Expo) 지침
Copilot은 React Native 컴포넌트 및 JavaScript 파일을 작성할 때 다음 규칙을 엄격히 준수해야 합니다.

2.1. 컴포넌트 구조 및 스타일
파일 형식: .js 또는 .jsx를 사용합니다 (TypeScript는 현재 적용되지 않음).

컴포넌트 이름: 컴포넌트 이름은 항상 PascalCase를 사용합니다. (예: PlaylistCard, HomeScreen).

로직 분리:

재사용 가능한 유틸리티 로직은 **Frontend/utils/index.js**에 정의된 storage, network, validation, format, async 객체 아래에 추상화합니다.

복잡한 비즈니스 및 비동기 로직은 Redux Slices 내의 createAsyncThunk에 구현해야 합니다.

스타일링:

모든 스타일은 컴포넌트 파일 내에서 StyleSheet.create 메서드를 사용하여 정의합니다.

인라인 스타일 사용을 최소화하고, StyleSheet.create로 생성된 객체를 참조합니다.

2.2. 명명 규칙 (JavaScript)
변수, 함수, 메서드: camelCase를 사용합니다 (예: handleLike, fetchMyPlaylists).

상수: 최상위 상수는 UPPER_SNAKE_CASE를 사용합니다 (예: SEARCH_HISTORY_KEY, MAX_HISTORY_ITEMS).

이벤트 핸들러: handle 또는 on 접두사를 사용합니다 (예: handleDelete, onPress).

Boolean 변수: is, has 접두사를 사용합니다 (예: isLiked, isLoading).

2.3. 상태 관리 및 데이터 흐름
API 통신: 모든 HTTP 요청은 **Frontend/services/ApiService.js**에 정의된 api (Axios) 인스턴스를 통해 이루어져야 합니다. 직접적인 fetch API 호출은 금지됩니다.

비동기 처리: createAsyncThunk를 사용하며, 내부 로직은 async/await 구문을 우선 사용합니다.

로컬 상태: 로컬 반응형 상태는 useState 훅을 사용합니다 (예: PlaylistCard.js의 shareModalVisible).

불변성: Redux Toolkit과 Immer 덕분에 Slice 리듀서 내에서는 상태를 직접 수정하는 것처럼 작성합니다.

3. 백엔드 (Node.js / Express) 지침
Copilot은 Node.js 및 Express 코드를 생성할 때 다음 원칙을 준수해야 합니다.

3.1. 아키텍처 및 모듈화
레이어 분리: 코드는 Route -> Middleware -> Controller -> Model 순서로 명확하게 계층을 분리합니다.

Route (routes/): URL 경로와 HTTP 메서드를 정의하고, middleware/authMiddleware.js의 protect를 사용하여 인증을 처리합니다.

Controller (controllers/): HTTP 요청 처리 및 입력 유효성 검사, 모델 메서드 호출을 담당합니다. express-async-handler를 사용하여 비동기 에러 처리를 캡슐화합니다.

Model (models/): 데이터베이스 상호작용 및 핵심 비즈니스 로직을 캡슐화하며, config/firebase.js의 RealtimeDBHelpers만을 사용해야 합니다.

DB 접근 추상화: **RealtimeDBHelpers**를 통한 간접적인 DB 접근만을 허용하며, Model 파일 외에서 admin.database()를 직접 사용하는 것은 금지합니다.

객체 처리: 도메인 객체(Model)를 직접 응답 객체로 사용하는 대신, 필요에 따라 클라이언트에게 적합한 형태로 가공하여 반환해야 합니다 (예: userController.js의 formatUserResponse).

3.2. JavaScript 코딩 컨벤션 (Node.js)
명명 규칙: 표준 JavaScript 컨벤션을 따릅니다.

비동기 처리: 모든 컨트롤러 함수는 asyncHandler(async (req, res) => { ... }) 패턴을 사용하여 작성해야 합니다.

에러 처리: 에러는 throw new Error('...') 형태로 던지고, middleware/errorMiddleware.js의 errorHandler에서 일괄 처리합니다.

로그 사용: console.log를 사용하여 디버깅 및 중요 작업의 흐름을 명시적으로 기록합니다 (예: deletePlaylist에서 삭제 요청/완료 로그).

4. 일반 원칙
DRY 원칙: 중복 코드를 최소화하고, 공통 로직은 유틸리티 클래스나 헬퍼 함수로 추상화합니다 (예: Frontend/utils/index.js의 format.errorMessage 함수).

코드 문서화: 복잡하거나 중요한 로직을 포함하는 함수 및 클래스에는 JSDoc 스타일 주석을 사용하여 목적, 매개변수, 반환 값을 명확히 설명합니다.

테스트 가능한 코드: 로직은 테스트 용이성을 고려하여 Controller, Model 계층으로 분리되어야 합니다.

의존성 관리: npm install --legacy-peer-deps를 사용하여 프론트엔드 의존성 충돌을 관리합니다.

보안:

민감 정보(비밀번호, API 키)는 .env 파일에 보관하며, .gitignore에 반드시 포함시켜야 합니다.

인증이 필요한 API 경로는 protect 미들웨어를 사용해야 합니다.