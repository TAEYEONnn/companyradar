import type {
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
  summary: string;
  nextAction: string;
  requirements: FitRequirement[];
  createdAt: string;
  updatedAt: string;
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
