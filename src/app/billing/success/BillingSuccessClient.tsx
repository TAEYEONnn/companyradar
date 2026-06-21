"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase-client";

export function BillingSuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("결제 내용을 확인하고 있어요.");

  useEffect(() => {
    async function confirmPayment() {
      const paymentKey = searchParams.get("paymentKey") ?? "";
      const orderId = searchParams.get("orderId") ?? "";
      const amount = searchParams.get("amount") ?? "";

      if (!paymentKey || !orderId || !amount) {
        setState("error");
        setMessage("결제 정보를 확인하지 못했어요.");
        return;
      }

      try {
        const supabase = getSupabaseClient();
        const accessToken = supabase
          ? (await supabase.auth.getSession()).data.session?.access_token
          : undefined;
        if (!accessToken) {
          setState("error");
          setMessage("로그인한 뒤 결제 내용을 다시 확인해주세요.");
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
              ? json.error?.message ?? "결제를 승인하지 못했어요."
              : "결제를 승인하지 못했어요.",
          );
          return;
        }

        setState("success");
        setMessage(
          json.alreadyApproved
            ? "이미 반영된 결제예요. AI 이용권을 바로 사용할 수 있어요."
            : "AI 10회 이용권을 추가했어요.",
        );
      } catch {
        setState("error");
        setMessage("결제를 확인하는 중 문제가 생겼어요.");
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
          {state === "success" ? "결제가 완료됐어요" : "결제 확인"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <Button className="mt-5" onClick={() => { router.push("/"); }}>
          트래커로 돌아가기
        </Button>
        <nav className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <Link className="hover:text-slate-600" href="/terms">이용약관</Link>
          <Link className="hover:text-slate-600" href="/refund-policy">환불정책</Link>
          <a className="hover:text-slate-600" href="mailto:support@companyradar.io">문의하기</a>
        </nav>
      </section>
    </main>
  );
}
