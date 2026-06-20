import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResumeProfileEditor } from "./ResumeProfileEditor";

describe("ResumeProfileEditor", () => {
  it("lets the user review every stored career field before confirmation", () => {
    const html = renderToStaticMarkup(
      <ResumeProfileEditor
        onCancel={() => undefined}
        onChange={() => undefined}
        onConfirm={() => undefined}
        profile={{
          targetRole: "Product Designer",
          yearsExperience: 5,
          skills: ["Figma"],
          domains: ["B2B SaaS"],
          achievements: ["전환율 개선"],
          updatedAt: "2026-06-20T00:00:00.000Z",
        }}
        warnings={[]}
      />,
    );

    expect(html).toContain("목표 직무");
    expect(html).toContain("경력 연차");
    expect(html).toContain("역량");
    expect(html).toContain("경험 도메인");
    expect(html).toContain("주요 성과");
    expect(html).toContain("이 내용으로 분석하기");
  });
});
