import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extractResumeText: vi.fn(),
  reserveResumeQuota: vi.fn(),
  cancelResumeQuota: vi.fn().mockResolvedValue(undefined),
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
  cancelResumeQuota: mocks.cancelResumeQuota,
}));

import { ResumeParseError } from "@/lib/resume-parser";
import { POST } from "./route";

// Minimal valid PDF binary (%PDF- magic bytes + stub content)
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
function makePdfFile(name = "resume.pdf"): File {
  return new File([PDF_MAGIC], name, { type: "application/pdf" });
}

const RESUME_TEXT =
  "Product designer with seven years of experience in B2B SaaS. Used Figma for product design. Improved conversion by 18 percent.";

const AI_RESPONSE = {
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
};

describe("POST /api/parse-resume", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    mocks.extractResumeText.mockResolvedValue(RESUME_TEXT);
    mocks.reserveResumeQuota.mockResolvedValue({
      allowed: true,
      reason: null,
      backend: "supabase",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(AI_RESPONSE), { status: 200 })),
    );
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("returns an editable career profile without echoing the file or raw text", async () => {
    const form = new FormData();
    form.set("file", makePdfFile("my-private-resume.pdf"));

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
    expect(JSON.stringify(body)).not.toContain("my-private-resume.pdf");
    expect(JSON.stringify(body)).not.toContain(RESUME_TEXT);
    expect(JSON.stringify(body)).not.toContain("Invented Skill");
  });

  it("accepts a PDF with application/pdf MIME type", async () => {
    const form = new FormData();
    form.set("file", new File([PDF_MAGIC], "cv.pdf", { type: "application/pdf" }));
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(200);
  });

  it("accepts a PDF with application/octet-stream MIME when extension + magic bytes are correct", async () => {
    const form = new FormData();
    form.set("file", new File([PDF_MAGIC], "cv.pdf", { type: "application/octet-stream" }));
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(200);
  });

  // ── Missing / invalid file ────────────────────────────────────────────────

  it("returns 400 file_missing when the FormData has no file field", async () => {
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: new FormData(),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "file_missing",
    });
  });

  it("returns 400 unsupported_file for a non-PDF/DOCX/TXT extension", async () => {
    const form = new FormData();
    form.set("file", new File(["data"], "photo.jpg", { type: "image/jpeg" }));
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "unsupported_file",
    });
  });

  it("returns 400 unsupported_file when a .pdf file has wrong magic bytes", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d])], // PNG header
        "not-really.pdf",
        { type: "application/pdf" },
      ),
    );
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "unsupported_file",
    });
  });

  // ── Parse failures → 422 (not 400) ───────────────────────────────────────

  it("returns 422 text_not_found for a scanned PDF with no text layer", async () => {
    mocks.extractResumeText.mockRejectedValue(new ResumeParseError("text_not_found"));
    const form = new FormData();
    form.set("file", makePdfFile());
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "text_not_found",
    });
  });

  it("returns 422 parse_failed when PDF.js cannot parse the file", async () => {
    mocks.extractResumeText.mockRejectedValue(new ResumeParseError("parse_failed"));
    const form = new FormData();
    form.set("file", makePdfFile());
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "parse_failed",
    });
  });

  it("returns 422 encrypted_file for a password-protected PDF", async () => {
    mocks.extractResumeText.mockRejectedValue(new ResumeParseError("encrypted_file"));
    const form = new FormData();
    form.set("file", makePdfFile());
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "encrypted_file",
    });
  });

  it("returns 422 pdf_invalid for a structurally corrupt PDF", async () => {
    mocks.extractResumeText.mockRejectedValue(new ResumeParseError("pdf_invalid"));
    const form = new FormData();
    form.set("file", makePdfFile());
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "pdf_invalid",
    });
  });

  it("returns 422 pdf_worker_failed when the pdfjs worker cannot initialise", async () => {
    mocks.extractResumeText.mockRejectedValue(new ResumeParseError("pdf_worker_failed"));
    const form = new FormData();
    form.set("file", makePdfFile());
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "pdf_worker_failed",
    });
  });

  it("returns 422 pdf_runtime_unsupported when DOMMatrix global is unavailable", async () => {
    mocks.extractResumeText.mockRejectedValue(new ResumeParseError("pdf_runtime_unsupported"));
    const form = new FormData();
    form.set("file", makePdfFile());
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "pdf_runtime_unsupported",
    });
  });

  // ── Quota ─────────────────────────────────────────────────────────────────

  it("returns 503 quota_unavailable when both quota stores fail", async () => {
    mocks.reserveResumeQuota.mockResolvedValue({
      allowed: false,
      reason: "quota_unavailable",
      backend: "supabase",
    });
    const form = new FormData();
    form.set("file", makePdfFile());

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
    // text extraction now runs before quota check (so corrupt files don't consume quota)
    expect(mocks.extractResumeText).toHaveBeenCalled();
  });

  // ── AI failures → 502 (not 400) ──────────────────────────────────────────

  it("returns 502 ai_failed when the AI provider is down — not 400 or 422", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 503 })),
    );
    const form = new FormData();
    form.set("file", makePdfFile());
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "ai_failed",
    });
  });

  it("returns 502 ai_failed when the AI returns unparseable JSON — not 400 or 422", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "not-valid-json{{" } }] }),
          { status: 200 },
        ),
      ),
    );
    const form = new FormData();
    form.set("file", makePdfFile());
    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "ai_failed",
    });
  });

  // ── Security: no sensitive data in error responses ────────────────────────

  it("does not include resume text or file name in any error response body", async () => {
    mocks.extractResumeText.mockRejectedValue(new ResumeParseError("parse_failed"));
    const form = new FormData();
    form.set(
      "file",
      new File([PDF_MAGIC], "confidential-resume.pdf", { type: "application/pdf" }),
    );

    const response = await POST(
      new Request("http://localhost/api/parse-resume", {
        method: "POST",
        body: form,
      }),
    );
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain("confidential-resume.pdf");
    expect(body).not.toContain(RESUME_TEXT);
  });
});
