"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BillingFailClient() {
  const searchParams = useSearchParams();
  const message =
    searchParams.get("message") ??
    "결제를 마치지 못했어요. 다시 시도해주세요.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-950">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-sm font-bold text-red-600">
          !
        </div>
        <h1 className="mt-4 text-lg font-semibold">결제가 취소됐어요</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <Button className="mt-5" onClick={() => { window.location.href = "/"; }}>
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
