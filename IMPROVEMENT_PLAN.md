# dashboard 개선 계획서

- 작성일: 2026-02-17
- 범위: `dashboard` 전체 (API, 인증/웹훅, Supabase Edge Function 호출 경로, UI 라우팅 연동)
- 상태: 1차 반영 완료, 2차 고도화 진행 중

## 1) 완료 상태 체크리스트 (현재 반영됨)

- [x] `src/lib/auth-middleware.ts`
  - `sanitizeDay`, `sanitizeEmail` 사용을 전역 표준으로 정리
  - 인증 미들웨어의 실패/예외 처리 통일
- [x] `src/lib/api-contract.ts`
  - 공통 응답 계약(`ApiErrorCode`, `apiError`) 정리
  - 공통 파싱 헬퍼(`parseJsonRequest`, `parseText`, `parseDay`, `parseQuizAnswers` 등) 도입
  - 본문 파싱 실패/형식 실패 응답을 구조화
  - 요청 본문 최대 크기 가드 추가 (기본 256KB)
  - 퀴즈 결과 배열 길이 상한 추가 (최대 200개)
- [x] 웹훅 보안 경로
  - `src/app/api/telegram/webhook/route.ts`
    - webhook secret 누락/불일치 검증 강화
    - payload 파싱/검증 실패 처리 강화
    - Telegram Bot Token 미설정 시 503 처리 추가
  - `src/app/api/kakao/webhook/route.ts`
    - Kakao 서명 검증 강화
    - payload 구조 가드 및 파싱 예외 처리 강화
- [x] `src/app/api/resend/add-contact/route.ts`
  - UTF-8 정규화 및 내부 시크릿 검증 적용
  - Resend 응답 에러를 일관된 `apiError` 스키마로 정리
- [x] 공통 에러 형식 정렬
  - `src/lib/api-contract.ts` 기반으로 다수 API 라우트 통합
- [x] 라우트별 점검에서 수정 완료
  - `src/app/api/attendance/route.ts`
  - `src/app/api/my/progress/route.ts`
  - `src/app/api/my/settings/route.ts`
  - `src/app/api/my/mastered/route.ts`
  - `src/app/api/my/status/route.ts`
  - `src/app/api/config/route.ts`
  - `src/app/api/resend/add-contact/route.ts`
  - `src/app/api/quiz/route.ts`
  - `src/app/api/words/route.ts`
  - `src/app/api/complete/route.ts`
  - `src/app/api/relearn/route.ts`
  - `src/app/auth/callback/route.ts`
  - `src/app/api/my/invite/route.ts`
  - `src/app/api/my/stats/route.ts`
  - `src/app/api/relearn/route.ts`
  - `src/app/api/results/route.ts`
  - `src/app/api/complete/route.ts`
  - `src/app/api/export/route.ts`
  - `src/app/api/invite/[code]/route.ts`
  - `src/app/api/my/admin/route.ts`
  - `src/lib/db.ts` (조회/쓰기 페이징 정책 정리)
- [x] 리포지토리 검사 문서 정리
  - `IMPROVEMENT_PLAN.md`
  - `REPOSITORY_REVIEW.md`

## 2) 2차 액션 플랜(우선순위)

### 2.1 High
- [ ] webhook/인증 흐름 전반에 재시도(중복) 방지 정책 통일 문서화
- [x] `GET /api/words`에 rate limit 정책 적용
- [ ] `src/app/api/my/admin/route.ts` 등 관리 API에 운영 모니터링 로그 추가

### 2.2 Medium
- [x] `src/app/api/push/test`, `src/app/api/push/subscribe`에 스로틀 정책 적용 및 남용 차단
  - `api:push:test` / `api:push:subscribe` / `api:push:subscribe:get` 범위 적용
- [x] 유저별 조회 응답에 공통 페이지네이션/제한을 통일 (`GET /api/results`, `GET /api/wrong`, `GET /api/attendance`)
  - `limit`, `offset` 쿼리 처리 및 `fromDate`, `toDate` 파라미터 보강
- [ ] Kakao/Telegram 메시지 텍스트 HTML/메시지 파싱에 대한 이스케이프 정책 검토
- [x] `POST /api/quiz`에 rate limit 적용 (scope 키/재시도 전략 포함)
  - `api:quiz:submit` 적용 완료

### 2.3 Low
- [ ] Edge Function 텍스트 템플릿 인코딩 정합성 점검 (한글 깨짐 이력 제거)
- [ ] `supabase/functions/*` 주요 함수에 최소한의 요청 바운더리 로그/에러코드 표준화
- [ ] 환경변수 누락 진단용 헬스체크 엔드포인트 추가 (`/api/health/config`)

## 3) 단계별 실행 계획

### 1단계 (1일)
- [x] `src/app/api/quiz/route.ts` POST 엔드포인트에 `checkRateLimit` 적용
- [x] `src/app/api/push/test/route.ts` POST 엔드포인트에 `checkRateLimit` 적용
- [x] `src/app/api/push/subscribe/route.ts` GET/POST 엔드포인트에 `checkRateLimit` 적용
- [x] `src/app/api/words/route.ts` GET 엔드포인트에 `checkRateLimit` 적용
- [x] `src/app/api/*/route.ts` 추가 10개 핵심 쓰기 엔드포인트에 `checkRateLimit` 확장 적용
- [x] 핵심 쓰기/외부 연동 `POST` 엔드포인트 추가 반영
  - `src/app/api/attendance/route.ts`
  - `src/app/api/postpone/route.ts`
  - `src/app/api/wrong/route.ts`
  - `src/app/api/my/progress/route.ts`
  - `src/app/api/my/status/route.ts`
  - `src/app/api/my/mastered/route.ts`
  - `src/app/api/my/settings/route.ts`
  - `src/app/api/config/route.ts`
  - `src/app/api/resend/add-contact/route.ts`
  - `src/app/api/kakao/webhook/route.ts`
  - `src/app/api/telegram/webhook/route.ts`
- [x] `GET` 핵심 조회 경로 일괄 `checkRateLimit` 반영
  - `src/app/api/complete/route.ts`
  - `src/app/api/export/route.ts`
  - `src/app/api/invite/[code]/route.ts`
  - `src/app/api/my/admin/route.ts`
  - `src/app/api/my/invite/route.ts`
  - `src/app/api/my/stats/route.ts`
  - `src/app/api/relearn/route.ts`
  - `src/app/api/results/route.ts`
  - `src/app/api/wrong/route.ts`
  - `src/app/api/attendance/route.ts` (`limit`, `offset`, `fromDate`, `toDate` 파싱 강화)
- [ ] `request-policy`에 로그 포맷(서비스별) 통일
- [ ] webhook 템플릿에서 사용자 이름/메시지 HTML 안전 처리 정리

### 2단계 (2-3일)
- [ ] `src/app/auth/callback/route.ts`와 webhook 경로에 재시도 키 규칙 문서화
- [ ] API 응답 계약(E2E)과 클라이언트 처리 매핑 정리
- [ ] `docs/REQUEST_POLICY.md` 기준으로 재시도/리플레이 템플릿 정리
- [ ] `GET /api/words` 정책 보강

### 3단계 (1주)
- [ ] 핵심 플로우 통합 smoke 테스트 추가
  - OAuth 로그인 + 회원 생성
  - Telegram/Kakao webhook 수신
  - 퀴즈 제출(`POST /api/quiz`)
  - 알림 발송 트리거(`supabase/functions/send-push`)
- [ ] EPERM 빌드 이슈 분리(개발환경 권한/잠금 파일 충돌) 확인 후 CI 빌드 결과 반영

## 4) 완료 기준

- [ ] 동일한 입력 규약이 `/api` 전 경로에서 일관되게 적용
- [ ] 외부 연동 경로가 `Invalid input`, `rate limit`, `replay` 3축으로 방어
- [ ] 문서와 실제 구현이 1:1 매칭
- [ ] 코드 변경량 대비 회귀 테스트 케이스 최소 5개
