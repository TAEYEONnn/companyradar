import { authorizeAiRequest, consumeAiCredit } from "@/lib/server-ai-entitlements";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

interface CompanySnapshot {
  name: string;
  status: string;
  applicationPriority?: string;
  fitScore?: number;
  jobDeadline?: string;
  followUpDueDates?: string[];
  interviewCount?: number;
  validationReasons?: string[];
}

interface WeeklyStrategyStats {
  needsValidation: number;
  interviews: number;
  deadline7d: number;
  waitingResponse: number;
  highPriority: number;
}

export async function POST(request: Request) {
  const auth = await authorizeAiRequest(request, "weekly-strategy");
  if (auth.response) return auth.response;

  let body: { companies?: CompanySnapshot[]; today?: string; stats?: WeeklyStrategyStats };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "invalid_request", "요청 본문을 파싱할 수 없습니다.");
  }

  const companies = body.companies ?? [];
  if (companies.length === 0)
    return apiError(400, "invalid_request", "회사 데이터가 없습니다.");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    return apiError(500, "config_missing", "AI 분석 중 서버 오류가 발생했습니다.");

  const today = body.today ?? new Date().toISOString().slice(0, 10);
  const stats = body.stats;

  const companySummary = companies
    .slice(0, 20)
    .map(
      (c) =>
        `- ${c.name}: 상태=${c.status}, 우선순위=${c.applicationPriority ?? "?"}, 핏=${c.fitScore?.toFixed(1) ?? "?"}, 마감=${c.jobDeadline || "없음"}, 면접=${c.interviewCount ?? 0}회, 검증사유=${(c.validationReasons ?? []).join(",") || "없음"}`,
    )
    .join("\n");

  const statsSummary = stats
    ? `\n포트폴리오 현황: 검증필요=${stats.needsValidation}개, 면접중=${stats.interviews}개, 7일내마감=${stats.deadline7d}개, 답변대기=${stats.waitingResponse}개, 높은우선순위=${stats.highPriority}개`
    : "";

  const systemPrompt = `당신은 프로덕트 디자이너 취업 준비를 지원하는 AI 커리어 코치입니다.
오늘 날짜는 ${today}입니다.

지원자의 현재 회사 트래킹 현황을 보고 이번 주 실행 전략을 작성하세요.

형식 (정확히 아래 구조로):
## 이번 주 집중
이번 주 우선적으로 실행해야 할 전략 방향 2~3문장. 구체적 회사명 포함.

## 리스크
- 파이프라인 쏠림, 마감 임박, 답변 지연 등 현재 리스크 최대 3개

## 지원 포트폴리오 조정
- 지원 우선순위 재배분, 신규 후보 발굴 필요 여부, 포트폴리오 균형 관점 최대 3개

## 검증 필요
- 정보 불확실성이 높아 이번 주 반드시 검증해야 할 회사 최대 3개. 이유 포함.

규칙: 한국어로, 구체적인 회사명 사용, 추상적 조언 금지, 오늘 할 일 목록에 나올 법한 단순 팔로업/면접 준비 액션 반복 금지, AI가 지원 여부를 결정하지 말고 판단 근거만 제시`;

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 600,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `현재 회사 현황 (오늘: ${today}):${statsSummary}\n\n${companySummary}` },
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
    const strategy = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!strategy)
      return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");

    await consumeAiCredit(auth.user, "weekly-strategy", auth.entitlement);
    return NextResponse.json({ ok: true, strategy });
  } catch {
    return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");
  }
}
