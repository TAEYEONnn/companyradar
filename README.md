# Career Company Tracker

좋은 회사를 단순 규모가 아니라 커리어 성장 가능성, 조직 안정성, 제품 품질, 구성원 후기, 포지션 적합도, 디자인 조직 성숙도 기준으로 평가하고 추적하는 개인용 웹앱입니다.

## Security Precondition

v0.3.1부터 사용자 데이터는 Supabase Auth session + RLS 정책으로만 접근합니다.

- 노출된 `service_role` key는 RLS를 우회할 수 있으므로 폐기해야 합니다.
- 프로젝트 재생성 또는 JWT/API key rotation이 어렵다면, 현재 프로젝트에는 민감한 면접 메모, 연봉/처우, 사람 이름, 내부 정보를 저장하지 마세요.
- `service_role` key는 클라이언트 코드, 서버 API route, Vercel 환경변수, README 예시에 절대 넣지 않습니다.
- 앱에는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`만 사용합니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 기술 스택

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui 스타일의 로컬 UI 컴포넌트
- Supabase Auth + RLS
- localStorage 보조 저장

## 주요 기능

- Magic Link 로그인
- 사용자별 Supabase row 소유권
- 회사 등록/수정
- 상태 관리: 관심, 지원 예정, 지원 완료, 면접 중, 탈락, 오퍼, 보류
- 회사 평가 점수(`companyFitScore`)와 실제 지원 우선순위(`applicationPriority`) 분리
- 근거 신뢰도(`evidenceLevel`)와 `검증 필요` 표시
- 5개 평가 카테고리와 21개 세부 항목 1~5점 평가
- 가중치 기반 총점 계산
- 점수 라벨: 적극 지원, 지원 고려, 정보 추가 필요, 보류
- Green flag / Red flag / Unknown 구조화 신호 기록
- 디자이너 적합도 체크리스트
- 지원 준비 체크리스트
- 면접 라운드, 면접 메모, 다음 할일 관리
- 공고 상태, 마감일, 최근 확인일 관리
- 경고 신호 체크리스트와 리스크 높음 뱃지
- 마감 임박, 회신 대기, 팔로업 필요, 정보 부족 후보 섹션
- 상태별 필터, 점수순/지원 우선순위순/마감 임박순/최근 수정순 정렬
- 실제 회사 기반 sample seed 15개 포함

## 데이터 구조

- `src/lib/types.ts`: 회사, 점수, 리서치 로그, 설정 타입
- `src/lib/criteria.ts`: 평가 항목, 기본 가중치, 상태/규모 라벨
- `src/lib/scoring.ts`: 평균 점수, 가중치 총점, 라벨 계산
- `src/lib/sample-data.ts`: 실제 회사 기반 sample seed 15개
- `src/lib/storage.ts`: localStorage repository

## Supabase 확장 포인트

`src/lib/storage.ts`의 `CompanyRepository` 인터페이스를 유지한 채 저장소를 교체할 수 있습니다. v0.3.1에서는 localStorage를 보조 저장소로 유지하고, Supabase Auth session이 있는 경우 사용자별 row에 동기화합니다.

예상 테이블:

- `companies`
- `company_scores`
- `research_logs`
- `risk_flags`
- `interview_notes`
- `interview_rounds`
- `follow_up_tasks`
- `research_signals`
- `criteria_settings`

## Do / Don't

Do:

- 회사 규모보다 역할, 성장 문제, 조직 신호를 우선 기록합니다.
- 회사 평가 점수와 지금 지원할 우선순위를 분리해서 판단합니다.
- 외부 후기와 면접 신호를 greenFlags, redFlags, unknowns로 나눠 기록합니다.
- 경고 신호가 많아도 총점과 별도로 판단합니다.

Don't:

- 출처 없는 투자/매출 수치를 확정값처럼 기록하지 않습니다.
- sample seed 데이터를 최신 채용공고로 간주하지 않습니다.
- 면접에서 확인하지 못한 내용을 사실처럼 단정하지 않습니다.
- 점수만 보고 지원 여부를 결정하지 않습니다.

---

## v0.2 업데이트

### 새 기능
- **항목 삭제**: 신호 / 면접 라운드 / 할일 / 면접 메모 개별 삭제
- **리서치 로그**: 출처·링크·긍/부정 신호·확인 질문 기록 (Detail Panel)
- **면접 라운드 개선**: 라운드 유형 선택, 결과(예정/통과/탈락 등) 인라인 변경
- **칸반 보드**: 테이블 ↔ 칸반 토글, 드래그앤드롭으로 상태 이동
- **지원 통계**: 퍼널 전환율, 상태별 분포, 점수 분포 차트
- **JSON 백업/복원**: 툴바에서 내보내기/가져오기 (id 기준 최신본 병합)
- **삭제 확인 다이얼로그**: 실수 방지
- **키보드 단축키**: `N` 회사 추가, `/` 검색, `S` 통계, `ESC` 돌아가기
- **반응형 개선**: 모바일/태블릿 레이아웃 대응

### 선택 기능 (환경변수 필요)

**1. Supabase 동기화** — 기기 간 데이터 공유
```
# .env.local 또는 Vercel 환경변수
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
- 기존 프로젝트는 `supabase/migrations/20260612_v031_auth_rls.sql` 실행
- 새 프로젝트는 `supabase/schema.sql` 실행
- 설정 시 Magic Link 로그인 후 헤더에 "Supabase 동기화" 뱃지 표시
- localStorage는 사용자별 보조 저장소, Supabase는 Auth/RLS 기반 원격 저장소

**2. 공고 URL AI 자동 채우기**
```
OPENAI_API_KEY=sk-...
# 선택
OPENAI_MODEL=gpt-4o-mini
```
- 회사 추가 폼에서 채용공고 URL 입력 → "자동 채우기" 버튼
- 회사명/산업군/제품 설명/마감일을 OpenAI API가 추출
- 로그인이 필요하거나 JS 렌더링되는 공고 페이지는 실패할 수 있음

### 구조 변경
```
src/components/company/
  CompanyTrackerApp.tsx   # 오케스트레이터 (1,775줄 → 477줄)
  CompanyTable.tsx        # 테이블 뷰
  KanbanBoard.tsx         # 칸반 뷰
  CompanyDetailPanel.tsx  # 상세 패널
  CompanyForm.tsx         # 추가/수정 폼
  CriteriaSettingsPanel.tsx
  DashboardSection.tsx
  StatsPanel.tsx          # 통계
  Toolbar.tsx             # 검색/필터/백업/뷰 토글
  shared.tsx              # Metric, InfoRow, 공통 헬퍼
src/lib/
  backup.ts               # JSON 내보내기/가져오기
  company-factory.ts      # 빈 회사 객체 생성
  remote-sync.ts          # Supabase Auth/RLS 동기화
  supabase-client.ts      # Supabase client/session 유틸
  use-keyboard-shortcuts.ts
src/app/api/parse-job/route.ts  # AI 공고 파싱
supabase/schema.sql
supabase/migrations/20260612_v031_auth_rls.sql
```

---

## v0.3.1 Auth/RLS Hardening

### Supabase 설정

1. Supabase SQL Editor에서 기존 프로젝트는 migration을 실행합니다.

```sql
-- 파일 내용 실행
supabase/migrations/20260612_v031_auth_rls.sql
```

새 프로젝트는 `supabase/schema.sql`을 실행합니다.

2. Vercel 환경변수를 설정합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

3. Supabase Dashboard > Authentication > URL Configuration을 설정합니다.

- Site URL: `https://company-career-tracker.vercel.app`
- Redirect URLs:
  - `http://localhost:3000/**`
  - `https://company-career-tracker.vercel.app/**`
  - Vercel preview URL 패턴, 예: `https://company-career-tracker-*.vercel.app/**`

### Seed ownership

- 기존 원격 sample rows는 migration에서 삭제합니다.
- 로그인한 사용자의 `companies` row가 없고 localStorage에도 사용자 데이터가 없을 때만 sample seed를 사용자 소유 row로 생성합니다.
- 여러 사용자가 같은 sample company id를 가질 수 있도록 DB primary key는 `(user_id, id)`입니다.

### RLS REST 검증

아래 예시는 `service_role` key를 사용하지 않습니다.

```bash
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_ANON_KEY="eyJ..."
export ACCESS_TOKEN="로그인한 사용자의 Supabase access token"
export USER_ID="로그인한 사용자의 uuid"
```

Anon key만으로 select가 차단되는지 확인합니다.

```bash
curl -i "$SUPABASE_URL/rest/v1/companies?select=id" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

기대 결과: `200`이어도 `[]`만 반환되거나 RLS로 사용자 row가 노출되지 않아야 합니다.

로그인 access token으로 자기 row insert/select가 되는지 확인합니다.

```bash
curl -i "$SUPABASE_URL/rest/v1/companies" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "[{\"user_id\":\"$USER_ID\",\"id\":\"rls_test_company\",\"data\":{\"id\":\"rls_test_company\",\"name\":\"RLS Test\"},\"updated_at\":\"2026-06-12T00:00:00Z\"}]"

curl -i "$SUPABASE_URL/rest/v1/companies?select=id,user_id&id=eq.rls_test_company" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

다른 `user_id`로 insert/update가 차단되는지 확인합니다.

```bash
curl -i "$SUPABASE_URL/rest/v1/companies" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "[{\"user_id\":\"00000000-0000-0000-0000-000000000000\",\"id\":\"rls_forbidden\",\"data\":{\"id\":\"rls_forbidden\"}}]"
```

기대 결과: RLS `with check` 위반으로 실패합니다.

검증 후 테스트 row를 삭제합니다.

```bash
curl -i -X DELETE "$SUPABASE_URL/rest/v1/companies?id=eq.rls_test_company" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
