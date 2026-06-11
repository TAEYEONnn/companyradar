import { SCORE_CATEGORIES } from "@/lib/criteria";
import type { Company, CompanyScoreResult, CriteriaSettings } from "@/lib/types";

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
    const average = calculateAverage(
      category.items.map((item) => company.scores[category.key]?.[item.id] ?? 0),
    );
    const weight = settings.weights[category.key] / normalizedWeightTotal;

    return {
      key: category.key,
      title: category.title,
      average,
      weighted: average * weight,
      weight,
    };
  });

  const totalScore = categoryScores.reduce(
    (sum, category) => sum + category.weighted,
    0,
  );
  const riskCount = company.riskFlags.length;

  return {
    categoryScores,
    totalScore,
    recommendationLabel: getRecommendationLabel(totalScore),
    highRisk: riskCount >= settings.highRiskThreshold,
    riskCount,
  };
}

export function formatScore(score: number): string {
  return score > 0 ? score.toFixed(1) : "-";
}
