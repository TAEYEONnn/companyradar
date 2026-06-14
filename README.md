# Career Company Tracker

디자인 계열 구직자가 관심 회사를 정리하고, 채용 공고와 회사 조사, 면접 준비 기록을 한 곳에서 관리하는 개인용 커리어 트래커입니다.

## 주요 기능

- 이메일/비밀번호 기반 회원가입 및 로그인
- 로그인 사용자별 회사 목록, 설정, 후보 Inbox 저장
- 회사 등록/수정, 상태/우선순위/마감일 관리
- 회사핏 점수, 리스크, 좋은 점 / 걱정되는 점 / 더 확인할 점 기록
- 모바일 회사 카드 리스트와 상세 드로어
- AI 공고 파싱, 회사 조사, 비교 분석, 주간 전략, 면접 질문, 메일 초안, 회사 요약
- AI 유료 베타: 계정당 첫 성공 1회 무료, 이후 10회권 4,900원

## 이번 빌드 변경사항

- **신규 사용자 빈 목록 시작**: 가입 후 샘플 데이터 없이 빈 화면으로 시작. 온보딩 "예시로 시작" 선택 시에만 샘플 로드. 첫 진입 흐름: AI 공고 정리 CTA → 붙여넣기 → 초안 생성.
- **상단 CTA 단순화**: 헤더 우측 "회사 추가" 버튼 제거, "AI로 공고 정리하기" 버튼으로 교체. 어디서든 클릭하면 Inbox로 이동.
- **예시 추가/삭제 버튼 단일 노출**: 예시 데이터가 없으면 "예시 추가"만, 있으면 "예시 삭제"만 표시. 두 버튼 동시 노출 방지.
- **빈 목록 안내 텍스트 단순화**: "첫 회사를 추가하고 지원 기준을 만들어보세요" → "아직 저장한 공고가 없어요." / 버튼도 "AI로 공고 정리하기"로 통일.
- **AI 기본 CTA 전환**: 빈 대시보드의 첫 번째 버튼이 "AI로 공고 정리하기"로 변경. 직접 추가는 보조 액션으로 낮춤. 제품의 기본 흐름을 "붙여넣으면 초안 생성"으로 정착.
- **AI 무료 분석 5회 정책**: 가입 후 AI 공고 분석을 무료 5회 사용 가능 (기존 1회). AI 분석 성공 시에만 차감. 남은 횟수를 시작 가이드·Inbox 상단·AI 버튼 배지에 실시간 표시.
- **직군 "운영/기타" 추가**: 온보딩 직군 선택에 "운영/기타" (운영, 세일즈, HR 등) 추가. 직군별 평가 기준·리스크 체크리스트 매핑 완료. "디자인·개발·기획·마케팅·운영 등 IT/프로덕트 직군 모두를 위한 트래커" 문구로 진입장벽 완화.
- **모바일 회사 추가/수정 하단 저장 버튼**: 모바일에서 스크롤해야 보이던 저장 버튼을 하단 sticky 영역으로 분리. 어느 위치에서도 저장/취소 접근 가능.
- **ScoreSlider 모바일 반응형 수정**: 평가 기준 슬라이더가 데스크톱에서는 4열 레이아웃, 모바일에서는 라벨 + [슬라이더+점수] + 근거 수준 3행으로 자동 전환. 화면 넘침 해소.
- **힌트 아이콘 모바일 탭 지원**: 물음표(?) 힌트 아이콘이 모바일 탭으로 열리고 닫히도록 수정. 기존 hover 동작은 데스크톱에서 유지.
- **할 일 입력 모바일 레이아웃 개선**: "다음 할 일 추가" 입력 행이 모바일에서 쌓이는 구조로 변경. placeholder 텍스트가 잘리지 않음.
- **첫 사용 경험 개선 — 2단계 온보딩**: 직군 선택(필수) → 시작 방식 선택(AI/직접/예시) 2단계로 재구성. AI 선택 시 Inbox로 이동, 직접 선택 시 회사 추가 폼, 예시 선택 시 직군별 샘플 데이터 로드.
- **AI 분석 초안 안내**: 파싱 성공 후 "AI 정리는 초안이에요. 저장 전 회사명, 공고명, 마감일을 직접 확인해주세요." 안내 표시.
- **OG 이미지 히어로 배너 리디자인**: 어두운 다크 그라디언트 배경 + 좌측 대형 헤드라인 + 우측 회사 핏 점수 카드로 재구성.
- **비밀번호 재설정 dev 힌트**: 재설정 메일 발송 실패 시 `console.error` 기록. 개발 환경에서 Supabase 대시보드 Redirect URLs 등록 안내 메시지를 UI에 인라인 표시.



- **비밀번호 재설정 보안 강화**: 코드 교환 전 기존 세션 강제 로그아웃으로 다른 계정 세션 혼입 버그 차단. 링크 만료 시 "새 재설정 메일 요청" 버튼 + `?reset=1` 파라미터로 AuthGate가 자동으로 재설정 모드 진입. 재설정 메일을 `/auth/callback`으로 라우팅해 허용 URL 설정 누락 우회.
- **빈 회사 목록 레이아웃 개선**: 컬럼 헤더(회사/회사핏/상태/수정)가 최상단에 항상 표시. "채용공고 붙여넣기" 버튼 제거. 필터 결과가 없을 때 "조건에 맞는 회사가 없습니다" 텍스트 제거 — 필터 초기화 버튼만 표시.
- **운영자 대시보드 기본 필터 전체로 변경**: 기본값이 "미처리"여서 완료된 요청이 보이지 않던 문제 해결. 이제 "전체" 필터로 시작하며 상단 필터 버튼으로 원하는 상태만 볼 수 있음.
- **답장 내용 즉시 반영**: Gmail 답장 버튼 클릭 시 DB 저장 결과와 무관하게 답장 내용이 즉시 textarea에 반영되도록 낙관적 업데이트 적용. DB 저장 실패 시 토스트로 안내.
- **운영자 버튼 명칭 명확화**: "검토 안내" → "검토 중으로 표시", "승인 안내" → "승인으로 표시", "거절 안내" → "거절로 표시", "완료 안내" → "완료로 표시". 버튼이 내부 상태 변경임을 명시.
- **답장 템플릿 선택기 추가**: 문의/환불/탈퇴 각 답장 미리보기에 템플릿 드롭다운 추가. 선택 시 상태별 템플릿 내용이 textarea에 즉시 채워짐.
- **탈퇴 승인 시 계정 자동 삭제**: "탈퇴 완료 처리" 버튼 클릭 시 확인 다이얼로그 후 Supabase Auth에서 해당 사용자 계정 자동 삭제.
- **AI 요약 탭 전환 시 내용 유지**: AI 요약 결과가 탭 전환 후 사라지던 문제 해결. aiSummary 상태를 상위 컴포넌트로 끌어올려 탭 재진입 시 결과가 그대로 표시됨.
- **직군 선택 모달 모바일 스크롤**: 작은 화면에서 모달 하단 "이 기준으로 시작하기" 버튼에 닿지 않던 문제 해결. 콘텐츠 영역은 스크롤, 버튼은 하단 고정 푸터로 분리.
- **기본 인증 이메일/비밀번호 전환**: Magic Link 기본 UI와 `signInWithOtp` 호출 제거. 로그인, 회원가입, 비밀번호 재설정 요청을 AuthGate에서 직접 처리.
- **회원가입 UX 추가**: 이메일, 비밀번호, 비밀번호 확인 입력과 8자 이상/일치 검증 추가. Confirm Email이 꺼져 있으면 즉시 앱 진입, 켜져 있으면 확인 메일 안내.
- **기존 짧은 비밀번호 계정 로그인 지원**: 로그인은 기존 Supabase 계정의 현재 비밀번호를 그대로 허용하고, 8자 이상 제한은 신규 회원가입과 비밀번호 변경에만 적용.
- **비밀번호 재설정 recovery 연결**: 재설정 메일은 `/auth/callback?type=recovery`로 돌아오고, code 교환 후 `/auth/reset-password`에서 새 비밀번호를 설정하도록 변경.
- **비밀번호 재설정 flow 유연화**: Supabase Auth client의 강제 PKCE 설정을 제거하고, reset 화면에서 링크 형태별 세션 복구를 직접 처리하도록 정리. 이전 방식으로 받은 재설정 메일도 최대한 복구합니다.
- **비밀번호 재설정 링크 복구 강화**: 재설정 메일은 `/auth/reset-password`로 직접 이동하고, reset 페이지가 `code`, `token_hash`, `#access_token` 링크를 모두 세션으로 복구하도록 변경. Supabase 이메일 템플릿/flow 차이로 만료 화면에 떨어지는 문제를 줄였습니다.
- **비밀번호 재설정 재요청 UX 개선**: 로그인/설정 화면의 재설정 메일 버튼에 60초 카운트다운을 추가해 중복 요청과 Supabase rate limit 혼란을 줄였습니다.
- **비밀번호 재설정 callback 복구 보강**: Supabase recovery 링크가 `type=recovery` 없이 `code`만 돌아와도 `/auth/reset-password`에서 세션 교환 후 재설정 폼을 열도록 수정했습니다.
- **운영자 요청 아카이브/답장 본문 저장**: 문의·환불·탈퇴 요청에 `archived_at`, `reply_body`, `replied_at` 컬럼을 추가하고, 운영자 대시보드에서 아카이브/복원 및 실제 발송할 답장 본문 편집을 지원합니다.
- **탈퇴 요청 운영자 조회 수정**: 탈퇴 요청 테이블의 `requested_at`을 운영자 UI의 날짜 필드로 매핑해 실제 접수된 탈퇴 요청이 대시보드에 표시되도록 정리했습니다.
- **회사 상세 드로어 스크롤 보강**: 긴 AI 리서치 결과가 있어도 하단 섹션까지 닿도록 드로어 viewport 높이와 스크롤 하단 여백을 조정했습니다.
- **면접 Q&A AI 코칭 추가**: 회사 상세 드로어의 예상질문 카드에서 `AI 답변 초안`과 `내 답변 평가`를 바로 실행할 수 있게 추가. 답변 초안은 기존 답변칸에 저장되고, 평가는 카드 안에서 점수/강점/개선점/개선 예시로 확인합니다.
- **첫 빈 대시보드 CTA 개선**: 회사가 0개일 때 `회사 직접 추가`와 `채용공고 붙여넣기` CTA를 노출해 첫 방문자가 다음 행동을 바로 선택할 수 있게 했습니다.
- **로그인 화면 OG 카피 정렬**: 공유 미리보기 문구와 로그인 첫 화면 카피를 "지원할 회사를 기준 있게 정리" 흐름으로 통일. 신규 사용자가 `회사 추가 → 점수 확인 → 면접 준비`를 바로 이해하도록 3단계 미니 흐름 추가.
- **첫 방문 온보딩 3단계 축약**: 직군 선택 모달 상단에 `회사 추가 → 점수 확인 → 면접 준비` 진행 흐름을 추가하고, 직군 설명을 짧게 줄여 첫 설정 부담 완화.
- **매직링크 rate limit UX 개선**: 성공한 매직링크 요청만 60초 재발송 차단으로 기록. Supabase가 `email rate limit exceeded`를 반환하면 Site URL/Redirect URL 문제가 아니라 Auth 이메일/OTP 발송 한도임을 안내.
- **OG/Twitter 공유 미리보기 추가**: 루트 페이지에 `og:title`, `og:description`, `og:url`, `og:site_name`, `og:image`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` 메타데이터 추가. `/opengraph-image`에서 1200×630 PNG 공유 이미지를 동적 생성.
- **브랜드 메타데이터 CompanyRadar 통일**: `layout.tsx` 기본 title/description을 CompanyRadar 기준으로 변경하고, `NEXT_PUBLIC_SITE_URL`/Vercel URL 기반 canonical URL을 사용.
- **운영자 답장 템플릿 상태 반영**: 문의·환불·탈퇴 상태 변경 후 Gmail 답장 링크와 "답장 내용" 미리보기가 검토/완료/승인/거절/취소 상태별 문구로 즉시 갱신.
- **인증 콜백 로딩 복구 보강**: `/auth/confirm` 코드 교환 timeout과 세션 fallback 추가. 루트에 `?code=`가 들어온 경우 `/auth/confirm`으로 복구 이동.
- **매직링크 무한로딩 수정**: 콜백 라우트를 `/auth/confirm` 중간 페이지로 변경. 코드 교환을 명시적으로 처리한 뒤 루트로 이동하여 `detectSessionInUrl` 이중 처리 루프 제거.
- **리스크 체크리스트 직군별 분리**: 디자이너/PM/프론트엔드/UX리서처/마케터 각각 직군에 맞는 리스크 항목으로 차별화. 회사 수정 폼과 드로어 조사 탭 모두 적용.
- **테이블 마감일 중복 표시 제거**: 모바일 카드 마감일 amber 강조 색상·데스크톱 "마감일 미확인" 텍스트 제거. StatusDropdown 배지로 충분히 구분 가능.
- **오늘 할 일 섹션 헤더 제거**: "기한 초과" / "이번 주" 섹션 헤더를 제거하고 우선순위 도트 색상으로 구분하는 평면 목록으로 변경. 같은 회사가 여러 섹션에 중복 노출되는 문제 해소.
- **오늘 할 일 validation 배지 단순화**: 여러 개의 amber 뱃지 대신 "공고 재확인 필요" 뱃지 하나 + ⓘ 아이콘 툴팁으로 상세 사유 표시.
- **매직링크 dev 오류 개선**: rate limit 에러 시 redirect URL 등록 힌트 미표시. 실제 URL 설정 문제일 때만 Supabase 대시보드 안내 표시.
- **드로어 회사명 '확인 필요' 뱃지 제거**: 이미 아래에 "공고 재확인 필요" 뱃지가 있으므로 회사명 옆 중복 뱃지 제거.
- **ScoreSlider 드롭다운 텍스트 트림**: 선택된 항목 텍스트가 긴 경우 말줄임표(…)로 잘림 처리.
- **할 일 추가 빠른 기한 버튼**: 오늘 / 3일 / 이번 주 / 2주 버튼으로 마감일 빠르게 설정. 선택된 날짜 강조.
- **테이블 인라인 상태 변경**: 회사 목록에서 상태 배지를 클릭하면 드롭다운으로 바로 상태 변경 가능. 모바일·데스크톱 모두 지원.
- **드로어 다음 할 일 배너 액션화**: "다음 할 일 없음" 배너에 "+ 할 일 추가" 버튼 추가. 클릭 시 준비 탭으로 전환 후 입력 필드 자동 포커스.
- **마감일 없는 회사 강조**: `관심중` / `지원 예정` 상태인데 마감일이 없는 회사는 테이블 마감일 필드를 주황색으로 강조. 데스크톱에서 "마감일 미확인" 안내 텍스트 표시.
- **준비 체크리스트 진행률 표시**: 드로어 준비 탭에 체크리스트 완료 현황(N/5) + 진행률 바 표시.
- **칸반 D-day 배지**: 마감일 7일 이내 시 칸반 카드에 `D-N` 배지 표시 (3일 이내 빨간색, 4–7일 주황색).
- **Magic link 로컬호스트 경고**: 성공 메시지에 로컬 서버 실행 여부 안내 추가. dev 환경에서 발송 실패 시 Supabase redirect URL 진단 힌트 인라인 표시.
- **예시 데이터 교체 아이콘 제거**: 툴바 devTools RotateCcw 버튼 및 관련 `resetSampleData` 로직 제거.
- **마감일 D-day 배지 (테이블)**: 마감일 7일 이내 시 테이블 카드·행에 `D-N` 배지 표시.
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

# 비밀번호 재설정 redirect URL 및 OG canonical URL 명시적 지정 (선택)
# 예: http://localhost:3000 (미설정 시 window.location.origin 자동 사용)
NEXT_PUBLIC_SITE_URL=

# 관리자 답장·설정 화면에 표시할 서비스 이메일(선택)
NEXT_PUBLIC_SUPPORT_EMAIL=
```

`service_role` key와 `TOSS_SECRET_KEY`는 서버 API route에서만 사용합니다. `NEXT_PUBLIC_` prefix가 붙은 값만 브라우저에 노출됩니다.

## Supabase 설정

### 이메일/비밀번호 Auth 설정

Supabase 대시보드 → Authentication → Providers → **Email**에서 아래를 확인합니다.

```txt
Email provider enabled: true
Email + Password signups enabled: true
```

MVP 내부 테스트 단계에서는 이메일 발송 제한을 피하려면 Confirm Email을 끄고 시작할 수 있습니다. 공개 운영 전에는 자체 도메인과 Custom SMTP를 붙인 뒤 Confirm Email을 다시 켜는 것을 권장합니다.

### Password Recovery Redirect URL 설정

Supabase 대시보드 → Authentication → URL Configuration → **Redirect URLs**에 아래 URL을 추가합니다.

```
http://localhost:3000/auth/callback
https://your-production-domain/auth/callback
```

로컬 개발 시 `NEXT_PUBLIC_SITE_URL=http://localhost:3000`을 `.env.local`에 추가합니다. Supabase의 **Site URL**은 로컬 테스트 중이면 `http://localhost:3000`이어도 정상입니다. 배포 도메인에서 비밀번호 재설정 메일을 보낼 때는 Site URL을 실제 프로덕션 도메인으로 바꾸고, Redirect URLs에 `https://your-production-domain/auth/callback`을 추가합니다.

`email rate limit exceeded`는 URL 설정 오류가 아니라 Supabase Auth 이메일/OTP 발송 한도입니다. Supabase Dashboard → Authentication → **Rate Limits**에서 OTP/email sent 한도를 확인합니다. Supabase 기본 이메일 발송자는 제한이 낮을 수 있으므로, 프로덕션에서는 Authentication → **SMTP Settings**에서 Custom SMTP를 연결하는 것을 권장합니다.

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
