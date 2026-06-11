export type ApplicationStatus =
  | "interested"
  | "planned"
  | "applied"
  | "interviewing"
  | "rejected"
  | "offer"
  | "on_hold";

export type ApplicationPriority = "high" | "medium" | "low" | "watch";

export type EvidenceLevel = 1 | 2 | 3 | 4 | 5;

export type JobStatus = "open" | "closed" | "unknown";

export type DiscoveryReason =
  | "design-system"
  | "product-growth"
  | "good-review"
  | "interesting-domain"
  | "salary"
  | "remote"
  | "referral"
  | "manual";

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

export type SortMode = "score_desc" | "priority_desc" | "deadline_asc" | "updated_desc";

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

export type ScoreEvidenceValues = Record<
  ScoreCategoryKey,
  Record<string, EvidenceLevel>
>;

export interface ResearchSignal {
  id: string;
  label: string;
  description: string;
  sourceUrl: string;
  confidence: EvidenceLevel;
  createdAt: string;
}

export interface SignalGroups {
  greenFlags: ResearchSignal[];
  redFlags: ResearchSignal[];
  unknowns: ResearchSignal[];
}

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

export interface DesignerFitChecklist {
  hasDesignSystemOpportunity: boolean;
  hasDesignOpsOpportunity: boolean;
  hasComponentOwnership: boolean;
  hasDocumentationCulture: boolean;
  canImproveProcess: boolean;
  isOnlyVisualProductionRole: boolean;
}

export interface ApplicationChecklist {
  resumeReady: boolean;
  portfolioReady: boolean;
  coverLetterReady: boolean;
  referralChecked: boolean;
  submitted: boolean;
}

export type InterviewRoundType =
  | "screening"
  | "assignment"
  | "first"
  | "second"
  | "culture"
  | "offer";

export interface InterviewRound {
  id: string;
  type: InterviewRoundType;
  title: string;
  scheduledAt: string;
  result: "scheduled" | "passed" | "rejected" | "pending" | "canceled";
  memo: string;
  createdAt: string;
}

export interface FollowUpTask {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  relatedRoundId?: string;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  homepageUrl: string;
  jobPostUrl: string;
  sourceUrls: string[];
  industry: string;
  size: CompanySize;
  growthInfo: string;
  productDescription: string;
  interestLevel: number;
  status: ApplicationStatus;
  applicationPriority: ApplicationPriority;
  priorityReason: string;
  evidenceLevel: EvidenceLevel;
  sourceConfidence: EvidenceLevel;
  discoveryReason: DiscoveryReason;
  firstImpressionNote: string;
  candidateReason: string;
  jobDeadline: string;
  jobStatus: JobStatus;
  lastCheckedAt: string;
  lastVerifiedAt: string;
  lastResearchedAt: string;
  isSampleData: boolean;
  needsRefresh: boolean;
  memo: string;
  scores: ScoreValues;
  scoreEvidence: ScoreEvidenceValues;
  signals: SignalGroups;
  designerFit: DesignerFitChecklist;
  applicationChecklist: ApplicationChecklist;
  interviewRounds: InterviewRound[];
  followUpTasks: FollowUpTask[];
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
  companyFitScore: number;
  totalScore: number;
  recommendationLabel: "적극 지원" | "지원 고려" | "정보 추가 필요" | "보류";
  highRisk: boolean;
  needsValidation: boolean;
  averageEvidenceLevel: number;
  riskCount: number;
}

export interface CriteriaSettings {
  weights: Record<ScoreCategoryKey, number>;
  highRiskThreshold: number;
}
