"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";

const AUTH_CONFIRM_TIMEOUT_MS = 10000;

function ConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      router.replace("/auth/error");
      return;
    }
    const authCode = code;
    const supabase = getSupabaseClient();
    if (!supabase) {
      router.replace("/auth/error");
      return;
    }
    const client = supabase;

    let active = true;
    const timeout = new Promise<{ timedOut: true }>((resolve) => {
      window.setTimeout(() => resolve({ timedOut: true }), AUTH_CONFIRM_TIMEOUT_MS);
    });

    async function confirmCode() {
      try {
        const result = await Promise.race([
          client.auth
            .exchangeCodeForSession(authCode)
            .then(({ error }) => ({ error, timedOut: false as const })),
          timeout,
        ]);
        if (!active) return;

        if (result.timedOut) {
          console.error("[auth/confirm] exchangeCodeForSession timed out");
          router.replace("/auth/error");
          return;
        }

        if (result.error) {
          console.error("[auth/confirm] exchangeCodeForSession error:", result.error);
          const { data } = await client.auth.getSession();
          if (!active) return;
          router.replace(data.session ? "/" : "/auth/error");
        } else {
          router.replace("/");
        }
      } catch (error) {
        console.error("[auth/confirm] unexpected confirmation error:", error);
        const { data } = await client.auth.getSession();
        if (!active) return;
        router.replace(data.session ? "/" : "/auth/error");
      }
    }

    void confirmCode();

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
        <p className="mt-3 text-sm text-slate-500">로그인 처리 중...</p>
      </div>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense>
      <ConfirmInner />
    </Suspense>
  );
}
