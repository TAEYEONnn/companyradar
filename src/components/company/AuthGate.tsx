"use client";

import { KeyRound, LogIn, Mail, ShieldCheck, UserPlus } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { getPasswordResetRedirectUrl, getSupabaseClient } from "@/lib/supabase-client";
import { USER_COPY } from "@/lib/user-copy";

type AuthMode = "login" | "signup" | "reset";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getAuthErrorMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? "";
  if (normalized.includes("rate") || normalized.includes("limit") || normalized.includes("429")) {
    return USER_COPY.auth.rateLimited;
  }
  return USER_COPY.auth.invalidCredentials;
}

export function AuthGate() {
  const [mode, setMode] = useState<AuthMode>(() => {
    if (typeof window === "undefined") return "login";
    return new URLSearchParams(window.location.search).get("reset") === "1" ? "reset" : "login";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetCooldown, setResetCooldown] = useState(0);

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

    const resetUrl = new URL("/auth/reset-password", window.location.origin);
    resetUrl.searchParams.set("code", code);
    window.location.replace(resetUrl.toString());
  }, [recoveringCode]);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResetCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldown]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  function validateEmail(nextEmail: string) {
    if (!nextEmail) {
      setError("이메일을 입력해주세요.");
      return false;
    }
    if (!isValidEmail(nextEmail)) {
      setError("이메일 주소를 다시 확인해주세요.");
      return false;
    }
    return true;
  }

  function validatePassword(nextPassword: string) {
    if (nextPassword.length < 8) {
      setError("비밀번호는 8자 이상으로 만들어주세요.");
      return false;
    }
    return true;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("로그인 연결이 아직 준비되지 않았어요.");
      return;
    }
    const nextEmail = email.trim();
    if (!validateEmail(nextEmail)) return;
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
      setError(getAuthErrorMessage(signInError.message));
    }
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("로그인 연결이 아직 준비되지 않았어요.");
      return;
    }
    const nextEmail = email.trim();
    if (!validateEmail(nextEmail) || !validatePassword(password)) return;
    if (password !== confirmPassword) {
      setError("비밀번호가 서로 달라요.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: nextEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(getAuthErrorMessage(signUpError.message));
      return;
    }

    if (data.session) {
      setMessage("가입이 완료됐어요.");
    } else {
      setMessage("확인 메일을 보냈어요. 메일함을 확인해주세요.");
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resetCooldown > 0) return;
    if (!supabase) {
      setError("로그인 연결이 아직 준비되지 않았어요.");
      return;
    }
    const nextEmail = email.trim();
    if (!validateEmail(nextEmail)) return;

    setLoading(true);
    setError("");
    setMessage("");
    const redirectTo = getPasswordResetRedirectUrl();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(nextEmail, {
      redirectTo,
    });
    setLoading(false);

    if (resetError) {
      console.error("[AuthGate] resetPasswordForEmail error:", resetError);
      const normalized = resetError.message?.toLowerCase() ?? "";
      const isRateLimit = normalized.includes("rate") || normalized.includes("limit");
      if (isRateLimit) {
        setError(USER_COPY.auth.rateLimited);
      } else if (process.env.NODE_ENV === "development") {
        setError(
          `비밀번호 재설정 메일을 보내지 못했습니다.\n오류: ${resetError.message}\n\nSupabase 대시보드 → Authentication → Redirect URLs에 "${redirectTo}" 추가 여부를 확인하세요.`,
        );
      } else {
        setError("재설정 메일을 보내지 못했어요. 잠시 후 다시 해주세요.");
      }
      return;
    }
    setResetCooldown(60);
    setMessage("재설정 메일을 보냈어요. 메일함을 확인해주세요.");
  }

  if (recoveringCode) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="text-center text-sm text-slate-500">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          인증 링크를 확인하고 있어요...
        </div>
      </main>
    );
  }

  const isSignup = mode === "signup";
  const isReset = mode === "reset";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 text-slate-950">
      <section className="w-full max-w-[420px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          CompanyRadar
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
          지원할 공고, 한곳에서 관리해요
        </h1>
        <p className="mt-1.5 text-sm leading-5 text-slate-500">
          공고 분석부터 지원 상태, 면접 준비까지 이어서 볼 수 있어요.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {["회사 추가", "점수 확인", "면접 준비"].map((step, index) => (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2" key={step}>
              <div className="text-[11px] font-semibold text-sky-600">{index + 1}</div>
              <div className="mt-0.5 text-xs font-medium text-slate-700">{step}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-600">
          {isReset
            ? "가입한 이메일로 비밀번호 재설정 링크를 보내드릴게요."
            : isSignup
              ? "계정을 만들면 분석한 공고를 계속 저장할 수 있어요."
              : "다시 오셨네요. 이어서 준비해볼까요?"}
        </div>

        <form
          className="mt-4 space-y-3"
          onSubmit={isReset ? handleResetPassword : isSignup ? handleSignup : handleLogin}
        >
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
          {!isReset ? (
            <div className="space-y-1.5">
              <Label htmlFor="auth-password">비밀번호</Label>
              <Input
                autoComplete={isSignup ? "new-password" : "current-password"}
                id="auth-password"
                minLength={isSignup ? 8 : undefined}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isSignup ? "8자 이상" : "비밀번호"}
                type="password"
                value={password}
              />
            </div>
          ) : null}
          {isSignup ? (
            <div className="space-y-1.5">
              <Label htmlFor="auth-password-confirm">비밀번호 확인</Label>
              <Input
                autoComplete="new-password"
                id="auth-password-confirm"
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="동일하게 입력"
                type="password"
                value={confirmPassword}
              />
            </div>
          ) : null}

          <Button className="w-full" disabled={loading || (isReset && resetCooldown > 0)} type="submit">
            {isReset ? <Mail className="h-4 w-4" /> : isSignup ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {loading
              ? isReset
                ? "메일을 보내고 있어요..."
                : isSignup
                  ? "계정을 만들고 있어요..."
                  : "로그인하고 있어요..."
              : isReset && resetCooldown > 0
                ? `${resetCooldown}초 후 다시 요청`
              : isReset
                ? "비밀번호 재설정 메일 받기"
                : isSignup
                  ? "회원가입"
                  : "로그인"}
          </Button>
        </form>

        {message ? (
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 whitespace-pre-line">
            {error}
          </div>
        ) : null}

        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
          {isReset ? (
            <button
              className="text-slate-500 hover:text-slate-800"
              onClick={() => switchMode("login")}
              type="button"
            >
              로그인으로 돌아가기
            </button>
          ) : isSignup ? (
            <button
              className="text-slate-500 hover:text-slate-800"
              onClick={() => switchMode("login")}
              type="button"
            >
              이미 계정이 있나요? 로그인
            </button>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                className="text-slate-500 hover:text-slate-800"
                onClick={() => switchMode("signup")}
                type="button"
              >
                아직 계정이 없나요? 회원가입
              </button>
              <button
                className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700"
                onClick={() => switchMode("reset")}
                type="button"
              >
                <KeyRound className="h-3.5 w-3.5" />
                비밀번호를 잊으셨나요?
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
