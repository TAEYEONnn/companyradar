import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server-auth";
import { getSupabaseAdminClient } from "@/lib/server-supabase-admin";

export async function POST(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (auth.response || !auth.user) return auth.response;

  let body: {
    orderId?: string;
    paymentKey?: string;
    reason?: string;
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

  const reason = body.reason?.trim() || "";
  if (!reason) {
    return NextResponse.json(
      { error: { code: "reason_required", message: "환불 요청 사유를 입력해 주세요." } },
      { status: 400 },
    );
  }

  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("refund_requests")
      .insert({
        user_id: auth.user.id,
        email: auth.user.email ?? "",
        order_id: body.orderId?.trim() || null,
        payment_key: body.paymentKey?.trim() || null,
        reason,
        metadata: body.metadata ?? {},
      })
      .select("id,status,created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, request: data });
  } catch {
    return NextResponse.json(
      { error: { code: "save_failed", message: "환불 요청 접수에 실패했습니다." } },
      { status: 500 },
    );
  }
}
