import { NextResponse } from "next/server";
import { fetchPublicText, PublicFetchError } from "@/lib/safe-public-fetch";

export const runtime = "nodejs";

type ErrorCode =
  | "invalid_request"
  | "url_invalid"
  | "url_blocked"
  | "url_timeout"
  | "url_access_denied"
  | "url_content_not_found"
  | "fetch_failed";

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
    const publicError =
      error instanceof PublicFetchError
        ? error
        : new PublicFetchError(
            "fetch_failed",
            "공고 페이지 요청이 실패했습니다. 공고 원문을 직접 붙여넣어 주세요.",
          );
    const status =
      publicError.code === "url_invalid" || publicError.code === "url_blocked"
        ? 400
        : 422;
    console.warn("[fetch-job-text]", {
      stage: "failed",
      errorCode: publicError.code,
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
