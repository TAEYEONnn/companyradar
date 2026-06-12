"use client";

import { ArrowLeft, BarChart3 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/criteria";
import { formatScore } from "@/lib/scoring";
import type { ApplicationStatus, Company, CompanyScoreResult } from "@/lib/types";
import { Metric } from "./shared";

const FUNNEL_STEPS: { key: ApplicationStatus[]; label: string }[] = [
  { key: ["interested", "planned", "applied", "interviewing", "offer", "rejected", "on_hold"], label: "전체 후보" },
  { key: ["applied", "interviewing", "offer", "rejected"], label: "지원 완료" },
  { key: ["interviewing", "offer"], label: "면접 진행" },
  { key: ["offer"], label: "오퍼" },
];

const STATUS_ORDER: ApplicationStatus[] = [
  "interested",
  "planned",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "on_hold",
];

interface StatsPanelProps {
  companies: Company[];
  scoreMap: Map<string, CompanyScoreResult>;
  onBack: () => void;
}

export function StatsPanel({ companies, scoreMap, onBack }: StatsPanelProps) {
  const stats = useMemo(() => {
    const total = companies.length;
    const applied = companies.filter((company) =>
      ["applied", "interviewing", "offer", "rejected"].includes(company.status),
    ).length;
    const interviewing = companies.filter((company) =>
      ["interviewing", "offer"].includes(company.status),
    ).length;
    const offers = companies.filter((company) => company.status === "offer").length;
    const rejected = companies.filter(
      (company) => company.status === "rejected",
    ).length;

    const statusCounts = STATUS_ORDER.map((status) => ({
      status,
      count: companies.filter((company) => company.status === status).length,
    }));

    const scoreBuckets = [
      { label: "4.3+", min: 4.3, max: 5.01 },
      { label: "3.7-4.2", min: 3.7, max: 4.3 },
      { label: "3.0-3.6", min: 3.0, max: 3.7 },
      { label: "3.0 미만", min: 0.01, max: 3.0 },
      { label: "미평가", min: 0, max: 0.01 },
    ].map((bucket) => ({
      ...bucket,
      count: companies.filter((company) => {
        const score = scoreMap.get(company.id)?.companyFitScore ?? 0;
        return score >= bucket.min && score < bucket.max;
      }).length,
    }));

    const averageScore =
      companies.reduce(
        (sum, company) => sum + (scoreMap.get(company.id)?.companyFitScore ?? 0),
        0,
      ) / Math.max(total, 1);

    const interviewRoundsTotal = companies.reduce(
      (sum, company) => sum + company.interviewRounds.length,
      0,
    );
    const passedRounds = companies.reduce(
      (sum, company) =>
        sum +
        company.interviewRounds.filter((round) => round.result === "passed").length,
      0,
    );

    return {
      total,
      applied,
      interviewing,
      offers,
      rejected,
      statusCounts,
      scoreBuckets,
      averageScore,
      interviewRoundsTotal,
      passedRounds,
      applyRate: total > 0 ? (applied / total) * 100 : 0,
      interviewRate: applied > 0 ? (interviewing / applied) * 100 : 0,
      offerRate: applied > 0 ? (offers / applied) * 100 : 0,
    };
  }, [companies, scoreMap]);

  const funnelCounts = FUNNEL_STEPS.map((step) => ({
    label: step.label,
    count: companies.filter((company) => step.key.includes(company.status)).length,
  }));
  const funnelMax = Math.max(funnelCounts[0]?.count ?? 1, 1);

  const maxStatusCount = Math.max(...stats.statusCounts.map((item) => item.count), 1);
  const maxBucketCount = Math.max(...stats.scoreBuckets.map((item) => item.count), 1);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            지원 통계
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            전환율과 분포로 지원 전략을 점검하세요.
          </p>
        </div>
        <Button onClick={onBack} variant="secondary">
          <ArrowLeft className="h-4 w-4" />
          대시보드
        </Button>
      </div>

      <div className="space-y-6 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="지원 전환율" value={`${stats.applyRate.toFixed(0)}%`} />
          <Metric label="서류→면접 전환" value={`${stats.interviewRate.toFixed(0)}%`} />
          <Metric
            label="지원→오퍼 전환"
            tone={stats.offers > 0 ? "green" : "slate"}
            value={`${stats.offerRate.toFixed(0)}%`}
          />
          <Metric label="평균 회사핏" value={formatScore(stats.averageScore)} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="지원 퍼널">
            {funnelCounts.map((step) => (
              <BarRow
                color="bg-slate-900"
                count={step.count}
                key={step.label}
                label={step.label}
                ratio={step.count / funnelMax}
              />
            ))}
          </ChartCard>

          <ChartCard title="상태별 분포">
            {stats.statusCounts.map((item) => (
              <BarRow
                color="bg-sky-600"
                count={item.count}
                key={item.status}
                label={STATUS_LABELS[item.status]}
                ratio={item.count / maxStatusCount}
              />
            ))}
          </ChartCard>

          <ChartCard title="회사핏 점수 분포">
            {stats.scoreBuckets.map((bucket) => (
              <BarRow
                color="bg-emerald-600"
                count={bucket.count}
                key={bucket.label}
                label={bucket.label}
                ratio={bucket.count / maxBucketCount}
              />
            ))}
          </ChartCard>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="전체 후보" value={`${stats.total}`} />
          <Metric label="면접 라운드 누적" value={`${stats.interviewRoundsTotal}`} />
          <Metric label="라운드 통과" value={`${stats.passedRounds}`} />
          <Metric
            label="탈락"
            tone={stats.rejected > 0 ? "red" : "slate"}
            value={`${stats.rejected}`}
          />
        </div>
      </div>
    </section>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function BarRow({
  color,
  count,
  label,
  ratio,
}: {
  color: string;
  count: number;
  label: string;
  ratio: number;
}) {
  return (
    <div className="grid grid-cols-[96px_1fr_32px] items-center gap-2 text-sm">
      <span className="truncate text-slate-600">{label}</span>
      <div className="h-5 rounded bg-slate-100">
        <div
          className={`h-5 rounded ${color} transition-all`}
          style={{ width: `${Math.max(ratio * 100, count > 0 ? 4 : 0)}%` }}
        />
      </div>
      <span className="text-right font-semibold text-slate-800">{count}</span>
    </div>
  );
}
