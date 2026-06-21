import { describe, expect, it } from "vitest";
import {
  canonicalizeJobUrl,
  isJobApplicationStatus,
  isJobDecision,
  normalizeApplicationEvent,
  normalizeTrackedJobPosting,
  scoreBand,
} from "@/lib/job-tracker";

describe("job tracker helpers", () => {
  it("canonicalizes URLs for duplicate prevention", () => {
    expect(
      canonicalizeJobUrl(
        "https://example.com/jobs/1/?utm_source=test&ref=mail#apply",
      ),
    ).toBe("https://example.com/jobs/1");
  });

  it("validates decisions and application statuses", () => {
    expect(isJobDecision("planned")).toBe(true);
    expect(isJobDecision("applied")).toBe(false);
    expect(isJobApplicationStatus("applied")).toBe(true);
    expect(isJobApplicationStatus("pass")).toBe(false);
  });

  it("groups scores without leaking raw analysis data to analytics", () => {
    expect(scoreBand(80)).toBe("high");
    expect(scoreBand(60)).toBe("medium");
    expect(scoreBand(20)).toBe("low");
  });

  it("keeps the saved company overview and structured job details", () => {
    const job = normalizeTrackedJobPosting({
      id: "job-1",
      companyName: "레이더",
      title: "프로덕트 디자이너",
      canonicalUrl: "https://example.com/jobs/1",
      source: "example.com",
      deadline: "2026-07-01",
      lastCheckedAt: "2026-06-21T00:00:00.000Z",
      decision: "planned",
      applicationStatus: "applied",
      analysisId: "analysis-1",
      recommendation: "apply",
      score: 84,
      evidenceCoverage: 75,
      summary: "핵심 경험이 잘 맞아요.",
      nextAction: "포트폴리오를 공고에 맞게 정리해보세요.",
      requirements: [],
      companyOverview: {
        industry: "B2B SaaS",
        productSummary: "채용팀을 위한 업무 도구",
        appealPoints: ["제품 주도 조직"],
        greenSignals: ["디자인 시스템 경험 우대"],
        cautionSignals: [],
        unknownSignals: ["팀 규모"],
      },
      structuredData: {
        responsibilities: ["제품 개선"],
        requiredQualifications: ["경력 3년"],
        preferredQualifications: ["B2B 경험"],
      },
      createdAt: "2026-06-21T00:00:00.000Z",
      updatedAt: "2026-06-21T00:00:00.000Z",
    });

    expect(job.companyOverview?.industry).toBe("B2B SaaS");
    expect(job.structuredData?.responsibilities).toEqual(["제품 개선"]);
    expect(job.evidenceCoverage).toBe(75);
  });

  it("maps a saved application event into the timeline model", () => {
    expect(
      normalizeApplicationEvent({
        id: "event-1",
        job_posting_id: "job-1",
        event_type: "status_changed",
        from_status: "planned",
        to_status: "applied",
        company_name: "레이더",
        job_title: "프로덕트 디자이너",
        note: null,
        occurred_at: "2026-06-21T09:00:00.000Z",
      }),
    ).toEqual({
      id: "event-1",
      jobPostingId: "job-1",
      eventType: "status_changed",
      fromStatus: "planned",
      toStatus: "applied",
      companyName: "레이더",
      jobTitle: "프로덕트 디자이너",
      note: "",
      occurredAt: "2026-06-21T09:00:00.000Z",
    });
  });
});
