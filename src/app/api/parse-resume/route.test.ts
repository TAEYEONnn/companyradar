import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extractResumeText: vi.fn(),
  reserveResumeQuota: vi.fn(),
}));

vi.mock("@/lib/resume-parser", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/resume-parser")>();
  return {
    ...original,
    extractResumeText: mocks.extractResumeText,
  };
});

vi.mock("@/lib/fit-quota", () => ({
  reserveResumeQuota: mocks.reserveResumeQuota,
}));

import { POST } from "./route";

describe("POST /api/parse-resume", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    mocks.extractResumeText.mockResolvedValue(
      "Product designer with seven years of experience in B2B SaaS. Used Figma for product design. Improved conversion by 18 percent.",
    );
    mocks.reserveResumeQuota.mockResolvedValue({
      allowed: true,
      reason: null,
      backend: "supabase",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    targetRole: "Product Designer",
                    yearsExperience: 7,
                    skills: ["Product Design", "Figma", "Invented Skill"],
                    domains: ["B2B SaaS"],
                    achievements: ["Improved conversion by 18 percent"],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns an editable career profile without echoing the file or raw text", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File(["private resume text"], "my-private-resume.txt", {
        type: "text/plain",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
        headers: { "x-companyradar-client": "browser-1" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      profile: {
        targetRole: "Product Designer",
        yearsExperience: 7,
        skills: ["Product Design", "Figma"],
      },
      warnings: [],
    });
    expect(JSON.stringify(body)).not.toContain("my-private-resume.txt");
    expect(JSON.stringify(body)).not.toContain("private resume text");
    expect(JSON.stringify(body)).not.toContain("Invented Skill");
  });

  it("keeps the retryable quota error distinct when both quota stores fail", async () => {
    mocks.reserveResumeQuota.mockResolvedValue({
      allowed: false,
      reason: "quota_unavailable",
      backend: "supabase",
    });
    const form = new FormData();
    form.set("file", new File(["resume content"], "resume.txt"));

    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
        headers: { "x-companyradar-client": "browser-1" },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "quota_unavailable",
    });
    expect(mocks.extractResumeText).not.toHaveBeenCalled();
  });

  it("requires a file", async () => {
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: new FormData(),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "unsupported_file",
    });
  });
});
