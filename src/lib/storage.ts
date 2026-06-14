import { DEFAULT_CRITERIA_SETTINGS, DEFAULT_SCORE_THRESHOLDS, SCORE_CATEGORIES } from "@/lib/criteria";
import { getCompanyValidationReasons } from "@/lib/company-validation";
import { getSampleCompaniesForRole } from "@/lib/sample-data";
import type {
  ApplicationChecklist,
  Company,
  CriteriaSettings,
  DesignerFitChecklist,
  EvidenceLevel,
  ScoreEvidenceValues,
  SignalGroups,
  UserRole,
} from "@/lib/types";

const COMPANIES_KEY = "career-company-tracker:companies";
const SETTINGS_KEY = "career-company-tracker:criteria-settings";
const MIGRATION_COMPLETED_KEY = "career-company-tracker:migration-completed-at";
const ROLE_KEY = "career-company-tracker:user-role";

export interface CompanyRepository {
  loadCompanies(userId?: string): Company[];
  saveCompanies(companies: Company[], userId?: string): void;
  loadSettings(userId?: string): CriteriaSettings;
  saveSettings(settings: CriteriaSettings, userId?: string): void;
  reset(userId?: string): void;
}

export const localStorageRepository: CompanyRepository = {
  loadCompanies(userId) {
    if (typeof window === "undefined") return [];

    return readCompaniesFromKey(getCompaniesKey(userId)) ?? readLegacyCompanies();
  },

  saveCompanies(companies, userId) {
    window.localStorage.setItem(getCompaniesKey(userId), JSON.stringify(companies));
  },

  loadSettings(userId) {
    if (typeof window === "undefined") return DEFAULT_CRITERIA_SETTINGS;

    const raw =
      window.localStorage.getItem(getSettingsKey(userId)) ??
      window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_CRITERIA_SETTINGS;

    try {
      const parsed = JSON.parse(raw) as CriteriaSettings;
      return {
        ...DEFAULT_CRITERIA_SETTINGS,
        ...parsed,
        scoreThresholds: {
          ...DEFAULT_SCORE_THRESHOLDS,
          ...parsed.scoreThresholds,
        },
      };
    } catch {
      return DEFAULT_CRITERIA_SETTINGS;
    }
  },

  saveSettings(settings, userId) {
    window.localStorage.setItem(getSettingsKey(userId), JSON.stringify(settings));
  },

  reset(userId) {
    window.localStorage.removeItem(getCompaniesKey(userId));
    window.localStorage.removeItem(getSettingsKey(userId));
  },
};

// Supabase extension point:
// Implement CompanyRepository with CRUD calls against tables such as
// companies, company_scores, research_logs, risk_flags, and interview_notes.
// The UI consumes the repository shape above, so storage can be swapped without
// rewriting scoring or presentation components.

export function normalizeCompany(company: Company): Company {
  const now = new Date().toISOString();

  return {
    ...company,
    sourceUrls: company.sourceUrls ?? [company.homepageUrl, company.jobPostUrl].filter(Boolean),
    applicationPriority: company.applicationPriority ?? "watch",
    priorityReason:
      company.priorityReason ??
      "기존 데이터에서 이전됨. 포지션 적합도와 마감 상태 확인 필요.",
    evidenceLevel: company.evidenceLevel ?? 1,
    sourceConfidence: company.sourceConfidence ?? company.evidenceLevel ?? 1,
    discoveryReason: company.discoveryReason ?? "manual",
    firstImpressionNote: company.firstImpressionNote ?? company.memo ?? "",
    candidateReason:
      company.candidateReason ?? "직접 추가한 관심 회사. 세부 공고 확인 필요.",
    jobDeadline: company.jobDeadline ?? "",
    jobStatus: company.jobStatus ?? "unknown",
    lastCheckedAt: company.lastCheckedAt ?? "",
    lastVerifiedAt: company.lastVerifiedAt ?? "",
    lastResearchedAt: company.lastResearchedAt ?? "",
    isSampleData: company.isSampleData ?? false,
    needsRefresh: company.needsRefresh ?? false,
    validationReason: migrateValidationReasons(
      company.validationReason ??
        getCompanyValidationReasons(
          { ...company, validationReason: [] },
          undefined,
          { includeDataQualityReasons: true },
        ),
    ),
    privateSensitiveNote: company.privateSensitiveNote ?? "",
    privateSensitiveNotes: company.privateSensitiveNotes ?? [],
    scoreEvidence: company.scoreEvidence ?? makeDefaultScoreEvidence(1),
    signals: company.signals ?? makeDefaultSignals(),
    designerFit: company.designerFit ?? makeDefaultDesignerFit(),
    applicationChecklist:
      company.applicationChecklist ?? makeDefaultApplicationChecklist(),
    interviewRounds: company.interviewRounds ?? [],
    followUpTasks: company.followUpTasks ?? [],
    interviewNotes: company.interviewNotes ?? [],
    prepQuestions: company.prepQuestions ?? [],
    createdAt: company.createdAt ?? now,
    updatedAt: company.updatedAt ?? now,
  };
}

const STALE_VALIDATION_LABELS = ["AI 추출 데이터", "근거 레벨 2 이하", "aiExtracted", "lowEvidence"];

function migrateValidationReasons(reasons: string[]): string[] {
  return reasons.filter((r) => !STALE_VALIDATION_LABELS.includes(r));
}

export function makeDefaultScoreEvidence(level: EvidenceLevel = 1): ScoreEvidenceValues {
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

function makeDefaultSignals(): SignalGroups {
  return {
    greenFlags: [],
    redFlags: [],
    unknowns: [],
  };
}

function makeDefaultDesignerFit(): DesignerFitChecklist {
  return {
    hasDesignSystemOpportunity: false,
    hasDesignOpsOpportunity: false,
    hasComponentOwnership: false,
    hasDocumentationCulture: false,
    canImproveProcess: false,
    isOnlyVisualProductionRole: false,
  };
}

function makeDefaultApplicationChecklist(): ApplicationChecklist {
  return {
    resumeReady: false,
    portfolioReady: false,
    coverLetterReady: false,
    referralChecked: false,
    submitted: false,
  };
}

function isLegacySampleSet(companies: Company[]): boolean {
  if (companies.length === 0) return false;
  const legacyIds = new Set([
    "company_lattice",
    "company_mono",
    "company_leaf",
    "company_signal",
    "company_arcade",
  ]);

  return companies.every(
    (company) =>
      legacyIds.has(company.id) ||
      company.homepageUrl?.startsWith("https://example.com/"),
  );
}

function getCompaniesKey(userId?: string): string {
  return userId ? `${COMPANIES_KEY}:${userId}` : COMPANIES_KEY;
}

function getSettingsKey(userId?: string): string {
  return userId ? `${SETTINGS_KEY}:${userId}` : SETTINGS_KEY;
}

function getMigrationCompletedKey(userId: string): string {
  return `${MIGRATION_COMPLETED_KEY}:${userId}`;
}

function readCompaniesFromKey(key: string): Company[] | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsedCompanies = JSON.parse(raw) as Company[];
    if (isLegacySampleSet(parsedCompanies)) {
      return [];
    }
    return parsedCompanies.map(normalizeCompany);
  } catch {
    return [];
  }
}

export function readLegacyCompanies(): Company[] {
  return readCompaniesFromKey(COMPANIES_KEY) ?? [];
}

export function readUserScopedCompanies(userId: string): Company[] {
  return readCompaniesFromKey(getCompaniesKey(userId)) ?? [];
}

export function getMigrationCompletedAt(userId: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(getMigrationCompletedKey(userId)) ?? "";
}

export function markMigrationCompleted(userId: string): string {
  const completedAt = new Date().toISOString();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(getMigrationCompletedKey(userId), completedAt);
  }
  return completedAt;
}

export function hasUserCompanies(companies: Company[]): boolean {
  return companies.some((company) => !company.isSampleData);
}

function getRoleKey(userId?: string): string {
  return userId ? `${ROLE_KEY}:${userId}` : ROLE_KEY;
}

export function loadUserRole(userId?: string): UserRole | null {
  if (typeof window === "undefined") return null;
  const stored =
    window.localStorage.getItem(getRoleKey(userId)) ??
    window.localStorage.getItem(ROLE_KEY);
  return (stored as UserRole | null) ?? null;
}

export function saveUserRole(role: UserRole, userId?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getRoleKey(userId), role);
}

export function cloneSampleCompaniesForUser(role: UserRole = "designer"): Company[] {
  const now = new Date().toISOString();
  return getSampleCompaniesForRole(role).map((company) =>
    normalizeCompany({
      ...company,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

export function normalizeSamplesForRole(
  companies: Company[],
  role: UserRole = "designer",
): Company[] {
  const userCompanies = companies.filter((company) => !company.isSampleData);
  const sampleCompanies = cloneSampleCompaniesForUser(role);
  return [...userCompanies, ...sampleCompanies];
}
