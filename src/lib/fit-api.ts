import {
  calculateFitResult,
  type CandidateProfile,
  type FitAnalysis,
  type FitRequirement,
  type RequirementImportance,
  type RequirementMatch,
} from "./fit-analysis";

const MAX_JOB_TEXT_CHARS = 20_000;
const MAX_RESUME_TEXT_CHARS = 20_000;

export interface AnalyzeFitInput {
  jobUrl: string;
  jobText: string;
  resumeText: string;
  candidateProfile: CandidateProfile | null;
  confidenceBefore: number;
}

interface ModelRequirement {
  text?: unknown;
  importance?: unknown;
  match?: unknown;
  confidence?: unknown;
  jobEvidence?: unknown;
  profileEvidence?: unknown;
}

export interface ModelFitAnalysis {
  candidateProfile?: Partial<CandidateProfile>;
  roleTitle?: unknown;
  companyName?: unknown;
  summary?: unknown;
  nextAction?: unknown;
  score?: unknown;
  requirements?: ModelRequirement[];
}

export function parseAnalyzeFitInput(value: unknown): AnalyzeFitInput {
  const body = isRecord(value) ? value : {};
  const jobUrl = asString(body.jobUrl);
  const jobText = asString(body.jobText).slice(0, MAX_JOB_TEXT_CHARS);
  const resumeText = asString(body.resumeText).slice(0, MAX_RESUME_TEXT_CHARS);
  const candidateProfile = parseCandidateProfile(body.candidateProfile);

  if (!jobUrl && !jobText) {
    throw new Error("공고 URL 또는 공고 원문을 입력해주세요.");
  }
  if (!resumeText && !candidateProfile) {
    throw new Error("이력서 또는 저장된 프로필이 필요합니다.");
  }
  if (jobText && jobText.length < 50) {
    throw new Error("공고 원문을 50자 이상 입력해주세요.");
  }
  if (resumeText && resumeText.length < 50) {
    throw new Error("이력서 내용을 50자 이상 입력해주세요.");
  }

  const rawConfidence = Number(body.confidenceBefore);
  const confidenceBefore = Number.isFinite(rawConfidence)
    ? Math.min(5, Math.max(1, Math.round(rawConfidence)))
    : 3;

  return {
    jobUrl,
    jobText,
    resumeText,
    candidateProfile,
    confidenceBefore,
  };
}

export function normalizeFitAnalysis(model: ModelFitAnalysis): FitAnalysis {
  const requirements = (model.requirements ?? [])
    .slice(0, 20)
    .map(normalizeRequirement)
    .filter((requirement): requirement is FitRequirement =>
      Boolean(requirement.text),
    );
  const fit = calculateFitResult(requirements);
  const now = new Date().toISOString();
  const profile = model.candidateProfile ?? {};

  return {
    analysisId: crypto.randomUUID(),
    candidateProfile: {
      targetRole: asString(profile.targetRole),
      yearsExperience:
        typeof profile.yearsExperience === "number" &&
        Number.isFinite(profile.yearsExperience)
          ? Math.max(0, profile.yearsExperience)
          : null,
      skills: stringArray(profile.skills),
      domains: stringArray(profile.domains),
      achievements: stringArray(profile.achievements),
      updatedAt: now,
    },
    roleTitle: asString(model.roleTitle),
    companyName: asString(model.companyName),
    summary: asString(model.summary),
    nextAction:
      asString(model.nextAction) ||
      "불확실한 필수요건을 확인한 뒤 지원 여부를 결정하세요.",
    requirements,
    ...fit,
  };
}

function normalizeRequirement(
  requirement: ModelRequirement,
  index: number,
): FitRequirement {
  const importance: RequirementImportance =
    requirement.importance === "preferred" ? "preferred" : "required";
  const allowedMatches: RequirementMatch[] = [
    "matched",
    "partial",
    "missing",
    "uncertain",
  ];
  const match = allowedMatches.includes(requirement.match as RequirementMatch)
    ? (requirement.match as RequirementMatch)
    : "uncertain";
  const rawConfidence = Number(requirement.confidence);
  const confidence = Math.min(
    3,
    Math.max(1, Number.isFinite(rawConfidence) ? Math.round(rawConfidence) : 1),
  ) as 1 | 2 | 3;

  return {
    id: `requirement-${index + 1}`,
    text: asString(requirement.text),
    importance,
    match,
    confidence,
    jobEvidence: asString(requirement.jobEvidence),
    profileEvidence: asString(requirement.profileEvidence),
  };
}

function parseCandidateProfile(value: unknown): CandidateProfile | null {
  if (!isRecord(value)) return null;

  return {
    targetRole: asString(value.targetRole),
    yearsExperience:
      typeof value.yearsExperience === "number" &&
      Number.isFinite(value.yearsExperience)
        ? Math.max(0, value.yearsExperience)
        : null,
    skills: stringArray(value.skills),
    domains: stringArray(value.domains),
    achievements: stringArray(value.achievements),
    updatedAt: asString(value.updatedAt) || new Date(0).toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}
