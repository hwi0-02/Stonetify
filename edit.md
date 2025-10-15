## 진행 현황 요약

- ✅ 완료
- ⚠️ 진행 중 (남은 세부 작업 있음)
- ⏳ 미착수

---

### 1. 공통 - 코드 일관성과 유틸 함수 도입 ✅
- 반복 패턴(해시/검증/상수)을 `utils/constants`, `utils/validators`, `utils/modelUtils` 등으로 분리 완료
- 로깅과 에러 출력은 `utils/logger`, `utils/errors`, `utils/responses`로 통합 적용

### 2. 백엔드 리팩토링
- **2.1 models** ✅
	- create/update 검증 유틸 도입 및 최소 변경 업데이트 로직 정비 완료
	- `searchUsers`/`searchPlaylists`/`searchSongs` 쿼리를 prefix 기반으로 전환하고 레거시 데이터 대비 fallback 포함
- **2.2 controllers** ✅
	- 전 컨트롤러에 공통 유틸·표준 응답/권한 체크를 일괄 적용하고 최종 검증 완료
- **2.3 routes** ✅
	- 전체 라우트 인증 구성 및 미사용 엔드포인트 정리를 마무리해 일관성 확보
- **2.4 middleware** ✅
	- 에러 핸들러 dev-stack 제한 및 토큰 검증 로깅 강화 완료
- **2.5 config** ✅
	- 환경 변수 검증 유틸(`utils/env`) 도입 및 경고 로깅 정비 완료
- **2.6 utils/scripts** ✅
	- 공통 로직·헬퍼를 `utils` 계층으로 이동하여 재사용 구조 구축

### 3. 프론트엔드 리팩토링
- **3.1 components** ✅
	- 전 컴포넌트에 공통 스타일·타이핑 패턴을 확산하고 PropTypes/접근성 점검까지 완료
- **3.2 screens** ✅
	- 홈/피드/Auth/Login/CreatePlaylist/EditProfile/Player/PlaylistDetail/SignUp/Search/ResetPassword/Welcome/WriteFeed 등 모든 화면에 공통 훅·디자인 시스템을 적용 완료
- **3.3 services** ✅
	- `httpClient`/`apiService` 통합, handleApiError 표준화 완료
- **3.4 store** ✅
	- `store/hooks` 정비와 모든 slice 액션/네이밍/흐름 일관성 점검을 마무리하고 공통 헬퍼 반영 완료
- **3.5 utils** ✅
	- UI/포맷 등 공통 함수 `utils` 하위로 중앙화 완료

### 4. 문서화 ⏳
- `SETUP_GUIDE.md` 최신 구조 반영 필요 (미착수)