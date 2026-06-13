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
    greenFlags?: string[];
    redFlags?: string[];
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
    greenFlags = [],
    redFlags = [],
  } = body;

  if (!companyName.trim())
    return apiError(400, "invalid_request", "companyName은 필수입니다.");

  // --- AI ---
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    return apiError(500, "config_missing", "AI 분석 중 서버 오류가 발생했습니다.");

  const systemPrompt = `당신은 프로덕트 디자이너 취업 준비를 돕는 커리어 코치입니다.
주어진 회사 정보를 바탕으로 면접에서 나올 가능성이 높은 예상 질문을 생성하세요.

규칙:
- behavioral: 경험·행동 기반 질문 (STAR 구조로 답할 수 있는 것)
- technical: 디자인 스킬·도구·프로세스 관련 질문
- culture: 조직문화·협업·커뮤니케이션 질문
- situational: 가상 시나리오 기반 판단력 질문
- 각 카테고리 2~3개, 합계 10~12개
- 질문은 구체적이고 회사 특성을 반영
- JSON만 출력, 설명 없음`;

  const userContent = `
회사명: ${companyName}
산업군: ${industry || "미입력"}
제품/서비스: ${productDescription || "미입력"}
지원 동기: ${candidateReason || "미입력"}
긍정 신호: ${greenFlags.slice(0, 4).join(", ") || "없음"}
부정 신호: ${redFlags.slice(0, 3).join(", ") || "없음"}

아래 JSON 형식으로만 응답:
{
  "questions": [
    { "category": "behavioral", "question": "질문 내용" },
    { "category": "technical", "question": "질문 내용" },
    { "category": "culture", "question": "질문 내용" },
    { "category": "situational", "question": "질문 내용" }
  ]
}
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
        temperature: 0.7,
        max_tokens: 1200,
        response_format: { type: "json_object" },
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
          "OpenAI API 사용량 또는 요청 제한에 걸렸습니다. 잠시 후 다시 시도하세요.",
        );
      return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");
    }

    const json = (await aiRes.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();

    let parsed: { questions?: { category: string; question: string }[] };
    try {
      parsed = JSON.parse(clean) as typeof parsed;
    } catch {
      return apiError(502, "ai_failed", "AI 응답을 해석하지 못했습니다.");
    }

    const validCategories = new Set(["behavioral", "technical", "culture", "situational"]);
    const questions = (parsed.questions ?? []).filter(
      (q) => q.category && q.question && validCategories.has(q.category),
    );

    await logAiRequest(auth.user, "gen-prep-questions", "success");
    return NextResponse.json({ ok: true, questions });
  } catch {
    return apiError(502, "ai_failed", "AI 질문 생성 중 오류가 발생했습니다.");
  }
}
