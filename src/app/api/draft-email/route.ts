import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type EmailType = "apply" | "followup" | "thank_you";

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  // --- Auth ---
  const accessToken = request.headers.get("Authorization")?.replace("Bearer ", "").trim();
  if (!accessToken) return apiError(401, "auth_required", "로그인이 필요합니다.");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return apiError(401, "auth_required", "유효하지 않은 세션입니다.");
  }

  // --- Body ---
  let body: {
    emailType?: EmailType;
    companyName?: string;
    jobTitle?: string;
    productDescription?: string;
    candidateReason?: string;
    signalsSummary?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "invalid_request", "요청 본문을 파싱할 수 없습니다.");
  }

  const {
    emailType = "apply",
    companyName = "",
    jobTitle = "",
    productDescription = "",
    candidateReason = "",
    signalsSummary = "",
  } = body;

  if (!companyName.trim()) return apiError(400, "invalid_request", "companyName은 필수입니다.");

  // --- AI ---
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return apiError(500, "config_missing", "OPENAI_API_KEY가 설정되지 않았습니다.");

  const typeInstructions: Record<EmailType, string> = {
    apply: "지원 이메일(지원동기 + 핵심 역량 강조, 150~200단어 이내 한국어)",
    followup: "후속 메일: 지원 후 2주 경과, 진행 상황 문의 (80단어 이내 한국어)",
    thank_you: "면접 감사 메일: 면접 후 24시간 이내 발송 (100단어 이내 한국어)",
  };

  const systemPrompt = `당신은 구직자를 돕는 채용 전문 어시스턴트입니다.
주어진 회사 정보와 지원자 정보를 바탕으로 ${typeInstructions[emailType]}를 작성하세요.
- 수신인: [채용 담당자 성함]으로 시작
- 발신인: [지원자 이름]으로 끝
- 실제 정보에 기반한 구체적 문장 사용
- 격식체(합쇼체) 유지
- 지나친 자기PR 문구 지양`;

  const userContent = `
회사명: ${companyName}
직무: ${jobTitle || "미입력"}
회사/제품 설명: ${productDescription || "미입력"}
지원 이유: ${candidateReason || "미입력"}
리서치 신호 요약: ${signalsSummary || "미입력"}
이메일 유형: ${emailType}
`.trim();

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 600,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiRes.ok) return apiError(502, "ai_failed", `OpenAI 오류: ${aiRes.status}`);

    const aiJson = (await aiRes.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const draft = aiJson.choices?.[0]?.message?.content?.trim() ?? "";
    if (!draft) return apiError(502, "ai_failed", "AI가 초안을 생성하지 못했습니다.");

    return NextResponse.json({ draft });
  } catch {
    return apiError(502, "ai_failed", "AI 요청 중 오류가 발생했습니다.");
  }
}
