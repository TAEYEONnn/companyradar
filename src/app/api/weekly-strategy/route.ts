import { createClient } from "@supabase/supabase-js";
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
}

export async function POST(request: Request) {
  const accessToken = request.headers
    .get("Authorization")
    ?.replace("Bearer ", "")
    .trim();
  if (!accessToken) return apiError(401, "auth_required", "로그인이 필요합니다.");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user)
      return apiError(401, "auth_required", "유효하지 않은 세션입니다.");
  }

  let body: { companies?: CompanySnapshot[]; today?: string };
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

  const companySummary = companies
    .slice(0, 20)
    .map(
      (c) =>
        `- ${c.name}: 상태=${c.status}, 우선순위=${c.applicationPriority ?? "?"}, 핏=${c.fitScore?.toFixed(1) ?? "?"}, 마감=${c.jobDeadline || "없음"}, 면접=${c.interviewCount ?? 0}회, 팔로업마감=${(c.followUpDueDates ?? []).join(",") || "없음"}`,
    )
    .join("\n");

  const systemPrompt = `당신은 프로덕트 디자이너 취업 준비를 지원하는 AI 커리어 코치입니다.
오늘 날짜는 ${today}입니다.

지원자의 현재 회사 트래킹 현황을 보고 이번 주 실행 전략을 작성하세요.

형식 (정확히 아래 구조로):
## 이번 주 전략 요약
2~3문장

## 즉시 행동 필요 (Today)
- 구체적인 액션 아이템 (회사명 포함, 최대 3개)

## 이번 주 중 처리
- 구체적인 액션 아이템 (회사명 포함, 최대 4개)

## 전략 인사이트
1~2문장 (현재 상태의 패턴 분석, 개선 방향)

규칙: 한국어로, 구체적인 회사명 사용, 추상적 조언 금지`;

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
          { role: "user", content: `현재 회사 현황 (오늘: ${today}):\n${companySummary}` },
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

    return NextResponse.json({ ok: true, strategy });
  } catch {
    return apiError(502, "ai_failed", "AI 분석 중 서버 오류가 발생했습니다.");
  }
}
