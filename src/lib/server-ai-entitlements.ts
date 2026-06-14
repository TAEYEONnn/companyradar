import { NextResponse } from "next/server";
import { AI_CREDIT_PRODUCT, type AiEntitlement } from "@/lib/billing";
import { getEntitlement } from "@/lib/server-billing";
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
  "무료 AI 분석 5회를 모두 사용했어요. 추가 사용은 추후 제공될 예정이에요.";

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

  // Record email permanently so re-registration cannot bypass the free credit limit.
  try {
    const { data: authData } = await admin.auth.admin.getUserById(user.id);
    const email = authData.user?.email;
    if (email) {
      await admin
        .from("ai_free_used_emails")
        .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
    }
  } catch { /* non-fatal — entitlement row already consumed */ }

  await logAiRequest(user, feature, "success");
}

export async function getOrCreateAiEntitlement(userId: string): Promise<AiEntitlement> {
  return getEntitlement(userId);
}

function isConsumeResult(value: unknown): value is { ok: boolean } {
  return Boolean(value && typeof value === "object" && "ok" in value);
}
