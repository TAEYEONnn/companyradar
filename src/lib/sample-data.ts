import { SCORE_CATEGORIES } from "@/lib/criteria";
import type { Company, ScoreValues } from "@/lib/types";

function makeScores(seed: Record<string, Record<string, number>>): ScoreValues {
  return SCORE_CATEGORIES.reduce((scores, category) => {
    scores[category.key] = category.items.reduce(
      (items, item) => {
        items[item.id] = seed[category.key]?.[item.id] ?? 3;
        return items;
      },
      {} as Record<string, number>,
    );
    return scores;
  }, {} as ScoreValues);
}

export const SAMPLE_COMPANIES: Company[] = [
  {
    id: "company_lattice",
    name: "Lattice Works",
    homepageUrl: "https://example.com/lattice",
    jobPostUrl: "https://example.com/lattice/jobs/product-designer",
    industry: "B2B SaaS / HR Tech",
    size: "scaleup",
    growthInfo: "Series B 이후 엔터프라이즈 고객 확대. ARR 성장률은 추가 확인 필요.",
    productDescription:
      "인사 평가, 피드백, 목표 관리를 연결하는 협업형 HR 플랫폼.",
    interestLevel: 5,
    status: "planned",
    memo: "프로덕트 조직과 디자인 시스템 개선 여지가 커 보임. 팀 구조 확인 필요.",
    scores: makeScores({
      businessProduct: {
        solvesProblem: 5,
        sustainable: 4,
        marketStability: 4,
        productQuality: 4,
      },
      organizationCulture: {
        reviewQuality: 4,
        burnoutRisk: 3,
        decisionClarity: 4,
        retention: 4,
      },
      designGrowth: {
        strategicRole: 5,
        systemOpportunity: 5,
        collaboration: 4,
        portfolioProblem: 5,
      },
      compensationWork: {
        salaryRange: 4,
        workModel: 4,
        commute: 3,
        benefits: 4,
        contractStability: 4,
      },
      personalFit: {
        currentSkillFit: 4,
        learningDirection: 5,
        interviewSignal: 3,
        growthCurve: 5,
      },
    }),
    researchLogs: [
      {
        id: "research_lattice_1",
        source: "채용공고",
        link: "https://example.com/lattice/jobs/product-designer",
        positiveSignals: "문제 정의, 실험, 디자인 시스템 기여가 명시됨.",
        negativeSignals: "빠른 실행 속도를 반복 강조함.",
        questions: "디자이너 1인당 담당 스쿼드 수와 PM 협업 방식 확인.",
        createdAt: "2026-06-01",
      },
    ],
    riskFlags: ["면접에서 퇴사율/야근/업무 범위 답변이 모호함"],
    interviewNotes: [],
    createdAt: "2026-06-01T09:00:00.000Z",
    updatedAt: "2026-06-08T10:30:00.000Z",
  },
  {
    id: "company_mono",
    name: "Mono Bank",
    homepageUrl: "https://example.com/mono",
    jobPostUrl: "https://example.com/mono/careers",
    industry: "Fintech",
    size: "mid_market",
    growthInfo: "흑자 전환 공시. 신규 B2C 금융 상품 출시 예정.",
    productDescription:
      "개인 자산 관리와 소액 투자 경험을 통합한 모바일 금융 서비스.",
    interestLevel: 4,
    status: "interviewing",
    memo: "제품 완성도는 높지만 의사결정 속도와 규제 제약을 확인해야 함.",
    scores: makeScores({
      businessProduct: {
        solvesProblem: 4,
        sustainable: 5,
        marketStability: 4,
        productQuality: 5,
      },
      organizationCulture: {
        reviewQuality: 3,
        burnoutRisk: 3,
        decisionClarity: 3,
        retention: 4,
      },
      designGrowth: {
        strategicRole: 4,
        systemOpportunity: 4,
        collaboration: 4,
        portfolioProblem: 4,
      },
      compensationWork: {
        salaryRange: 5,
        workModel: 3,
        commute: 4,
        benefits: 5,
        contractStability: 5,
      },
      personalFit: {
        currentSkillFit: 4,
        learningDirection: 4,
        interviewSignal: 4,
        growthCurve: 4,
      },
    }),
    researchLogs: [
      {
        id: "research_mono_1",
        source: "제품 사용",
        link: "https://example.com/mono",
        positiveSignals: "정보 구조와 온보딩 품질이 안정적임.",
        negativeSignals: "금융 규제로 실험 속도는 느릴 수 있음.",
        questions: "디자이너가 데이터 분석 도구에 접근 가능한지 확인.",
        createdAt: "2026-05-27",
      },
    ],
    riskFlags: [],
    interviewNotes: [
      {
        id: "note_mono_1",
        title: "1차 면접",
        content: "PM과 제품 문제를 함께 정의하는 구조라고 설명함.",
        createdAt: "2026-06-07",
      },
    ],
    createdAt: "2026-05-27T12:00:00.000Z",
    updatedAt: "2026-06-10T18:20:00.000Z",
  },
  {
    id: "company_leaf",
    name: "Leaf Commerce",
    homepageUrl: "https://example.com/leaf",
    jobPostUrl: "https://example.com/leaf/jobs",
    industry: "Commerce / Retail Tech",
    size: "startup",
    growthInfo: "월 거래액 증가세. 투자 단계와 현금흐름은 확인 필요.",
    productDescription:
      "중소 브랜드의 재고, 상세페이지, 캠페인 운영을 돕는 커머스 운영 도구.",
    interestLevel: 3,
    status: "interested",
    memo: "작은 팀이지만 디자이너가 핵심 플로우를 넓게 만질 가능성이 있음.",
    scores: makeScores({
      businessProduct: {
        solvesProblem: 4,
        sustainable: 3,
        marketStability: 3,
        productQuality: 3,
      },
      organizationCulture: {
        reviewQuality: 3,
        burnoutRisk: 3,
        decisionClarity: 3,
        retention: 3,
      },
      designGrowth: {
        strategicRole: 4,
        systemOpportunity: 5,
        collaboration: 3,
        portfolioProblem: 5,
      },
      compensationWork: {
        salaryRange: 3,
        workModel: 4,
        commute: 4,
        benefits: 3,
        contractStability: 3,
      },
      personalFit: {
        currentSkillFit: 5,
        learningDirection: 4,
        interviewSignal: 3,
        growthCurve: 4,
      },
    }),
    researchLogs: [],
    riskFlags: ["채용공고가 지나치게 모호함", "역할 범위가 과도하게 넓음"],
    interviewNotes: [],
    createdAt: "2026-06-03T08:30:00.000Z",
    updatedAt: "2026-06-04T14:10:00.000Z",
  },
  {
    id: "company_signal",
    name: "Signal Care",
    homepageUrl: "https://example.com/signal",
    jobPostUrl: "https://example.com/signal/product-design",
    industry: "Healthcare",
    size: "seed",
    growthInfo: "PoC 고객 다수. 유료 전환율과 규제 리스크 확인 필요.",
    productDescription:
      "만성질환 환자와 의료진 사이의 상태 추적을 돕는 케어 관리 SaaS.",
    interestLevel: 4,
    status: "applied",
    memo: "문제 자체는 강하지만 초기 팀 리스크를 면접에서 확인해야 함.",
    scores: makeScores({
      businessProduct: {
        solvesProblem: 5,
        sustainable: 3,
        marketStability: 3,
        productQuality: 3,
      },
      organizationCulture: {
        reviewQuality: 2,
        burnoutRisk: 2,
        decisionClarity: 3,
        retention: 3,
      },
      designGrowth: {
        strategicRole: 4,
        systemOpportunity: 4,
        collaboration: 3,
        portfolioProblem: 5,
      },
      compensationWork: {
        salaryRange: 3,
        workModel: 3,
        commute: 2,
        benefits: 2,
        contractStability: 2,
      },
      personalFit: {
        currentSkillFit: 4,
        learningDirection: 5,
        interviewSignal: 3,
        growthCurve: 4,
      },
    }),
    researchLogs: [
      {
        id: "research_signal_1",
        source: "뉴스/블로그",
        link: "https://example.com/signal/blog",
        positiveSignals: "도메인 문제 정의가 명확하고 고객 인터뷰 사례가 있음.",
        negativeSignals: "상용 고객 규모가 아직 작음.",
        questions: "의료 데이터 보안과 제품 책임 범위 확인.",
        createdAt: "2026-06-02",
      },
    ],
    riskFlags: [
      "계약 조건이 불명확함",
      "온보딩 체계가 없어 보임",
      "리뷰에서 리더십 문제가 반복됨",
    ],
    interviewNotes: [],
    createdAt: "2026-06-02T09:10:00.000Z",
    updatedAt: "2026-06-09T11:40:00.000Z",
  },
  {
    id: "company_arcade",
    name: "Arcade Studio",
    homepageUrl: "https://example.com/arcade",
    jobPostUrl: "https://example.com/arcade/careers/designer",
    industry: "Consumer App / Entertainment",
    size: "startup",
    growthInfo: "DAU는 빠르게 증가. 수익 모델은 광고와 구독 테스트 중.",
    productDescription:
      "짧은 인터랙티브 콘텐츠를 만들고 공유하는 크리에이터 앱.",
    interestLevel: 2,
    status: "on_hold",
    memo: "재미있는 제품이지만 디자인 역할이 비주얼 제작에 치우칠 수 있음.",
    scores: makeScores({
      businessProduct: {
        solvesProblem: 3,
        sustainable: 2,
        marketStability: 2,
        productQuality: 4,
      },
      organizationCulture: {
        reviewQuality: 2,
        burnoutRisk: 2,
        decisionClarity: 2,
        retention: 2,
      },
      designGrowth: {
        strategicRole: 2,
        systemOpportunity: 3,
        collaboration: 3,
        portfolioProblem: 3,
      },
      compensationWork: {
        salaryRange: 3,
        workModel: 3,
        commute: 3,
        benefits: 2,
        contractStability: 2,
      },
      personalFit: {
        currentSkillFit: 3,
        learningDirection: 2,
        interviewSignal: 2,
        growthCurve: 2,
      },
    }),
    researchLogs: [],
    riskFlags: [
      "디자인을 단순 시각 제작으로만 봄",
      "리뷰에서 리더십 문제가 반복됨",
      "면접에서 퇴사율/야근/업무 범위 답변이 모호함",
    ],
    interviewNotes: [],
    createdAt: "2026-05-22T13:00:00.000Z",
    updatedAt: "2026-06-05T16:00:00.000Z",
  },
];
