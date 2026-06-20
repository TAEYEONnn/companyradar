import { describe, expect, it } from "vitest";
import {
  canonicalizeJobUrl,
  isJobApplicationStatus,
  isJobDecision,
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
});
