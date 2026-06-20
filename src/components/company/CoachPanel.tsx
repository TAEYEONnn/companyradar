"use client";

import { ArrowLeft, BrainCircuit, ChevronDown, ChevronUp, RefreshCw, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getApiErrorMessage } from "@/lib/api-error";
import { getCompanyValidationReasons } from "@/lib/company-validation";
import { getSupabaseClient } from "@/lib/supabase-client";
import type { Company, CompanyScoreResult, CriteriaSettings } from "@/lib/types";
import { useCurrentDate } from "@/lib/use-current-date";

interface CoachPanelProps {
  companies: Company[];
  scoreMap: Map<string, CompanyScoreResult>;
  settings?: CriteriaSettings;
  onBack: () => void;
  strategy: string;
  onStrategyChange: (s: string) => void;
}

export function CoachPanel({ companies, scoreMap, settings, onBack, strategy, onStrategyChange }: CoachPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [strategyOpen, setStrategyOpen] = useState(true);

  const today = useCurrentDate();
  const activeCompanies = companies.filter(
    (company) => !["rejected", "on_hold"].includes(company.status),
  );
  const opportunities = useMemo(() => {
    const list: { title: string; description: string; companies?: string[] }[] = [];
    const preApply = activeCompanies.filter((company) =>
      ["interested", "planned"].includes(company.status),
    );
    const inPipeline = activeCompanies.filter((company) =>
      ["applied", "interviewing", "offer"].includes(company.status),
    );

    if (activeCompanies.length > 0 && preApply.length >= Math.max(3, inPipeline.length * 2)) {
      list.push({
        title: "지원 비중 편향",
        description: `검토/예정 후보가 ${preApply.length}개이고 실제 지원 파이프라인은 ${inPipeline.length}개입니다. 이번 주에는 공고 확인을 마친 후보를 지원 단계로 이동시키는 것이 좋습니다.`,
      });
    }

    const industryCounts = activeCompanies.reduce<Record<string, number>>((acc, company) => {
      const key = company.industry.trim() || "미분류";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const topIndustry = Object.entries(industryCounts).sort((a, b) => b[1] - a[1])[0];
    if (topIndustry && topIndustry[1] >= Math.max(3, Math.ceil(activeCompanies.length * 0.45))) {
      list.push({
        title: "특정 분야 과다 지원",
        description: `${topIndustry[0]} 후보가 ${topIndustry[1]}개로 많습니다. 비슷한 리스크를 피하려면 다른 산업군의 고득점 후보를 1-2개 섞어보세요.`,
      });
    }

    const validationCandidates = activeCompanies
      .filter((company) => {
        const score = scoreMap.get(company.id)?.companyFitScore ?? 0;
        return (
          ["high", "medium"].includes(company.applicationPriority) &&
          ["interested", "planned"].includes(company.status) &&
          score >= 3.7 &&
          getCompanyValidationReasons(company).length > 0
        );
      })
      .sort(
        (a, b) =>
          (scoreMap.get(b.id)?.companyFitScore ?? 0) -
          (scoreMap.get(a.id)?.companyFitScore ?? 0),
      )
      .slice(0, 3);
    if (validationCandidates.length > 0) {
      list.push({
        title: "공고 확인 후 우선 지원 가능 후보",
        description: "점수와 우선순위는 충분하지만 아직 확인할 내용이 남아 있습니다. 확인만 끝내면 이번 주 지원 후보로 올릴 수 있습니다.",
        companies: validationCandidates.map((company) => company.name),
      });
    }

    return list.length > 0
      ? list
      : [
          {
            title: "기회 신호 안정",
            description: "지원 비중, 산업군 쏠림, 확인 대기 후보가 과하게 치우치지 않았습니다. 이번 주에는 현재 분배를 유지하면서 고득점 후보의 정보 품질을 높이세요.",
          },
        ];
  }, [activeCompanies, scoreMap]);

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
          .filter((t) => !t.completed && t.dueDate)
          .map((t) => t.dueDate),
        interviewCount: c.interviewRounds.length,
        validationReasons: getCompanyValidationReasons(c),
      }));

      const stats = {
        needsValidation: companies.filter(
          (c) => getCompanyValidationReasons(c).length > 0,
        ).length,
        interviews: companies.filter((c) => c.interviewRounds.length > 0).length,
        deadline7d: companies.filter((c) => {
          if (!c.jobDeadline) return false;
          const diff = Math.ceil(
            (new Date(c.jobDeadline).getTime() - Date.now()) / 86400000,
          );
          return diff >= 0 && diff <= 7;
        }).length,
        waitingResponse: companies.filter((c) =>
          ["applied", "interviewing"].includes(c.status),
        ).length,
        highPriority: companies.filter((c) => c.applicationPriority === "high")
          .length,
      };

      const res = await fetch("/api/weekly-strategy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          companies: snapshots,
          stats,
          today,
          userRole: settings?.userRole,
        }),
      });

      const data = (await res.json()) as
        | { ok: true; strategy: string }
        | { error: { code?: string; message: string } };

      if (!("ok" in data) || !data.ok) {
        setError(getApiErrorMessage(res, data, "이번 주 전략을 만들지 못했어요."));
        return;
      }
      onStrategyChange(data.strategy);
      setStrategyOpen(true);
    } catch {
      setError("이번 주 전략을 만들지 못했어요.");
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
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Target className="h-4 w-4 text-emerald-600" />
            이번 주 기회
          </span>
          <Badge tone="green">{opportunities.length}개</Badge>
        </div>
        <div className="divide-y divide-slate-100">
          {opportunities.map((item) => (
            <div className="space-y-2 px-4 py-3" key={item.title}>
              <div className="text-sm font-semibold text-slate-900">{item.title}</div>
              <p className="text-sm leading-relaxed text-slate-600">{item.description}</p>
              {item.companies && (
                <div className="flex flex-wrap gap-1">
                  {item.companies.map((company) => (
                    <Badge key={company} tone="blue">
                      {company}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

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
