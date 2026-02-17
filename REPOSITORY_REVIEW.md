# dashboard REPOSITORY_REVIEW

- 작성일: 2026-02-17
- 점검 범위: `dashboard` 루트에서 실행되는 API, 인증, 웹훅, Supabase 연동 경로

## 1) 전반 리스크 요약

- High: 없음
- Medium: 외부 연동 경로의 재시도/중복 방지 정책이 분산됨
- Medium: 일부 페이지/API에서 보안/입력 제한은 적용되었으나 정책 문서가 완전하지 않음
- Low: UTF-8 문자열 데이터셋/문자열 템플릿에서 인코딩 경고 잔여 항목 존재

## 2) 완료 항목 (재확인)

- [x] webhook 계약 정비
  - `src/app/api/telegram/webhook/route.ts`
  - `src/app/api/kakao/webhook/route.ts`
- [x] 공통 API 계약 도입
  - `src/lib/api-contract.ts`
  - `src/lib/request-policy.ts`
  - 다수 라우트 공통 에러 포맷 적용
- [x] 핵심 쓰기 API 요청 방어 강화
  - `src/app/api/quiz/route.ts` (`POST /api/quiz`)
  - `src/app/api/push/test/route.ts` (`POST /api/push/test`)
  - `src/app/api/push/subscribe/route.ts` (`GET /api/push/subscribe`, `POST /api/push/subscribe`)
  - `src/app/api/attendance/route.ts` (`POST /api/attendance`)
  - `src/app/api/postpone/route.ts` (`POST /api/postpone`, `DELETE /api/postpone`)
  - `src/app/api/wrong/route.ts` (`POST /api/wrong`)
  - `src/app/api/my/progress/route.ts` (`POST /api/my/progress`)
  - `src/app/api/my/status/route.ts` (`POST /api/my/status`)
  - `src/app/api/my/mastered/route.ts` (`POST /api/my/mastered`)
  - `src/app/api/my/settings/route.ts` (`POST /api/my/settings`)
  - `src/app/api/config/route.ts` (`POST /api/config`)
  - `src/app/api/resend/add-contact/route.ts` (`POST /api/resend/add-contact`)
  - `src/app/api/kakao/webhook/route.ts` (`POST /api/kakao/webhook`)
  - `src/app/api/telegram/webhook/route.ts` (`POST /api/telegram/webhook`)
- [x] 인증/인가 기반 경로 정합성
  - `src/app/auth/callback/route.ts`
  - 다수 `/api/my/*` 경로
- [x] 데이터 검증 강화
  - `src/app/api/attendance/route.ts`
  - `src/app/api/words/route.ts`
  - `src/app/api/my/progress/route.ts`
  - `src/app/api/quiz/route.ts`
  - `src/app/api/results/route.ts` (`limit`, `offset` 쿼리 검증)
  - `src/app/api/wrong/route.ts` (`limit`, `offset`, `mastered` 쿼리 검증)
  - `src/app/api/attendance/route.ts` (`limit`, `offset`, `fromDate`, `toDate` 쿼리 검증)
- [x] 조회 API 방어 보강
  - `src/app/api/words/route.ts` (`GET /api/words`)
  - `src/app/api/attendance/route.ts` (`GET /api/attendance`) + 페이지네이션/범위
  - `src/app/api/complete/route.ts` (`GET /api/complete`)
  - `src/app/api/export/route.ts` (`GET /api/export`)
  - `src/app/api/invite/[code]/route.ts` (`GET /api/invite/[code]`)
  - `src/app/api/my/admin/route.ts` (`GET /api/my/admin`)
  - `src/app/api/my/invite/route.ts` (`GET /api/my/invite`)
  - `src/app/api/my/stats/route.ts` (`GET /api/my/stats`)
  - `src/app/api/relearn/route.ts` (`GET /api/relearn`)
  - `src/app/api/results/route.ts` (`GET /api/results`) + `limit`/`offset`
  - `src/app/api/wrong/route.ts` (`GET /api/wrong`) + `limit`/`offset`/`mastered`
- [x] 파싱 안정성
  - `src/app/api/quiz/route.ts` 입력 배열 상한 적용 간접 적용(공통 파서)
  - `src/lib/api-contract.ts` 요청 본문 크기 기본 제한(256KB)
- [x] 인코딩/텍스트 이슈 경로 정리
  - `src/app/api/resend/add-contact/route.ts` UTF-8 재저장

## 3) 미해결 항목(체크리스트)

- [ ] API 라우트 공통 정책 정합성 문서화
  - `/api/results`, `/api/wrong`, `/api/my/admin`의 운영 정책(429, retry, timeout)
- [ ] webhook/콜백 중복 처리 계약 문서
  - Telegram/Kakao 요청 idempotency 키 스펙
- [ ] 공통 입력 제한 스키마와 rate limit 정책의 중앙 레지스트리 작성
- [ ] Edge Function별 에러 코드/응답 포맷 표준화
  - `supabase/functions/evening-review/index.ts`
  - `supabase/functions/morning-words/index.ts`
  - `supabase/functions/naver-auth/index.ts`
- [ ] 텍스트 템플릿 인코딩 정합성 점검
  - Supabase Function 템플릿(한글/이모지 렌더링)
## 4) 추천 자동 점검 항목(테스트)

- [ ] `POST /api/quiz` 큰 payload 거부
  - 0개 항목
  - 201개 항목
  - invalid JSON
- [ ] `POST /api/push/test` 남용 방지 동작(1분 단위 10회)
- [ ] `POST /api/push/subscribe` 남용 방지 동작(1분 단위 40회)
- [ ] `GET /api/push/subscribe` 남용 방지 동작(1분 단위 120회)
- [ ] `GET /api/words` 남용 방지 동작(1분 단위 120회) 및 `docs/REQUEST_POLICY.md` 반영 검증
- [ ] `POST /api/config` 남용 방지 동작(1분 단위 30회)
- [ ] `POST /api/my/mastered`, `POST /api/my/settings` 남용 방지 동작(1분 단위 60회)
- [ ] `POST /api/kakao/webhook`, `POST /api/telegram/webhook` 남용 방지 동작(1분 단위 120회)
- [ ] `GET /api/attendance`, `GET /api/complete`, `GET /api/export`, `GET /api/relearn` 남용 방지 동작(1분 단위 120회)
- [ ] `GET /api/my/admin`, `GET /api/my/invite`, `GET /api/my/stats`, `GET /api/results`, `GET /api/wrong` 남용 방지 동작(1분 단위 120회)
- [ ] `GET /api/results`, `GET /api/wrong`, `GET /api/attendance`에서 `limit`/`offset`/`fromDate`/`toDate` 파라미터 경계 테스트
- [ ] `GET /api/invite/[code]` 남용 방지 동작(1분 단위 120회)
- [ ] `GET /api/my/stats` 남용 방지 동작(1분 단위 120회)
- [ ] webhook 파싱/서명 실패 시 4xx 고정 응답
  - Telegram secret 누락
  - Kakao signature 불일치
- [ ] `requireAuth` 실패 시 401과 권한 불일치 403 경계 확인
- [ ] `GET /api/results`에서 요청자 email 오염 시 접근제어 차단
- [ ] Supabase Functions 인증/환경변수 누락 시 5xx 경계 케이스

## 5) 다음 리뷰 사이클 체크포인트

1. [ ] 2주마다 `IMPROVEMENT_PLAN.md`와 동기화
2. [ ] 엔드투엔드 smoke 테스트 결과를 `docs/` 또는 `IMPLEMENTATION_SUMMARY`에 누적
3. [ ] Medium 항목(재시도/중복 요청 정책) 선반영 후 High 후보 항목 없음 재확인
4. [ ] 새 에러 계약 변경 시 프론트엔드 소비측 매핑 규격 업데이트
