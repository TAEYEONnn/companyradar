import { authorizeAiRequest, consumeAiCredit } from "@/lib/server-ai-entitlements";
import { NextResponse } from "next/server";
import { AiProviderError, createJsonCompletion, getAiProviderConfig } from "@/lib/ai-provider";

export const runtime = "nodejs";

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  // --- Auth ---
  const auth = await authorizeAiRequest(request, "summarize-company");
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
  try {
    getAiProviderConfig();
  } catch {
    return apiError(500, "config_missing", "AI 분석 중 서버 오류가 발생했습니다.");
  }

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

  let summary: string;
  try {
    summary = await createJsonCompletion({
      systemPrompt,
      userPrompt: userContent,
      temperature: 0.5,
      maxTokens: 600,
      timeoutMs: 45_000,
      format: "text",
    });
  } catch (err) {
    const status = err instanceof AiProviderError ? err.status : undefined;
    if (status === 401)
      return apiError(502, "ai_failed", "AI API 키가 없거나 유효하지 않습니다.");
    if (status === 429)
      return apiError(
        502,
        "ai_failed",
        "회사 요약을 만들지 못했어요. 잠시 후 다시 해주세요.",
      );
    return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");
  }

  if (!summary)
    return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");

  await consumeAiCredit(auth.user, "summarize-company", auth.entitlement);
  return NextResponse.json({ ok: true, summary });
}
