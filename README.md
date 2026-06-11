# Career Company Tracker

좋은 회사를 단순 규모가 아니라 커리어 성장 가능성, 조직 안정성, 제품 품질, 구성원 후기, 포지션 적합도, 디자인 조직 성숙도 기준으로 평가하고 추적하는 개인용 웹앱입니다.

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
- localStorage 저장

## 주요 기능

- 회사 등록/수정
- 상태 관리: 관심, 지원 예정, 지원 완료, 면접 중, 탈락, 오퍼, 보류
- 5개 평가 카테고리와 21개 세부 항목 1~5점 평가
- 가중치 기반 총점 계산
- 점수 라벨: 적극 지원, 지원 고려, 정보 추가 필요, 보류
- 리서치 로그 기록
- 면접 메모 기록
- 경고 신호 체크리스트와 리스크 높음 뱃지
- 상태별 필터, 점수순/최근 수정순 정렬
- 샘플 회사 데이터 5개 포함

## 데이터 구조

- `src/lib/types.ts`: 회사, 점수, 리서치 로그, 설정 타입
- `src/lib/criteria.ts`: 평가 항목, 기본 가중치, 상태/규모 라벨
- `src/lib/scoring.ts`: 평균 점수, 가중치 총점, 라벨 계산
- `src/lib/sample-data.ts`: 샘플 회사 5개
- `src/lib/storage.ts`: localStorage repository

## Supabase 확장 포인트

`src/lib/storage.ts`의 `CompanyRepository` 인터페이스를 유지한 채 Supabase 구현체를 추가하면 UI 변경 없이 저장소를 교체할 수 있습니다.

예상 테이블:

- `companies`
- `company_scores`
- `research_logs`
- `risk_flags`
- `interview_notes`
- `criteria_settings`

## Do / Don't

Do:

- 회사 규모보다 역할, 성장 문제, 조직 신호를 우선 기록합니다.
- 외부 후기와 면접 신호를 분리해서 기록합니다.
- 경고 신호가 많아도 총점과 별도로 판단합니다.

Don't:

- 출처 없는 투자/매출 수치를 확정값처럼 기록하지 않습니다.
- 면접에서 확인하지 못한 내용을 사실처럼 단정하지 않습니다.
- 점수만 보고 지원 여부를 결정하지 않습니다.
