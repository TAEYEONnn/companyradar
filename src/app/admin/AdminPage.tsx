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
  const [state, setState] = useState<"loading" | "forbidden" | "ready">("loading");
  const [data, setData] = useState<RequestData>({ support: [], refunds: [], deletions: [] });

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
        if (res.status === 403 || res.status === 401) { setState("forbidden"); return; }
        if (!res.ok) { setState("forbidden"); return; }

        const json = (await res.json()) as RequestData;
        setData(json);
        setState("ready");
      } catch {
        setState("forbidden");
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

  if (state === "forbidden") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium text-slate-700">접근 권한이 없습니다.</p>
        <p className="text-xs text-slate-400">운영자 계정으로 로그인 후 다시 시도해 주세요.</p>
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
