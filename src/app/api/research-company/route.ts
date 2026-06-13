import { authorizeAiRequest, consumeAiCredit } from "@/lib/server-ai-entitlements";
import { NextResponse } from "next/server";

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    return apiError(500, "config_missing", "AI 분석 중 서버 오류가 발생했습니다.");

  let pageText = "";
  let fetchedUrl = "";

  if (homepageUrl && /^https?:\/\//i.test(homepageUrl)) {
    try {
      const pageRes = await fetch(homepageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CareerTrackerBot/1.0; personal job tracker)",
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

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        max_tokens: 400,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `회사명: ${companyName}\n산업군: ${body.industry || "미입력"}${contextSection}`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 401)
        return apiError(502, "ai_failed", "OpenAI API 키가 없거나 유효하지 않습니다.");
      if (aiRes.status === 429)
        return apiError(
          502,
          "ai_failed",
          "OpenAI API 사용량 또는 요청 제한에 걸렸습니다. 잠시 후 다시 시도하거나 수동 입력을 사용하세요.",
        );
      return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");
    }

    const json = (await aiRes.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = (json.choices?.[0]?.message?.content ?? "").trim();
    const clean = text.replace(/```json|```/g, "").trim();

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
  } catch {
    return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");
  }
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
