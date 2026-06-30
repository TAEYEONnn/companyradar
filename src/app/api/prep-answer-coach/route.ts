import { NextResponse } from "next/server";
import { authorizeAiRequest, consumeAiCredit } from "@/lib/server-ai-entitlements";
import { AiProviderError, createJsonCompletion, getAiProviderConfig } from "@/lib/ai-provider";

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
    return apiError(400, "invalid_request", "요청 내용을 확인하지 못했어요.");
  }

  const mode = body.mode;
  const companyName = body.companyName?.trim() ?? "";
  const question = body.question?.trim() ?? "";
  const answer = body.answer?.trim() ?? "";
  const roleName = ROLE_NAMES[body.userRole ?? ""] ?? "프로덕트 디자이너";

  if (mode !== "draft" && mode !== "review") {
    return apiError(400, "invalid_request", "요청한 코칭 방식을 확인하지 못했어요.");
  }
  if (!companyName || !question) {
    return apiError(400, "invalid_request", "회사명과 면접 질문을 입력해주세요.");
  }
  if (mode === "review" && answer.length < 20) {
    return apiError(400, "invalid_request", "답변을 20자 이상 적어주세요.");
  }

  try {
    getAiProviderConfig();
  } catch {
    return apiError(500, "config_missing", "AI 분석 중 서버 오류가 발생했습니다.");
  }

  const systemPrompt =
    mode === "draft"
      ? `당신은 ${roleName} 면접 답변 코치입니다. 사용자가 자기 경험으로 다듬기 쉬운 현실적인 한국어 답변 초안을 작성하세요. STAR 구조는 자연스럽게 녹이고 제목 없이 2~3문단으로 답하세요. 과장하거나 없는 경험을 만들지 말고, 대괄호 힌트는 최대 2개만 사용하세요. 문장은 짧고 자연스러운 존댓말로 쓰며 보고서 말투와 AI식 상투어를 피하세요.`
      : `당신은 ${roleName} 면접 답변 평가자입니다. 채용 담당자 관점에서 솔직하지만 부담스럽지 않게 평가하세요. summary, strengths, improvements는 짧고 자연스러운 한국어로 쓰고 바로 고칠 수 있는 행동을 제안하세요. JSON만 출력하고 점수는 100점 만점 정수입니다.`;

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

  let content: string;
  try {
    content = await createJsonCompletion({
      systemPrompt,
      userPrompt: userContent,
      temperature: mode === "draft" ? 0.7 : 0.35,
      maxTokens: mode === "draft" ? 900 : 1100,
      timeoutMs: 45_000,
    });
  } catch (err) {
    const status = err instanceof AiProviderError ? err.status : undefined;
    if (status === 401) {
      return apiError(502, "ai_failed", "AI API 키가 없거나 유효하지 않습니다.");
    }
    if (status === 429) {
      return apiError(502, "ai_failed", "답변 코칭을 마치지 못했어요. 잠시 후 다시 해주세요.");
    }
    return apiError(502, "ai_failed", "코칭 결과를 정리하지 못했어요. 다시 해주세요.");
  }

  const clean = content.replace(/```json|```/g, "").trim();
  let parsed: {
    draft?: string;
    score?: number;
    summary?: string;
    strengths?: string[];
    improvements?: string[];
    rewrite?: string;
  };
  try {
    parsed = JSON.parse(clean) as typeof parsed;
  } catch {
    return apiError(502, "ai_failed", "코칭 결과를 정리하지 못했어요. 다시 해주세요.");
  }

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
}
