"use client";

import { BrainCircuit, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase-client";
import type { Company, CompanyScoreResult } from "@/lib/types";
import { isDueOrOverdue } from "./shared";

interface CoachPanelProps {
  companies: Company[];
  scoreMap: Map<string, CompanyScoreResult>;
  onBack: () => void;
}

export function CoachPanel({ companies, scoreMap, onBack }: CoachPanelProps) {
  const [strategy, setStrategy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    let accessToken: string | undefined;
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token;
      }
    } catch { /* non-fatal */ }

    try {
      const snapshots = companies.map((c) => ({
        name: c.name,
        status: c.status,
        applicationPriority: c.applicationPriority,
        fitScore: scoreMap.get(c.id)?.companyFitScore,
        jobDeadline: c.jobDeadline,
        followUpDueDates: c.followUpTasks
          .filter((t) => !t.completed && Boolean(t.dueDate) && isDueOrOverdue(t.dueDate))
          .map((t) => t.dueDate),
        interviewCount: c.interviewRounds.length,
      }));

      const res = await fetch("/api/weekly-strategy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          companies: snapshots,
          today: new Date().toISOString().slice(0, 10),
        }),
      });

      const data = (await res.json()) as
        | { ok: true; strategy: string }
        | { error: { message: string } };

      if (!("ok" in data) || !data.ok) {
        setError("error" in data ? data.error.message : "전략 생성에 실패했습니다.");
        return;
      }
      setStrategy(data.strategy);
    } catch {
      setError("AI 코치 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const active = companies.filter((c) => !["rejected", "on_hold"].includes(c.status)).length;
  const applying = companies.filter((c) => ["applied", "interviewing"].includes(c.status)).length;
  const deadlineSoon = companies.filter((c) => {
    if (!c.jobDeadline || c.jobStatus !== "open") return false;
    const days = Math.ceil((Date.parse(c.jobDeadline) - Date.now()) / 86_400_000);
    return days >= 0 && days <= 7;
  }).length;

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BrainCircuit className="h-5 w-5 text-violet-600" />
            AI 커리어 코치
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            현재 진행 현황을 분석해 이번 주 실행 계획을 제안합니다.
          </p>
        </div>
        <Button onClick={onBack} variant="secondary">
          ← 대시보드
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="진행 중" value={active} />
        <StatCard label="답변 대기" tone="purple" value={applying} />
        <StatCard label="마감 임박 (7일)" tone={deadlineSoon > 0 ? "amber" : "slate"} value={deadlineSoon} />
      </div>

      {/* Explain what each stat means for clarity */}
      <div className="mt-2 space-y-1 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <p><strong>진행 중</strong>: 거절(on_hold) 상태가 아닌 모든 회사 수입니다.</p>
        <p><strong>답변 대기</strong>: 서류를 제출했거나 면접을 진행하여 기업의 결과를 기다리는 회사 수입니다.</p>
        <p><strong>마감 임박 (7일)</strong>: 채용 공고 마감일이 앞으로 7일 이내인 회사 수입니다.</p>
      </div>

      <Button
        className="w-full"
        disabled={loading || companies.length === 0}
        onClick={() => void generate()}
      >
        {loading ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <BrainCircuit className="h-4 w-4" />
        )}
        {loading ? "분석 중..." : strategy ? "전략 재생성" : "이번 주 전략 생성"}
      </Button>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {strategy && (
        <div className="space-y-1 rounded-lg border border-violet-100 bg-violet-50 p-4">
          {strategy.split("\n").map((line, i) => {
            if (line.startsWith("## ")) {
              return (
                <h3 className="mt-3 text-sm font-semibold text-violet-800 first:mt-0" key={i}>
                  {line.replace("## ", "")}
                </h3>
              );
            }
            if (line.startsWith("- ")) {
              return (
                <p className="ml-3 text-sm leading-relaxed text-slate-700" key={i}>
                  • {line.slice(2)}
                </p>
              );
            }
            if (line.trim()) {
              return (
                <p className="text-sm leading-relaxed text-slate-700" key={i}>
                  {line}
                </p>
              );
            }
            return null;
          })}
        </div>
      )}

      {!strategy && !loading && !error && (
        <p className="text-center text-sm text-slate-400">
          버튼을 눌러 AI가 현재 지원 현황을 분석하고 이번 주 우선순위를 제안하게 하세요.
        </p>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "purple" | "amber" | "green";
}) {
  const toneClasses = {
    slate: "bg-slate-50 text-slate-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <div className={`rounded-lg p-3 text-center ${toneClasses[tone]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-xs font-medium">{label}</div>
    </div>
  );
}
