import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_HTML_BYTES = 500_000;
const MAX_PAGE_CHARS = 12_000;
const MAX_RAW_TEXT_CHARS = 20_000;

type ErrorCode =
  | "auth_required"
  | "invalid_request"
  | "url_invalid"
  | "url_blocked"
  | "fetch_failed"
  | "text_extraction_failed"
  | "ai_failed"
  | "ai_parse_failed"
  | "config_missing";

interface ParsedSignal {
  label: string;
  reason: string;
  evidenceText: string;
  confidence: 1 | 2 | 3;
}

interface ParsedSignals {
  greenFlags: ParsedSignal[];
  redFlags: ParsedSignal[];
  unknowns: ParsedSignal[];
}

interface ParsedJobPost {
  name?: string;
  industry?: string;
  productDescription?: string;
  jobDeadline?: string;
  candidateReason?: string;
  signals?: ParsedSignals;
}

export async function POST(request: Request) {
  // 1. Auth — require valid Supabase session token
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!accessToken) {
    return apiError("로그인이 필요합니다.", "auth_required", 401);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false },
      });
      const { data, error: authError } = await client.auth.getUser();
      if (authError || !data.user) {
        return apiError("로그인이 필요합니다.", "auth_required", 401);
      }
    } catch {
      return apiError("인증 확인에 실패했습니다.", "auth_required", 401);
    }
  }

  // 2. Parse body
  let url = "";
  let rawText = "";
  try {
    const body = (await request.json()) as { url?: string; rawText?: string };
    url = (body.url ?? "").trim();
    rawText = (body.rawText ?? "").trim().slice(0, MAX_RAW_TEXT_CHARS);
  } catch {
    return apiError("요청 형식이 올바르지 않습니다.", "invalid_request");
  }

  if (!url && !rawText) {
    return apiError("URL 또는 공고 텍스트를 입력해주세요.", "invalid_request");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return apiError("AI 분석 중 서버 오류가 발생했습니다.", "config_missing");
  }

  // 3. Resolve page text — URL fetch or raw text fallback
  let pageText = "";

  if (url) {
    if (!/^https?:\/\//i.test(url)) {
      return apiError("http(s)로 시작하는 URL을 입력해주세요.", "url_invalid");
    }
    const blocked = validatePublicUrl(url);
    if (blocked) {
      return apiError(blocked, "url_blocked");
    }

    try {
      const pageResponse = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CareerTrackerBot/1.0; personal job tracker)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!pageResponse.ok) {
        return apiError(
          `공고 페이지를 불러오지 못했습니다 (HTTP ${pageResponse.status}). 로그인 필요 페이지라면 텍스트를 직접 붙여넣어 주세요.`,
          "fetch_failed",
        );
      }
      const contentLength = pageResponse.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_HTML_BYTES) {
        return apiError(
          "페이지 크기가 너무 큽니다. 텍스트를 직접 붙여넣어 주세요.",
          "fetch_failed",
        );
      }
      // Stream with size guard
      const reader = pageResponse.body?.getReader();
      if (!reader) throw new Error("no body");
      let html = "";
      let total = 0;
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_HTML_BYTES) {
          reader.cancel();
          break;
        }
        html += decoder.decode(value, { stream: true });
      }
      pageText = stripHtml(html).slice(0, MAX_PAGE_CHARS);
    } catch {
      return apiError(
        "공고 페이지 요청이 실패했거나 시간이 초과됐습니다. 텍스트를 직접 붙여넣어 주세요.",
        "fetch_failed",
      );
    }

    if (pageText.trim().length < 100) {
      if (rawText.length >= 100) {
        // URL 파싱 실패 시 함께 제출한 raw text로 fallback
        pageText = rawText;
      } else {
        return apiError(
          "페이지에서 텍스트를 충분히 추출하지 못했습니다 (JS 렌더링 페이지일 수 있어요). 공고 내용을 직접 붙여넣어 주세요.",
          "text_extraction_failed",
        );
      }
    }
  } else {
    if (rawText.trim().length < 50) {
      return apiError(
        "공고 텍스트가 너무 짧습니다. 더 많은 내용을 붙여넣어 주세요.",
        "invalid_request",
      );
    }
    pageText = rawText;
  }

  // 4. AI structured parsing
  try {
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You extract structured job post information for a personal career tracker. Return only a valid JSON object.",
          },
          {
            role: "user",
            content: `다음은 채용공고 페이지의 텍스트입니다. 아래 JSON 형식으로만 응답하세요. 마크다운 백틱이나 설명 없이 JSON 객체만 출력합니다.

규칙:
- signals: 원문에 근거가 있을 때만 greenFlags/redFlags에 추가. 원문에 없는 추론은 unknowns에 넣을 것.
- evidenceText: 판단 근거가 된 원문 발췌 (20~80자). 근거 없으면 빈 문자열.
- confidence: 명확한 근거 3, 암시적 2, 불분명 1.
- 각 그룹 최대 4개. 신호가 없으면 빈 배열.
- 알 수 없는 필드는 빈 문자열.

{
  "name": "회사명",
  "industry": "산업군 (예: B2B SaaS, Fintech)",
  "productDescription": "제품/서비스 한두 문장 요약",
  "jobDeadline": "마감일 YYYY-MM-DD (상시채용이면 빈 문자열)",
  "candidateReason": "이 공고에서 프로덕트 디자이너에게 매력적인 포인트 한 문장",
  "signals": {
    "greenFlags": [
      {"label": "신호 라벨", "reason": "왜 긍정적인지 한 문장", "evidenceText": "원문 발췌", "confidence": 2}
    ],
    "redFlags": [
      {"label": "신호 라벨", "reason": "왜 부정적인지 한 문장", "evidenceText": "원문 발췌", "confidence": 2}
    ],
    "unknowns": [
      {"label": "확인 필요 항목", "reason": "왜 불분명한지 한 문장", "evidenceText": "", "confidence": 1}
    ]
  }
}

--- 공고 텍스트 ---
${pageText}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 401) {
        return apiError("OpenAI API 키가 없거나 유효하지 않습니다.", "ai_failed");
      }
      if (aiResponse.status === 429) {
        return apiError(
          "OpenAI API 사용량 또는 요청 제한에 걸렸습니다. 잠시 후 다시 시도하거나 수동 입력을 사용하세요.",
          "ai_failed",
        );
      }
      return apiError("AI 분석 중 서버 오류가 발생했습니다.", "ai_failed");
    }

    const data = (await aiResponse.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed: ParsedJobPost;
    try {
      parsed = JSON.parse(clean) as ParsedJobPost;
    } catch {
      return apiError(
        "AI 응답을 해석하지 못했습니다. 다시 시도해주세요.",
        "ai_parse_failed",
      );
    }

    return NextResponse.json({ ok: true, result: parsed }, { status: 200 });
  } catch {
    return apiError("AI 분석 중 오류가 발생했습니다. 다시 시도해주세요.", "ai_failed");
  }
}

function apiError(message: string, code: ErrorCode, status = 200) {
  return NextResponse.json({ ok: false, error: message, errorCode: code }, { status });
}

// Block loopback, link-local, and RFC1918 private ranges
function validatePublicUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "유효하지 않은 URL 형식입니다.";
  }

  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "localhost" || hostname === "localhost.") {
    return "localhost URL은 허용되지 않습니다.";
  }

  if (hostname === "[::1]" || hostname === "::1") {
    return "loopback 주소는 허용되지 않습니다.";
  }

  const ipv4 = hostname.replace(/^\[|\]$/g, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ipv4)) {
    const parts = ipv4.split(".").map(Number);
    if (
      parts[0] === 127 ||
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254) ||
      parts[0] === 0 ||
      parts[0] >= 240
    ) {
      return "내부 네트워크 주소는 허용되지 않습니다.";
    }
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
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
