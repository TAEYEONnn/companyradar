import { NextResponse } from "next/server";
import { isAllowedAiOperator, requireSupabaseUser } from "@/lib/server-auth";
import { hasApprovedAiPayment } from "@/lib/server-billing";
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
    const operatorTest = isAllowedAiOperator(auth.user);
    const hasApprovedPayment = operatorTest || (await hasApprovedAiPayment(auth.user.id));
    if (!hasApprovedPayment) {
      return NextResponse.json(
        {
          error: {
            code: "no_refundable_payment",
            message: "환불 요청 가능한 결제 이력이 없습니다.",
          },
        },
        { status: 403 },
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
    const { data, error } = await admin
      .from("refund_requests")
      .insert({
        user_id: auth.user.id,
        email: auth.user.email ?? "",
        order_id: body.orderId?.trim() || null,
        payment_key: body.paymentKey?.trim() || null,
        reason,
        metadata: {
          ...(body.metadata ?? {}),
          ...(operatorTest ? { operatorTest: true } : {}),
        },
      })
      .select("id,status,created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, request: data });
  } catch (error) {
    console.error("[billing/refund-request] failed to save refund request", error);
    return NextResponse.json(
      { error: { code: "save_failed", message: "환불 요청을 보내지 못했어요." } },
      { status: 500 },
    );
  }
}
