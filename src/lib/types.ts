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

export type CandidateParseStatus =
  | "idle"
  | "fetching"
  | "parsed"
  | "partial"
  | "failed"
  | "needs_manual_input";

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
  /** Legacy free-text description (manual entry). Prefer reason + evidenceText for AI-extracted signals. */
  description: string;
  /** Why this is a signal (AI-extracted) */
  reason?: string;
  /** Short verbatim excerpt from the job posting that supports this signal */
  evidenceText?: string;
  /** Signal polarity — set automatically when grouped, stored for convenience */
  type?: "green" | "red" | "unknown";
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

export interface PrivateSensitiveNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export type PrepCategory = "behavioral" | "technical" | "culture" | "situational";

export interface PrepQuestion {
  id: string;
  category: PrepCategory;
  question: string;
  /** AES-GCM ciphertext (v1: prefix) — same key as privateSensitiveNote */
  answer: string;
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
  completedAt?: string;
  relatedRoundId?: string;
  createdAt: string;
}

export interface CandidateInboxItem {
  id: string;
  sourceUrl: string;
  rawText: string;
  discoveryReason: DiscoveryReason;
  firstImpressionNote: string;
  parsedCompany: Partial<Company> | null;
  parseStatus: CandidateParseStatus;
  needsReview: boolean;
  promotedCompanyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryEntry {
  status: ApplicationStatus;
  date: string;
  note: string;
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
  validationReason: string[];
  memo: string;
  /** AES-GCM ciphertext. Decrypted client-side with per-device key in localStorage. */
  privateSensitiveNote: string;
  privateSensitiveNotes?: PrivateSensitiveNote[];
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
  prepQuestions: PrepQuestion[];
  statusHistory: StatusHistoryEntry[];
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

export type UserRole = "designer" | "pm" | "frontend" | "ux_researcher" | "marketer";

export interface ScoreThresholdSettings {
  strong: number;
  consider: number;
  needsInfo: number;
}

export interface CriteriaSettings {
  weights: Record<ScoreCategoryKey, number>;
  highRiskThreshold: number;
  userRole?: UserRole;
  scoreThresholds?: ScoreThresholdSettings;
}
