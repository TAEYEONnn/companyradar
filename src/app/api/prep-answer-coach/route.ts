import { NextResponse } from "next/server";
import { authorizeAiRequest, consumeAiCredit } from "@/lib/server-ai-entitlements";

export const runtime = "nodejs";

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const ROLE_NAMES: Record<string, string> = {
  designer: "프로덕트 디자이너",
  pm: "PM/PO",
  frontend: "프론트엔드 개발자",
  ux_researcher: "UX 리서처",
  marketer: "프로덕트 마케터",
};

export async function POST(request: Request) {
  const auth = await authorizeAiRequest(request, "prep-answer-coach");
  if (auth.response) return auth.response;

  let body: {
    mode?: "draft" | "review";
    companyName?: string;
    industry?: string;
    productDescription?: string;
    candidateReason?: string;
    question?: string;
    answer?: string;
    category?: string;
    greenFlags?: string[];
    redFlags?: string[];
    userRole?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "invalid_request", "요청 본문을 파싱할 수 없습니다.");
  }

  const mode = body.mode;
  const companyName = body.companyName?.trim() ?? "";
  const question = body.question?.trim() ?? "";
  const answer = body.answer?.trim() ?? "";
  const roleName = ROLE_NAMES[body.userRole ?? ""] ?? "프로덕트 디자이너";

  if (mode !== "draft" && mode !== "review") {
    return apiError(400, "invalid_request", "mode는 draft 또는 review여야 합니다.");
  }
  if (!companyName || !question) {
    return apiError(400, "invalid_request", "회사명과 질문은 필수입니다.");
  }
  if (mode === "review" && answer.length < 20) {
    return apiError(400, "invalid_request", "평가하려면 답변을 20자 이상 입력해주세요.");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return apiError(500, "config_missing", "AI 분석 중 서버 오류가 발생했습니다.");
  }

  const systemPrompt =
    mode === "draft"
      ? `당신은 ${roleName} 면접 답변 코치입니다. 사용자가 그대로 복붙하기보다 자기 경험으로 다듬을 수 있는 현실적인 한국어 답변 초안을 작성하세요. STAR 구조를 자연스럽게 반영하되 제목 없이 2~3문단으로 답하세요. 과장된 성과나 없는 경험을 지어내지 말고, 사용자가 채워 넣을 수 있는 대괄호 힌트는 최대 2개만 사용하세요.`
      : `당신은 ${roleName} 면접 답변 평가자입니다. 답변을 채용 담당자 관점에서 엄격하지만 실용적으로 평가하세요. JSON만 출력하고, 점수는 100점 만점 정수입니다.`;

  const userContent = `
mode: ${mode}
회사명: ${companyName}
산업군: ${body.industry || "미입력"}
제품/서비스: ${body.productDescription || "미입력"}
지원 동기: ${body.candidateReason || "미입력"}
질문 카테고리: ${body.category || "미입력"}
면접 질문: ${question}
긍정 신호: ${(body.greenFlags ?? []).slice(0, 4).join(", ") || "없음"}
우려 신호: ${(body.redFlags ?? []).slice(0, 3).join(", ") || "없음"}
${mode === "review" ? `사용자 답변: ${answer}` : ""}

${mode === "draft"
  ? `아래 JSON 형식으로만 응답:
{ "draft": "답변 초안" }`
  : `아래 JSON 형식으로만 응답:
{
  "score": 82,
  "summary": "한 줄 총평",
  "strengths": ["강점 1", "강점 2"],
  "improvements": ["개선점 1", "개선점 2"],
  "rewrite": "개선 예시 답변"
}`}
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
        temperature: mode === "draft" ? 0.7 : 0.35,
        max_tokens: mode === "draft" ? 900 : 1100,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 401) {
        return apiError(502, "ai_failed", "OpenAI API 키가 없거나 유효하지 않습니다.");
      }
      if (aiRes.status === 429) {
        return apiError(502, "ai_failed", "OpenAI API 사용량 또는 요청 제한에 걸렸습니다. 잠시 후 다시 시도하세요.");
      }
      return apiError(502, "ai_failed", "AI 코칭 중 서버 오류가 발생했습니다.");
    }

    const json = (await aiRes.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as {
      draft?: string;
      score?: number;
      summary?: string;
      strengths?: string[];
      improvements?: string[];
      rewrite?: string;
    };

    await consumeAiCredit(auth.user, "prep-answer-coach", auth.entitlement);

    if (mode === "draft") {
      return NextResponse.json({ ok: true, draft: parsed.draft ?? "" });
    }

    return NextResponse.json({
      ok: true,
      review: {
        score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
        summary: parsed.summary ?? "",
        strengths: (parsed.strengths ?? []).slice(0, 3),
        improvements: (parsed.improvements ?? []).slice(0, 3),
        rewrite: parsed.rewrite ?? "",
      },
    });
  } catch {
    return apiError(502, "ai_failed", "AI 코칭 응답을 해석하지 못했습니다.");
  }
}
