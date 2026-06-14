# Career Company Tracker

디자인 계열 구직자가 관심 회사를 정리하고, 채용 공고와 회사 조사, 면접 준비 기록을 한 곳에서 관리하는 개인용 커리어 트래커입니다.

## 주요 기능

- Magic Link 기반 로그인
- 로그인 사용자별 회사 목록, 설정, 후보 Inbox 저장
- 회사 등록/수정, 상태/우선순위/마감일 관리
- 회사핏 점수, 리스크, 좋은 점 / 걱정되는 점 / 더 확인할 점 기록
- 모바일 회사 카드 리스트와 상세 드로어
- AI 공고 파싱, 회사 조사, 비교 분석, 주간 전략, 면접 질문, 메일 초안, 회사 요약
- AI 유료 베타: 계정당 첫 성공 1회 무료, 이후 10회권 4,900원

## 이번 빌드 변경사항

- **Magic link 로컬호스트 경고**: 성공 메시지에 로컬 서버 실행 여부 안내 추가. dev 환경에서 발송 실패 시 Supabase redirect URL 진단 힌트 인라인 표시.
- **예시 데이터 교체 아이콘 제거**: 툴바 devTools RotateCcw 버튼 및 관련 `resetSampleData` 로직 제거.
- **마감일 D-day 배지**: 마감일 7일 이내 시 테이블 카드·행에 `D-N` 배지 표시 (3일 이내 빨간색, 4–7일 주황색).
- **Magic link 에러 메시지 개선**: rate limit 판별 메시지 분리, dev 환경에서 실제 오류 텍스트 + Supabase redirect URL 등록 안내 인라인 표시.
- **직군 선택 모달 필수화**: devTools 환경에서도 "나중에 설정" 건너뛰기 불가 (`allowSkip` 항상 `false`).
- **지원 제출 완료 → 지원 목표 카운팅**: "지원 제출 완료" 체크 시 status가 초기 단계(`interested`/`planned`)이면 자동으로 `applied`로 업데이트. 사이드바 지원 목표 카운터에 즉시 반영. 토스트 안내.
- **예시 데이터 버튼 분리**: 툴바 인라인 `<select>` 제거 → "예시 추가" / "샘플 삭제" 개별 버튼으로 분리.
- **검증 뱃지 텍스트 통일**: 테이블과 드로어 모두 "공고 재확인 필요"로 통일 (`getPrimaryValidationBadge` 단순화).
- **테이블 빈 상태 구분**: 필터 결과 없음 vs 등록 회사 없음 메시지 구분.
- **칸반 빈 컬럼 드롭존**: dashed border 컨테이너로 시각적 드롭 영역 표시.

## 이전 빌드 변경사항 (Radar Sprint)

- 서비스명 전면 교체: `CareerTrack` / `Career Company Tracker` → `CompanyRadar`. AppSidebar, manifest, User-Agent 모두 반영.
- Drawer 요약카드 행 간격 축소: 두 metric 그리드 섹션을 `space-y-2` 래퍼로 묶어 행 간격을 좁힘.
- 리스크 체크리스트 Drawer 인라인 편집: 회사 조사 탭에서 `RISK_CHECKLIST` 항목을 직접 체크/해제 가능. 체크된 항목은 빨간 배경으로 구분.
- 리스크 체크리스트 이름 통일: CompanyForm의 "걱정되는 점 체크리스트" → "리스크 체크리스트".
- Candidate Inbox 회사명/직무명 직접 입력 필드 추가: URL 없이도 회사명·직무명으로 후보 저장 가능. 승격 시 직접 입력 값 우선 사용.
- Candidate Inbox AI 분석 버튼: 카드마다 "AI 분석" 버튼 추가. `/api/parse-job` 호출 후 `parsedCompany` 저장, 파싱 상태 표시.
- 기존 validationReason 레이블 마이그레이션: `normalizeCompany`에서 "AI 추출 데이터", "근거 레벨 2 이하" 등 기술적 레이블 자동 제거.
- DB 스키마: `candidate_inbox_items` 테이블에 `company_name`, `job_title` 컬럼 추가 (migration v039).

## 이전 빌드 변경사항

- Magic Link 인증 개선: `/auth/callback` 라우트 추가(PKCE code exchange), 로그인 실패 시 사용자 친화적 안내 페이지(`/auth/error`), `emailRedirectTo` 값 수정. AuthGate 브랜딩 업데이트.
- 설정 화면 Gmail 문의 버튼: `NEXT_PUBLIC_SUPPORT_EMAIL` 설정 시 서비스 문의·결제 환불 섹션에 Gmail Compose URL 버튼 추가.
- Drawer 너비 확장: `sm:w-[520px]` → `sm:w-[600px] lg:w-[720px] xl:w-[800px]`.
- 회사 추가/수정 폼 progressive disclosure: 필수 항목(회사명, 공고 URL, 상태, 우선순위)만 기본 노출. 나머지는 "추가 정보" 접힘 영역으로 이동.
- 샘플 데이터 명확화: 직군별 샘플 회사명을 `[샘플] 디자이너 직군 예시` 형식으로 변경. 회사 목록에 "샘플" 배지 추가. 툴바에 "샘플 삭제" 버튼 추가.
- 모바일 레이아웃 수정: Toolbar 상태/정렬 필터 반응형 flex로 수정(375px overflow 해소). ActionBox flex-wrap으로 버튼 overflow 방지. 설정 슬라이더 그리드 협소 화면 대응.
- 헤더 브랜드명: "Career Company Tracker" → "CompanyRadar".
- Drawer 정보 밀도 축소: 빈 InfoRow 자동 숨김, 중복 링크 제거, 빈 값 fallback "없음" 제거.
- 어드민 대시보드 전면 개선: Gmail 답장 링크, 더미 데이터, 답장 템플릿 미리보기, 완료 되돌리기, 기본 필터 "미처리".
- 회사 테이블 뱃지 중복 제거, 드로어 근거 레벨 자연어화, 서비스명 CompanyRadar 교체, 소스코드 개인정보 제거.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

프로덕션 빌드 확인:

```bash
npm run build
```

## 환경변수

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# 운영자/무제한 AI 계정
AI_ALLOWED_EMAILS=
AI_ALLOWED_USER_IDS=

# Toss Payments
NEXT_PUBLIC_TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=
TOSS_WEBHOOK_SECRET=

# 서버 전용. 클라이언트에 노출 금지
SUPABASE_SERVICE_ROLE_KEY=

# 테스트 도구를 노출할 개발 호스트/오리진(선택)
NEXT_PUBLIC_DEV_TOOL_ORIGINS=

# Magic Link redirect URL 명시적 지정 (로컬 개발 또는 커스텀 도메인용, 선택)
# 예: http://localhost:3000 (미설정 시 window.location.origin 자동 사용)
NEXT_PUBLIC_SITE_URL=

# 관리자 답장·설정 화면에 표시할 서비스 이메일(선택)
NEXT_PUBLIC_SUPPORT_EMAIL=
```

`service_role` key와 `TOSS_SECRET_KEY`는 서버 API route에서만 사용합니다. `NEXT_PUBLIC_` prefix가 붙은 값만 브라우저에 노출됩니다.

## Supabase 설정

### Magic Link Redirect URL 설정

Supabase 대시보드 → Authentication → URL Configuration → **Redirect URLs**에 아래 URL을 추가합니다.

```
http://localhost:3000/**
https://your-production-domain/**
```

로컬 개발 시 `NEXT_PUBLIC_SITE_URL=http://localhost:3000`을 `.env.local`에 추가합니다.

### DB 마이그레이션

Supabase SQL Editor에서 아래 migration을 순서대로 적용합니다.

```txt
supabase/migrations/20260612_v031_auth_rls.sql
supabase/migrations/20260612_v033_candidate_inbox.sql
supabase/migrations/20260613_v034_profiles_ai_requests.sql
supabase/migrations/20260613_v035_ai_billing_credits.sql
supabase/migrations/20260613_v036_support_account_requests.sql
supabase/migrations/20260614_v038_profiles_trigger.sql
supabase/migrations/20260614_v039_candidate_inbox_name_fields.sql
```

`v038` 적용 후 운영자 계정을 `owner`로 설정:

```sql
update public.profiles
set role = 'owner'
where email = 'your-operator@example.com';
```

주요 테이블:

- `companies`: 사용자별 회사 데이터
- `candidate_inbox_items`: 검토 전 후보 회사/공고
- `profiles`: `owner / beta_user / blocked` 역할
- `ai_requests`: AI 요청 로그
- `ai_credit_accounts`: 무료/유료 AI 잔여 횟수
- `ai_credit_ledger`: 무료 지급, 구매 지급, 성공 차감 기록
- `payments`: 토스페이먼츠 주문/승인 상태
- `support_requests`: 서비스 문의, 버그, 기능 제안
- `refund_requests`: 결제/환불 요청
- `account_deletion_requests`: 회원탈퇴 요청 상태

## AI 권한과 과금

- `AI_ALLOWED_EMAILS` 또는 `AI_ALLOWED_USER_IDS`에 포함된 계정, `profiles.role = owner` 계정은 AI를 무제한 사용합니다.
- `profiles.role = blocked` 계정은 무료/유료 크레딧이 있어도 AI 사용이 차단됩니다.
- 일반 사용자는 `ai_credit_accounts.free_uses_remaining + paid_credits_remaining > 0`일 때 AI를 사용할 수 있습니다.
- 새 계정은 첫 성공 AI 응답 1회를 무료로 사용할 수 있습니다.
- 이후에는 `AI 10회 이용권`을 4,900원에 구매합니다.
- 크레딧은 성공한 AI 응답에만 1회 차감됩니다. OpenAI 오류, 네트워크 오류, 권한 오류는 차감하지 않습니다.

## 결제 흐름

결제는 토스페이먼츠 일회성 원화 결제로 처리합니다.

1. AI 잔여 횟수가 없으면 클라이언트가 `402 payment_required` 응답을 받고 구매 모달을 엽니다.
2. 사용자가 `10회권 4,900원 구매`를 누르면 `/api/billing/create-order`가 pending 주문을 만듭니다.
3. 토스페이먼츠 결제창에서 결제가 끝나면 `/billing/success`로 돌아옵니다.
4. 성공 페이지가 `/api/billing/confirm`을 호출해 `paymentKey/orderId/amount`를 검증하고 토스 승인 API를 호출합니다.
5. 승인 상태가 `DONE`이면 `paid_credits_remaining`에 10회를 지급합니다.
6. 같은 `orderId`가 다시 confirm되거나 웹훅이 중복 도착해도 크레딧은 한 번만 지급됩니다.

정산 계좌는 토스페이먼츠 상점 설정에서 등록합니다. 앱 DB에는 계좌번호를 저장하지 않습니다.

## 서비스 문의, 환불, 탈퇴

- 설정 화면의 `서비스 문의`에서 버그, 기능 제안, 사용 문의를 접수합니다.
- 설정 화면의 `결제 및 환불`에서 AI 10회권 환불 요청을 접수합니다.
- 환불 정책은 `결제 후 7일 이내 + 유료 크레딧 미사용`이면 전액 환불 요청 가능입니다.
- 사용 이력이 있거나 서비스 장애, 중복 결제, 승인 오류가 있는 경우 운영자가 개별 확인합니다.
- 회원탈퇴는 즉시 삭제가 아니라 요청 접수형입니다. 결제/환불 가능성을 확인한 뒤 운영자가 처리하고 이메일로 안내합니다.

## 개발 메모

- 샘플 데이터는 현재 직군 기준 예시 1개만 제공합니다.
- Supabase 저장이 기본이며, 데이터를 불러오지 못하는 경우 로그인 사용자별 localStorage에 임시 저장합니다.
- JSON 가져오기/내보내기는 설정의 고급 백업에서만 제공합니다.
- 결제/크레딧 로직은 `SUPABASE_SERVICE_ROLE_KEY`가 필요합니다.
- 토스 테스트 키를 사용하면 실제 결제가 발생하지 않습니다.
