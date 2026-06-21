import { reconcileTossWebhook, verifyTossPayment } from "@/lib/server-billing";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface TossWebhookPayload {
  eventType?: string;
  data?: {
    paymentKey?: string;
    orderId?: string;
    status?: string;
    approvedAt?: string;
    secret?: string;
  };
  secret?: string;
}

export async function POST(request: Request) {
  let body: TossWebhookPayload;
  try {
    body = (await request.json()) as TossWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const webhookSecret = process.env.TOSS_WEBHOOK_SECRET;
  const receivedSecret = body.secret ?? body.data?.secret;
  // Reject if secret is not configured server-side, or request omits secret, or secrets don't match
  if (!webhookSecret || !receivedSecret || receivedSecret !== webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (body.eventType !== "PAYMENT_STATUS_CHANGED" || !body.data?.orderId) {
    return NextResponse.json({ ok: true });
  }

  const paymentKey = body.data.paymentKey ?? "";

  // For DONE events, re-verify with Toss API before granting credits
  if (body.data.status === "DONE" && paymentKey) {
    const verified = await verifyTossPayment(paymentKey);
    if (!verified || verified.status !== "DONE" || verified.orderId !== body.data.orderId) {
      return NextResponse.json({ ok: false }, { status: 422 });
    }
  }

  await reconcileTossWebhook({
    paymentKey,
    orderId: body.data.orderId,
    status: body.data.status ?? "",
    approvedAt: body.data.approvedAt,
  });

  return NextResponse.json({ ok: true });
}
