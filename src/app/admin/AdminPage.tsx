"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";
import { AdminDashboard } from "./AdminDashboard";

type RequestData = {
  support: object[];
  refunds: object[];
  deletions: object[];
};

export function AdminPage() {
  const [state, setState] = useState<"loading" | "forbidden" | "config_error" | "server_error" | "ready">("loading");
  const [data, setData] = useState<RequestData>({ support: [], refunds: [], deletions: [] });
  const [errorDetail, setErrorDetail] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) { setState("forbidden"); return; }
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) { setState("forbidden"); return; }

        const res = await fetch("/api/admin/requests", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 403 || res.status === 401) {
          setState("forbidden");
          return;
        }
        if (res.status === 503) {
          setState("config_error");
          try {
            const body = (await res.json()) as { error?: { message?: string } };
            setErrorDetail(body.error?.message ?? "");
          } catch { /* ignore */ }
          return;
        }
        if (!res.ok) {
          setState("server_error");
          setErrorDetail(`HTTP ${res.status}`);
          return;
        }

        const json = (await res.json()) as RequestData;
        setData(json);
        setState("ready");
      } catch (e) {
        setState("server_error");
        setErrorDetail(e instanceof Error ? e.message : String(e));
      }
    }
    void load();
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        로딩 중...
      </div>
    );
  }

  if (state === "config_error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm font-medium text-slate-700">서버 설정 오류</p>
        <p className="text-xs text-slate-500">
          SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.
        </p>
        {errorDetail && (
          <p className="mt-1 max-w-sm rounded bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-500">
            {errorDetail}
          </p>
        )}
        <a className="mt-2 text-xs text-sky-600 underline" href="/">홈으로</a>
      </div>
    );
  }

  if (state === "server_error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm font-medium text-slate-700">서버 오류가 발생했습니다.</p>
        {errorDetail && (
          <p className="mt-1 max-w-sm rounded bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-500">
            {errorDetail}
          </p>
        )}
        <a className="mt-2 text-xs text-sky-600 underline" href="/">홈으로</a>
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm font-medium text-slate-700">접근 권한이 없습니다.</p>
        <p className="text-xs text-slate-400">
          운영자 계정(profiles.role = owner 또는 AI_ALLOWED_EMAILS)으로 로그인 후 다시 시도해 주세요.
        </p>
        <a className="mt-2 text-xs text-sky-600 underline" href="/">홈으로</a>
      </div>
    );
  }

  return (
    <AdminDashboard
      initialDeletions={data.deletions as Parameters<typeof AdminDashboard>[0]["initialDeletions"]}
      initialRefunds={data.refunds as Parameters<typeof AdminDashboard>[0]["initialRefunds"]}
      initialSupport={data.support as Parameters<typeof AdminDashboard>[0]["initialSupport"]}
    />
  );
}
