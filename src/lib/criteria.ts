import type {
  ApplicationPriority,
  ApplicationStatus,
  CompanySize,
  CriteriaSettings,
  DesignerFitChecklist,
  DiscoveryReason,
  EvidenceLevel,
  JobStatus,
  ScoreCategoryKey,
  ScoreCategoryDefinition,
  ScoreThresholdSettings,
  UserRole,
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
  1: "아직 추측 수준",
  2: "채용공고만 봤어요",
  3: "뉴스·후기 찾아봤어요",
  4: "면접에서 직접 들었어요",
  5: "재직자·퇴사자에게 들었어요",
};

export const EVIDENCE_LEVEL_OPTIONS = Object.entries(EVIDENCE_LEVEL_LABELS).map(
  ([value, label]) => ({
    value: Number(value) as EvidenceLevel,
    label,
  }),
);

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: "공개 중",
  closed: "마감",
  unknown: "미확인",
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
  manual: "직접 추가",
};

export const DISCOVERY_REASON_OPTIONS = Object.entries(
  DISCOVERY_REASON_LABELS,
).map(([value, label]) => ({
  value: value as DiscoveryReason,
  label,
}));

export const INTERVIEW_ROUND_TYPE_LABELS: Record<
  import("@/lib/types").InterviewRoundType,
  string
> = {
  screening: "서류/스크리닝",
  assignment: "과제",
  first: "1차 면접",
  second: "2차 면접",
  culture: "컬처핏",
  offer: "오퍼/처우 협의",
};

export const INTERVIEW_ROUND_TYPE_OPTIONS = Object.entries(
  INTERVIEW_ROUND_TYPE_LABELS,
).map(([value, label]) => ({
  value: value as import("@/lib/types").InterviewRoundType,
  label,
}));

export const ROUND_RESULT_LABELS: Record<
  import("@/lib/types").InterviewRound["result"],
  string
> = {
  scheduled: "예정",
  pending: "결과 대기",
  passed: "통과",
  rejected: "탈락",
  canceled: "취소",
};

export const ROUND_RESULT_OPTIONS = Object.entries(ROUND_RESULT_LABELS).map(
  ([value, label]) => ({
    value: value as import("@/lib/types").InterviewRound["result"],
    label,
  }),
);

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

type RoleScoreText = {
  title: string;
  shortTitle: string;
  items: Record<string, string>;
};

const ROLE_SCORE_TEXT: Record<UserRole, Record<ScoreCategoryKey, RoleScoreText>> = {
  designer: {
    businessProduct: {
      title: "사업/제품",
      shortTitle: "사업",
      items: {
        solvesProblem: "제품이 실제 사용자 문제를 해결하는가",
        sustainable: "서비스가 지속 가능해 보이는가",
        marketStability: "시장이 너무 작거나 불안정하지 않은가",
        productQuality: "제품 완성도와 UX 품질이 괜찮은가",
      },
    },
    organizationCulture: {
      title: "조직/문화",
      shortTitle: "조직",
      items: {
        reviewQuality: "후기와 평판이 전반적으로 괜찮은가",
        burnoutRisk: "야근/번아웃 위험이 낮아 보이는가",
        decisionClarity: "의사결정 구조가 지나치게 혼란스럽지 않은가",
        retention: "사람들이 오래 일할 수 있는 환경인가",
      },
    },
    designGrowth: {
      title: "디자인 성장 가능성",
      shortTitle: "디자인",
      items: {
        strategicRole: "디자이너 역할이 단순 제작에 그치지 않는가",
        systemOpportunity: "디자인 시스템/UX/제품 개선 여지가 있는가",
        collaboration: "기획/개발과 협업 구조가 있는가",
        portfolioProblem: "포트폴리오에 남길 만한 문제가 있는가",
      },
    },
    compensationWork: {
      title: "보상/근무 조건",
      shortTitle: "조건",
      items: {
        salaryRange: "연봉 범위가 기대와 맞는가",
        workModel: "근무 형태가 지속 가능하게 맞는가",
        commute: "출퇴근 거리와 시간이 감당 가능한가",
        benefits: "복지와 장비/지원이 충분한가",
        contractStability: "계약/고용 안정성이 괜찮은가",
      },
    },
    personalFit: {
      title: "나와의 적합도",
      shortTitle: "적합도",
      items: {
        currentSkillFit: "현재 역량과 적절히 맞는가",
        learningDirection: "배우고 싶은 방향과 맞는가",
        interviewSignal: "면접/커뮤니케이션 인상이 좋은가",
        growthCurve: "장기적으로 성장 곡선이 있는가",
      },
    },
  },
  pm: {
    businessProduct: {
      title: "제품/시장 기회",
      shortTitle: "제품",
      items: {
        solvesProblem: "해결하는 문제가 명확하고 중요한가",
        sustainable: "비즈니스 모델이 지속 가능해 보이는가",
        marketStability: "시장 크기와 성장성이 충분한가",
        productQuality: "제품 지표/사용성 개선 여지가 보이는가",
      },
    },
    organizationCulture: {
      title: "조직/의사결정",
      shortTitle: "조직",
      items: {
        reviewQuality: "조직 평판과 협업 문화가 괜찮은가",
        burnoutRisk: "PM에게 과도한 조율 부담이 몰리지 않는가",
        decisionClarity: "권한과 의사결정 구조가 명확한가",
        retention: "핵심 인력이 안정적으로 유지되는가",
      },
    },
    designGrowth: {
      title: "제품 영향력",
      shortTitle: "영향력",
      items: {
        strategicRole: "로드맵/전략에 실질적으로 관여할 수 있는가",
        systemOpportunity: "제품 문제를 구조적으로 개선할 기회가 있는가",
        collaboration: "디자인/개발/데이터 협업 체계가 있는가",
        portfolioProblem: "성과로 설명 가능한 제품 문제가 있는가",
      },
    },
    compensationWork: {
      title: "보상/근무 조건",
      shortTitle: "조건",
      items: {
        salaryRange: "연봉 범위가 기대와 맞는가",
        workModel: "근무 형태가 PM 업무 방식과 맞는가",
        commute: "출퇴근 부담이 지속 가능한가",
        benefits: "복지와 업무 지원이 충분한가",
        contractStability: "고용/계약 안정성이 괜찮은가",
      },
    },
    personalFit: {
      title: "나와의 적합도",
      shortTitle: "적합도",
      items: {
        currentSkillFit: "현재 PM 역량과 역할 난이도가 맞는가",
        learningDirection: "배우고 싶은 제품 역량과 맞는가",
        interviewSignal: "면접에서 커뮤니케이션 신뢰가 있었는가",
        growthCurve: "다음 커리어 단계에 도움이 되는가",
      },
    },
  },
  frontend: {
    businessProduct: {
      title: "제품/기술 맥락",
      shortTitle: "제품",
      items: {
        solvesProblem: "프론트엔드로 기여할 사용자 문제가 명확한가",
        sustainable: "제품과 기술 투자가 지속 가능해 보이는가",
        marketStability: "서비스 성장성과 안정성이 괜찮은가",
        productQuality: "UI 품질과 성능 개선 여지가 있는가",
      },
    },
    organizationCulture: {
      title: "개발 문화",
      shortTitle: "문화",
      items: {
        reviewQuality: "코드 리뷰와 개발 문화 평판이 괜찮은가",
        burnoutRisk: "릴리즈/운영 부담이 과도하지 않은가",
        decisionClarity: "기술 의사결정 구조가 명확한가",
        retention: "개발자가 오래 일할 수 있는 환경인가",
      },
    },
    designGrowth: {
      title: "기술 성장 가능성",
      shortTitle: "기술",
      items: {
        strategicRole: "프론트엔드가 제품 의사결정에 참여하는가",
        systemOpportunity: "디자인 시스템/성능/아키텍처 개선 기회가 있는가",
        collaboration: "디자인/백엔드/PM 협업 구조가 건강한가",
        portfolioProblem: "기술적으로 설명 가능한 성과를 만들 수 있는가",
      },
    },
    compensationWork: {
      title: "보상/근무 조건",
      shortTitle: "조건",
      items: {
        salaryRange: "연봉 범위가 기대와 맞는가",
        workModel: "근무 형태가 집중 개발에 맞는가",
        commute: "출퇴근 부담이 지속 가능한가",
        benefits: "장비/학습/복지 지원이 충분한가",
        contractStability: "고용/계약 안정성이 괜찮은가",
      },
    },
    personalFit: {
      title: "나와의 적합도",
      shortTitle: "적합도",
      items: {
        currentSkillFit: "현재 기술 스택과 역량에 맞는가",
        learningDirection: "배우고 싶은 기술 방향과 맞는가",
        interviewSignal: "면접에서 기술 대화가 건강했는가",
        growthCurve: "장기적으로 기술 성장 곡선이 있는가",
      },
    },
  },
  ux_researcher: {
    businessProduct: {
      title: "제품/사용자 문제",
      shortTitle: "문제",
      items: {
        solvesProblem: "리서치할 만한 사용자 문제가 명확한가",
        sustainable: "사용자 이해에 투자할 사업 여력이 있는가",
        marketStability: "시장과 사용자군이 충분히 의미 있는가",
        productQuality: "리서치가 제품 품질 개선으로 이어질 수 있는가",
      },
    },
    organizationCulture: {
      title: "리서치 수용 문화",
      shortTitle: "문화",
      items: {
        reviewQuality: "사용자 중심 문화에 대한 평판이 괜찮은가",
        burnoutRisk: "리서처에게 과도한 일정/정치 부담이 없을 것 같은가",
        decisionClarity: "리서치 결과가 의사결정에 반영되는 구조인가",
        retention: "리서치/제품 인력이 안정적으로 유지되는가",
      },
    },
    designGrowth: {
      title: "리서치 환경",
      shortTitle: "리서치",
      items: {
        strategicRole: "리서치가 전략/로드맵에 영향을 줄 수 있는가",
        systemOpportunity: "정성/정량 리서치 체계를 만들 기회가 있는가",
        collaboration: "PM/디자인/데이터와 협업 구조가 있는가",
        portfolioProblem: "케이스 스터디로 남길 사용자 문제가 있는가",
      },
    },
    compensationWork: {
      title: "보상/근무 조건",
      shortTitle: "조건",
      items: {
        salaryRange: "연봉 범위가 기대와 맞는가",
        workModel: "인터뷰/분석 업무에 맞는 근무 형태인가",
        commute: "출퇴근 부담이 지속 가능한가",
        benefits: "리서치 툴/참여자 모집 지원이 충분한가",
        contractStability: "고용/계약 안정성이 괜찮은가",
      },
    },
    personalFit: {
      title: "나와의 적합도",
      shortTitle: "적합도",
      items: {
        currentSkillFit: "현재 리서치 역량과 역할이 맞는가",
        learningDirection: "배우고 싶은 리서치 방향과 맞는가",
        interviewSignal: "면접에서 리서치에 대한 이해가 느껴졌는가",
        growthCurve: "장기적으로 전문성을 확장할 수 있는가",
      },
    },
  },
  marketer: {
    businessProduct: {
      title: "시장/성장 기회",
      shortTitle: "시장",
      items: {
        solvesProblem: "고객 문제와 구매 동기가 명확한가",
        sustainable: "성장 채널과 수익 모델이 지속 가능해 보이는가",
        marketStability: "시장 규모와 경쟁 구도가 매력적인가",
        productQuality: "마케팅이 전환시킬 만한 제품 품질인가",
      },
    },
    organizationCulture: {
      title: "마케팅 협업 문화",
      shortTitle: "문화",
      items: {
        reviewQuality: "브랜드/마케팅 조직 평판이 괜찮은가",
        burnoutRisk: "성과 압박과 실행량이 과도하지 않은가",
        decisionClarity: "목표/예산/권한이 명확한가",
        retention: "마케팅/세일즈 인력이 안정적으로 유지되는가",
      },
    },
    designGrowth: {
      title: "마케팅 임팩트",
      shortTitle: "임팩트",
      items: {
        strategicRole: "마케팅이 성장 전략에 실질적으로 관여하는가",
        systemOpportunity: "퍼널/콘텐츠/브랜드를 개선할 기회가 있는가",
        collaboration: "제품/세일즈/데이터 협업 구조가 있는가",
        portfolioProblem: "성과로 설명 가능한 캠페인 문제가 있는가",
      },
    },
    compensationWork: {
      title: "보상/근무 조건",
      shortTitle: "조건",
      items: {
        salaryRange: "연봉 범위가 기대와 맞는가",
        workModel: "캠페인/콘텐츠 업무 방식과 맞는 근무 형태인가",
        commute: "출퇴근 부담이 지속 가능한가",
        benefits: "예산/툴/교육 지원이 충분한가",
        contractStability: "고용/계약 안정성이 괜찮은가",
      },
    },
    personalFit: {
      title: "나와의 적합도",
      shortTitle: "적합도",
      items: {
        currentSkillFit: "현재 마케팅 역량과 역할 난이도가 맞는가",
        learningDirection: "배우고 싶은 성장/브랜드 방향과 맞는가",
        interviewSignal: "면접에서 목표와 협업 방식이 명확했는가",
        growthCurve: "장기적으로 마케팅 커리어에 도움이 되는가",
      },
    },
  },
  other: {
    businessProduct: {
      title: "사업/제품",
      shortTitle: "사업",
      items: {
        solvesProblem: "해결하는 문제가 명확하고 중요한가",
        sustainable: "비즈니스 모델이 지속 가능해 보이는가",
        marketStability: "시장 크기와 성장성이 충분한가",
        productQuality: "제품/서비스 품질과 방향이 괜찮은가",
      },
    },
    organizationCulture: {
      title: "조직/문화",
      shortTitle: "조직",
      items: {
        reviewQuality: "조직 평판과 협업 문화가 괜찮은가",
        burnoutRisk: "업무 과부하 위험이 낮아 보이는가",
        decisionClarity: "의사결정 구조가 명확한가",
        retention: "핵심 인력이 안정적으로 유지되는가",
      },
    },
    designGrowth: {
      title: "성장 가능성",
      shortTitle: "성장",
      items: {
        strategicRole: "역할이 단순 실행에 그치지 않는가",
        systemOpportunity: "구조적으로 개선하고 기여할 기회가 있는가",
        collaboration: "팀 간 협업 구조가 건강한가",
        portfolioProblem: "경력에 남길 만한 문제를 다룰 수 있는가",
      },
    },
    compensationWork: {
      title: "보상/근무 조건",
      shortTitle: "조건",
      items: {
        salaryRange: "연봉 범위가 기대와 맞는가",
        workModel: "근무 형태가 지속 가능하게 맞는가",
        commute: "출퇴근 부담이 감당 가능한가",
        benefits: "복지와 업무 지원이 충분한가",
        contractStability: "고용/계약 안정성이 괜찮은가",
      },
    },
    personalFit: {
      title: "나와의 적합도",
      shortTitle: "적합도",
      items: {
        currentSkillFit: "현재 역량과 역할 난이도가 맞는가",
        learningDirection: "배우고 싶은 방향과 맞는가",
        interviewSignal: "면접에서 커뮤니케이션 신뢰가 있었는가",
        growthCurve: "다음 커리어 단계에 도움이 되는가",
      },
    },
  },
};

export function getRoleScoreCategories(
  userRole: UserRole = "designer",
): ScoreCategoryDefinition[] {
  const roleText = ROLE_SCORE_TEXT[userRole] ?? ROLE_SCORE_TEXT.designer;
  return SCORE_CATEGORIES.map((category) => {
    const text = roleText[category.key];
    return {
      ...category,
      title: text.title,
      shortTitle: text.shortTitle,
      items: category.items.map((item) => ({
        ...item,
        label: text.items[item.id] ?? item.label,
      })),
    };
  });
}

export const RISK_CHECKLIST = [
  "채용공고가 지나치게 모호함",
  "역할 범위가 과도하게 넓음",
  "디자인을 단순 시각 제작으로만 봄",
  "면접에서 퇴사율/야근/업무 범위 답변이 모호함",
  "리뷰에서 리더십 문제가 반복됨",
  "계약 조건이 불명확함",
  "온보딩 체계가 없어 보임",
];

export const ROLE_RISK_CHECKLIST: Record<UserRole, string[]> = {
  designer: [
    "채용공고가 지나치게 모호함",
    "역할 범위가 과도하게 넓음",
    "디자인을 단순 시각 제작으로만 봄",
    "면접에서 퇴사율/야근/업무 범위 답변이 모호함",
    "리뷰에서 리더십 문제가 반복됨",
    "계약 조건이 불명확함",
    "온보딩 체계가 없어 보임",
  ],
  pm: [
    "채용공고가 지나치게 모호함",
    "PM 역할이 기획·운영 잡무로만 구성됨",
    "데이터 접근 권한이 제한적",
    "면접에서 제품 방향성/의사결정 구조 답변이 불명확",
    "리뷰에서 리더십 문제가 반복됨",
    "계약 조건이 불명확함",
    "온보딩 체계가 없어 보임",
  ],
  frontend: [
    "채용공고가 지나치게 모호함",
    "단순 퍼블리싱·유지보수만 다루는 역할",
    "레거시 코드 비중이 과도하게 높음",
    "면접에서 기술스택 방향성 답변이 모호함",
    "리뷰에서 기술 부채 방치 사례 반복",
    "계약 조건이 불명확함",
    "온보딩 체계가 없어 보임",
  ],
  ux_researcher: [
    "채용공고가 지나치게 모호함",
    "리서치 결과 반영 구조가 없음",
    "정량 지표만 중시하는 문화",
    "면접에서 리서치 독립성 보장 답변이 모호함",
    "리뷰에서 리서처 역할이 서포트로만 한정된 사례",
    "계약 조건이 불명확함",
    "온보딩 체계가 없어 보임",
  ],
  marketer: [
    "채용공고가 지나치게 모호함",
    "마케팅이 단순 콘텐츠 실행으로만 구성됨",
    "데이터 분석 환경이 미비함",
    "면접에서 마케팅 예산·자율성 답변이 모호함",
    "리뷰에서 ROI 측정 체계 부재 반복",
    "계약 조건이 불명확함",
    "온보딩 체계가 없어 보임",
  ],
  other: [
    "채용공고가 지나치게 모호함",
    "역할 범위가 과도하게 넓음",
    "단순 반복 업무 위주의 역할",
    "면접에서 업무 범위·성장 경로 답변이 불명확",
    "리뷰에서 리더십 문제가 반복됨",
    "계약 조건이 불명확함",
    "온보딩 체계가 없어 보임",
  ],
};

export const DEFAULT_SCORE_THRESHOLDS: ScoreThresholdSettings = {
  strong: 4.3,
  consider: 3.7,
  needsInfo: 3.0,
};

export const DEFAULT_CRITERIA_SETTINGS: CriteriaSettings = {
  weights: {
    businessProduct: 0.2,
    organizationCulture: 0.25,
    designGrowth: 0.3,
    compensationWork: 0.15,
    personalFit: 0.1,
  },
  highRiskThreshold: 3,
  scoreThresholds: DEFAULT_SCORE_THRESHOLDS,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  designer: "프로덕트 디자이너",
  pm: "PM / PO",
  frontend: "프론트엔드 개발자",
  ux_researcher: "UX 리서처",
  marketer: "프로덕트 마케터",
  other: "운영 / 기타",
};

export const ROLE_WEIGHT_PRESETS: Record<UserRole, CriteriaSettings["weights"]> = {
  designer:      { businessProduct: 0.2,  organizationCulture: 0.25, designGrowth: 0.3,  compensationWork: 0.15, personalFit: 0.1 },
  pm:            { businessProduct: 0.3,  organizationCulture: 0.25, designGrowth: 0.2,  compensationWork: 0.15, personalFit: 0.1 },
  frontend:      { businessProduct: 0.2,  organizationCulture: 0.25, designGrowth: 0.3,  compensationWork: 0.15, personalFit: 0.1 },
  ux_researcher: { businessProduct: 0.15, organizationCulture: 0.3,  designGrowth: 0.3,  compensationWork: 0.15, personalFit: 0.1 },
  marketer:      { businessProduct: 0.25, organizationCulture: 0.25, designGrowth: 0.25, compensationWork: 0.15, personalFit: 0.1 },
  other:         { businessProduct: 0.2,  organizationCulture: 0.25, designGrowth: 0.25, compensationWork: 0.2,  personalFit: 0.1 },
};

export const ROLE_GROWTH_LABEL: Record<UserRole, string> = {
  designer:      "디자인 성장 가능성",
  pm:            "프로덕트 영향력",
  frontend:      "기술 성장 가능성",
  ux_researcher: "리서치 환경",
  marketer:      "마케팅 임팩트",
  other:         "성장 가능성",
};

export const ROLE_FIT_LABELS: Record<UserRole, Record<keyof DesignerFitChecklist, string>> = {
  designer: {
    hasDesignSystemOpportunity: "디자인 시스템 개선 기회",
    hasDesignOpsOpportunity: "디자인 운영/프로세스 개선 기회",
    hasComponentOwnership: "컴포넌트 오너십",
    hasDocumentationCulture: "문서화 문화",
    canImproveProcess: "협업 프로세스 개선 가능",
    isOnlyVisualProductionRole: "단순 시각 제작 역할",
  },
  pm: {
    hasDesignSystemOpportunity: "프로덕트 전략 결정 권한",
    hasDesignOpsOpportunity: "데이터 기반 의사결정 환경",
    hasComponentOwnership: "엔지니어링팀 협업 구조",
    hasDocumentationCulture: "사용자 리서치 도입 가능",
    canImproveProcess: "PM 역할 범위 명확",
    isOnlyVisualProductionRole: "단순 기능 기획 역할 여부",
  },
  frontend: {
    hasDesignSystemOpportunity: "기술 부채 개선 기회",
    hasDesignOpsOpportunity: "코드 리뷰 문화",
    hasComponentOwnership: "컴포넌트 오너십",
    hasDocumentationCulture: "최신 기술스택",
    canImproveProcess: "테스트 문화",
    isOnlyVisualProductionRole: "단순 퍼블리싱 역할 여부",
  },
  ux_researcher: {
    hasDesignSystemOpportunity: "정성/정량 리서치 모두 가능",
    hasDesignOpsOpportunity: "리서치 결과 반영 구조",
    hasComponentOwnership: "사용자 접근성",
    hasDocumentationCulture: "리서치 독립성",
    canImproveProcess: "팀내 리서치 문화",
    isOnlyVisualProductionRole: "단순 서포트 역할 여부",
  },
  marketer: {
    hasDesignSystemOpportunity: "그로스 실험 환경",
    hasDesignOpsOpportunity: "데이터 분석 환경",
    hasComponentOwnership: "콘텐츠 자율성",
    hasDocumentationCulture: "크로스팀 협업",
    canImproveProcess: "마케팅 예산 권한",
    isOnlyVisualProductionRole: "단순 실행 역할 여부",
  },
  other: {
    hasDesignSystemOpportunity: "업무 체계 개선 기회",
    hasDesignOpsOpportunity: "프로세스 자동화/개선 가능성",
    hasComponentOwnership: "역할 자율성",
    hasDocumentationCulture: "문서화 및 협업 문화",
    canImproveProcess: "업무 방식 개선 가능",
    isOnlyVisualProductionRole: "단순 반복 업무 위주 역할 여부",
  },
};

export const ROLE_FIT_CHECKLIST_TITLE: Record<UserRole, string> = {
  designer:      "디자이너 적합도 체크리스트",
  pm:            "PM/PO 적합도 체크리스트",
  frontend:      "개발자 적합도 체크리스트",
  ux_researcher: "UX 리서처 적합도 체크리스트",
  marketer:      "마케터 적합도 체크리스트",
  other:         "커리어 적합도 체크리스트",
};
