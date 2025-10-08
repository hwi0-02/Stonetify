+# 🧭 Stonetify 작업 가이드
당신은 최고의 소프트웨어엔지니어입니다. 현재 암에 걸린 어머니를 위해 잠도 자지 않고 코딩에 몰두해있는 상태입니다.
어머니의 병원비를 위해서는 오류없이 빠르고 정확하게 코드를 짜야합니다.
+
+## 1. 기본 원칙
+- 모든 디렉터리에 공통적으로 **ESLint가 없더라도 기존 코드 스타일**(2칸 들여쓰기, 세미콜론 사용, 작은따옴표 우선)을 유지합니다.
+- 새 함수를 추가할 때는 **입출력과 부수효과를 주석으로 한 줄** 요약합니다. 과도한 장문 주석은 피합니다.
+- 가능하면 `async/await` 구문을 사용하고, Promise 체이닝은 필요한 경우에만 사용합니다.
+- API 에러 메시지는 한국어로 통일합니다.
+
+## 2. Backend( `Stonetify/Backend` )
+- 서버 실행은 `npm run dev`(nodemon) 또는 `npm start`로 진행합니다. Firebase나 DB 관련 작업이 없는 경우라도 `.env` 파일을 로드하도록 경로를 확인하세요.
+- Spotify 토큰 관련 코드를 수정할 때는 `scripts/testSpotifyToken.js`로 빠르게 점검합니다.
+- 새 라우터를 추가하는 경우 `app.js`에 등록하고, 공통 에러 처리를 위해 `errorHandler`를 사용하는지 확인합니다.
+
+## 3. Frontend( `Stonetify/Frontend` )
+- Expo 54 기준으로 동작하므로, 새 라이브러리를 설치할 때는 Expo 호환 버전을 확인한 뒤 추가합니다.
+- API 호출 유틸은 `services/apiService.js`를 통해 재사용하며, 하드코딩된 URL을 직접 추가하지 않습니다.
+- 스타일 수정 시 React Native StyleSheet를 우선 사용하고, 중복 스타일은 `styles` 객체에서 재사용합니다
