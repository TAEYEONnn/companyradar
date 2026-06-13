import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server-auth";
import { getSupabaseAdminClient } from "@/lib/server-supabase-admin";

type SupportRequestType = "general" | "bug" | "feature" | "account" | "billing";

const SUPPORT_TYPES = new Set<SupportRequestType>([
  "general",
  "bug",
  "feature",
  "account",
  "billing",
]);

export async function POST(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (auth.response || !auth.user) return auth.response;

  let body: {
    requestType?: string;
    subject?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "요청 내용을 확인해 주세요." } },
      { status: 400 },
    );
  }

  const requestType = SUPPORT_TYPES.has(body.requestType as SupportRequestType)
    ? (body.requestType as SupportRequestType)
    : "general";
  const subject = body.subject?.trim() || "서비스 문의";
  const message = body.message?.trim() || "";

  if (!message) {
    return NextResponse.json(
      { error: { code: "message_required", message: "문의 내용을 입력해 주세요." } },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "config_error",
          message: `서비스를 일시적으로 이용할 수 없습니다.${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ? ` ${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}으로 문의해 주세요.` : ""}`,
        },
      },
      { status: 503 },
    );
  }

  try {
    const { data, error } = await admin
      .from("support_requests")
      .insert({
        user_id: auth.user.id,
        email: auth.user.email ?? "",
        request_type: requestType,
        subject,
        message,
        metadata: body.metadata ?? {},
      })
      .select("id,status,created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, request: data });
  } catch (error) {
    console.error("[support/request] failed to save support request", error);
    return NextResponse.json(
      {
        error: {
          code: "save_failed",
          message: "문의 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        },
      },
      { status: 500 },
    );
  }
}
