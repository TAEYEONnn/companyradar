import { getEntitlement, hasApprovedAiPayment } from "@/lib/server-billing";
import { AI_CREDIT_PRODUCT } from "@/lib/billing";
import { isAllowedAiOperator, requireSupabaseUser } from "@/lib/server-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (auth.response) return auth.response;
  if (!auth.user) {
    return NextResponse.json(
      { error: { code: "auth_required", message: "로그인이 필요합니다." } },
      { status: 401 },
    );
  }

  if (auth.user.role === "blocked") {
    return NextResponse.json({
      ok: true,
      entitlement: {
        unlimited: false,
        freeUsesRemaining: 0,
        paidCreditsRemaining: 0,
        totalRemaining: 0,
      },
      product: AI_CREDIT_PRODUCT,
      blocked: true,
      hasApprovedPayment: false,
    });
  }

  if (isAllowedAiOperator(auth.user)) {
    return NextResponse.json({
      ok: true,
      entitlement: {
        unlimited: true,
        freeUsesRemaining: 0,
        paidCreditsRemaining: 0,
        totalRemaining: null,
      },
      product: AI_CREDIT_PRODUCT,
      hasApprovedPayment: true,
    });
  }

  try {
    const entitlement = await getEntitlement(auth.user.id);
    const hasApprovedPayment = await hasApprovedAiPayment(auth.user.id);
    return NextResponse.json({ ok: true, entitlement, product: AI_CREDIT_PRODUCT, hasApprovedPayment });
  } catch {
    return NextResponse.json(
      { error: { code: "billing_failed", message: "이용권 정보를 불러오지 못했습니다." } },
      { status: 500 },
    );
  }
}
