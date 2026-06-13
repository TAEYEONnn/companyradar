"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase-client";

export function BillingSuccessClient() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("결제를 확인하고 있습니다.");

  useEffect(() => {
    async function confirmPayment() {
      const paymentKey = searchParams.get("paymentKey") ?? "";
      const orderId = searchParams.get("orderId") ?? "";
      const amount = searchParams.get("amount") ?? "";

      if (!paymentKey || !orderId || !amount) {
        setState("error");
        setMessage("결제 승인 정보가 부족합니다.");
        return;
      }

      try {
        const supabase = getSupabaseClient();
        const accessToken = supabase
          ? (await supabase.auth.getSession()).data.session?.access_token
          : undefined;
        if (!accessToken) {
          setState("error");
          setMessage("로그인이 필요합니다. 다시 로그인한 뒤 결제를 확인해주세요.");
          return;
        }

        const response = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ paymentKey, orderId, amount }),
        });
        const json = (await response.json()) as
          | { ok: true; alreadyApproved?: boolean }
          | { ok?: false; error?: { message?: string } };

        if (!response.ok || !("ok" in json) || !json.ok) {
          setState("error");
          setMessage(
            "error" in json
              ? json.error?.message ?? "결제 승인에 실패했습니다."
              : "결제 승인에 실패했습니다.",
          );
          return;
        }

        setState("success");
        setMessage(
          json.alreadyApproved
            ? "이미 반영된 결제입니다. AI 이용권을 사용할 수 있어요."
            : "AI 10회권이 추가되었습니다.",
        );
      } catch {
        setState("error");
        setMessage("결제 승인 요청 중 오류가 발생했습니다.");
      }
    }

    void confirmPayment();
  }, [searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-950">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        {state === "loading" ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-500" />
        ) : state === "success" ? (
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
        ) : (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-sm font-bold text-red-600">
            !
          </div>
        )}
        <h1 className="mt-4 text-lg font-semibold">
          {state === "success" ? "결제가 완료되었습니다" : "결제 확인"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <Button className="mt-5" onClick={() => { window.location.href = "/"; }}>
          트래커로 돌아가기
        </Button>
      </section>
    </main>
  );
}
