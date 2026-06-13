import { NextResponse } from "next/server";
import { AI_CREDIT_PRODUCT, type AiEntitlement } from "@/lib/billing";
import { type AiRequestFeature, logAiRequest } from "@/lib/server-ai-usage";
import {
  authError,
  type AuthenticatedUser,
  isAllowedAiOperator,
  requireSupabaseUser,
} from "@/lib/server-auth";
import { getSupabaseAdminClient } from "@/lib/server-supabase-admin";

interface AuthorizeAiResult {
  response?: NextResponse;
  user?: AuthenticatedUser;
  entitlement?: AiEntitlement;
}

const PAYMENT_REQUIRED_MESSAGE =
  "AI 기능은 유료 베타입니다. 계정당 1회 무료로 체험할 수 있고, 이후 10회권을 구매해 계속 사용할 수 있어요.";

export async function authorizeAiRequest(
  request: Request,
  feature: AiRequestFeature,
): Promise<AuthorizeAiResult> {
  const auth = await requireSupabaseUser(request);
  if (auth.response || !auth.user) return { response: auth.response };

  if (auth.user.role === "blocked") {
    return {
      response: authError(403, "forbidden", "AI 기능 사용이 차단된 계정입니다."),
    };
  }

  if (isAllowedAiOperator(auth.user)) {
    return {
      user: auth.user,
      entitlement: {
        unlimited: true,
        freeUsesRemaining: 0,
        paidCreditsRemaining: 0,
        totalRemaining: Number.POSITIVE_INFINITY,
      },
    };
  }

  const entitlement = await getOrCreateAiEntitlement(auth.user.id);
  if (entitlement.totalRemaining <= 0) {
    await logAiRequest(auth.user, feature, "error", "payment_required");
    return {
      response: NextResponse.json(
        {
          error: {
            code: "payment_required",
            message: PAYMENT_REQUIRED_MESSAGE,
          },
          entitlement,
          product: AI_CREDIT_PRODUCT,
        },
        { status: 402 },
      ),
    };
  }

  return { user: auth.user, entitlement };
}

export async function consumeAiCredit(
  user: AuthenticatedUser | undefined,
  feature: AiRequestFeature,
  entitlement?: AiEntitlement,
) {
  if (!user) return;

  if (entitlement?.unlimited) {
    await logAiRequest(user, feature, "success");
    return;
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("consume_ai_credit", {
    p_user_id: user.id,
    p_feature: feature,
  });

  if (error || !isConsumeResult(data) || !data.ok) {
    await logAiRequest(user, feature, "error", "credit_consume_failed");
    throw new Error("AI credit consume failed");
  }

  await logAiRequest(user, feature, "success");
}

export async function getOrCreateAiEntitlement(userId: string): Promise<AiEntitlement> {
  const admin = getSupabaseAdminClient();
  await admin.from("ai_credit_accounts").upsert(
    {
      user_id: userId,
      free_uses_remaining: 1,
      paid_credits_remaining: 0,
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  );

  const { data, error } = await admin
    .from("ai_credit_accounts")
    .select("free_uses_remaining, paid_credits_remaining")
    .eq("user_id", userId)
    .single<{
      free_uses_remaining: number;
      paid_credits_remaining: number;
    }>();

  if (error || !data) {
    throw new Error("AI entitlement lookup failed");
  }

  const freeUsesRemaining = data.free_uses_remaining;
  const paidCreditsRemaining = data.paid_credits_remaining;
  return {
    unlimited: false,
    freeUsesRemaining,
    paidCreditsRemaining,
    totalRemaining: freeUsesRemaining + paidCreditsRemaining,
  };
}

function isConsumeResult(value: unknown): value is { ok: boolean } {
  return Boolean(value && typeof value === "object" && "ok" in value);
}
