import { logAiRequest } from "@/lib/server-ai-usage";
import { requireAllowedSupabaseUser } from "@/lib/server-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  // --- Auth ---
  const auth = await requireAllowedSupabaseUser(request);
  if (auth.response) return auth.response;

  // --- Body ---
  let body: {
    companyName?: string;
    industry?: string;
    productDescription?: string;
    candidateReason?: string;
    applicationPriority?: string;
    status?: string;
    greenFlags?: string[];
    redFlags?: string[];
    riskFlags?: string[];
    researchLogs?: { source: string; positiveSignals: string; negativeSignals: string }[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "invalid_request", "요청 본문을 파싱할 수 없습니다.");
  }

  const {
    companyName = "",
    industry = "",
    productDescription = "",
    candidateReason = "",
    applicationPriority = "",
    status = "",
    greenFlags = [],
    redFlags = [],
    riskFlags = [],
    researchLogs = [],
  } = body;

  if (!companyName.trim())
    return apiError(400, "invalid_request", "companyName은 필수입니다.");

  // --- AI ---
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    return apiError(500, "config_missing", "AI 분석 중 서버 오류가 발생했습니다.");

  const systemPrompt = `당신은 프로덕트 디자이너 취업 준비를 돕는 커리어 코치입니다.
주어진 회사 정보를 분석하여 지원자에게 실질적으로 도움이 되는 회사 요약을 작성하세요.

요약 구성 (2~3 단락, 한국어):
1. 회사·제품 특성과 지원 매력 포인트
2. 리서치에서 파악된 긍정/부정 신호와 리스크
3. 지원자 관점에서의 핵심 판단 포인트 (지원 여부·주의사항)

규칙:
- 각 단락은 3~5문장
- 사실 기반으로 작성, 과도한 낙관·비관 지양
- 지원자 시점("이 회사는", "지원 시")으로 작성
- JSON이나 마크다운 없이 순수 텍스트로만 출력`;

  const logLines = researchLogs
    .slice(0, 5)
    .map(
      (l) =>
        `[${l.source}] 긍정: ${l.positiveSignals || "없음"} / 부정: ${l.negativeSignals || "없음"}`,
    )
    .join("\n");

  const userContent = `
회사명: ${companyName}
산업군: ${industry || "미입력"}
제품/서비스: ${productDescription || "미입력"}
지원 동기: ${candidateReason || "미입력"}
지원 상태: ${status || "미입력"}
지원 우선순위: ${applicationPriority || "미입력"}
긍정 신호: ${greenFlags.slice(0, 6).join(", ") || "없음"}
부정 신호: ${redFlags.slice(0, 4).join(", ") || "없음"}
리스크: ${riskFlags.slice(0, 4).join(", ") || "없음"}
리서치 로그:
${logLines || "없음"}
`.trim();

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
        max_tokens: 600,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
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
    const summary = json.choices?.[0]?.message?.content?.trim() ?? "";

    if (!summary)
      return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");

    await logAiRequest(auth.user, "summarize-company", "success");
    return NextResponse.json({ ok: true, summary });
  } catch {
    return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");
  }
}
