import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/server-auth", () => ({
  requireSupabaseUser: vi.fn(async () => ({
    user: {
      id: "user-1",
      accessToken: "token",
      email: "test@example.com",
    },
  })),
  createSupabaseUserClient: vi.fn(() => ({ rpc })),
}));

import { POST } from "./route";

describe("POST /api/fit-results", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({
      data: {
        jobPostingId: "job-1",
        duplicate: false,
        decision: "planned",
        applicationStatus: "planned",
      },
      error: null,
    });
  });

  it("stores structured analysis without resume or job raw text", async () => {
    const payload = {
      sourceUrl: "https://example.com/jobs/1?utm_source=test",
      decision: "planned",
      jobPosting: {
        title: "Frontend Developer",
        companyName: "Example",
        source: "example.com",
        deadline: "",
        responsibilities: ["제품 개발"],
        requiredQualifications: ["React"],
        preferredQualifications: [],
      },
      analysis: {
        analysisId: "analysis-1",
        candidateProfile: {
          targetRole: "Frontend Developer",
          yearsExperience: 4,
          skills: ["React"],
          domains: [],
          achievements: [],
          updatedAt: "2026-06-20T00:00:00.000Z",
        },
        roleTitle: "Frontend Developer",
        companyName: "Example",
        summary: "근거 중심 요약",
        nextAction: "지원서를 준비하세요.",
        score: 80,
        recommendation: "apply",
        evidenceCoverage: 70,
        missingCriticalCount: 0,
        requirements: [
          {
            id: "requirement-1",
            text: "React 경험",
            importance: "required",
            match: "matched",
            confidence: 3,
            jobEvidence: "React 기반 개발",
            profileEvidence: "React 프로젝트",
          },
        ],
        jobPosting: {
          title: "Frontend Developer",
          companyName: "Example",
          source: "example.com",
          deadline: "",
          responsibilities: ["제품 개발"],
          requiredQualifications: ["React"],
          preferredQualifications: [],
        },
      },
    };

    const response = await POST(
      new Request("http://localhost/api/fit-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledOnce();
    const rpcPayload = rpc.mock.calls[0][1];
    expect(rpcPayload.p_job_posting.canonicalUrl).toBe(
      "https://example.com/jobs/1",
    );
    expect(JSON.stringify(rpcPayload)).not.toContain("resumeText");
    expect(JSON.stringify(rpcPayload)).not.toContain("jobText");
  });

  it("rejects an unsupported decision", async () => {
    const response = await POST(
      new Request("http://localhost/api/fit-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis: { analysisId: "analysis-1" },
          jobPosting: {},
          decision: "applied",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
