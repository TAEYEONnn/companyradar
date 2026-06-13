import { createPendingAiPayment } from "@/lib/server-billing";
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
  if (auth.user.role === "blocked") {
    return NextResponse.json(
      { error: { code: "forbidden", message: "결제를 진행할 수 없는 계정입니다." } },
      { status: 403 },
    );
  }

  try {
    const order = await createPendingAiPayment(auth.user);
    return NextResponse.json({ ok: true, order });
  } catch {
    return NextResponse.json(
      { error: { code: "billing_failed", message: "주문 생성에 실패했습니다." } },
      { status: 500 },
    );
  }
}
