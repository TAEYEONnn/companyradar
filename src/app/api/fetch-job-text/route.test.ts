import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchPublicText: vi.fn(),
}));

vi.mock("@/lib/safe-public-fetch", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/safe-public-fetch")>();
  return { ...original, fetchPublicText: mocks.fetchPublicText };
});

import { PublicFetchError } from "@/lib/safe-public-fetch";
import { POST } from "./route";

const JOB_TEXT =
  "프로덕트 매니저 채용. 5년 이상의 B2B SaaS 경험. Figma와 SQL 활용 가능자 우대. 서비스 전략 수립 및 로드맵 관리 업무를 담당합니다.";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/fetch-job-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/fetch-job-text", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("returns extracted text when fetchPublicText succeeds", async () => {
    mocks.fetchPublicText.mockResolvedValue(JOB_TEXT);

    const response = await POST(makeRequest({ url: "https://example.com/job/1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, text: JOB_TEXT });
  });

  it("does not echo the URL or job text in error responses", async () => {
    mocks.fetchPublicText.mockRejectedValue(
      new PublicFetchError("fetch_failed", "공고 페이지 요청이 실패했습니다."),
    );
    const sensitiveUrl = "https://company-internal.example.com/secret-job";
    const response = await POST(makeRequest({ url: sensitiveUrl }));
    const raw = JSON.stringify(await response.json());

    expect(raw).not.toContain("secret-job");
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it("returns 400 when url is missing", async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "invalid_request",
    });
  });

  it("returns 400 when url is empty string", async () => {
    const response = await POST(makeRequest({ url: "   " }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "invalid_request",
    });
  });

  it("returns 400 when request body is not JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/fetch-job-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "invalid_request",
    });
  });

  // ── PublicFetchError mapping ───────────────────────────────────────────────

  it("returns 400 for url_blocked errors", async () => {
    mocks.fetchPublicText.mockRejectedValue(
      new PublicFetchError("url_blocked", "내부 네트워크 주소는 사용할 수 없습니다."),
    );
    const response = await POST(makeRequest({ url: "http://192.168.0.1/job" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "url_blocked",
    });
  });

  it("returns 400 for url_invalid errors", async () => {
    mocks.fetchPublicText.mockRejectedValue(
      new PublicFetchError("url_invalid", "유효한 http(s) URL을 입력해주세요."),
    );
    const response = await POST(makeRequest({ url: "ftp://bad.url" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "url_invalid",
    });
  });

  it("returns 422 for url_content_not_found (SPA with no text layer)", async () => {
    mocks.fetchPublicText.mockRejectedValue(
      new PublicFetchError(
        "url_content_not_found",
        "공고 내용을 충분히 읽지 못했습니다.",
      ),
    );
    const response = await POST(
      makeRequest({ url: "https://www.wanted.co.kr/wd/368995" }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "url_content_not_found",
    });
  });

  it("returns 422 for url_timeout", async () => {
    mocks.fetchPublicText.mockRejectedValue(
      new PublicFetchError("url_timeout", "요청 시간이 초과됐습니다."),
    );
    const response = await POST(
      makeRequest({ url: "https://slow.example.com/job" }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "url_timeout",
    });
  });

  it("returns 422 for url_access_denied (login-gated page)", async () => {
    mocks.fetchPublicText.mockRejectedValue(
      new PublicFetchError("url_access_denied", "로그인이 필요합니다."),
    );
    const response = await POST(
      makeRequest({ url: "https://private.example.com/job" }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "url_access_denied",
    });
  });

  it("returns 422 for unknown fetch errors", async () => {
    mocks.fetchPublicText.mockRejectedValue(new Error("network failure"));
    const response = await POST(
      makeRequest({ url: "https://example.com/job" }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "fetch_failed",
    });
  });

  // ── Text is not logged ────────────────────────────────────────────────────

  it("logs textLength but never the job text content", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.fetchPublicText.mockResolvedValue(JOB_TEXT);

    await POST(makeRequest({ url: "https://example.com/job/1" }));

    const logged = spy.mock.calls.map((args) => JSON.stringify(args)).join(" ");
    expect(logged).toContain("textLength");
    expect(logged).not.toContain("프로덕트 매니저 채용");
    spy.mockRestore();
  });
});
