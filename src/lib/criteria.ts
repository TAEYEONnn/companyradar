import type {
  ApplicationPriority,
  ApplicationStatus,
  CompanySize,
  CriteriaSettings,
  DiscoveryReason,
  EvidenceLevel,
  JobStatus,
  ScoreCategoryDefinition,
} from "@/lib/types";

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  interested: "관심",
  planned: "지원 예정",
  applied: "지원 완료",
  interviewing: "면접 중",
  rejected: "탈락",
  offer: "오퍼",
  on_hold: "보류",
};

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(
  ([value, label]) => ({
    value: value as ApplicationStatus,
    label,
  }),
);

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  seed: "초기 스타트업",
  startup: "스타트업",
  scaleup: "스케일업",
  mid_market: "중견/성장 기업",
  enterprise: "대기업/엔터프라이즈",
  unknown: "확인 필요",
};

export const COMPANY_SIZE_OPTIONS = Object.entries(COMPANY_SIZE_LABELS).map(
  ([value, label]) => ({
    value: value as CompanySize,
    label,
  }),
);

export const PRIORITY_LABELS: Record<ApplicationPriority, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음",
  watch: "관찰",
};

export const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(
  ([value, label]) => ({
    value: value as ApplicationPriority,
    label,
  }),
);

export const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
  1: "추측",
  2: "채용공고 기반",
  3: "회사/기사/후기 기반",
  4: "면접에서 확인",
  5: "재직자/퇴사자 직접 확인",
};

export const EVIDENCE_LEVEL_OPTIONS = Object.entries(EVIDENCE_LEVEL_LABELS).map(
  ([value, label]) => ({
    value: Number(value) as EvidenceLevel,
    label,
  }),
);

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: "진행 중",
  closed: "마감",
  unknown: "확인 필요",
};

export const JOB_STATUS_OPTIONS = Object.entries(JOB_STATUS_LABELS).map(
  ([value, label]) => ({
    value: value as JobStatus,
    label,
  }),
);

export const DISCOVERY_REASON_LABELS: Record<DiscoveryReason, string> = {
  "design-system": "디자인 시스템",
  "product-growth": "제품 성장",
  "good-review": "좋은 후기",
  "interesting-domain": "흥미로운 도메인",
  salary: "보상",
  remote: "원격/유연근무",
  referral: "추천/소개",
  manual: "수동 추가",
};

export const DISCOVERY_REASON_OPTIONS = Object.entries(
  DISCOVERY_REASON_LABELS,
).map(([value, label]) => ({
  value: value as DiscoveryReason,
  label,
}));

export const DESIGNER_FIT_LABELS = {
  hasDesignSystemOpportunity: "디자인 시스템 개선 기회",
  hasDesignOpsOpportunity: "디자인 운영/프로세스 개선 기회",
  hasComponentOwnership: "컴포넌트 오너십",
  hasDocumentationCulture: "문서화 문화",
  canImproveProcess: "협업 프로세스 개선 가능",
  isOnlyVisualProductionRole: "단순 시각 제작 역할",
} as const;

export const SCORE_CATEGORIES: ScoreCategoryDefinition[] = [
  {
    key: "businessProduct",
    title: "사업/제품",
    shortTitle: "사업",
    weight: 0.2,
    items: [
      { id: "solvesProblem", label: "제품이 실제 문제를 해결하는가" },
      { id: "sustainable", label: "서비스가 지속 가능해 보이는가" },
      { id: "marketStability", label: "시장이 너무 작거나 불안정하지 않은가" },
      { id: "productQuality", label: "제품 퀄리티가 괜찮은가" },
    ],
  },
  {
    key: "organizationCulture",
    title: "조직/문화",
    shortTitle: "조직",
    weight: 0.25,
    items: [
      { id: "reviewQuality", label: "후기가 전반적으로 괜찮은가" },
      { id: "burnoutRisk", label: "야근/소진 리스크가 낮아 보이는가" },
      { id: "decisionClarity", label: "의사결정 구조가 지나치게 혼란스럽지 않은가" },
      { id: "retention", label: "사람이 자주 나가는 회사는 아닌가" },
    ],
  },
  {
    key: "designGrowth",
    title: "디자인 성장 가능성",
    shortTitle: "디자인",
    weight: 0.3,
    items: [
      { id: "strategicRole", label: "디자이너 역할이 단순 제작이 아닌가" },
      { id: "systemOpportunity", label: "디자인 시스템, UX 개선, 프로덕트 개선 여지가 있는가" },
      { id: "collaboration", label: "기획/개발과 협업할 구조가 있는가" },
      { id: "portfolioProblem", label: "포트폴리오에 남길 수 있는 문제가 있는가" },
    ],
  },
  {
    key: "compensationWork",
    title: "보상/근무 조건",
    shortTitle: "조건",
    weight: 0.15,
    items: [
      { id: "salaryRange", label: "연봉 범위" },
      { id: "workModel", label: "근무 형태" },
      { id: "commute", label: "출퇴근 거리" },
      { id: "benefits", label: "복지" },
      { id: "contractStability", label: "계약 안정성" },
    ],
  },
  {
    key: "personalFit",
    title: "나와의 적합도",
    shortTitle: "적합도",
    weight: 0.1,
    items: [
      { id: "currentSkillFit", label: "내 현재 역량과 맞는가" },
      { id: "learningDirection", label: "내가 배우고 싶은 방향과 맞는가" },
      { id: "interviewSignal", label: "면접에서 받은 인상이 좋았는가" },
      { id: "growthCurve", label: "장기적으로 성장 곡선이 있는가" },
    ],
  },
];

export const RISK_CHECKLIST = [
  "채용공고가 지나치게 모호함",
  "역할 범위가 과도하게 넓음",
  "디자인을 단순 시각 제작으로만 봄",
  "면접에서 퇴사율/야근/업무 범위 답변이 모호함",
  "리뷰에서 리더십 문제가 반복됨",
  "계약 조건이 불명확함",
  "온보딩 체계가 없어 보임",
];

export const DEFAULT_CRITERIA_SETTINGS: CriteriaSettings = {
  weights: {
    businessProduct: 0.2,
    organizationCulture: 0.25,
    designGrowth: 0.3,
    compensationWork: 0.15,
    personalFit: 0.1,
  },
  highRiskThreshold: 3,
};
