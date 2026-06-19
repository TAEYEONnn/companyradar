import type { CandidateProfile } from "./fit-analysis";

const STORAGE_VERSION = 1;

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
  eventName: string,
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
