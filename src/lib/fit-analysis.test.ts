import { describe, expect, it } from "vitest";
import {
  calculateFitResult,
  type FitRequirement,
} from "./fit-analysis";

function requirement(
  overrides: Partial<FitRequirement> = {},
): FitRequirement {
  return {
    id: "requirement-1",
    text: "React 기반 제품 개발 경험",
    importance: "required",
    match: "matched",
    confidence: 3,
    jobEvidence: "React 기반 서비스 개발 경험",
    profileEvidence: "React 제품을 3년간 설계하고 출시",
    ...overrides,
  };
}

describe("calculateFitResult", () => {
  it("recommends applying when the weighted score is at least 75 with no critical gap", () => {
    const result = calculateFitResult([
      requirement(),
      requirement({
        id: "preferred",
        importance: "preferred",
        match: "partial",
      }),
    ]);

    expect(result.score).toBe(88);
    expect(result.recommendation).toBe("apply");
  });

  it("requires verification when a critical requirement is uncertain", () => {
    const result = calculateFitResult([
      requirement({ match: "uncertain" }),
      requirement({
        id: "preferred",
        importance: "preferred",
      }),
    ]);

    expect(result.recommendation).toBe("verify");
    expect(result.evidenceCoverage).toBe(50);
  });

  it("suggests considering a pass when two required requirements are missing", () => {
    const result = calculateFitResult([
      requirement({ id: "missing-1", match: "missing" }),
      requirement({ id: "missing-2", match: "missing" }),
      requirement({
        id: "matched-preferred",
        importance: "preferred",
      }),
    ]);

    expect(result.recommendation).toBe("pass");
  });

  it("returns a neutral verification result when no requirements are available", () => {
    expect(calculateFitResult([])).toEqual({
      score: 0,
      recommendation: "verify",
      evidenceCoverage: 0,
      missingCriticalCount: 0,
    });
  });
});
