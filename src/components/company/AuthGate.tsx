"use client";

import { Mail } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { getAuthRedirectUrl, getSupabaseClient } from "@/lib/supabase-client";

export function AuthGate() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = getSupabaseClient();

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
          이메일 Magic Link로 로그인해주세요.
        </p>

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
