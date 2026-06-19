import { afterEach, describe, expect, it } from "vitest";
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
