import { NextResponse } from "next/server";
import {
  normalizeFitAnalysis,
  parseAnalyzeFitInput,
  type AnalyzeFitInput,
  type ModelFitAnalysis,
} from "@/lib/fit-api";
import { reserveFitQuota, type QuotaReason } from "@/lib/fit-quota";

export const runtime = "nodejs";

const MAX_HTML_BYTES = 500_000;
const MAX_PAGE_CHARS = 20_000;

type ErrorCode =
  | "invalid_request"
  | "config_missing"
  | "quota_exceeded"
  | "quota_unavailable"
  | "url_invalid"
  | "url_blocked"
  | "fetch_failed"
  | "ai_failed"
  | "ai_parse_failed";

export async function POST(request: Request) {
  let input: AnalyzeFitInput;
  try {
    input = parseAnalyzeFitInput(await request.json());
  } catch (error) {
    return apiError(
      400,
      "invalid_request",
      error instanceof Error ? error.message : "요청 형식이 올바르지 않습니다.",
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return apiError(
      500,
      "config_missing",
      "AI 분석 설정이 완료되지 않았습니다.",
    );
  }

  const clientId =
    request.headers.get("x-companyradar-client")?.slice(0, 100) || "anonymous";
  const quota = await reserveFitQuota(request, clientId);
  if (!quota.allowed) {
    return quotaError(quota.reason);
  }

  const jobTextResult = await resolveJobText(input);
  if (!jobTextResult.ok) {
    return apiError(
      jobTextResult.status,
      jobTextResult.errorCode,
      jobTextResult.message,
    );
  }

  try {
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You analyze job fit using only supplied evidence. Never invent experience. Return one valid JSON object without markdown.",
          },
          {
            role: "user",
            content: buildAnalysisPrompt(input, jobTextResult.text),
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!aiResponse.ok) {
      return apiError(
        502,
        "ai_failed",
        aiResponse.status === 429
          ? "AI 요청이 많습니다. 잠시 후 다시 시도해주세요."
          : "AI 분석 요청에 실패했습니다.",
      );
    }

    const data = (await aiResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    let modelAnalysis: ModelFitAnalysis;
    try {
      modelAnalysis = JSON.parse(
        content.replace(/```json|```/g, "").trim(),
      ) as ModelFitAnalysis;
    } catch {
      return apiError(
        502,
        "ai_parse_failed",
        "분석 결과를 해석하지 못했습니다. 다시 시도해주세요.",
      );
    }

    return NextResponse.json({
      ok: true,
      result: normalizeFitAnalysis(modelAnalysis),
    });
  } catch {
    return apiError(
      502,
      "ai_failed",
      "AI 분석 시간이 초과됐습니다. 다시 시도해주세요.",
    );
  }
}

function buildAnalysisPrompt(input: AnalyzeFitInput, jobText: string): string {
  const candidateSource = input.candidateProfile
    ? JSON.stringify(input.candidateProfile)
    : input.resumeText;

  return `아래 채용공고와 지원자 정보를 비교해 JSON 객체만 반환하세요.

규칙:
- 공고의 요구사항을 필수(required)와 우대(preferred)로 구분합니다.
- 각 요구사항의 match는 matched, partial, missing, uncertain 중 하나입니다.
- 지원자 정보에 없는 경험은 missing 또는 uncertain으로 표시합니다.
- jobEvidence와 profileEvidence는 입력에서 직접 확인 가능한 짧은 근거만 사용합니다.
- 요구사항은 최대 12개입니다.
- score와 recommendation은 생성하지 마세요. 서버가 계산합니다.
- nextAction은 가장 중요한 확인 또는 지원 행동 한 문장입니다.

형식:
{
  "candidateProfile": {
    "targetRole": "목표 직무",
    "yearsExperience": 0,
    "skills": ["역량"],
    "domains": ["도메인"],
    "achievements": ["성과"]
  },
  "roleTitle": "공고 직무명",
  "companyName": "회사명",
  "summary": "근거 중심 요약",
  "nextAction": "다음 행동",
  "requirements": [
    {
      "text": "요구사항",
      "importance": "required",
      "match": "matched",
      "confidence": 3,
      "jobEvidence": "공고 근거",
      "profileEvidence": "지원자 근거"
    }
  ]
}

--- 채용공고 ---
${jobText}

--- 지원자 정보 ---
${candidateSource}`;
}

async function resolveJobText(
  input: AnalyzeFitInput,
): Promise<
  | { ok: true; text: string }
  | {
      ok: false;
      status: number;
      errorCode: "url_invalid" | "url_blocked" | "fetch_failed";
      message: string;
    }
> {
  if (input.jobText) return { ok: true, text: input.jobText };

  const blocked = validatePublicUrl(input.jobUrl);
  if (blocked) return blocked;

  try {
    const response = await fetch(input.jobUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; CompanyRadarBot/1.0; job fit analysis)",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: 422,
        errorCode: "fetch_failed",
        message:
          "공고 페이지를 불러오지 못했습니다. 공고 원문을 직접 붙여넣어 주세요.",
      };
    }
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_HTML_BYTES) {
      return {
        ok: false,
        status: 422,
        errorCode: "fetch_failed",
        message: "페이지가 너무 큽니다. 공고 원문을 직접 붙여넣어 주세요.",
      };
    }
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const text = stripHtml(html).slice(0, MAX_PAGE_CHARS);
    if (text.length < 100) {
      return {
        ok: false,
        status: 422,
        errorCode: "fetch_failed",
        message:
          "공고 내용을 충분히 읽지 못했습니다. 공고 원문을 직접 붙여넣어 주세요.",
      };
    }
    return { ok: true, text };
  } catch {
    return {
      ok: false,
      status: 422,
      errorCode: "fetch_failed",
      message:
        "공고 페이지 요청이 실패했습니다. 공고 원문을 직접 붙여넣어 주세요.",
    };
  }
}

function validatePublicUrl(
  rawUrl: string,
):
  | {
      ok: false;
      status: number;
      errorCode: "url_invalid" | "url_blocked";
      message: string;
    }
  | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return {
      ok: false,
      status: 400,
      errorCode: "url_invalid",
      message: "유효한 http(s) 공고 URL을 입력해주세요.",
    };
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return {
      ok: false,
      status: 400,
      errorCode: "url_invalid",
      message: "http(s) 공고 URL만 사용할 수 있습니다.",
    };
  }
  const hostname = url.hostname.toLowerCase();
  const blocked =
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
  if (blocked) {
    return {
      ok: false,
      status: 400,
      errorCode: "url_blocked",
      message: "내부 네트워크 주소는 사용할 수 없습니다.",
    };
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function quotaError(reason: QuotaReason | null) {
  if (reason === "quota_unavailable") {
    return apiError(
      503,
      "quota_unavailable",
      "사용량 확인에 실패했습니다. 잠시 후 다시 시도해주세요.",
    );
  }
  return apiError(
    429,
    "quota_exceeded",
    reason === "global_daily"
      ? "오늘 준비된 전체 AI 분석량을 모두 사용했습니다."
      : reason === "ip_minute"
        ? "요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요."
        : "오늘 무료 분석 10회를 모두 사용했습니다.",
  );
}

function apiError(status: number, errorCode: ErrorCode, error: string) {
  return NextResponse.json({ ok: false, errorCode, error }, { status });
}
