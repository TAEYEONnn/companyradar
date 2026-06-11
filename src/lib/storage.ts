import { DEFAULT_CRITERIA_SETTINGS } from "@/lib/criteria";
import { SAMPLE_COMPANIES } from "@/lib/sample-data";
import type { Company, CriteriaSettings } from "@/lib/types";

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
      return JSON.parse(raw) as Company[];
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
