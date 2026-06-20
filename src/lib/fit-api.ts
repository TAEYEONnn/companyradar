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
  jobPosting?: {
    title?: unknown;
    companyName?: unknown;
    source?: unknown;
    deadline?: unknown;
    responsibilities?: unknown;
    requiredQualifications?: unknown;
    preferredQualifications?: unknown;
  };
  score?: unknown;
  requirements?: ModelRequirement[];
}

interface FitAnalysisContext {
  baseProfile?: CandidateProfile | null;
  jobText?: string;
  jobUrl?: string;
  candidateText?: string;
}

export function getOpenAIErrorMessage(status: number): string {
  if (status === 401) {
    return "분석 연결 설정을 확인해주세요.";
  }
  if (status === 429) {
    return "분석 요청이 잠깐 몰렸어요. 잠시 후 다시 해주세요.";
  }
  return `분석을 마치지 못했어요. 잠시 후 다시 해주세요. (${status})`;
}

export function parseAnalyzeFitInput(value: unknown): AnalyzeFitInput {
  const body = isRecord(value) ? value : {};
  const jobUrl = asString(body.jobUrl);
  const jobText = asString(body.jobText).slice(0, MAX_JOB_TEXT_CHARS);
  const resumeText = asString(body.resumeText).slice(0, MAX_RESUME_TEXT_CHARS);
  const candidateProfile = parseCandidateProfile(body.candidateProfile);

  if (!jobUrl && !jobText) {
    throw new Error("공고 URL이나 공고 내용을 넣어주세요.");
  }
  if (!resumeText && !candidateProfile) {
    throw new Error("이력서를 올리거나 저장된 프로필을 선택해주세요.");
  }
  if (jobText && jobText.length < 50) {
    throw new Error("공고 내용을 50자 이상 붙여주세요.");
  }
  if (resumeText && resumeText.length < 50) {
    throw new Error("이력서 내용을 50자 이상 붙여주세요.");
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

export function normalizeFitAnalysis(
  model: ModelFitAnalysis,
  context: FitAnalysisContext = {},
): FitAnalysis {
  const modelRequirements = Array.isArray(model.requirements)
    ? model.requirements.filter(isRecord)
    : [];
  const requirements = modelRequirements
    .slice(0, 12)
    .map((requirement, index) =>
      normalizeRequirement(requirement, index, context),
    )
    .filter((requirement): requirement is FitRequirement =>
      Boolean(requirement.text),
    );
  const fit = calculateFitResult(requirements);
  const now = new Date().toISOString();
  const profile = model.candidateProfile ?? {};
  const baseProfile = context.baseProfile;
  const posting = isRecord(model.jobPosting) ? model.jobPosting : {};
  const companyName = cleanSchemaPlaceholder(
    posting.companyName ?? model.companyName,
    ["회사명", "회사 미확인"],
  );
  const roleTitle = cleanSchemaPlaceholder(
    posting.title ?? model.roleTitle,
    ["공고 직무명", "직무명"],
  );

  return {
    analysisId: crypto.randomUUID(),
    candidateProfile: baseProfile
      ? { ...baseProfile }
      : {
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
    roleTitle,
    companyName,
    summary: asString(model.summary),
    nextAction:
      asString(model.nextAction) ||
      "확실하지 않은 필수 조건부터 확인해보세요.",
    requirements,
    jobPosting: {
      title: roleTitle,
      companyName,
      source:
        cleanSchemaPlaceholder(posting.source, ["출처"]) ||
        sourceFromUrl(context.jobUrl),
      deadline: normalizeDate(posting.deadline),
      responsibilities: stringArray(posting.responsibilities).slice(0, 12),
      requiredQualifications: stringArray(
        posting.requiredQualifications,
      ).slice(0, 12),
      preferredQualifications: stringArray(
        posting.preferredQualifications,
      ).slice(0, 12),
    },
    ...fit,
  };
}

function normalizeRequirement(
  requirement: ModelRequirement,
  index: number,
  context: FitAnalysisContext,
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

  const jobEvidence = evidenceFromSource(
    requirement.jobEvidence,
    context.jobText,
  );
  const profileEvidence = evidenceFromSource(
    requirement.profileEvidence,
    context.candidateText,
  );
  const evidenceSupportsMatch =
    Boolean(jobEvidence) &&
    (match === "missing" || Boolean(profileEvidence));

  return {
    id: `requirement-${index + 1}`,
    text: asString(requirement.text),
    importance,
    match: evidenceSupportsMatch ? match : "uncertain",
    confidence,
    jobEvidence,
    profileEvidence,
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

function cleanSchemaPlaceholder(
  value: unknown,
  placeholders: string[],
): string {
  const text = asString(value);
  return placeholders.includes(text) ? "" : text;
}

function evidenceFromSource(evidence: unknown, source?: string): string {
  const text = asString(evidence);
  if (!source) return text;
  return normalizeEvidence(source).includes(normalizeEvidence(text)) ? text : "";
}

function normalizeEvidence(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function sourceFromUrl(value?: string): string {
  if (!value) return "manual";
  try {
    return new URL(value).hostname;
  } catch {
    return "manual";
  }
}

function normalizeDate(value: unknown): string {
  const text = asString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  return Number.isNaN(Date.parse(`${text}T00:00:00Z`)) ? "" : text;
}
