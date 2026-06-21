import type {
  CompanyOverview,
  FitAnalysis,
  FitRecommendation,
  FitRequirement,
} from "@/lib/fit-analysis";

export type JobDecision = "interested" | "planned" | "pass";
export type JobApplicationStatus =
  | "interested"
  | "planned"
  | "applied"
  | "interviewing"
  | "rejected"
  | "offer"
  | "on_hold";

export interface StructuredJobPosting {
  title: string;
  companyName: string;
  source: string;
  deadline: string;
  responsibilities: string[];
  requiredQualifications: string[];
  preferredQualifications: string[];
}

export interface SaveFitResultInput {
  analysis: FitAnalysis;
  jobPosting: StructuredJobPosting;
  sourceUrl: string;
  decision: JobDecision;
}

export interface SaveFitResultResponse {
  jobPostingId: string;
  companyId: string | null;
  duplicate: boolean;
  decision: JobDecision;
  applicationStatus: JobApplicationStatus | null;
}

export interface TrackedJobPosting {
  id: string;
  companyName: string;
  title: string;
  canonicalUrl: string;
  source: string;
  deadline: string;
  lastCheckedAt: string;
  decision: JobDecision;
  applicationStatus: JobApplicationStatus | null;
  analysisId: string;
  recommendation: FitRecommendation;
  score: number;
  evidenceCoverage: number;
  summary: string;
  nextAction: string;
  requirements: FitRequirement[];
  companyOverview: CompanyOverview | null;
  structuredData: {
    responsibilities: string[];
    requiredQualifications: string[];
    preferredQualifications: string[];
  } | null;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationEventType =
  | "saved"
  | "decision_changed"
  | "status_changed"
  | "interview_scheduled";

export interface ApplicationEvent {
  id: string;
  jobPostingId: string;
  eventType: ApplicationEventType;
  fromStatus: string;
  toStatus: string;
  companyName: string;
  jobTitle: string;
  note: string;
  occurredAt: string;
}

export function normalizeTrackedJobPosting(
  value: TrackedJobPosting,
): TrackedJobPosting {
  return {
    ...value,
    evidenceCoverage: Number.isFinite(value.evidenceCoverage)
      ? value.evidenceCoverage
      : 0,
    companyOverview: value.companyOverview ?? null,
    structuredData: value.structuredData ?? null,
  };
}

export function normalizeApplicationEvent(value: {
  id: string;
  job_posting_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string;
  company_name: string | null;
  job_title: string | null;
  note: string | null;
  occurred_at: string;
}): ApplicationEvent {
  return {
    id: value.id,
    jobPostingId: value.job_posting_id,
    eventType: value.event_type as ApplicationEventType,
    fromStatus: value.from_status ?? "",
    toStatus: value.to_status,
    companyName: value.company_name ?? "회사명 확인 필요",
    jobTitle: value.job_title ?? "",
    note: value.note ?? "",
    occurredAt: value.occurred_at,
  };
}

export function canonicalizeJobUrl(value: string): string {
  if (!value.trim()) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        ["fbclid", "gclid", "ref"].includes(key.toLowerCase())
      ) {
        url.searchParams.delete(key);
      }
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return "";
  }
}

export function isJobDecision(value: unknown): value is JobDecision {
  return value === "interested" || value === "planned" || value === "pass";
}

export function isJobApplicationStatus(
  value: unknown,
): value is JobApplicationStatus {
  return [
    "interested",
    "planned",
    "applied",
    "interviewing",
    "rejected",
    "offer",
    "on_hold",
  ].includes(String(value));
}

export function scoreBand(score: number): string {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}
