import { SCORE_CATEGORIES } from "@/lib/criteria";
import { needsCompanyValidation } from "@/lib/company-validation";
import type {
  Company,
  CompanyScoreResult,
  CriteriaSettings,
  EvidenceLevel,
} from "@/lib/types";

export function calculateAverage(values: number[]): number {
  const validValues = values.filter((value) => value > 0);
  if (validValues.length === 0) {
    return 0;
  }

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

export function getRecommendationLabel(
  score: number,
): CompanyScoreResult["recommendationLabel"] {
  if (score >= 4.3) return "적극 지원";
  if (score >= 3.7) return "지원 고려";
  if (score >= 3.0) return "정보 추가 필요";
  return "보류";
}

export function evaluateCompany(
  company: Company,
  settings: CriteriaSettings,
): CompanyScoreResult {
  const weightTotal = Object.values(settings.weights).reduce(
    (sum, weight) => sum + weight,
    0,
  );

  const normalizedWeightTotal = weightTotal > 0 ? weightTotal : 1;

  const categoryScores = SCORE_CATEGORIES.map((category) => {
    const baseAverage = calculateAverage(
      category.items.map((item) => company.scores[category.key]?.[item.id] ?? 0),
    );
    const average =
      category.key === "designGrowth"
        ? applyDesignerFitAdjustment(baseAverage, company)
        : baseAverage;
    const weight = settings.weights[category.key] / normalizedWeightTotal;

    return {
      key: category.key,
      title: category.title,
      average,
      weighted: average * weight,
      weight,
    };
  });

  const companyFitScore = categoryScores.reduce(
    (sum, category) => sum + category.weighted,
    0,
  );
  const riskCount = company.riskFlags.length;
  const averageEvidenceLevel = getAverageEvidenceLevel(company);

  return {
    categoryScores,
    companyFitScore,
    totalScore: companyFitScore,
    recommendationLabel: getRecommendationLabel(companyFitScore),
    highRisk: riskCount >= settings.highRiskThreshold,
    needsValidation: needsCompanyValidation(company),
    averageEvidenceLevel,
    riskCount,
  };
}

export function formatScore(score: number): string {
  return score > 0 ? score.toFixed(1) : "-";
}

function applyDesignerFitAdjustment(baseAverage: number, company: Company): number {
  const checklist = company.designerFit;
  const positiveCount = [
    checklist.hasDesignSystemOpportunity,
    checklist.hasDesignOpsOpportunity,
    checklist.hasComponentOwnership,
    checklist.hasDocumentationCulture,
    checklist.canImproveProcess,
  ].filter(Boolean).length;
  const positiveAdjustment = positiveCount * 0.08;
  const visualOnlyPenalty = checklist.isOnlyVisualProductionRole ? 0.4 : 0;

  return clampScore(baseAverage + positiveAdjustment - visualOnlyPenalty);
}

function getAverageEvidenceLevel(company: Company): number {
  const levels: EvidenceLevel[] = [company.evidenceLevel];

  SCORE_CATEGORIES.forEach((category) => {
    category.items.forEach((item) => {
      levels.push(company.scoreEvidence[category.key]?.[item.id] ?? 1);
    });
  });

  return (
    levels.reduce((sum, level) => sum + level, 0) / Math.max(levels.length, 1)
  );
}

function clampScore(score: number): number {
  return Math.min(5, Math.max(1, score));
}
