import { reconcileTossWebhook } from "@/lib/server-billing";
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
  if (webhookSecret && receivedSecret && receivedSecret !== webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (body.eventType !== "PAYMENT_STATUS_CHANGED" || !body.data?.orderId) {
    return NextResponse.json({ ok: true });
  }

  await reconcileTossWebhook({
    paymentKey: body.data.paymentKey ?? "",
    orderId: body.data.orderId,
    status: body.data.status ?? "",
    approvedAt: body.data.approvedAt,
  });

  return NextResponse.json({ ok: true });
}
