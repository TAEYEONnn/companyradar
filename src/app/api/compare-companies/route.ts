import { authorizeAiRequest, consumeAiCredit } from "@/lib/server-ai-entitlements";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

interface CompanySnapshot {
  name: string;
  industry?: string;
  productDescription?: string;
  candidateReason?: string;
  applicationPriority?: string;
  status?: string;
  fitScore?: number;
  greenFlags?: string[];
  redFlags?: string[];
  riskFlags?: string[];
}

export async function POST(request: Request) {
  const auth = await authorizeAiRequest(request, "compare-companies");
  if (auth.response) return auth.response;

  let body: { companies?: CompanySnapshot[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "invalid_request", "요청 본문을 파싱할 수 없습니다.");
  }

  const companies = body.companies ?? [];
  if (companies.length < 2)
    return apiError(400, "invalid_request", "비교할 회사가 2개 이상 필요합니다.");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    return apiError(500, "config_missing", "AI 분석 중 서버 오류가 발생했습니다.");

  const systemPrompt = `당신은 프로덕트 디자이너 취업 준비를 돕는 커리어 코치입니다.
여러 회사를 비교 분석하여 지원자 관점에서 핵심 차이와 추천 순서를 작성하세요.

형식:
1. 핵심 비교 요약 (3~4문장)
2. 추천 순위와 이유 (각 회사 1~2문장)
3. 주의 사항 (있을 경우)

규칙: 순수 텍스트로만, JSON/마크다운 없이, 한국어로 작성`;

  const companyLines = companies
    .map(
      (c) =>
        `[${c.name}] 산업: ${c.industry || "미입력"} / 핏점수: ${c.fitScore ?? "??"} / 우선순위: ${c.applicationPriority || "미입력"} / 지원동기: ${c.candidateReason || "없음"} / 긍정신호: ${(c.greenFlags ?? []).slice(0, 4).join(", ") || "없음"} / 부정신호: ${(c.redFlags ?? []).slice(0, 3).join(", ") || "없음"} / 리스크: ${(c.riskFlags ?? []).slice(0, 3).join(", ") || "없음"}`,
    )
    .join("\n");

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: companyLines },
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
          "회사 비교를 만들지 못했어요. 잠시 후 다시 해주세요.",
        );
      return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");
    }

    const json = (await aiRes.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const comparison = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!comparison)
      return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");

    await consumeAiCredit(auth.user, "compare-companies", auth.entitlement);
    return NextResponse.json({ ok: true, comparison });
  } catch {
    return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");
  }
}
