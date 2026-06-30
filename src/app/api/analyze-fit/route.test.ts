import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createJsonCompletion, getAiProviderConfig } from "@/lib/ai-provider";
import { cancelFitQuota } from "@/lib/fit-quota";

vi.mock("@/lib/fit-quota", () => ({
  reserveFitQuota: vi.fn().mockResolvedValue({ allowed: true, reason: null, backend: "redis" }),
  cancelFitQuota: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/fit-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fit-api")>("@/lib/fit-api");
  return {
    ...actual,
    normalizeFitAnalysis: vi.fn().mockReturnValue({ score: 75, requirements: [] }),
  };
});

// ── helpers ──────────────────────────────────────────────────────────────────

function makeAiResponse(content: string) {
  return {
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
  };
}

function makeAnalyzeRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/analyze-fit", {
    method: "POST",
    body: JSON.stringify({
      jobText: "공고 내용 ".repeat(20),
      resumeText: "이력서 내용 ".repeat(20),
      ...overrides,
    }),
    headers: {
      "Content-Type": "application/json",
      "x-companyradar-client": "test-client",
    },
  });
}

// ── route tests ───────────────────────────────────────────────────────────────

describe("POST /api/analyze-fit", () => {
  afterEach(() => {
    delete process.env.AI_PROVIDER;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.NVIDIA_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
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
    // No NVIDIA_API_KEY set — default provider (nvidia) config check fails
    const response = await POST(makeAnalyzeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      errorCode: "config_missing",
    });
    expect(JSON.stringify(body)).not.toContain("이력서 내용");
  });

  it("logs request-received with text lengths when jobText is provided", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const response = await POST(makeAnalyzeRequest());

    expect(response.status).toBe(500); // config_missing — no NVIDIA_API_KEY (default provider)
    const logged = spy.mock.calls.find(
      (args) => typeof args[1] === "object" && (args[1] as Record<string, unknown>).stage === "request-received",
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
      (args) => typeof args[1] === "object" && (args[1] as Record<string, unknown>).stage === "request-received",
    );
    expect(logged).toBeDefined();
    expect((logged![1] as Record<string, unknown>).hasCandidateProfile).toBe(true);
    spy.mockRestore();
  });

  it("blocks private-network job URLs before making an AI request", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
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

  // ── Route: 쿼터·로그 동작 ────────────────────────────────────────────────────

  describe("Route: 쿼터·로그 동작", () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      vi.stubGlobal("fetch", mockFetch);
      mockFetch.mockResolvedValue(
        makeAiResponse('{"requirements":[],"summary":"테스트","roleTitle":"","companyName":""}'),
      );
    });

    it("사용자 이력서와 공고 내용이 AI 오류 로그에 포함되지 않는다", async () => {
      process.env.NVIDIA_API_KEY = "test-key";
      mockFetch.mockResolvedValue({ ok: false, status: 502, json: () => Promise.resolve({}) });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await POST(
        new Request("http://localhost/api/analyze-fit", {
          method: "POST",
          body: JSON.stringify({
            jobText: "공고고유텍스트SECRETJOB",
            resumeText: "이력서고유텍스트SECRETRESUME",
          }),
          headers: {
            "Content-Type": "application/json",
            "x-companyradar-client": "test-client",
          },
        }),
      );

      const allLogged = [
        ...logSpy.mock.calls,
        ...errSpy.mock.calls,
      ].map((args) => JSON.stringify(args)).join(" ");

      expect(allLogged).not.toContain("SECRETJOB");
      expect(allLogged).not.toContain("SECRETRESUME");

      logSpy.mockRestore();
      errSpy.mockRestore();
    });

    it("JSON 코드펜스가 포함된 응답도 파싱할 수 있다", async () => {
      process.env.NVIDIA_API_KEY = "test-key";
      mockFetch.mockResolvedValue(
        makeAiResponse(
          "```json\n{\"requirements\":[],\"summary\":\"테스트\",\"roleTitle\":\"\",\"companyName\":\"\"}\n```",
        ),
      );

      const response = await POST(makeAnalyzeRequest());
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it("AI 실패 시 예약한 무료 쿼터가 취소된다", async () => {
      process.env.NVIDIA_API_KEY = "test-key";
      mockFetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) });

      await POST(makeAnalyzeRequest());

      expect(cancelFitQuota).toHaveBeenCalled();
    });
  });
});

// ── createJsonCompletion provider behavior ───────────────────────────────────

describe("createJsonCompletion provider behavior", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue(
      makeAiResponse('{"requirements":[]}'),
    );
  });

  afterEach(() => {
    delete process.env.AI_PROVIDER;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.NVIDIA_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("AI_PROVIDER=nvidia일 때 NVIDIA endpoint를 호출한다", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.NVIDIA_API_KEY = "test-nvidia-key";

    await createJsonCompletion({ userPrompt: "test" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      expect.any(Object),
    );
  });

  it("NVIDIA 요청에 NVIDIA_API_KEY가 Authorization 헤더로 들어간다", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.NVIDIA_API_KEY = "nvidia-secret-key";

    await createJsonCompletion({ userPrompt: "test" });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer nvidia-secret-key");
  });

  it("NVIDIA 요청에 NVIDIA_MODEL이 model로 들어간다", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.NVIDIA_API_KEY = "test-key";
    process.env.NVIDIA_MODEL = "custom/test-model";

    await createJsonCompletion({ userPrompt: "test" });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.model).toBe("custom/test-model");
  });

  it("NVIDIA 요청에는 response_format을 넣지 않는다", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.NVIDIA_API_KEY = "test-key";

    await createJsonCompletion({ userPrompt: "test" });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.response_format).toBeUndefined();
  });

  it("NVIDIA 요청에 stream: false가 들어간다", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.NVIDIA_API_KEY = "test-key";

    await createJsonCompletion({ userPrompt: "test" });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.stream).toBe(false);
  });

  it("NVIDIA 응답의 choices[0].message.content를 반환한다", async () => {
    process.env.AI_PROVIDER = "nvidia";
    process.env.NVIDIA_API_KEY = "test-key";
    mockFetch.mockResolvedValue(makeAiResponse('{"hello":"world"}'));

    const result = await createJsonCompletion({ userPrompt: "test" });

    expect(result).toBe('{"hello":"world"}');
  });

  it("AI_PROVIDER=openai일 때 기존 OpenAI endpoint를 호출한다", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-openai-key";

    await createJsonCompletion({ userPrompt: "test" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.any(Object),
    );
  });

  it("API 키가 없으면 실제 fetch 전에 config 오류가 발생한다", async () => {
    // AI_PROVIDER defaults to nvidia; no NVIDIA_API_KEY set

    await expect(createJsonCompletion({ userPrompt: "test" })).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("getAiProviderConfig가 API 키 없이 호출되면 오류를 던진다", () => {
    // No keys set
    expect(() => getAiProviderConfig()).toThrow();
  });
});
