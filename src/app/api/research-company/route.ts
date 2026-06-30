import { authorizeAiRequest, consumeAiCredit } from "@/lib/server-ai-entitlements";
import { NextResponse } from "next/server";
import { AiProviderError, createJsonCompletion, getAiProviderConfig } from "@/lib/ai-provider";

export const runtime = "nodejs";

const MAX_HTML_BYTES = 300_000;
const MAX_PAGE_CHARS = 8_000;

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

interface ResearchResult {
  source: string;
  link: string;
  positiveSignals: string;
  negativeSignals: string;
  questions: string;
}

export async function POST(request: Request) {
  const auth = await authorizeAiRequest(request, "research-company");
  if (auth.response) return auth.response;

  let body: { companyName?: string; homepageUrl?: string; industry?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "invalid_request", "요청 본문을 파싱할 수 없습니다.");
  }

  const companyName = (body.companyName ?? "").trim();
  const homepageUrl = (body.homepageUrl ?? "").trim();
  if (!companyName)
    return apiError(400, "invalid_request", "회사 이름이 필요합니다.");

  try {
    getAiProviderConfig();
  } catch {
    return apiError(500, "config_missing", "AI 분석 중 서버 오류가 발생했습니다.");
  }

  let pageText = "";
  let fetchedUrl = "";

  if (homepageUrl && /^https?:\/\//i.test(homepageUrl)) {
    try {
      const pageRes = await fetch(homepageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CompanyRadarBot/1.0; personal job tracker)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (pageRes.ok) {
        const reader = pageRes.body?.getReader();
        if (reader) {
          let html = "";
          let total = 0;
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > MAX_HTML_BYTES) { reader.cancel(); break; }
            html += decoder.decode(value, { stream: true });
          }
          pageText = stripHtml(html).slice(0, MAX_PAGE_CHARS);
          fetchedUrl = homepageUrl;
        }
      }
    } catch { /* silently fallback — use AI with company name only */ }
  }

  const contextSection = pageText.length > 100
    ? `\n\n--- 홈페이지 내용 (발췌) ---\n${pageText}`
    : "";

  const systemPrompt = `당신은 프로덕트 디자이너 취업 준비를 지원하는 리서치 전문가입니다.
회사 정보를 분석하여 리서치 로그 항목을 작성하세요.

다음 JSON 형식으로만 응답하세요 (마크다운 없이):
{
  "positiveSignals": "긍정적 신호들 (불릿 없이, 줄바꿈으로 구분, 2~4개 항목)",
  "negativeSignals": "부정적/불분명한 신호들 (줄바꿈으로 구분, 1~3개 항목. 없으면 '특이사항 없음')",
  "questions": "더 확인이 필요한 질문들 (줄바꿈으로 구분, 2~3개 항목)"
}

규칙: 한국어로, 구체적으로, 프로덕트 디자이너 관점에서`;

  let content: string;
  try {
    content = await createJsonCompletion({
      systemPrompt,
      userPrompt: `회사명: ${companyName}\n산업군: ${body.industry || "미입력"}${contextSection}`,
      temperature: 0.3,
      maxTokens: 400,
      timeoutMs: 45_000,
    });
  } catch (err) {
    const status = err instanceof AiProviderError ? err.status : undefined;
    if (status === 401)
      return apiError(502, "ai_failed", "AI API 키가 없거나 유효하지 않습니다.");
    if (status === 429)
      return apiError(
        502,
        "ai_failed",
        "회사 조사를 마치지 못했어요. 잠시 후 다시 해주세요.",
      );
    return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");
  }

  const clean = content.replace(/```json|```/g, "").trim();
  let parsed: { positiveSignals?: string; negativeSignals?: string; questions?: string };
  try {
    parsed = JSON.parse(clean) as typeof parsed;
  } catch {
    return apiError(502, "ai_failed", "AI 응답을 해석하지 못했습니다.");
  }

  const result: ResearchResult = {
    source: `AI 리서치 — ${companyName}`,
    link: fetchedUrl,
    positiveSignals: parsed.positiveSignals ?? "",
    negativeSignals: parsed.negativeSignals ?? "",
    questions: parsed.questions ?? "",
  };

  await consumeAiCredit(auth.user, "research-company", auth.entitlement);
  return NextResponse.json({ ok: true, result });
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
