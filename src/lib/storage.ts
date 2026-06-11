import { DEFAULT_CRITERIA_SETTINGS, SCORE_CATEGORIES } from "@/lib/criteria";
import { SAMPLE_COMPANIES } from "@/lib/sample-data";
import type {
  ApplicationChecklist,
  Company,
  CriteriaSettings,
  DesignerFitChecklist,
  EvidenceLevel,
  ScoreEvidenceValues,
  SignalGroups,
} from "@/lib/types";

const COMPANIES_KEY = "career-company-tracker:companies";
const SETTINGS_KEY = "career-company-tracker:criteria-settings";

export interface CompanyRepository {
  loadCompanies(): Company[];
  saveCompanies(companies: Company[]): void;
  loadSettings(): CriteriaSettings;
  saveSettings(settings: CriteriaSettings): void;
  reset(): void;
}

export const localStorageRepository: CompanyRepository = {
  loadCompanies() {
    if (typeof window === "undefined") return SAMPLE_COMPANIES;

    const raw = window.localStorage.getItem(COMPANIES_KEY);
    if (!raw) {
      window.localStorage.setItem(COMPANIES_KEY, JSON.stringify(SAMPLE_COMPANIES));
      return SAMPLE_COMPANIES;
    }

    try {
      const parsedCompanies = JSON.parse(raw) as Company[];
      if (isLegacySampleSet(parsedCompanies)) {
        window.localStorage.setItem(COMPANIES_KEY, JSON.stringify(SAMPLE_COMPANIES));
        return SAMPLE_COMPANIES;
      }
      return parsedCompanies.map(normalizeCompany);
    } catch {
      return SAMPLE_COMPANIES;
    }
  },

  saveCompanies(companies) {
    window.localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies));
  },

  loadSettings() {
    if (typeof window === "undefined") return DEFAULT_CRITERIA_SETTINGS;

    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_CRITERIA_SETTINGS;

    try {
      return {
        ...DEFAULT_CRITERIA_SETTINGS,
        ...(JSON.parse(raw) as CriteriaSettings),
      };
    } catch {
      return DEFAULT_CRITERIA_SETTINGS;
    }
  },

  saveSettings(settings) {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  reset() {
    window.localStorage.removeItem(COMPANIES_KEY);
    window.localStorage.removeItem(SETTINGS_KEY);
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
    scoreEvidence: company.scoreEvidence ?? makeDefaultScoreEvidence(1),
    signals: company.signals ?? makeDefaultSignals(),
    designerFit: company.designerFit ?? makeDefaultDesignerFit(),
    applicationChecklist:
      company.applicationChecklist ?? makeDefaultApplicationChecklist(),
    interviewRounds: company.interviewRounds ?? [],
    followUpTasks: company.followUpTasks ?? [],
    createdAt: company.createdAt ?? now,
    updatedAt: company.updatedAt ?? now,
  };
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
