import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SavedJobFullView } from "./SavedJobFullView";
import type { TrackedJobPosting } from "@/lib/job-tracker";

const job: TrackedJobPosting = {
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
  requirements: [
    {
      id: "requirement-1",
      text: "디자인 시스템 경험",
      importance: "required",
      match: "matched",
      confidence: 3,
      jobEvidence: "디자인 시스템 경험",
      profileEvidence: "디자인 시스템 구축",
    },
  ],
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
};

describe("SavedJobFullView", () => {
  it("shows the complete saved analysis and application pipeline", () => {
    const html = renderToStaticMarkup(
      <SavedJobFullView
        job={job}
        onClose={() => undefined}
        onStatusChange={() => undefined}
        updating={false}
      />,
    );

    expect(html).toContain("84");
    expect(html).toContain("근거 충족률 75%");
    expect(html).toContain("회사 정보도 함께 정리했어요");
    expect(html).toContain("디자인 시스템 경험");
    expect(html).toContain("지원 완료");
    expect(html).toContain("공고에서 맡게 될 일");
  });
});
