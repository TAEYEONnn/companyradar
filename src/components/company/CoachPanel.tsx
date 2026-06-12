"use client";

import { BrainCircuit, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSupabaseClient } from "@/lib/supabase-client";
import { INTERVIEW_ROUND_TYPE_LABELS, STATUS_LABELS } from "@/lib/criteria";
import type { Company, CompanyScoreResult } from "@/lib/types";
import { STATUS_TONE } from "./shared";

interface CoachPanelProps {
  companies: Company[];
  scoreMap: Map<string, CompanyScoreResult>;
  onBack: () => void;
}

type ActionUrgency = "urgent" | "normal" | "low";

interface ActionRec {
  action: string;
  urgency: ActionUrgency;
  context?: string;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - Date.parse(dateStr)) / 86_400_000);
}

function daysUntil(dateStr: string): number {
  return Math.ceil((Date.parse(dateStr) - Date.now()) / 86_400_000);
}

function getActionRec(company: Company, today: string): ActionRec {
  const { status } = company;

  const lastHistory = (company.statusHistory ?? [])
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const daysSinceChange = lastHistory
    ? daysSince(lastHistory.date.slice(0, 10))
    : null;

  const upcomingInterview = company.interviewRounds
    .filter((r) => r.result === "scheduled" && r.scheduledAt >= today)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];

  const hasPending = company.interviewRounds.some((r) => r.result === "pending");

  if (status === "offer") {
    return { action: "오퍼 조건 검토 및 협상 진행", urgency: "urgent" };
  }

  if (status === "interviewing") {
    if (upcomingInterview) {
      const days = daysUntil(upcomingInterview.scheduledAt);
      const label =
        INTERVIEW_ROUND_TYPE_LABELS[upcomingInterview.type] ?? upcomingInterview.type;
      return {
        action: `${label} 면접 준비`,
        urgency: days <= 3 ? "urgent" : "normal",
        context: `${upcomingInterview.scheduledAt} · ${days}일 후`,
      };
    }
    if (hasPending) {
      return { action: "면접 결과 입력 필요", urgency: "normal" };
    }
    return { action: "결과 대기 중", urgency: "low" };
  }

  if (status === "applied") {
    if (daysSinceChange !== null && daysSinceChange >= 14) {
      return {
        action: "팔로업 메일 발송",
        urgency: "urgent",
        context: `지원 후 ${daysSinceChange}일 경과 — 담당자에게 연락`,
      };
    }
    if (daysSinceChange !== null && daysSinceChange >= 7) {
      return {
        action: "팔로업 메일 발송 고려",
        urgency: "normal",
        context: `지원 후 ${daysSinceChange}일 경과`,
      };
    }
    return {
      action: "응답 대기 중",
      urgency: "low",
      context: daysSinceChange !== null ? `지원 후 ${daysSinceChange}일` : undefined,
    };
  }

  if (status === "planned") {
    if (company.jobDeadline) {
      const days = daysUntil(company.jobDeadline);
      if (days >= 0 && days <= 7) {
        return {
          action: "마감 임박 — 지원서 제출",
          urgency: "urgent",
          context: `마감 ${company.jobDeadline} · ${days}일 남음`,
        };
      }
    }
    return { action: "지원서 준비 및 제출", urgency: "normal" };
  }

  if (status === "interested") {
    return { action: "회사 리서치 및 공고 확인", urgency: "low" };
  }

  return { action: "상태 업데이트 필요", urgency: "low" };
}

const URGENCY_DOT: Record<ActionUrgency, string> = {
  urgent: "bg-red-500",
  normal: "bg-amber-400",
  low: "bg-slate-300",
};

const URGENCY_ORDER: Record<ActionUrgency, number> = {
  urgent: 0,
  normal: 1,
  low: 2,
};

export function CoachPanel({ companies, scoreMap, onBack }: CoachPanelProps) {
  const [strategy, setStrategy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [strategyOpen, setStrategyOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const recs = companies
    .filter((c) => !["rejected", "on_hold"].includes(c.status))
    .map((c) => ({ company: c, rec: getActionRec(c, today) }))
    .sort(
      (a, b) =>
        URGENCY_ORDER[a.rec.urgency] - URGENCY_ORDER[b.rec.urgency] ||
        a.company.name.localeCompare(b.company.name),
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
            회사별 다음 행동 추천 · {recs.filter((r) => r.rec.urgency === "urgent").length}건 즉시 행동 필요
          </p>
        </div>
        <Button onClick={onBack} variant="secondary">
          ← 대시보드
        </Button>
      </div>

      {/* 회사별 다음 행동 */}
      {recs.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          진행 중인 회사가 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {recs.map(({ company, rec }) => (
            <li key={company.id} className="flex items-start gap-3 px-4 py-3">
              <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${URGENCY_DOT[rec.urgency]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={STATUS_TONE[company.status]}>
                    {company.name}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    {STATUS_LABELS[company.status]}
                  </span>
                </div>
                <p className="mt-0.5 text-sm font-medium text-slate-800">
                  {rec.action}
                </p>
                {rec.context && (
                  <p className="mt-0.5 text-xs text-slate-400">{rec.context}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

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
