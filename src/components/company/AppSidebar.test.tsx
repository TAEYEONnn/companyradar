import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppSidebar } from "./AppSidebar";

describe("AppSidebar", () => {
  it("uses the unified job navigation without the legacy company tab", () => {
    const html = renderToStaticMarkup(
      <AppSidebar
        appliedCount={0}
        badges={{ deadline: 0 }}
        onNavigate={() => undefined}
        onSignOut={() => undefined}
        userEmail="test@example.com"
        viewMode="jobs"
      />,
    );

    expect(html).toContain("지원 현황");
    expect(html).toContain("지원 일정");
    expect(html).not.toContain("회사 정보");
  });
});
