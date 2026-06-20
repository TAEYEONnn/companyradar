import type { CandidateProfile, FitAnalysis } from "./fit-analysis";
import type { JobDecision } from "./job-tracker";

const STORAGE_VERSION = 1;
const PENDING_SAVE_VERSION = 1;
const PENDING_SAVE_TTL_MS = 24 * 60 * 60 * 1000;

export type FitEventName =
  | "fit_input_started"
  | "fit_analysis_submitted"
  | "fit_analysis_completed"
  | "fit_save_clicked"
  | "fit_auth_required"
  | "fit_result_saved"
  | "fit_decision_recorded"
  | "application_started"
  | "second_job_analysis_started"
  | "fit_analysis_failed";

export interface PendingFitSave {
  analysis: FitAnalysis;
  decision: JobDecision;
  sourceUrl: string;
  createdAt: string;
}

export function serializeCandidateProfile(profile: CandidateProfile): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    profile,
  });
}

export function parseStoredCandidateProfile(
  value: string | null,
): CandidateProfile | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as {
      version?: unknown;
      profile?: Partial<CandidateProfile>;
    };
    if (parsed.version !== STORAGE_VERSION || !parsed.profile) return null;
    const profile = parsed.profile;
    if (
      typeof profile.targetRole !== "string" ||
      !Array.isArray(profile.skills) ||
      !Array.isArray(profile.domains) ||
      !Array.isArray(profile.achievements) ||
      typeof profile.updatedAt !== "string"
    ) {
      return null;
    }
    return {
      targetRole: profile.targetRole,
      yearsExperience:
        typeof profile.yearsExperience === "number"
          ? profile.yearsExperience
          : null,
      skills: profile.skills.filter(
        (item): item is string => typeof item === "string",
      ),
      domains: profile.domains.filter(
        (item): item is string => typeof item === "string",
      ),
      achievements: profile.achievements.filter(
        (item): item is string => typeof item === "string",
      ),
      updatedAt: profile.updatedAt,
    };
  } catch {
    return null;
  }
}

export function trackFitEvent(
  eventName: FitEventName,
  parameters: Record<string, string | number | boolean> = {},
) {
  if (typeof window === "undefined") return;
  const gtag = (
    window as typeof window & {
      gtag?: (
        command: "event",
        name: string,
        params: Record<string, string | number | boolean>,
      ) => void;
    }
  ).gtag;
  gtag?.("event", eventName, parameters);
}

export function chooseNewestCandidateProfile(
  localProfile: CandidateProfile | null,
  remoteProfile: CandidateProfile | null,
): CandidateProfile | null {
  if (!localProfile) return remoteProfile;
  if (!remoteProfile) return localProfile;
  return Date.parse(remoteProfile.updatedAt) > Date.parse(localProfile.updatedAt)
    ? remoteProfile
    : localProfile;
}

export function serializePendingFitSave(value: PendingFitSave): string {
  return JSON.stringify({ version: PENDING_SAVE_VERSION, value });
}

export function parsePendingFitSave(
  serialized: string | null,
  now = Date.now(),
): PendingFitSave | null {
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(serialized) as {
      version?: unknown;
      value?: Partial<PendingFitSave>;
    };
    const value = parsed.value;
    if (
      parsed.version !== PENDING_SAVE_VERSION ||
      !value?.analysis ||
      typeof value.analysis.analysisId !== "string" ||
      !isDecision(value.decision) ||
      typeof value.createdAt !== "string" ||
      now - Date.parse(value.createdAt) > PENDING_SAVE_TTL_MS
    ) {
      return null;
    }
    return {
      analysis: value.analysis,
      decision: value.decision,
      sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : "",
      createdAt: value.createdAt,
    };
  } catch {
    return null;
  }
}

function isDecision(value: unknown): value is JobDecision {
  return value === "interested" || value === "planned" || value === "pass";
}
