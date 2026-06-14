"use client";

import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { getAuthRedirectUrl, getSupabaseClient } from "@/lib/supabase-client";

export function AuthGate() {
  const [email, setEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = getSupabaseClient();

  // Exchange PKCE code from URL after magic link redirect
  useEffect(() => {
    if (!supabase) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    setExchanging(true);
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: err }) => {
        if (err) {
          setError("로그인 링크가 만료됐거나 올바르지 않습니다. 새 링크를 요청해 주세요.");
        }
        // On success, onAuthStateChange in CompanyTrackerApp catches the session.
        // Remove the code from the URL to keep it clean.
        const clean = new URL(window.location.href);
        clean.searchParams.delete("code");
        window.history.replaceState({}, "", clean.toString());
      })
      .finally(() => setExchanging(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    setLoading(true);
    setError("");
    setMessage("");
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: nextEmail,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    setLoading(false);

    if (signInError) {
      setError("링크 발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setMessage(`${nextEmail}로 로그인 링크를 보냈습니다. 메일함을 확인하고 링크를 클릭하면 바로 이어서 사용할 수 있어요.`);
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

  if (exchanging) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="text-center text-sm text-slate-500">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          로그인 중...
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
          지원할 회사를 정리하세요
        </h1>
        <p className="mt-1.5 text-sm leading-5 text-slate-500">
          채용 공고, 회사 조사, 면접 준비 기록을 로그인한 계정별로 저장합니다.
        </p>

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
