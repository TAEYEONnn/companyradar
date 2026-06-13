import { SCORE_CATEGORIES } from "@/lib/criteria";
import type {
  ApplicationPriority,
  Company,
  CompanySize,
  DesignerFitChecklist,
  DiscoveryReason,
  EvidenceLevel,
  ResearchSignal,
  ScoreEvidenceValues,
  ScoreValues,
  UserRole,
} from "@/lib/types";

const VERIFIED_AT = "2026-06-11";
const CREATED_AT = "2026-06-11T09:00:00.000Z";

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

function makeScoreEvidence(level: EvidenceLevel): ScoreEvidenceValues {
  return SCORE_CATEGORIES.reduce((scores, category) => {
    scores[category.key] = category.items.reduce(
      (items, item) => {
        items[item.id] = level;
        return items;
      },
      {} as Record<string, EvidenceLevel>,
    );
    return scores;
  }, {} as ScoreEvidenceValues);
}

function signal(
  id: string,
  label: string,
  description: string,
  sourceUrl: string,
  confidence: EvidenceLevel,
): ResearchSignal {
  return {
    id,
    label,
    description,
    sourceUrl,
    confidence,
    createdAt: VERIFIED_AT,
  };
}

function company(input: {
  id: string;
  name: string;
  homepageUrl: string;
  jobPostUrl: string;
  industry: string;
  size: CompanySize;
  growthInfo: string;
  productDescription: string;
  interestLevel: number;
  applicationPriority: ApplicationPriority;
  priorityReason: string;
  discoveryReason: DiscoveryReason;
  firstImpressionNote: string;
  candidateReason: string;
  designerFit: Partial<DesignerFitChecklist>;
  greenFlags: ResearchSignal[];
  redFlags?: ResearchSignal[];
  unknowns: ResearchSignal[];
  scores: Record<string, Record<string, number>>;
}): Company {
  return {
    id: input.id,
    name: input.name,
    homepageUrl: input.homepageUrl,
    jobPostUrl: input.jobPostUrl,
    sourceUrls: [input.homepageUrl, input.jobPostUrl],
    industry: input.industry,
    size: input.size,
    growthInfo: input.growthInfo,
    productDescription: input.productDescription,
    interestLevel: input.interestLevel,
    status: "interested",
    applicationPriority: input.applicationPriority,
    priorityReason: input.priorityReason,
    evidenceLevel: 3,
    sourceConfidence: 3,
    discoveryReason: input.discoveryReason,
    firstImpressionNote: input.firstImpressionNote,
    candidateReason: input.candidateReason,
    jobDeadline: "",
    jobStatus: "unknown",
    lastCheckedAt: VERIFIED_AT,
    lastVerifiedAt: VERIFIED_AT,
    lastResearchedAt: VERIFIED_AT,
    isSampleData: true,
    needsRefresh: true,
    validationReason: [
      "공고 확인 30일 초과",
      "마감일 미확인",
      "근거 레벨 2 이하",
    ],
    memo: "샘플 seed 데이터입니다. 실제 지원 전 공고 상태, 포지션 요구사항, 후기 신호를 다시 확인하세요.",
    privateSensitiveNote: "",
    scores: makeScores(input.scores),
    scoreEvidence: makeScoreEvidence(2),
    signals: {
      greenFlags: input.greenFlags,
      redFlags: input.redFlags ?? [],
      unknowns: input.unknowns,
    },
    designerFit: {
      hasDesignSystemOpportunity: false,
      hasDesignOpsOpportunity: false,
      hasComponentOwnership: false,
      hasDocumentationCulture: false,
      canImproveProcess: false,
      isOnlyVisualProductionRole: false,
      ...input.designerFit,
    },
    applicationChecklist: {
      resumeReady: false,
      portfolioReady: false,
      coverLetterReady: false,
      referralChecked: false,
      submitted: false,
    },
    interviewRounds: [],
    followUpTasks: [
      {
        id: `${input.id}_refresh_task`,
        title: "채용공고 상태와 디자이너 역할 범위 재확인",
        dueDate: VERIFIED_AT,
        completed: false,
        createdAt: VERIFIED_AT,
      },
    ],
    researchLogs: [],
    riskFlags: [],
    interviewNotes: [],
    prepQuestions: [],
    statusHistory: [],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

const standardScores = {
  businessProduct: {
    solvesProblem: 4,
    sustainable: 4,
    marketStability: 4,
    productQuality: 4,
  },
  organizationCulture: {
    reviewQuality: 3,
    burnoutRisk: 3,
    decisionClarity: 3,
    retention: 3,
  },
  designGrowth: {
    strategicRole: 4,
    systemOpportunity: 4,
    collaboration: 4,
    portfolioProblem: 4,
  },
  compensationWork: {
    salaryRange: 3,
    workModel: 3,
    commute: 3,
    benefits: 3,
    contractStability: 3,
  },
  personalFit: {
    currentSkillFit: 4,
    learningDirection: 4,
    interviewSignal: 3,
    growthCurve: 4,
  },
};

const ALL_SAMPLE_COMPANIES: Company[] = [
  company({
    id: "company_toss",
    name: "토스",
    homepageUrl: "https://toss.im/",
    jobPostUrl: "https://toss.im/career/jobs",
    industry: "Fintech / Consumer Finance",
    size: "enterprise",
    growthInfo: "금융 슈퍼앱과 계열 제품 조직이 커서 제품 실험과 UX 개선 여지가 큼.",
    productDescription: "송금, 결제, 증권, 은행 등 금융 경험을 통합한 제품군.",
    interestLevel: 5,
    applicationPriority: "high",
    priorityReason: "제품 조직 성숙도와 포트폴리오 문제 크기는 높지만, 현재 디자인 포지션 적합도는 확인 필요.",
    discoveryReason: "product-growth",
    firstImpressionNote: "제품 밀도와 실험 속도가 높은 편이라 성장 기회가 커 보임.",
    candidateReason: "금융 UX, 복잡한 IA, 디자인 시스템 문제를 다룰 가능성이 큼.",
    designerFit: {
      hasDesignSystemOpportunity: true,
      hasDesignOpsOpportunity: true,
      hasComponentOwnership: true,
      hasDocumentationCulture: true,
      canImproveProcess: true,
    },
    greenFlags: [
      signal("toss_green_jobs", "채용 페이지 활성", "공식 채용 페이지가 운영 중이며 다양한 제품 직군을 확인할 수 있음.", "https://toss.im/career/jobs", 2),
    ],
    unknowns: [
      signal("toss_unknown_role", "현재 포지션 적합도", "프로덕트 디자이너 공고의 연차/도메인/마감 여부를 재확인해야 함.", "https://toss.im/career/jobs", 2),
    ],
    scores: standardScores,
  }),
  company({
    id: "company_daangn",
    name: "당근",
    homepageUrl: "https://www.daangn.com/",
    jobPostUrl: "https://www.daangn.com/kr/careers/jobs/",
    industry: "Local Community / Marketplace",
    size: "enterprise",
    growthInfo: "지역 커뮤니티와 로컬 비즈니스 제품으로 문제 영역이 넓음.",
    productDescription: "지역 기반 중고거래, 커뮤니티, 로컬 서비스 제품.",
    interestLevel: 5,
    applicationPriority: "medium",
    priorityReason: "도메인과 사용자 문제는 좋지만 현재 디자인 공고 상태와 팀 배치를 확인해야 함.",
    discoveryReason: "interesting-domain",
    firstImpressionNote: "지역 커뮤니티 UX와 신뢰 문제를 다룰 수 있는 후보.",
    candidateReason: "서비스 품질, 커뮤니티 운영, 로컬 비즈니스 전환 문제를 평가하기 좋음.",
    designerFit: {
      hasDesignSystemOpportunity: true,
      hasComponentOwnership: true,
      canImproveProcess: true,
    },
    greenFlags: [
      signal("daangn_green_jobs", "채용 페이지 활성", "공식 채용 페이지에서 포지션을 확인할 수 있음.", "https://www.daangn.com/kr/careers/jobs/", 2),
    ],
    unknowns: [
      signal("daangn_unknown_opening", "디자인 포지션 여부", "현재 프로덕트 디자인 포지션의 오픈 여부와 마감일 확인 필요.", "https://www.daangn.com/kr/careers/jobs/", 2),
    ],
    scores: standardScores,
  }),
  company({
    id: "company_woowa",
    name: "우아한형제들",
    homepageUrl: "https://www.woowahan.com/",
    jobPostUrl: "https://career.woowahan.com/",
    industry: "Food Delivery / Commerce Platform",
    size: "enterprise",
    growthInfo: "배달, 커머스, 사장님 서비스 등 다면 플랫폼 문제를 보유.",
    productDescription: "배달의민족과 관련 커머스/비즈니스 운영 제품군.",
    interestLevel: 4,
    applicationPriority: "medium",
    priorityReason: "제품 문제는 크지만 포지션별 역할 범위와 조직 배치를 확인해야 함.",
    discoveryReason: "product-growth",
    firstImpressionNote: "B2C/B2B가 같이 있어 포트폴리오 문제 폭이 넓어 보임.",
    candidateReason: "복잡한 플랫폼 UX, 운영 도구, 디자인 시스템 점검 후보.",
    designerFit: {
      hasDesignSystemOpportunity: true,
      hasDesignOpsOpportunity: true,
      hasDocumentationCulture: true,
      canImproveProcess: true,
    },
    greenFlags: [
      signal("woowa_green_career", "공식 채용 페이지", "공식 채용 페이지가 정상 응답하며 포지션 확인 가능.", "https://career.woowahan.com/", 2),
    ],
    unknowns: [
      signal("woowa_unknown_deadline", "마감/역할 확인", "디자인 포지션별 마감일과 담당 제품 영역 확인 필요.", "https://career.woowahan.com/", 2),
    ],
    scores: standardScores,
  }),
  company({
    id: "company_line_plus",
    name: "LINE Plus",
    homepageUrl: "https://linecorp.com/",
    jobPostUrl: "https://careers.linecorp.com/ko/jobs",
    industry: "Global Messenger / Platform",
    size: "enterprise",
    growthInfo: "글로벌 플랫폼 제품과 여러 서비스 라인이 있어 협업 규모가 큼.",
    productDescription: "메신저, 콘텐츠, 핀테크, 커머스 등 글로벌 플랫폼 제품군.",
    interestLevel: 4,
    applicationPriority: "watch",
    priorityReason: "제품 조직 규모는 크지만 현재 국내 디자인 포지션과 언어/조직 적합도 확인 필요.",
    discoveryReason: "product-growth",
    firstImpressionNote: "글로벌 제품 경험을 쌓을 가능성이 있으나 포지션 필터링 필요.",
    candidateReason: "글로벌 플랫폼 디자인, 시스템/문서화 문화 확인 후보.",
    designerFit: {
      hasDesignSystemOpportunity: true,
      hasDocumentationCulture: true,
      hasComponentOwnership: true,
    },
    greenFlags: [
      signal("line_green_jobs", "공식 채용 페이지", "공식 채용 페이지에서 한국어 채용 목록을 확인할 수 있음.", "https://careers.linecorp.com/ko/jobs", 2),
    ],
    unknowns: [
      signal("line_unknown_role", "디자인 포지션 적합도", "현재 UX/Product Design 포지션의 국가, 언어, 연차 조건 확인 필요.", "https://careers.linecorp.com/ko/jobs", 2),
    ],
    scores: standardScores,
  }),
  company({
    id: "company_naver",
    name: "네이버",
    homepageUrl: "https://www.navercorp.com/",
    jobPostUrl: "https://recruit.navercorp.com/rcrt/list.do",
    industry: "Search / Commerce / AI Platform",
    size: "enterprise",
    growthInfo: "검색, 커머스, 콘텐츠, AI 등 다양한 제품군과 대규모 사용자 접점을 보유.",
    productDescription: "검색, 쇼핑, 콘텐츠, 지도, 클라우드, AI 서비스 제품군.",
    interestLevel: 4,
    applicationPriority: "watch",
    priorityReason: "제품 문제는 크지만 구체 디자인 포지션과 조직 배치를 확인해야 함.",
    discoveryReason: "product-growth",
    firstImpressionNote: "제품군이 넓어 도메인 선택이 중요해 보임.",
    candidateReason: "대규모 제품 품질, 시스템, 협업 프로세스 확인 후보.",
    designerFit: {
      hasDesignSystemOpportunity: true,
      hasDesignOpsOpportunity: true,
      hasDocumentationCulture: true,
    },
    greenFlags: [
      signal("naver_green_recruit", "공식 채용 페이지", "공식 채용 목록에서 직군별 포지션 확인 가능.", "https://recruit.navercorp.com/rcrt/list.do", 2),
    ],
    unknowns: [
      signal("naver_unknown_team", "팀 적합도", "관심 서비스와 디자인 역할 범위를 별도로 확인해야 함.", "https://recruit.navercorp.com/rcrt/list.do", 2),
    ],
    scores: standardScores,
  }),
  company({
    id: "company_socar",
    name: "쏘카",
    homepageUrl: "https://www.socar.kr/",
    jobPostUrl: "https://socar.career.greetinghr.com/",
    industry: "Mobility",
    size: "mid_market",
    growthInfo: "모빌리티 예약, 운영, 구독, B2B 영역의 UX 개선 여지가 있음.",
    productDescription: "차량 공유와 모빌리티 운영 서비스를 제공.",
    interestLevel: 4,
    applicationPriority: "medium",
    priorityReason: "모빌리티 도메인과 운영 UX가 흥미롭지만 현재 디자인 공고 확인 필요.",
    discoveryReason: "interesting-domain",
    firstImpressionNote: "오프라인 운영과 디지털 제품이 만나는 문제를 다룰 수 있음.",
    candidateReason: "예약/운영/신뢰 문제와 프로세스 개선 기회 확인 후보.",
    designerFit: {
      hasComponentOwnership: true,
      canImproveProcess: true,
      hasDesignSystemOpportunity: true,
    },
    greenFlags: [
      signal("socar_green_career", "채용 페이지", "Greeting 기반 채용 페이지를 통해 현재 포지션 확인 가능.", "https://socar.career.greetinghr.com/", 2),
    ],
    unknowns: [
      signal("socar_unknown_design", "디자인 조직 규모", "디자인 조직 규모와 역할 분담을 확인해야 함.", "https://socar.career.greetinghr.com/", 2),
    ],
    scores: standardScores,
  }),
  company({
    id: "company_ridi",
    name: "리디",
    homepageUrl: "https://ridicorp.com/",
    jobPostUrl: "https://ridi.career.greetinghr.com/",
    industry: "Content Platform",
    size: "mid_market",
    growthInfo: "콘텐츠 소비, 구독, 글로벌 웹툰/웹소설 경험 개선 과제가 있음.",
    productDescription: "전자책, 웹툰, 웹소설 등 디지털 콘텐츠 플랫폼.",
    interestLevel: 4,
    applicationPriority: "medium",
    priorityReason: "콘텐츠 플랫폼 UX는 적합하나 현재 공고와 포트폴리오 문제 크기 확인 필요.",
    discoveryReason: "interesting-domain",
    firstImpressionNote: "콘텐츠 탐색과 구매/구독 경험 개선 가능성이 있어 보임.",
    candidateReason: "콘텐츠 IA, 추천, 결제/구독 UX 평가 후보.",
    designerFit: {
      hasDesignSystemOpportunity: true,
      hasComponentOwnership: true,
      canImproveProcess: true,
    },
    greenFlags: [
      signal("ridi_green_career", "채용 페이지", "Greeting 기반 채용 페이지에서 포지션 확인 가능.", "https://ridi.career.greetinghr.com/", 2),
    ],
    unknowns: [
      signal("ridi_unknown_open", "현재 디자인 포지션", "프로덕트 디자이너 포지션 오픈 여부와 마감 확인 필요.", "https://ridi.career.greetinghr.com/", 2),
    ],
    scores: standardScores,
  }),
  company({
    id: "company_kakaostyle",
    name: "카카오스타일",
    homepageUrl: "https://kakaostyle.com/",
    jobPostUrl: "https://kakaostyle.career.greetinghr.com/",
    industry: "Fashion Commerce",
    size: "mid_market",
    growthInfo: "패션 탐색, 추천, 구매 전환과 셀러 운영 UX 과제가 있음.",
    productDescription: "지그재그 등 패션 커머스 제품을 운영.",
    interestLevel: 4,
    applicationPriority: "medium",
    priorityReason: "커머스 UX 경험과 맞을 수 있으나 현재 포지션 조건 확인 필요.",
    discoveryReason: "product-growth",
    firstImpressionNote: "전환율 개선과 정보 구조 개선 과제가 뚜렷할 가능성.",
    candidateReason: "커머스 퍼널, 검색/탐색, 디자인 시스템 확인 후보.",
    designerFit: {
      hasDesignSystemOpportunity: true,
      hasComponentOwnership: true,
      canImproveProcess: true,
    },
    greenFlags: [
      signal("kakaostyle_green_career", "채용 페이지", "채용 페이지에서 포지션 확인 가능.", "https://kakaostyle.career.greetinghr.com/", 2),
    ],
    unknowns: [
      signal("kakaostyle_unknown_team", "팀 배치", "지원 포지션이 구매자/셀러/플랫폼 중 어디인지 확인 필요.", "https://kakaostyle.career.greetinghr.com/", 2),
    ],
    scores: standardScores,
  }),
  company({
    id: "company_wantedlab",
    name: "원티드랩",
    homepageUrl: "https://www.wantedlab.com/",
    jobPostUrl: "https://www.wantedlab.com/career",
    industry: "HR Tech / Matching Platform",
    size: "mid_market",
    growthInfo: "채용 매칭, 커리어, HR SaaS 영역으로 확장 가능성이 있음.",
    productDescription: "채용 매칭과 커리어 관련 플랫폼 제품군.",
    interestLevel: 4,
    applicationPriority: "medium",
    priorityReason: "채용 도메인이 앱 목표와 맞지만 현재 디자인 포지션 확인 필요.",
    discoveryReason: "interesting-domain",
    firstImpressionNote: "커리어/채용 도메인에 관심이 있다면 제품 이해가 빠를 수 있음.",
    candidateReason: "매칭, 검색, B2B/B2C 양면 UX 평가 후보.",
    designerFit: {
      hasDesignSystemOpportunity: true,
      hasDocumentationCulture: true,
      canImproveProcess: true,
    },
    greenFlags: [
      signal("wanted_green_career", "채용 페이지", "공식 커리어 페이지를 통해 포지션 확인 가능.", "https://www.wantedlab.com/career", 2),
    ],
    unknowns: [
      signal("wanted_unknown_role", "포지션 적합도", "프로덕트 디자인 공고의 담당 제품과 요구 연차 확인 필요.", "https://www.wantedlab.com/career", 2),
    ],
    scores: standardScores,
  }),
  company({
    id: "company_channel_corp",
    name: "채널코퍼레이션",
    homepageUrl: "https://channel.io/",
    jobPostUrl: "https://channel.io/ko/careers",
    industry: "B2B SaaS / Customer Support",
    size: "scaleup",
    growthInfo: "고객 상담, CRM, AI 지원 도구로 B2B SaaS 제품 성장성이 있음.",
    productDescription: "채널톡 기반 고객 상담, CRM, 마케팅 자동화 제품.",
    interestLevel: 5,
    applicationPriority: "high",
    priorityReason: "B2B SaaS와 디자인 시스템/운영 개선 기회가 커 보여 우선 검토 가치가 높음.",
    discoveryReason: "design-system",
    firstImpressionNote: "도구형 제품이라 컴포넌트 오너십과 UX 개선 과제가 많아 보임.",
    candidateReason: "B2B SaaS, AI, 운영도구 UX, 디자인 시스템 후보.",
    designerFit: {
      hasDesignSystemOpportunity: true,
      hasDesignOpsOpportunity: true,
      hasComponentOwnership: true,
      hasDocumentationCulture: true,
      canImproveProcess: true,
    },
    greenFlags: [
      signal("channel_green_career", "채용 페이지", "공식 커리어 페이지에서 포지션 확인 가능.", "https://channel.io/ko/careers", 2),
    ],
    unknowns: [
      signal("channel_unknown_design", "디자인 조직 확인", "디자인 조직 규모, PM/개발 협업 구조 확인 필요.", "https://channel.io/ko/careers", 2),
    ],
    scores: {
      ...standardScores,
      designGrowth: {
        strategicRole: 5,
        systemOpportunity: 5,
        collaboration: 4,
        portfolioProblem: 5,
      },
    },
  }),
  company({
    id: "company_sendbird",
    name: "센드버드",
    homepageUrl: "https://sendbird.com/",
    jobPostUrl: "https://sendbird.com/careers",
    industry: "B2B SaaS / Communication API",
    size: "scaleup",
    growthInfo: "글로벌 B2B SaaS와 API/콘솔 UX 문제를 보유.",
    productDescription: "채팅, 메시징, 커뮤니케이션 API와 운영 콘솔 제품.",
    interestLevel: 4,
    applicationPriority: "watch",
    priorityReason: "글로벌 SaaS 경험은 매력적이나 현재 한국/원격 디자인 포지션 확인 필요.",
    discoveryReason: "design-system",
    firstImpressionNote: "개발자 도구와 관리자 콘솔 UX를 다룰 가능성.",
    candidateReason: "API 제품, 콘솔, 문서화 문화, 디자인 시스템 후보.",
    designerFit: {
      hasDesignSystemOpportunity: true,
      hasDocumentationCulture: true,
      hasComponentOwnership: true,
    },
    greenFlags: [
      signal("sendbird_green_career", "채용 페이지", "공식 커리어 페이지에서 글로벌 포지션 확인 가능.", "https://sendbird.com/careers", 2),
    ],
    unknowns: [
      signal("sendbird_unknown_location", "근무지/언어", "한국 기반 지원 가능 여부와 영어 협업 수준 확인 필요.", "https://sendbird.com/careers", 2),
    ],
    scores: standardScores,
  }),
  company({
    id: "company_yanolja",
    name: "야놀자",
    homepageUrl: "https://www.yanolja.com/",
    jobPostUrl: "https://careers.yanolja.co/",
    industry: "Travel / Hospitality Tech",
    size: "enterprise",
    growthInfo: "여행, 숙박, B2B 솔루션 등 복합 제품군을 운영.",
    productDescription: "여행/숙박 예약과 호스피탈리티 솔루션 제품.",
    interestLevel: 3,
    applicationPriority: "watch",
    priorityReason: "제품 영역은 넓지만 현재 디자인 포지션과 조직 안정성 신호를 확인해야 함.",
    discoveryReason: "interesting-domain",
    firstImpressionNote: "예약, 운영, 파트너 도구 등 복합 UX 문제가 있음.",
    candidateReason: "여행/숙박 플랫폼 UX와 B2B 운영도구 확인 후보.",
    designerFit: {
      hasDesignSystemOpportunity: true,
      canImproveProcess: true,
    },
    greenFlags: [
      signal("yanolja_green_career", "채용 페이지", "공식 채용 페이지에서 현재 포지션 확인 가능.", "https://careers.yanolja.co/", 2),
    ],
    unknowns: [
      signal("yanolja_unknown_role", "역할 범위", "디자인 역할이 제품 개선 중심인지 운영/마케팅 제작 중심인지 확인 필요.", "https://careers.yanolja.co/", 2),
    ],
    scores: standardScores,
  }),
  company({
    id: "company_ab180",
    name: "AB180",
    homepageUrl: "https://ab180.co/",
    jobPostUrl: "https://ab180.co/career",
    industry: "B2B SaaS / Marketing Analytics",
    size: "startup",
    growthInfo: "마케팅 데이터, 어트리뷰션, 데이터 기반 운영 도구 영역.",
    productDescription: "마케팅 성과 분석과 데이터 활용을 돕는 B2B SaaS 제품.",
    interestLevel: 4,
    applicationPriority: "medium",
    priorityReason: "데이터 제품 UX가 흥미롭지만 현재 디자인 포지션과 제품 오너십 확인 필요.",
    discoveryReason: "product-growth",
    firstImpressionNote: "복잡한 데이터 시각화와 워크플로우 개선 기회가 있어 보임.",
    candidateReason: "B2B SaaS, 데이터 대시보드, 문서화 문화 확인 후보.",
    designerFit: {
      hasDesignSystemOpportunity: true,
      hasComponentOwnership: true,
      hasDocumentationCulture: true,
      canImproveProcess: true,
    },
    greenFlags: [
      signal("ab180_green_career", "채용 페이지", "공식 커리어 페이지를 통해 포지션 확인 가능.", "https://ab180.co/career", 2),
    ],
    unknowns: [
      signal("ab180_unknown_open", "현재 오픈 포지션", "프로덕트 디자이너 포지션 오픈 여부와 마감 확인 필요.", "https://ab180.co/career", 2),
    ],
    scores: standardScores,
  }),
  company({
    id: "company_flex",
    name: "플렉스",
    homepageUrl: "https://flex.team/",
    jobPostUrl: "https://flex.team/career",
    industry: "HR SaaS",
    size: "scaleup",
    growthInfo: "인사관리, 근태, 급여 등 조직 운영 SaaS 문제를 다룸.",
    productDescription: "HR 운영을 위한 SaaS 제품과 워크플로우.",
    interestLevel: 4,
    applicationPriority: "medium",
    priorityReason: "HR SaaS와 프로세스 개선 도메인이 적합하지만 현재 공고 확인 필요.",
    discoveryReason: "design-system",
    firstImpressionNote: "복잡한 업무 플로우와 컴포넌트 설계 과제가 많아 보임.",
    candidateReason: "SaaS 워크플로우, 디자인 시스템, 문서화 문화 확인 후보.",
    designerFit: {
      hasDesignSystemOpportunity: true,
      hasDesignOpsOpportunity: true,
      hasComponentOwnership: true,
      hasDocumentationCulture: true,
      canImproveProcess: true,
    },
    greenFlags: [
      signal("flex_green_career", "채용 페이지", "공식 채용 페이지를 통해 포지션 확인 가능.", "https://flex.team/career", 2),
    ],
    unknowns: [
      signal("flex_unknown_role", "포지션 조건", "디자인 포지션 오픈 여부, 요구 경력, 담당 모듈 확인 필요.", "https://flex.team/career", 2),
    ],
    scores: standardScores,
  }),
  company({
    id: "company_hackle",
    name: "Hackle",
    homepageUrl: "https://hackle.io/",
    jobPostUrl: "https://hackle.io/careers",
    industry: "B2B SaaS / Experimentation",
    size: "startup",
    growthInfo: "A/B 테스트, 기능 플래그, 제품 실험 플랫폼 영역.",
    productDescription: "제품 실험과 기능 배포를 돕는 SaaS 플랫폼.",
    interestLevel: 4,
    applicationPriority: "medium",
    priorityReason: "제품 실험 도메인이 커리어 방향과 잘 맞지만 현재 공고와 디자인 조직 규모 확인 필요.",
    discoveryReason: "product-growth",
    firstImpressionNote: "실험 플랫폼이라 제품 개선 문화와 잘 맞을 수 있음.",
    candidateReason: "실험/분석 제품, 콘솔 UX, 디자인-개발 협업 확인 후보.",
    designerFit: {
      hasComponentOwnership: true,
      hasDocumentationCulture: true,
      canImproveProcess: true,
      hasDesignSystemOpportunity: true,
    },
    greenFlags: [
      signal("hackle_green_product", "제품 실험 도메인", "A/B 테스트와 기능 플래그 기반 제품 개선 도메인.", "https://hackle.io/", 3),
    ],
    unknowns: [
      signal("hackle_unknown_career", "채용 페이지 확인", "현재 디자인 포지션 오픈 여부와 담당 제품 영역 확인 필요.", "https://hackle.io/careers", 2),
    ],
    scores: standardScores,
  }),
];

const ROLE_SAMPLE_INDEX: Record<UserRole, number> = {
  designer: 0,
  pm: 1,
  frontend: 9,
  ux_researcher: 3,
  marketer: 7,
};

export function getSampleCompaniesForRole(role: UserRole = "designer"): Company[] {
  const sample = ALL_SAMPLE_COMPANIES[ROLE_SAMPLE_INDEX[role]] ?? ALL_SAMPLE_COMPANIES[0];
  return sample ? [sample] : [];
}

export const SAMPLE_COMPANIES: Company[] = getSampleCompaniesForRole("designer");
