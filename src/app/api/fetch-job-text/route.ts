import { NextResponse } from "next/server";
import { fetchPublicText, PublicFetchError } from "@/lib/safe-public-fetch";

export const runtime = "nodejs";

type ErrorCode =
  | "invalid_request"
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
  | "fetch_failed";

const SSRF_CODES = new Set<ErrorCode>(["url_invalid", "url_blocked", "blocked_private_address", "redirect_blocked"]);

export async function POST(request: Request) {
  let url = "";
  try {
    const body = (await request.json()) as { url?: unknown };
    url = (typeof body.url === "string" ? body.url : "").trim();
  } catch {
    return apiError(400, "invalid_request", "요청 형식이 올바르지 않습니다.");
  }

  if (!url) {
    return apiError(400, "invalid_request", "URL이 필요합니다.");
  }

  try {
    const text = await fetchPublicText(url, {
      maxBytes: 500_000,
      maxChars: 20_000,
      timeoutMs: 10_000,
      maxRedirects: 3,
    });
    console.log("[fetch-job-text]", { stage: "fetched", textLength: text.length });
    return NextResponse.json({ ok: true, text });
  } catch (error) {
    const rawErrorName = error instanceof Error ? error.name : "UnknownError";
    const rawErrorMessage = error instanceof Error ? error.message : String(error);
    const rawErrorCode =
      error instanceof Error && "code" in error
        ? (error as { code?: string }).code ?? null
        : null;

    const publicError =
      error instanceof PublicFetchError
        ? error
        : new PublicFetchError(
            "fetch_failed",
            "공고 페이지 요청이 실패했습니다. 공고 원문을 직접 붙여넣어 주세요.",
          );

    const status = SSRF_CODES.has(publicError.code as ErrorCode) ? 400 : 422;

    console.warn("[fetch-job-text]", {
      stage: "failed",
      errorCode: publicError.code,
      rawErrorName,
      rawErrorMessage,
      rawErrorCode,
    });

    return NextResponse.json(
      { ok: false, errorCode: publicError.code, error: publicError.message },
      { status },
    );
  }
}

function apiError(status: number, errorCode: ErrorCode, error: string) {
  return NextResponse.json({ ok: false, errorCode, error }, { status });
}
