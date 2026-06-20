import { confirmTossPayment } from "@/lib/server-billing";
import { requireSupabaseUser } from "@/lib/server-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (auth.response) return auth.response;
  if (!auth.user) {
    return NextResponse.json(
      { error: { code: "auth_required", message: "로그인이 필요합니다." } },
      { status: 401 },
    );
  }

  let body: { paymentKey?: string; orderId?: string; amount?: number | string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "요청 본문을 파싱할 수 없습니다." } },
      { status: 400 },
    );
  }

  const paymentKey = (body.paymentKey ?? "").trim();
  const orderId = (body.orderId ?? "").trim();
  const amount = Number(body.amount);
  if (!paymentKey || !orderId || !Number.isFinite(amount)) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "결제 승인 정보가 부족합니다." } },
      { status: 400 },
    );
  }

  try {
    const result = await confirmTossPayment({
      user: auth.user,
      paymentKey,
      orderId,
      amount,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "billing_confirm_failed",
          message:
            error instanceof Error
              ? error.message
              : "결제를 승인하지 못했어요.",
        },
      },
      { status: 502 },
    );
  }
}
