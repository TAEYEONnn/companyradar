import { AI_CREDIT_PRODUCT, type AiEntitlement } from "@/lib/billing";
import type { AuthenticatedUser } from "@/lib/server-auth";
import { getSupabaseAdminClient } from "@/lib/server-supabase-admin";

interface TossPayment {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount?: number;
  method?: string;
  approvedAt?: string;
}

export function createAiCreditOrderId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `ai_${Date.now()}_${random}`;
}

export async function createPendingAiPayment(user: AuthenticatedUser) {
  const admin = getSupabaseAdminClient();
  const orderId = createAiCreditOrderId();

  const { error } = await admin.from("payments").insert({
    order_id: orderId,
    user_id: user.id,
    product_code: AI_CREDIT_PRODUCT.code,
    amount_krw: AI_CREDIT_PRODUCT.amountKrw,
    credits: AI_CREDIT_PRODUCT.credits,
    status: "pending",
  });

  if (error) throw error;

  return {
    orderId,
    orderName: AI_CREDIT_PRODUCT.name,
    amount: AI_CREDIT_PRODUCT.amountKrw,
    product: AI_CREDIT_PRODUCT,
    customerKey: user.id,
    customerEmail: user.email ?? "",
  };
}

export async function confirmTossPayment(input: {
  user: AuthenticatedUser;
  paymentKey: string;
  orderId: string;
  amount: number;
}) {
  const admin = getSupabaseAdminClient();
  const payment = await getPaymentForUser(input.user.id, input.orderId);
  if (payment.status === "approved") {
    return { ok: true as const, alreadyApproved: true, entitlement: await getEntitlement(input.user.id) };
  }

  if (
    payment.product_code !== AI_CREDIT_PRODUCT.code ||
    payment.amount_krw !== AI_CREDIT_PRODUCT.amountKrw ||
    Number(input.amount) !== payment.amount_krw
  ) {
    await markPaymentFailed(input.orderId, input.paymentKey, "amount_mismatch");
    throw new Error("결제 금액이 일치하지 않습니다.");
  }

  const tossPayment = await requestTossPaymentConfirm({
    paymentKey: input.paymentKey,
    orderId: input.orderId,
    amount: payment.amount_krw,
  });

  if (tossPayment.status !== "DONE") {
    await admin
      .from("payments")
      .update({
        payment_key: input.paymentKey,
        status: "pending",
        raw_response: tossPayment,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", input.orderId);
    return { ok: false as const, status: tossPayment.status };
  }

  const entitlement = await grantCreditsForPayment({
    userId: input.user.id,
    orderId: input.orderId,
    paymentKey: input.paymentKey,
    rawResponse: tossPayment,
    approvedAt: tossPayment.approvedAt,
  });

  return { ok: true as const, alreadyApproved: false, entitlement };
}

export async function reconcileTossWebhook(data: TossPayment) {
  if (!data.orderId) return;

  const admin = getSupabaseAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("user_id, status")
    .eq("order_id", data.orderId)
    .maybeSingle<{ user_id: string; status: string }>();

  if (!payment) return;
  if (payment.status === "approved") return;

  if (data.status === "DONE") {
    await grantCreditsForPayment({
      userId: payment.user_id,
      orderId: data.orderId,
      paymentKey: data.paymentKey,
      rawResponse: data,
      approvedAt: data.approvedAt,
    });
    return;
  }

  if (data.status === "CANCELED") {
    await admin
      .from("payments")
      .update({
        status: "canceled",
        raw_response: data,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", data.orderId);
  }
}

export async function getEntitlement(userId: string): Promise<AiEntitlement> {
  const admin = getSupabaseAdminClient();

  // Determine the correct initial free-use count for this account.
  // If the same email has already consumed credits under a previous account
  // (re-registration scenario), start at 0 instead of 5.
  let initialFreeUses = 5;
  try {
    const { data: authData } = await admin.auth.admin.getUserById(userId);
    const email = authData.user?.email;
    if (email) {
      const { data: usedRow } = await admin
        .from("ai_free_used_emails")
        .select("email")
        .eq("email", email)
        .maybeSingle<{ email: string }>();
      if (usedRow) initialFreeUses = 0;
    }
  } catch { /* non-fatal — default to 5 */ }

  await admin.from("ai_credit_accounts").upsert(
    {
      user_id: userId,
      free_uses_remaining: initialFreeUses,
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

  if (error || !data) throw new Error("이용권 정보를 불러오지 못했습니다.");

  const freeUsesRemaining = data.free_uses_remaining;
  const paidCreditsRemaining = data.paid_credits_remaining;
  return {
    unlimited: false,
    freeUsesRemaining,
    paidCreditsRemaining,
    totalRemaining: freeUsesRemaining + paidCreditsRemaining,
  };
}

export async function hasApprovedAiPayment(userId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("payments")
    .select("order_id")
    .eq("user_id", userId)
    .eq("status", "approved")
    .limit(1);

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function getPaymentForUser(userId: string, orderId: string) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("payments")
    .select("order_id, user_id, product_code, amount_krw, credits, status")
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .single<{
      order_id: string;
      user_id: string;
      product_code: string;
      amount_krw: number;
      credits: number;
      status: string;
    }>();

  if (error || !data) throw new Error("결제 주문을 찾을 수 없습니다.");
  return data;
}

export async function verifyTossPayment(paymentKey: string): Promise<{ status: string; orderId: string } | null> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) return null;
  try {
    const response = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { status?: string; orderId?: string };
    if (!json.status || !json.orderId) return null;
    return { status: json.status, orderId: json.orderId };
  } catch {
    return null;
  }
}

async function requestTossPaymentConfirm(input: {
  paymentKey: string;
  orderId: string;
  amount: number;
}) {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) throw new Error("TOSS_SECRET_KEY is required.");

  const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const json = (await response.json()) as TossPayment & { message?: string };
  if (!response.ok) {
    await markPaymentFailed(input.orderId, input.paymentKey, json.message ?? "toss_confirm_failed");
    throw new Error(json.message ?? "토스페이먼츠 결제 승인에 실패했습니다.");
  }

  return json;
}

async function grantCreditsForPayment(input: {
  userId: string;
  orderId: string;
  paymentKey: string;
  rawResponse: unknown;
  approvedAt?: string;
}) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("grant_ai_credits_for_payment", {
    p_user_id: input.userId,
    p_order_id: input.orderId,
    p_payment_key: input.paymentKey,
    p_credits: AI_CREDIT_PRODUCT.credits,
    p_raw_response: input.rawResponse,
    p_approved_at: input.approvedAt ?? new Date().toISOString(),
  });
  if (error || !isGrantResult(data) || !data.ok) {
    throw new Error("AI credit grant failed");
  }
  return getEntitlement(input.userId);
}

function isGrantResult(value: unknown): value is { ok: boolean } {
  return Boolean(value && typeof value === "object" && "ok" in value);
}

async function markPaymentFailed(orderId: string, paymentKey: string, reason: string) {
  const admin = getSupabaseAdminClient();
  await admin
    .from("payments")
    .update({
      payment_key: paymentKey,
      status: "failed",
      raw_response: { reason },
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", orderId);
}
