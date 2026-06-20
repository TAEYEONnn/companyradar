export type RequirementImportance = "required" | "preferred";
export type RequirementMatch =
  | "matched"
  | "partial"
  | "missing"
  | "uncertain";
export type FitRecommendation = "apply" | "verify" | "pass";

export interface CompanyOverview {
  industry: string;
  productSummary: string;
  appealPoints: string[];
  greenSignals: string[];
  cautionSignals: string[];
  unknownSignals: string[];
}

export interface CandidateProfile {
  targetRole: string;
  yearsExperience: number | null;
  skills: string[];
  domains: string[];
  achievements: string[];
  updatedAt: string;
}

export interface FitRequirement {
  id: string;
  text: string;
  importance: RequirementImportance;
  match: RequirementMatch;
  confidence: 1 | 2 | 3;
  jobEvidence: string;
  profileEvidence: string;
}

export interface FitResult {
  score: number;
  recommendation: FitRecommendation;
  evidenceCoverage: number;
  missingCriticalCount: number;
}

export interface FitAnalysis extends FitResult {
  analysisId: string;
  candidateProfile: CandidateProfile;
  roleTitle: string;
  companyName: string;
  summary: string;
  nextAction: string;
  requirements: FitRequirement[];
  companyOverview: CompanyOverview | null;
  jobPosting: {
    title: string;
    companyName: string;
    source: string;
    deadline: string;
    responsibilities: string[];
    requiredQualifications: string[];
    preferredQualifications: string[];
  };
}

const MATCH_VALUE: Record<RequirementMatch, number> = {
  matched: 1,
  partial: 0.5,
  uncertain: 0.25,
  missing: 0,
};

const IMPORTANCE_WEIGHT: Record<RequirementImportance, number> = {
  required: 3,
  preferred: 1,
};

export function calculateFitResult(
  requirements: FitRequirement[],
): FitResult {
  if (requirements.length === 0) {
    return {
      score: 0,
      recommendation: "verify",
      evidenceCoverage: 0,
      missingCriticalCount: 0,
    };
  }

  let weightedMatch = 0;
  let totalWeight = 0;

  for (const requirement of requirements) {
    const weight = IMPORTANCE_WEIGHT[requirement.importance];
    weightedMatch += MATCH_VALUE[requirement.match] * weight;
    totalWeight += weight;
  }

  const score = Math.round((weightedMatch / totalWeight) * 100);
  const missingCriticalCount = requirements.filter(
    (requirement) =>
      requirement.importance === "required" &&
      requirement.match === "missing",
  ).length;
  const hasCriticalUncertainty = requirements.some(
    (requirement) =>
      requirement.importance === "required" &&
      requirement.match === "uncertain",
  );
  const supportedCount = requirements.filter(
    (requirement) =>
      requirement.match !== "uncertain" &&
      Boolean(requirement.jobEvidence.trim()) &&
      Boolean(requirement.profileEvidence.trim()),
  ).length;
  const evidenceCoverage = Math.round(
    (supportedCount / requirements.length) * 100,
  );

  let recommendation: FitRecommendation;
  if (missingCriticalCount >= 2 || (score < 45 && !hasCriticalUncertainty)) {
    recommendation = "pass";
  } else if (
    score >= 75 &&
    missingCriticalCount === 0 &&
    !hasCriticalUncertainty
  ) {
    recommendation = "apply";
  } else {
    recommendation = "verify";
  }

  return {
    score,
    recommendation,
    evidenceCoverage,
    missingCriticalCount,
  };
}
