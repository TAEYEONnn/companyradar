"use client";

import { KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { getAuthRedirectUrl, getSupabaseClient } from "@/lib/supabase-client";

export function AuthGate() {
  const [email, setEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = getSupabaseClient();

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
      setError(signInError.message);
      return;
    }
    setMessage(`${nextEmail}로 로그인 링크를 보냈습니다. 메일에서 링크를 열면 바로 이어서 사용할 수 있어요.`);
  }

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase 환경변수가 설정되지 않았습니다.");
      return;
    }
    const nextEmail = adminEmail.trim();
    if (!nextEmail) {
      setError("관리자 이메일을 입력해주세요.");
      return;
    }
    if (!password) {
      setError("비밀번호를 입력해주세요.");
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
      setError(signInError.message);
      return;
    }
    // 성공 시 onAuthStateChange가 세션을 잡아 앱으로 진입합니다.
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 text-slate-950">
      <section className="w-full max-w-[460px] rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Career Company Tracker
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal">
          지원할 회사를 안전하게 정리하세요
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          채용 공고, 회사 조사, 면접 준비 기록을 로그인한 계정별로 저장하는 개인용 지원 관리 도구입니다.
        </p>

        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
          <div className="flex gap-2">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>
              비밀번호 없이 이메일 링크로 로그인합니다. 같은 이메일로 접속하면 내 회사 목록과 설정만 불러옵니다.
            </p>
          </div>
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

        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700"
            onClick={toggleAdminLogin}
            type="button"
          >
            <KeyRound className="h-3.5 w-3.5" />
            관리자 로그인
          </button>
        </div>

        {adminOpen ? (
          <form className="mt-3 space-y-3 rounded-md border border-slate-200 bg-white p-3" onSubmit={signInWithPassword}>
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
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        ) : null}

        {message ? (
          <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
