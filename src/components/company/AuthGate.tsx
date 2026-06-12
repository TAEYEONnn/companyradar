"use client";

import { KeyRound, Mail } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { getAuthRedirectUrl, getSupabaseClient } from "@/lib/supabase-client";

type AuthMode = "magic" | "password";

export function AuthGate() {
  const [mode, setMode] = useState<AuthMode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = getSupabaseClient();

  function switchMode(next: AuthMode) {
    setMode(next);
    setError("");
    setMessage("");
  }

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase 환경변수가 설정되지 않았습니다.");
      return;
    }
    if (!email.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    setMessage("Magic Link를 보냈습니다. 메일함에서 로그인 링크를 열어주세요.");
  }

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase 환경변수가 설정되지 않았습니다.");
      return;
    }
    if (!email.trim()) {
      setError("이메일을 입력해주세요.");
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
      email: email.trim(),
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
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Mail className="h-4 w-4" />
          Career Company Tracker
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal">
          로그인 후 데이터를 불러옵니다
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          v0.3.1부터 회사 데이터는 Supabase Auth 사용자별 row로 저장됩니다.
          이메일 Magic Link 또는 비밀번호로 로그인해주세요.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">
          <button
            className={cn(
              "flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition",
              mode === "magic"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            )}
            onClick={() => switchMode("magic")}
            type="button"
          >
            <Mail className="h-3.5 w-3.5" />
            Magic Link
          </button>
          <button
            className={cn(
              "flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition",
              mode === "password"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            )}
            onClick={() => switchMode("password")}
            type="button"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Email + Password
          </button>
        </div>

        {mode === "magic" ? (
          <form className="mt-5 space-y-3" onSubmit={requestMagicLink}>
            <Input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "전송 중..." : "Magic Link 받기"}
            </Button>
          </form>
        ) : (
          <form className="mt-5 space-y-3" onSubmit={signInWithPassword}>
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">이메일</Label>
              <Input
                autoComplete="email"
                id="auth-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-password">비밀번호</Label>
              <Input
                autoComplete="current-password"
                id="auth-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                type="password"
                value={password}
              />
            </div>
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "로그인 중..." : "로그인"}
            </Button>
            <p className="text-xs leading-5 text-slate-500">
              개발 테스트용입니다. 계정은 Supabase Dashboard &gt; Authentication &gt;
              Users에서 직접 추가하세요. (앱에 회원가입 기능은 없습니다.)
            </p>
          </form>
        )}

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
        <p className="mt-4 text-xs leading-5 text-slate-500">
          노출된 service role key는 RLS를 우회할 수 있습니다. 현재 프로젝트에서는
          민감한 면접 메모, 연봉/처우, 사람 이름 같은 정보 저장을 권장하지 않습니다.
        </p>
      </section>
    </main>
  );
}
