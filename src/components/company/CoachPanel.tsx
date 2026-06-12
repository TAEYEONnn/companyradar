"use client";

import { ArrowLeft, BrainCircuit, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase-client";
import type { Company, CompanyScoreResult } from "@/lib/types";
import { useCurrentDate } from "@/lib/use-current-date";

interface CoachPanelProps {
  companies: Company[];
  scoreMap: Map<string, CompanyScoreResult>;
  onBack: () => void;
}

export function CoachPanel({ companies, scoreMap, onBack }: CoachPanelProps) {
  const [strategy, setStrategy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [strategyOpen, setStrategyOpen] = useState(true);

  const today = useCurrentDate();
  const activeCompanies = companies.filter(
    (company) => !["rejected", "on_hold"].includes(company.status),
  );

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
          today,
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
      setStrategyOpen(true);
    } catch {
      setError("AI 코치 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BrainCircuit className="h-5 w-5 text-violet-600" />
            AI 커리어 코치
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            오늘 할 일과 중복 없는 포트폴리오 전략 · 진행 중 {activeCompanies.length}개
          </p>
        </div>
        <Button onClick={onBack} variant="secondary">
          <ArrowLeft className="h-4 w-4" />
          대시보드
        </Button>
      </div>

      {/* AI 주간 전략 (접기/펼치기) */}
      <div className="rounded-lg border border-slate-200">
        <button
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900"
          onClick={() => setStrategyOpen((v) => !v)}
          type="button"
        >
          <span className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-violet-500" />
            AI 주간 전략
          </span>
          {strategyOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {strategyOpen && (
          <div className="border-t border-slate-200 p-4 space-y-3">
            <Button
              className="w-full"
              disabled={loading || companies.length === 0}
              onClick={() => void generate()}
              size="sm"
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
                      <h3
                        className="mt-3 text-sm font-semibold text-violet-800 first:mt-0"
                        key={i}
                      >
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
              <p className="text-center text-xs text-slate-400">
                버튼을 눌러 AI가 이번 주 우선순위를 제안하게 하세요.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
