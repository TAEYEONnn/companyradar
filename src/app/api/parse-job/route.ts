import { NextResponse } from "next/server";

/**
 * 채용공고 URL을 받아 공고 페이지를 가져온 뒤,
 * Claude API로 회사명/산업군/마감일 등을 구조화해 반환합니다.
 *
 * 필요 환경변수 (Vercel > Settings > Environment Variables):
 *   ANTHROPIC_API_KEY=sk-ant-...
 */

export const runtime = "nodejs";

interface ParsedJobPost {
  name?: string;
  industry?: string;
  productDescription?: string;
  jobDeadline?: string;
  candidateReason?: string;
}

const MAX_PAGE_CHARS = 12000;

export async function POST(request: Request) {
  let url = "";
  try {
    const body = (await request.json()) as { url?: string };
    url = (body.url ?? "").trim();
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 형식이 올바르지 않습니다." },
      { status: 200 },
    );
  }

  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { ok: false, error: "http(s)로 시작하는 URL을 입력해주세요." },
      { status: 200 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "ANTHROPIC_API_KEY가 설정되지 않았습니다. Vercel 환경변수에 추가해주세요.",
      },
      { status: 200 },
    );
  }

  // 1. 공고 페이지 텍스트 수집
  let pageText = "";
  try {
    const pageResponse = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CareerTrackerBot/1.0; personal job tracker)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!pageResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `공고 페이지를 불러오지 못했습니다 (HTTP ${pageResponse.status}). 로그인 필요 페이지일 수 있어요.`,
        },
        { status: 200 },
      );
    }
    const html = await pageResponse.text();
    pageText = stripHtml(html).slice(0, MAX_PAGE_CHARS);
  } catch {
    return NextResponse.json(
      { ok: false, error: "공고 페이지 요청이 실패했거나 시간이 초과됐습니다." },
      { status: 200 },
    );
  }

  if (pageText.trim().length < 100) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "페이지에서 텍스트를 충분히 추출하지 못했습니다. (JS 렌더링 페이지일 수 있어요)",
      },
      { status: 200 },
    );
  }

  // 2. Claude API로 구조화
  try {
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: `다음은 채용공고 페이지의 텍스트입니다. 아래 JSON 형식으로만 응답하세요. 마크다운 백틱이나 다른 설명 없이 JSON 객체만 출력합니다. 알 수 없는 필드는 빈 문자열로 두세요.

{"name": "회사명", "industry": "산업군 (예: B2B SaaS, Fintech)", "productDescription": "제품/서비스 한두 문장 요약", "jobDeadline": "마감일 YYYY-MM-DD 형식 (상시채용이면 빈 문자열)", "candidateReason": "이 공고에서 디자이너에게 매력적인 포인트 한 문장"}

--- 공고 텍스트 ---
${pageText}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      return NextResponse.json(
        { ok: false, error: `AI 분석 요청 실패 (HTTP ${aiResponse.status})` },
        { status: 200 },
      );
    }

    const data = (await aiResponse.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = (data.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("\n");

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as ParsedJobPost;

    return NextResponse.json({ ok: true, result: parsed }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, error: "AI 응답을 해석하지 못했습니다. 다시 시도해주세요." },
      { status: 200 },
    );
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
