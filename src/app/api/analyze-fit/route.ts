import { NextResponse } from "next/server";
import {
  getOpenAIErrorMessage,
  normalizeFitAnalysis,
  parseAnalyzeFitInput,
  type AnalyzeFitInput,
  type ModelFitAnalysis,
} from "@/lib/fit-api";
import { reserveFitQuota, type QuotaReason } from "@/lib/fit-quota";
import {
  authorizeAiRequest,
  consumeAiCredit,
} from "@/lib/server-ai-entitlements";
import {
  fetchPublicText,
  PublicFetchError,
} from "@/lib/safe-public-fetch";
import { USER_COPY } from "@/lib/user-copy";

export const runtime = "nodejs";

const MAX_HTML_BYTES = 500_000;
const MAX_PAGE_CHARS = 20_000;

type ErrorCode =
  | "invalid_request"
  | "config_missing"
  | "quota_exceeded"
  | "quota_unavailable"
  | "auth_required"
  | "payment_required"
  | "forbidden"
  | "url_invalid"
  | "url_blocked"
  | "blocked_private_address"
  | "dns_failed"
  | "remote_timeout"
  | "remote_connection_failed"
  | "remote_tls_failed"
  | "remote_http_forbidden"
  | "remote_http_rate_limited"
  | "remote_http_error"
  | "redirect_limit_exceeded"
  | "redirect_blocked"
  | "response_too_large"
  | "decompression_failed"
  | "url_timeout"
  | "url_access_denied"
  | "url_content_not_found"
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

  console.log("[analyze-fit]", {
    stage: "request-received",
    hasJobUrl: Boolean(input.jobUrl),
    hasJobText: Boolean(input.jobText),
    jobTextLength: input.jobText?.length ?? 0,
    resumeTextLength: input.resumeText?.length ?? 0,
    hasCandidateProfile: Boolean(input.candidateProfile),
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return apiError(
      500,
      "config_missing",
      "AI 분석 설정이 완료되지 않았습니다.",
    );
  }

  const jobTextResult = await resolveJobText(input);
  if (!jobTextResult.ok) {
    return apiError(
      jobTextResult.status,
      jobTextResult.errorCode,
      jobTextResult.message,
    );
  }

  const hasBearer = /^Bearer\s+\S+/i.test(
    request.headers.get("authorization") ?? "",
  );
  const authorized = hasBearer
    ? await authorizeAiRequest(request, "analyze-fit")
    : null;
  if (authorized?.response) {
    const payload = (await authorized.response.clone().json()) as {
      error?: { code?: string; message?: string };
    };
    return apiError(
      authorized.response.status,
      normalizeAuthErrorCode(payload.error?.code),
      payload.error?.message ?? "AI 분석 권한을 확인하지 못했습니다.",
    );
  }

  if (!authorized?.user) {
    const clientId =
      request.headers.get("x-companyradar-client")?.slice(0, 100) ||
      "anonymous";
    const quota = await reserveFitQuota(request, clientId);
    console.info("[ai-quota]", {
      feature: "analyze-fit",
      backend: quota.backend ?? "unknown",
      status: quota.reason ? "rejected" : "reserved",
      errorCode: quota.reason,
    });
    if (!quota.allowed) {
      return quotaError(quota.reason);
    }
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
      const providerBody = (await aiResponse.json().catch(() => null)) as {
        error?: { code?: string; type?: string };
      } | null;
      console.error("analyze-fit OpenAI error", {
        status: aiResponse.status,
        code: providerBody?.error?.code,
        type: providerBody?.error?.type,
      });
      return apiError(
        502,
        "ai_failed",
        getOpenAIErrorMessage(aiResponse.status),
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

    const result = normalizeFitAnalysis(modelAnalysis, {
      baseProfile: input.candidateProfile,
      jobText: jobTextResult.text,
      jobUrl: input.jobUrl,
      candidateText: input.candidateProfile
        ? JSON.stringify(input.candidateProfile)
        : input.resumeText,
    });

    if (authorized?.user) {
      try {
        await consumeAiCredit(
          authorized.user,
          "analyze-fit",
          authorized.entitlement,
        );
      } catch {
        return apiError(
          503,
          "quota_unavailable",
          "AI 사용량 처리에 실패했습니다. 다시 시도해주세요.",
        );
      }
    }

    return NextResponse.json({
      ok: true,
      result,
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
- summary와 nextAction은 짧고 자연스러운 한국어 존댓말로 씁니다.
- "대체로 연결됩니다", "검토가 필요합니다" 같은 보고서 말투와 과한 AI식 표현을 피합니다.
- companyOverview는 외부 정보를 사용하지 않고 공고 내용에서만 확인되는 내용만 작성합니다.
- companyOverview의 빈 항목은 빈 배열 또는 빈 문자열로 남깁니다.

형식:
{
  "candidateProfile": {
    "targetRole": "목표 직무",
    "yearsExperience": 0,
    "skills": ["역량"],
    "domains": ["도메인"],
    "achievements": ["성과"]
  },
  "roleTitle": "공고 직무명 (알 수 없으면 빈 문자열)",
  "companyName": "회사명 (알 수 없으면 빈 문자열)",
  "summary": "근거 중심 요약",
  "nextAction": "다음 행동",
  "companyOverview": {
    "industry": "공고에서 확인되는 업종 (예: 핀테크, B2B SaaS, 커머스)",
    "productSummary": "공고에서 확인되는 제품·서비스 요약 1-2문장",
    "appealPoints": ["공고에서 확인되는 지원 매력 포인트"],
    "greenSignals": ["공고에서 확인되는 긍정 신호"],
    "cautionSignals": ["공고에서 확인되는 주의 신호"],
    "unknownSignals": ["공고에서 확인이 필요한 항목"]
  },
  "jobPosting": {
    "title": "공고 제목 또는 직무명",
    "companyName": "회사명",
    "source": "채용 페이지 출처",
    "deadline": "YYYY-MM-DD 또는 빈 문자열",
    "responsibilities": ["주요 업무"],
    "requiredQualifications": ["필수 요건"],
    "preferredQualifications": ["우대 요건"]
  },
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
      errorCode: ErrorCode;
      message: string;
    }
> {
  if (input.jobText) return { ok: true, text: input.jobText };

  try {
    const text = await fetchPublicText(input.jobUrl, {
      maxBytes: MAX_HTML_BYTES,
      maxChars: MAX_PAGE_CHARS,
      timeoutMs: 10_000,
      maxRedirects: 3,
    });
    return { ok: true, text };
  } catch (error) {
    const publicError =
      error instanceof PublicFetchError
        ? error
        : new PublicFetchError(
            "fetch_failed",
            "공고 페이지 요청이 실패했습니다. 공고 원문을 직접 붙여넣어 주세요.",
          );
    const ssrfCodes = new Set(["url_invalid", "url_blocked", "blocked_private_address", "redirect_blocked"]);
    const status = ssrfCodes.has(publicError.code) ? 400 : 422;
    return {
      ok: false,
      status,
      errorCode: publicError.code,
      message: publicError.message,
    };
  }
}

function quotaError(reason: QuotaReason | null) {
  if (reason === "quota_unavailable") {
    return apiError(
      503,
      "quota_unavailable",
      USER_COPY.ai.unavailable,
    );
  }
  return apiError(
    429,
    "quota_exceeded",
    reason === "global_daily"
      ? "오늘 준비된 전체 AI 분석량을 모두 사용했습니다."
      : reason === "ip_minute"
        ? "요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요."
      : USER_COPY.ai.quotaExceeded,
  );
}

function apiError(status: number, errorCode: ErrorCode, error: string) {
  return NextResponse.json({ ok: false, errorCode, error }, { status });
}

function normalizeAuthErrorCode(
  value?: string,
): "auth_required" | "payment_required" | "forbidden" | "quota_unavailable" {
  if (value === "auth_required") return "auth_required";
  if (value === "payment_required") return "payment_required";
  if (value === "forbidden") return "forbidden";
  return "quota_unavailable";
}
