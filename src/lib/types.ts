export type ApplicationStatus =
  | "interested"
  | "planned"
  | "applied"
  | "interviewing"
  | "rejected"
  | "offer"
  | "on_hold";

export type CompanySize =
  | "seed"
  | "startup"
  | "scaleup"
  | "mid_market"
  | "enterprise"
  | "unknown";

export type ScoreCategoryKey =
  | "businessProduct"
  | "organizationCulture"
  | "designGrowth"
  | "compensationWork"
  | "personalFit";

export type SortMode = "score_desc" | "updated_desc";

export interface ScoreItemDefinition {
  id: string;
  label: string;
}

export interface ScoreCategoryDefinition {
  key: ScoreCategoryKey;
  title: string;
  shortTitle: string;
  weight: number;
  items: ScoreItemDefinition[];
}

export type ScoreValues = Record<ScoreCategoryKey, Record<string, number>>;

export interface ResearchLog {
  id: string;
  source: string;
  link: string;
  positiveSignals: string;
  negativeSignals: string;
  questions: string;
  createdAt: string;
}

export interface InterviewNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  homepageUrl: string;
  jobPostUrl: string;
  industry: string;
  size: CompanySize;
  growthInfo: string;
  productDescription: string;
  interestLevel: number;
  status: ApplicationStatus;
  memo: string;
  scores: ScoreValues;
  researchLogs: ResearchLog[];
  riskFlags: string[];
  interviewNotes: InterviewNote[];
  createdAt: string;
  updatedAt: string;
}

export interface CategoryScore {
  key: ScoreCategoryKey;
  title: string;
  average: number;
  weighted: number;
  weight: number;
}

export interface CompanyScoreResult {
  categoryScores: CategoryScore[];
  totalScore: number;
  recommendationLabel: "적극 지원" | "지원 고려" | "정보 추가 필요" | "보류";
  highRisk: boolean;
  riskCount: number;
}

export interface CriteriaSettings {
  weights: Record<ScoreCategoryKey, number>;
  highRiskThreshold: number;
}
