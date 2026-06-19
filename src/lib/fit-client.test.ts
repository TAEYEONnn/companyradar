import { describe, expect, it } from "vitest";
import {
  parseStoredCandidateProfile,
  serializeCandidateProfile,
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
