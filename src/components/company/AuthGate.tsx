"use client";

import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { getAuthRedirectUrl, getSupabaseClient } from "@/lib/supabase-client";

const MAGIC_LINK_COOLDOWN_MS = 60_000;

function getMagicLinkCooldownKey(email: string) {
  return `companyradar:magic-link-sent-at:${email.toLowerCase()}`;
}

function getRemainingCooldownSeconds(email: string) {
  if (typeof window === "undefined") return 0;
  const sentAt = Number(window.localStorage.getItem(getMagicLinkCooldownKey(email)) ?? 0);
  if (!sentAt) return 0;
  return Math.max(0, Math.ceil((MAGIC_LINK_COOLDOWN_MS - (Date.now() - sentAt)) / 1000));
}

function rememberMagicLinkSent(email: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getMagicLinkCooldownKey(email), String(Date.now()));
}

export function AuthGate() {
  const [email, setEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [devError, setDevError] = useState("");

  const [recoveringCode] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(new URLSearchParams(window.location.search).get("code"));
  });

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!recoveringCode) return;
    const current = new URL(window.location.href);
    const code = current.searchParams.get("code");
    if (!code) return;

    const confirmUrl = new URL("/auth/confirm", window.location.origin);
    confirmUrl.searchParams.set("code", code);
    window.location.replace(confirmUrl.toString());
  }, [recoveringCode]);

  function toggleAdminLogin() {
    setAdminOpen((open) => !open);
    setError("");
    setMessage("");
  }

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase 환경변수가 설정되지 않았습니다.");
      return;
    }
    const nextEmail = email.trim();
    if (!nextEmail) {
      setError("이메일을 입력해주세요.");
      return;
    }
    const remainingSeconds = getRemainingCooldownSeconds(nextEmail);
    if (remainingSeconds > 0) {
      setMessage("");
      setError(`방금 로그인 링크 요청을 완료했습니다. 메일함을 확인하거나 ${remainingSeconds}초 후 다시 시도해주세요.`);
      setDevError(
        process.env.NODE_ENV === "development"
          ? "[dev] 직전 요청이 성공했을 때만 로컬 재발송 차단을 적용합니다. Redirect URL 설정 문제는 아닙니다."
          : "",
      );
      return;
    }

    setLoading(true);
    setError("");
    setDevError("");
    setMessage("");
    const redirectUrl = getAuthRedirectUrl();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: nextEmail,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    setLoading(false);

    if (signInError) {
      console.error("[AuthGate] signInWithOtp error:", signInError);
      const msg = signInError.message?.toLowerCase() ?? "";
      const isRateLimit = msg.includes("rate") || msg.includes("limit") || signInError.status === 429;
      if (isRateLimit) {
        setError("Supabase 이메일 발송 한도에 걸렸습니다. 잠시 후 다시 시도하거나 운영자에게 알려주세요.");
      } else {
        setError("링크 발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
      if (process.env.NODE_ENV === "development") {
        setDevError(
          isRateLimit
            ? `[dev] ${signInError.message ?? String(signInError)}\n\nRedirect URL: ${redirectUrl ?? "(없음)"}\n\n이 에러는 Supabase Auth 이메일/OTP 발송 한도입니다. Site URL 또는 Redirect URLs 설정 문제가 아닙니다.\nSupabase Dashboard › Authentication › Rate Limits에서 OTP/email sent 한도를 확인하고, 프로덕션에서는 Custom SMTP 설정을 권장합니다.`
            : `[dev] ${signInError.message ?? String(signInError)}\n\nRedirect URL: ${redirectUrl ?? "(없음)"}\n→ Supabase 대시보드 › Authentication › URL Configuration › Redirect URLs 에 이 URL이 등록되어 있는지 확인하세요.`,
        );
      }
      return;
    }
    rememberMagicLinkSent(nextEmail);
    const isLocalhost = redirectUrl?.includes("localhost") ?? false;
    setMessage(
      isLocalhost
        ? `${nextEmail}로 로그인 링크를 보냈습니다. 메일함에서 링크를 클릭하기 전에 로컬 서버(npm run dev)가 실행 중이어야 합니다.`
        : `${nextEmail}로 로그인 링크를 보냈습니다. 메일함을 확인하고 링크를 클릭하면 바로 이어서 사용할 수 있어요.`,
    );
  }

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase 환경변수가 설정되지 않았습니다.");
      return;
    }
    const nextEmail = adminEmail.trim();
    if (!nextEmail || !password) {
      setError("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: nextEmail,
      password,
    });
    setLoading(false);

    if (signInError) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    // 성공 시 onAuthStateChange가 세션을 잡아 앱으로 진입합니다.
  }

  if (recoveringCode) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="text-center text-sm text-slate-500">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          로그인 링크 확인 중...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 text-slate-950">
      <section className="w-full max-w-[420px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          CompanyRadar
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
          지원할 회사를 기준 있게 정리하세요
        </h1>
        <p className="mt-1.5 text-sm leading-5 text-slate-500">
          회사핏 점수, 리스크, 면접 준비 기록을 한 곳에서 관리하는 개인용 지원 트래커입니다.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {["회사 추가", "점수 확인", "면접 준비"].map((step, index) => (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2" key={step}>
              <div className="text-[11px] font-semibold text-sky-600">{index + 1}</div>
              <div className="mt-0.5 text-xs font-medium text-slate-700">{step}</div>
            </div>
          ))}
        </div>

        <form className="mt-5 space-y-3" onSubmit={requestMagicLink}>
          <div className="space-y-1.5">
            <Label htmlFor="magic-email">이메일</Label>
            <Input
              autoComplete="email"
              id="magic-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </div>
          <Button className="w-full" disabled={loading} type="submit">
            <Mail className="h-4 w-4" />
            {loading ? "링크 보내는 중..." : "로그인 링크 받기"}
          </Button>
        </form>

        {message ? (
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {devError ? (
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-100 px-3 py-2 text-[11px] leading-5 text-slate-600">
            {devError}
          </pre>
        ) : null}

        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600"
            onClick={toggleAdminLogin}
            type="button"
          >
            <KeyRound className="h-3.5 w-3.5" />
            관리자 로그인
          </button>
        </div>

        {adminOpen ? (
          <form
            className="mt-3 space-y-3 rounded-lg border border-slate-200 p-3"
            onSubmit={signInWithPassword}
          >
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">관리자 이메일</Label>
              <Input
                autoComplete="email"
                id="admin-email"
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="admin@example.com"
                type="email"
                value={adminEmail}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">비밀번호</Label>
              <Input
                autoComplete="current-password"
                id="admin-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                type="password"
                value={password}
              />
            </div>
            <Button className="w-full" disabled={loading} type="submit" variant="secondary">
              {loading ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
