import { describe, expect, it } from "vitest";
import {
  chooseNewestCandidateProfile,
  parseStoredCandidateProfile,
  parsePendingFitSave,
  serializeCandidateProfile,
  serializePendingFitSave,
} from "./fit-client";

const profile = {
  targetRole: "Frontend Developer",
  yearsExperience: 5,
  skills: ["React", "TypeScript"],
  domains: ["Commerce"],
  achievements: ["결제 전환율 12% 개선"],
  updatedAt: "2026-06-19T00:00:00.000Z",
};

describe("candidate profile persistence", () => {
  it("stores only the structured profile", () => {
    const serialized = serializeCandidateProfile(profile);

    expect(serialized).not.toContain("resumeText");
    expect(parseStoredCandidateProfile(serialized)).toEqual(profile);
  });

  it("ignores malformed or outdated stored values", () => {
    expect(parseStoredCandidateProfile("not-json")).toBeNull();
    expect(
      parseStoredCandidateProfile(
        JSON.stringify({ version: 99, profile }),
      ),
    ).toBeNull();
  });
});

describe("fit save recovery", () => {
  const pending = {
    analysis: {
      analysisId: "analysis-1",
      candidateProfile: profile,
      roleTitle: "Frontend Developer",
      companyName: "Example",
      summary: "요약",
      nextAction: "지원하기",
      requirements: [],
      jobPosting: {
        title: "Frontend Developer",
        companyName: "Example",
        source: "example.com",
        deadline: "",
        responsibilities: [],
        requiredQualifications: [],
        preferredQualifications: [],
      },
      score: 80,
      recommendation: "apply" as const,
      evidenceCoverage: 70,
      missingCriticalCount: 0,
    },
    decision: "planned" as const,
    sourceUrl: "https://example.com/job",
    createdAt: "2026-06-20T00:00:00.000Z",
  };

  it("restores a pending save for 24 hours without raw text", () => {
    const serialized = serializePendingFitSave(pending);
    expect(serialized).not.toContain("resumeText");
    expect(serialized).not.toContain("jobText");
    expect(
      parsePendingFitSave(serialized, Date.parse("2026-06-20T12:00:00.000Z")),
    ).toEqual(pending);
    expect(
      parsePendingFitSave(serialized, Date.parse("2026-06-21T01:00:00.000Z")),
    ).toBeNull();
  });

  it("uses the newest structured candidate profile", () => {
    const remote = { ...profile, updatedAt: "2026-06-20T00:00:00.000Z" };
    expect(chooseNewestCandidateProfile(profile, remote)).toEqual(remote);
  });
});
