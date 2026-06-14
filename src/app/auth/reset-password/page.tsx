"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase-client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // After password change succeeds, auto-redirect to login after 2 s.
  useEffect(() => {
    if (status !== "done") return;
    const timer = setTimeout(() => {
      window.location.replace("/");
    }, 2000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseClient();
    if (!supabase) {
      queueMicrotask(() => {
        if (mounted) setHasSession(false);
      });
      return;
    }
    const client = supabase;

    async function prepareRecoverySession() {
      const currentUrl = new URL(window.location.href);
      const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
      const code = currentUrl.searchParams.get("code");
      const tokenHash = currentUrl.searchParams.get("token_hash");
      const type = currentUrl.searchParams.get("type");
      const hashType = hashParams.get("type");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      const hasRecoveryParam = Boolean(code || tokenHash || accessToken);

      // No recovery params → do not fall back to existing session.
      // An operator session in localStorage must not grant access to this form.
      if (!hasRecoveryParam) {
        if (mounted) setHasSession(false);
        return;
      }

      try {
        if (code) {
          // Sign out any existing session first — prevents a logged-in operator's session
          // from being used if code exchange fails (wrong-account bleed).
          await client.auth.signOut();
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type === "recovery") {
          await client.auth.signOut();
          const { error } = await client.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as EmailOtpType,
          });
          if (error) throw error;
        } else if (accessToken && refreshToken && (!hashType || hashType === "recovery")) {
          await client.auth.signOut();
          const { error } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        const { data } = await client.auth.getSession();
        if (!mounted) return;
        setHasSession(Boolean(data.session));
        if (data.session) {
          window.history.replaceState(null, "", "/auth/reset-password");
        }
      } catch (error) {
        console.error("[auth/reset-password] recovery session error:", error);
        if (mounted) setHasSession(false);
      }
    }

    void prepareRecoverySession();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setErrorMsg("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    const supabase = getSupabaseClient();
    if (!supabase || !hasSession) {
      setErrorMsg("비밀번호 재설정 링크를 다시 열어주세요.");
      setStatus("error");
      return;
    }
    const { error } = (await supabase?.auth.updateUser({ password })) ?? {};
    if (error) {
      setErrorMsg("비밀번호 변경에 실패했습니다. 링크가 만료되었을 수 있습니다.");
      setStatus("error");
    } else {
      // Sign out the recovery session — prevents the reset user from being
      // auto-logged in and confusing a browser that had an operator session.
      await supabase?.auth.signOut();
      setStatus("done");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">비밀번호 재설정</h1>
        <p className="mb-6 text-sm text-slate-500">새 비밀번호를 입력해주세요.</p>

        {hasSession === false ? (
          <div className="space-y-3">
            <p className="rounded-md bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              재설정 링크가 만료됐거나 이미 사용된 링크입니다.
              메일 링크는 같은 브라우저에서만 사용할 수 있습니다.
              새 재설정 메일을 요청해주세요.
            </p>
            <Link
              className="block w-full rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-700"
              href="/?reset=1"
            >
              새 재설정 메일 요청하기
            </Link>
            <Link
              className="block w-full rounded-md border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-600 hover:bg-slate-50"
              href="/"
            >
              로그인 화면으로 돌아가기
            </Link>
          </div>
        ) : status === "done" ? (
          <div className="space-y-4">
            <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
              비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.
            </p>
            <Link
              className="block w-full rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-700"
              href="/"
            >
              로그인 화면으로 이동
            </Link>
          </div>
        ) : hasSession === null ? (
          <div className="py-8 text-center text-sm text-slate-500">재설정 링크 확인 중...</div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
                새 비밀번호
              </label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                id="password"
                minLength={8}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8자 이상"
                required
                type="password"
                value={password}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="confirm">
                비밀번호 확인
              </label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                id="confirm"
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="동일하게 입력"
                required
                type="password"
                value={confirm}
              />
            </div>

            {errorMsg && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{errorMsg}</p>
            )}

            <button
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-slate-700"
              disabled={status === "loading"}
              type="submit"
            >
              {status === "loading" ? "변경 중..." : "비밀번호 변경"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
