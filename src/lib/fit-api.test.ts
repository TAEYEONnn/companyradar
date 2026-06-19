import { describe, expect, it } from "vitest";
import {
  normalizeFitAnalysis,
  parseAnalyzeFitInput,
} from "./fit-api";

describe("parseAnalyzeFitInput", () => {
  it("requires a job source and candidate source", () => {
    expect(() => parseAnalyzeFitInput({})).toThrow(
      "공고 URL 또는 공고 원문을 입력해주세요.",
    );
    expect(() =>
      parseAnalyzeFitInput({ jobText: "a".repeat(100) }),
    ).toThrow("이력서 또는 저장된 프로필이 필요합니다.");
  });

  it("trims text and limits confidence to the supported range", () => {
    const input = parseAnalyzeFitInput({
      jobText: `  ${"공고 ".repeat(30)} `,
      resumeText: `  ${"경력 ".repeat(30)} `,
      confidenceBefore: 9,
    });

    expect(input.jobText.startsWith("공고")).toBe(true);
    expect(input.resumeText.startsWith("경력")).toBe(true);
    expect(input.confidenceBefore).toBe(5);
  });
});

describe("normalizeFitAnalysis", () => {
  it("ignores the model score and calculates the recommendation from requirements", () => {
    const result = normalizeFitAnalysis({
      candidateProfile: {
        targetRole: "Product Manager",
        yearsExperience: 4,
        skills: ["제품 전략"],
        domains: ["B2B"],
        achievements: ["전환율 개선"],
      },
      roleTitle: "Senior Product Manager",
      companyName: "Example",
      summary: "핵심 경험이 대체로 맞습니다.",
      nextAction: "지원서를 작성하세요.",
      score: 100,
      requirements: [
        {
          text: "8년 이상 경력",
          importance: "required",
          match: "missing",
          confidence: 3,
          jobEvidence: "8년 이상 경력",
          profileEvidence: "4년 경력",
        },
        {
          text: "영어 협업",
          importance: "required",
          match: "missing",
          confidence: 2,
          jobEvidence: "영어 커뮤니케이션",
          profileEvidence: "",
        },
      ],
    });

    expect(result.score).toBe(0);
    expect(result.recommendation).toBe("pass");
    expect(result.candidateProfile.updatedAt).toMatch(/T/);
    expect(result.requirements[0].id).toBe("requirement-1");
  });
});
