import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("POST /api/analyze-fit", () => {
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("rejects a request without job and candidate input", async () => {
    const response = await POST(
      new Request("http://localhost/api/analyze-fit", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "invalid_request",
    });
  });

  it("reports missing AI configuration without echoing submitted text", async () => {
    const response = await POST(
      new Request("http://localhost/api/analyze-fit", {
        method: "POST",
        body: JSON.stringify({
          jobText: "공고 내용 ".repeat(20),
          resumeText: "이력서 내용 ".repeat(20),
        }),
        headers: {
          "Content-Type": "application/json",
          "x-companyradar-client": "test-client",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      errorCode: "config_missing",
    });
    expect(JSON.stringify(body)).not.toContain("이력서 내용");
  });

  // ── request-received logging ──────────────────────────────────────────────

  it("logs request-received with text lengths when jobText is provided", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const response = await POST(
      new Request("http://localhost/api/analyze-fit", {
        method: "POST",
        body: JSON.stringify({
          jobText: "공고 내용 ".repeat(20),
          resumeText: "이력서 내용 ".repeat(20),
        }),
        headers: {
          "Content-Type": "application/json",
          "x-companyradar-client": "test-client",
        },
      }),
    );

    expect(response.status).toBe(500); // config_missing — no OPENAI_API_KEY
    const logged = spy.mock.calls.find(
      (args) => typeof args[1] === "object" && (args[1] as Record<string,unknown>).stage === "request-received",
    );
    expect(logged).toBeDefined();
    const entry = logged![1] as Record<string, unknown>;
    expect(typeof entry.jobTextLength).toBe("number");
    expect(entry.jobTextLength).toBeGreaterThan(0);
    expect(typeof entry.resumeTextLength).toBe("number");
    expect(entry.resumeTextLength).toBeGreaterThan(0);
    spy.mockRestore();
  });

  it("never logs resume or job text content in request-received", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await POST(
      new Request("http://localhost/api/analyze-fit", {
        method: "POST",
        body: JSON.stringify({
          jobText: "고유한공고텍스트내용XQZMARKER",
          resumeText: "고유한이력서텍스트내용XQZMARKER",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-companyradar-client": "test-client",
        },
      }),
    );

    const allLogged = spy.mock.calls.map((args) => JSON.stringify(args)).join(" ");
    expect(allLogged).not.toContain("XQZMARKER");
    spy.mockRestore();
  });

  it("logs hasCandidateProfile=true when candidateProfile is supplied", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await POST(
      new Request("http://localhost/api/analyze-fit", {
        method: "POST",
        body: JSON.stringify({
          jobText: "공고 내용 ".repeat(20),
          candidateProfile: {
            targetRole: "Designer",
            yearsExperience: 3,
            skills: [],
            domains: [],
            achievements: [],
            updatedAt: "2026-06-21T00:00:00.000Z",
          },
        }),
        headers: {
          "Content-Type": "application/json",
          "x-companyradar-client": "test-client",
        },
      }),
    );

    const logged = spy.mock.calls.find(
      (args) => typeof args[1] === "object" && (args[1] as Record<string,unknown>).stage === "request-received",
    );
    expect(logged).toBeDefined();
    expect((logged![1] as Record<string, unknown>).hasCandidateProfile).toBe(true);
    spy.mockRestore();
  });

  it("blocks private-network job URLs before making an AI request", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const response = await POST(
      new Request("http://localhost/api/analyze-fit", {
        method: "POST",
        body: JSON.stringify({
          jobUrl: "http://127.0.0.1:3000/private",
          candidateProfile: {
            targetRole: "Frontend Developer",
            yearsExperience: 3,
            skills: ["React"],
            domains: [],
            achievements: [],
            updatedAt: "2026-06-19T00:00:00.000Z",
          },
        }),
        headers: {
          "Content-Type": "application/json",
          "x-companyradar-client": "test-client",
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "url_blocked",
    });
  });
});
