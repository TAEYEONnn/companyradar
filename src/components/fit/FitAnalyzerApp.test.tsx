import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FitAnalyzerApp } from "./FitAnalyzerApp";

describe("FitAnalyzerApp", () => {
  it("leads with the decision job and keeps the legacy tracker secondary", () => {
    const html = renderToStaticMarkup(<FitAnalyzerApp />);

    expect(html).toContain("이 공고, 나랑 얼마나 맞을까?");
    expect(html).toContain("PDF, DOCX, TXT");
    expect(html).toContain("텍스트로 직접 입력");
    expect(html).toContain('href="/tracker"');
  });
});
