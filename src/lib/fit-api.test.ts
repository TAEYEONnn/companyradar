import { describe, expect, it } from "vitest";
import {
  getOpenAIErrorMessage,
  normalizeFitAnalysis,
  parseAnalyzeFitInput,
} from "./fit-api";

describe("parseAnalyzeFitInput", () => {
  it("requires a job source and candidate source", () => {
    expect(() => parseAnalyzeFitInput({})).toThrow(
      "공고 URL이나 공고 내용을 넣어주세요.",
    );
    expect(() =>
      parseAnalyzeFitInput({ jobText: "a".repeat(100) }),
    ).toThrow("이력서를 올리거나 저장된 프로필을 선택해주세요.");
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

  it("removes schema placeholder labels when the source does not identify a company", () => {
    const result = normalizeFitAnalysis({
      companyName: "회사명",
      roleTitle: "공고 직무명",
      requirements: [],
    });

    expect(result.companyName).toBe("");
    expect(result.roleTitle).toBe("");
  });

  it("handles malformed requirement containers without throwing", () => {
    const result = normalizeFitAnalysis({
      requirements: { unexpected: true } as never,
    });

    expect(result.requirements).toEqual([]);
    expect(result.recommendation).toBe("verify");
  });

  it("preserves an existing profile instead of replacing it with incomplete model output", () => {
    const existingProfile = {
      targetRole: "Frontend Developer",
      yearsExperience: 5,
      skills: ["React", "TypeScript"],
      domains: ["B2B SaaS"],
      achievements: ["전환율 개선"],
      updatedAt: "2026-06-18T00:00:00.000Z",
    };
    const result = normalizeFitAnalysis(
      {
        candidateProfile: {
          targetRole: "",
          skills: [],
          domains: [],
          achievements: [],
        },
        requirements: [],
      },
      { baseProfile: existingProfile },
    );

    expect(result.candidateProfile).toMatchObject(existingProfile);
  });

  it("downgrades a claimed match when its evidence is absent from the submitted text", () => {
    const result = normalizeFitAnalysis(
      {
        requirements: [
          {
            text: "React 경험",
            importance: "required",
            match: "matched",
            confidence: 3,
            jobEvidence: "React 경험",
            profileEvidence: "존재하지 않는 경력",
          },
        ],
      },
      {
        jobText: "필수요건 React 경험",
        candidateText: "TypeScript 제품 개발 경험",
      },
    );

    expect(result.requirements[0].match).toBe("uncertain");
    expect(result.requirements[0].profileEvidence).toBe("");
    expect(result.recommendation).toBe("verify");
  });
});

describe("getOpenAIErrorMessage", () => {
  it("keeps authentication, quota, and generic provider failures distinct", () => {
    expect(getOpenAIErrorMessage(401)).toContain("설정");
    expect(getOpenAIErrorMessage(429)).toContain("요청");
    expect(getOpenAIErrorMessage(400)).toContain("400");
  });
});
