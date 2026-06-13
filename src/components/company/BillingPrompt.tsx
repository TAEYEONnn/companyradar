"use client";

import { CreditCard, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { Button } from "@/components/ui/button";
import { AI_CREDIT_PRODUCT, formatWon } from "@/lib/billing";
import { getSupabaseClient } from "@/lib/supabase-client";

interface BillingOrder {
  orderId: string;
  orderName: string;
  amount: number;
  customerKey: string;
  customerEmail: string;
}

export function BillingPrompt() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handlePaymentRequired() {
      setError("");
      setOpen(true);
    }
    window.addEventListener("ai-payment-required", handlePaymentRequired);
    return () => {
      window.removeEventListener("ai-payment-required", handlePaymentRequired);
    };
  }, []);

  async function startCheckout() {
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) {
      setError("토스페이먼츠 클라이언트 키가 설정되지 않았습니다.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = getSupabaseClient();
      const accessToken = supabase
        ? (await supabase.auth.getSession()).data.session?.access_token
        : undefined;
      if (!accessToken) {
        setError("로그인이 필요합니다.");
        return;
      }

      const orderResponse = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ productCode: AI_CREDIT_PRODUCT.code }),
      });
      const orderJson = (await orderResponse.json()) as
        | { ok: true; order: BillingOrder }
        | { ok?: false; error?: { message?: string } };
      if (!orderResponse.ok || !("ok" in orderJson) || !orderJson.ok) {
        setError(
          "error" in orderJson
            ? orderJson.error?.message ?? "주문 생성에 실패했습니다."
            : "주문 생성에 실패했습니다.",
        );
        return;
      }

      const tossPayments = await loadTossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: orderJson.order.customerKey });
      await payment.requestPayment({
        method: "CARD",
        amount: {
          currency: "KRW",
          value: orderJson.order.amount,
        },
        orderId: orderJson.order.orderId,
        orderName: orderJson.order.orderName,
        customerEmail: orderJson.order.customerEmail,
        successUrl: `${window.location.origin}/billing/success`,
        failUrl: `${window.location.origin}/billing/fail`,
      });
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "결제창을 여는 중 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4"
      onClick={() => setOpen(false)}
      role="dialog"
    >
      <div
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-full bg-sky-50 p-2 text-sky-700">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                AI 기능은 유료 베타입니다
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                계정당 1회 무료로 체험할 수 있고, 이후에는 10회권을 구매해 계속 사용할 수 있어요.
              </p>
            </div>
          </div>
          <button
            aria-label="닫기"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={() => setOpen(false)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {AI_CREDIT_PRODUCT.name}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                성공한 AI 응답에만 1회 차감
              </div>
            </div>
            <div className="text-sm font-bold text-slate-950">
              {formatWon(AI_CREDIT_PRODUCT.amountKrw)}
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setOpen(false)} variant="secondary">
            나중에
          </Button>
          <Button disabled={loading} onClick={startCheckout}>
            <CreditCard className="h-4 w-4" />
            {loading ? "결제 준비 중..." : "10회권 4,900원 구매"}
          </Button>
        </div>
      </div>
    </div>
  );
}
