import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FitAnalyzerApp } from "./FitAnalyzerApp";

describe("FitAnalyzerApp", () => {
  it("leads with the decision job and keeps the legacy tracker secondary", () => {
    const html = renderToStaticMarkup(<FitAnalyzerApp />);

    expect(html).toContain("이 공고, 지원할지 5분 안에 결정하세요");
    expect(html).toContain("이력서 원문은 저장하지 않습니다");
    expect(html).toContain('href="/tracker"');
  });
});
