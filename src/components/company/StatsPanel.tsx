"use client";

import { ArrowLeft, BarChart3 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  INTERVIEW_ROUND_TYPE_LABELS,
  STATUS_LABELS,
} from "@/lib/criteria";
import { formatScore } from "@/lib/scoring";
import type {
  ApplicationStatus,
  Company,
  CompanyScoreResult,
  InterviewRoundType,
} from "@/lib/types";
import { Metric } from "./shared";

const FUNNEL_STEPS: { key: ApplicationStatus[]; label: string }[] = [
  { key: ["interested", "planned", "applied", "interviewing", "offer", "rejected", "on_hold"], label: "전체 후보" },
  { key: ["applied", "interviewing", "offer", "rejected"], label: "지원 완료" },
  { key: ["interviewing", "offer"], label: "면접 진행" },
  { key: ["offer"], label: "오퍼" },
];

const STATUS_ORDER: ApplicationStatus[] = [
  "offer",
  "interviewing",
  "applied",
  "planned",
  "interested",
  "rejected",
  "on_hold",
];

const ROUND_TYPE_ORDER: InterviewRoundType[] = [
  "screening",
  "assignment",
  "first",
  "second",
  "culture",
  "offer",
];

interface StatsPanelProps {
  companies: Company[];
  scoreMap: Map<string, CompanyScoreResult>;
  onBack: () => void;
}

export function StatsPanel({ companies, scoreMap, onBack }: StatsPanelProps) {
  const stats = useMemo(() => {
    const total = companies.length;
    const applied = companies.filter((c) =>
      ["applied", "interviewing", "offer", "rejected"].includes(c.status),
    ).length;
    const interviewing = companies.filter((c) =>
      ["interviewing", "offer"].includes(c.status),
    ).length;
    const offers = companies.filter((c) => c.status === "offer").length;
    const rejected = companies.filter((c) => c.status === "rejected").length;

    const statusCounts = STATUS_ORDER.map((status) => ({
      status,
      count: companies.filter((c) => c.status === status).length,
    }));

    const scoreBuckets = [
      { label: "4.3+", min: 4.3, max: 5.01 },
      { label: "3.7-4.2", min: 3.7, max: 4.3 },
      { label: "3.0-3.6", min: 3.0, max: 3.7 },
      { label: "3.0 미만", min: 0.01, max: 3.0 },
      { label: "미평가", min: 0, max: 0.01 },
    ].map((bucket) => ({
      ...bucket,
      count: companies.filter((c) => {
        const score = scoreMap.get(c.id)?.companyFitScore ?? 0;
        return score >= bucket.min && score < bucket.max;
      }).length,
    }));

    const averageScore =
      companies.reduce(
        (sum, c) => sum + (scoreMap.get(c.id)?.companyFitScore ?? 0),
        0,
      ) / Math.max(total, 1);

    const allRounds = companies.flatMap((c) => c.interviewRounds);
    const interviewRoundsTotal = allRounds.length;
    const passedRounds = allRounds.filter((r) => r.result === "passed").length;
    const decidedRounds = allRounds.filter(
      (r) => r.result === "passed" || r.result === "rejected",
    ).length;

    // ── 사이클타임 ──────────────────────────────────────────────
    // 후보 등록 → 첫 면접까지 평균 일수
    const companiesWithScheduled = companies.filter((c) =>
      c.interviewRounds.some((r) => r.scheduledAt),
    );
    const avgDaysToFirst =
      companiesWithScheduled.length > 0
        ? companiesWithScheduled.reduce((sum, c) => {
            const first = c.interviewRounds
              .filter((r) => r.scheduledAt)
              .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
            const ms =
              new Date(first.scheduledAt).getTime() -
              new Date(c.createdAt).getTime();
            return sum + Math.max(0, ms / 86_400_000);
          }, 0) / companiesWithScheduled.length
        : null;

    // 첫 라운드 → 마지막 라운드 평균 기간 (2+ 라운드 보유 기업)
    const companiesMultiRound = companies.filter(
      (c) => c.interviewRounds.filter((r) => r.scheduledAt).length >= 2,
    );
    const avgProcessDays =
      companiesMultiRound.length > 0
        ? companiesMultiRound.reduce((sum, c) => {
            const scheduled = c.interviewRounds
              .filter((r) => r.scheduledAt)
              .map((r) => new Date(r.scheduledAt).getTime())
              .sort((a, b) => a - b);
            const span =
              (scheduled[scheduled.length - 1] - scheduled[0]) / 86_400_000;
            return sum + Math.max(0, span);
          }, 0) / companiesMultiRound.length
        : null;

    // ── 라운드별 합격률 ────────────────────────────────────────
    const roundTypeStats = ROUND_TYPE_ORDER.map((type) => {
      const decided = allRounds.filter(
        (r) =>
          r.type === type &&
          (r.result === "passed" || r.result === "rejected"),
      );
      const passed = decided.filter((r) => r.result === "passed").length;
      return {
        type,
        label: INTERVIEW_ROUND_TYPE_LABELS[type],
        total: decided.length,
        passed,
        rate: decided.length > 0 ? passed / decided.length : null,
      };
    }).filter((s) => s.total > 0);

    // ── 점수 vs 결과 ──────────────────────────────────────────
    const scoreByStatus = STATUS_ORDER.map((status) => {
      const group = companies.filter((c) => c.status === status);
      const avg =
        group.length > 0
          ? group.reduce(
              (sum, c) => sum + (scoreMap.get(c.id)?.companyFitScore ?? 0),
              0,
            ) / group.length
          : 0;
      return {
        status,
        label: STATUS_LABELS[status],
        count: group.length,
        avgScore: avg,
      };
    }).filter((s) => s.count > 0);

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
      decidedRounds,
      applyRate: total > 0 ? (applied / total) * 100 : 0,
      interviewRate: applied > 0 ? (interviewing / applied) * 100 : 0,
      offerRate: applied > 0 ? (offers / applied) * 100 : 0,
      roundPassRate: decidedRounds > 0 ? (passedRounds / decidedRounds) * 100 : 0,
      avgDaysToFirst,
      avgProcessDays,
      roundTypeStats,
      scoreByStatus,
    };
  }, [companies, scoreMap]);

  const funnelCounts = FUNNEL_STEPS.map((step) => ({
    label: step.label,
    count: companies.filter((c) => step.key.includes(c.status)).length,
  }));
  const funnelMax = Math.max(funnelCounts[0]?.count ?? 1, 1);

  const maxStatusCount = Math.max(...stats.statusCounts.map((item) => item.count), 1);
  const maxBucketCount = Math.max(...stats.scoreBuckets.map((item) => item.count), 1);
  const maxScoreByStatus = Math.max(...stats.scoreByStatus.map((s) => s.avgScore), 0.01);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            지원 통계
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            전환율·사이클타임·점수 상관관계로 지원 전략을 점검하세요.
          </p>
        </div>
        <Button onClick={onBack} variant="secondary">
          <ArrowLeft className="h-4 w-4" />
          대시보드
        </Button>
      </div>

      <div className="space-y-6 p-4">
        {/* ── 전환율 ── */}
        <div>
          <SectionLabel>전환율</SectionLabel>
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
        </div>

        {/* ── 사이클타임 ── */}
        <div>
          <SectionLabel>사이클타임</SectionLabel>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric
              label="첫 면접까지 평균"
              value={
                stats.avgDaysToFirst !== null
                  ? `${stats.avgDaysToFirst.toFixed(1)}일`
                  : "—"
              }
            />
            <Metric
              label="면접 프로세스 평균"
              value={
                stats.avgProcessDays !== null
                  ? `${stats.avgProcessDays.toFixed(1)}일`
                  : "—"
              }
            />
            <Metric
              label="라운드 통과율"
              tone={stats.roundPassRate >= 50 ? "green" : stats.roundPassRate > 0 ? "slate" : "slate"}
              value={
                stats.decidedRounds > 0
                  ? `${stats.roundPassRate.toFixed(0)}%`
                  : "—"
              }
            />
            <Metric
              label="완료 프로세스"
              value={`${stats.offers + stats.rejected}개`}
            />
          </div>
        </div>

        {/* ── 분포 차트 3개 ── */}
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

        {/* ── 파이프라인 분석 2개 ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="라운드 유형별 합격률">
            {stats.roundTypeStats.length === 0 ? (
              <p className="text-xs text-slate-400">결과가 기록된 면접 라운드가 없습니다.</p>
            ) : (
              stats.roundTypeStats.map((s) => (
                <PassRateRow
                  key={s.type}
                  label={s.label}
                  passed={s.passed}
                  rate={s.rate ?? 0}
                  total={s.total}
                />
              ))
            )}
          </ChartCard>

          <ChartCard title="상태별 평균 회사핏 점수">
            {stats.scoreByStatus.length === 0 ? (
              <p className="text-xs text-slate-400">점수 데이터가 없습니다.</p>
            ) : (
              stats.scoreByStatus.map((s) => (
                <ScoreBarRow
                  key={s.status}
                  avgScore={s.avgScore}
                  count={s.count}
                  label={s.label}
                  maxScore={maxScoreByStatus}
                  status={s.status}
                />
              ))
            )}
          </ChartCard>
        </div>

        {/* ── raw counts ── */}
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h3>
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

function PassRateRow({
  label,
  passed,
  rate,
  total,
}: {
  label: string;
  passed: number;
  rate: number;
  total: number;
}) {
  const pct = Math.round(rate * 100);
  const barColor =
    pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="grid grid-cols-[88px_1fr_48px] items-center gap-2 text-sm">
      <span className="truncate text-slate-600">{label}</span>
      <div className="relative h-5 rounded bg-slate-100">
        <div
          className={`h-5 rounded ${barColor} transition-all`}
          style={{ width: `${Math.max(pct, total > 0 ? 3 : 0)}%` }}
        />
      </div>
      <span className="text-right text-xs text-slate-500">
        {passed}/{total}
      </span>
    </div>
  );
}

function ScoreBarRow({
  avgScore,
  count,
  label,
  maxScore,
  status,
}: {
  avgScore: number;
  count: number;
  label: string;
  maxScore: number;
  status: ApplicationStatus;
}) {
  const barColor =
    status === "offer"
      ? "bg-emerald-500"
      : status === "rejected"
        ? "bg-red-400"
        : status === "interviewing"
          ? "bg-amber-500"
          : "bg-sky-500";
  const ratio = maxScore > 0 ? avgScore / maxScore : 0;
  return (
    <div className="grid grid-cols-[80px_1fr_64px] items-center gap-2 text-sm">
      <span className="truncate text-slate-600">{label}</span>
      <div className="h-5 rounded bg-slate-100">
        <div
          className={`h-5 rounded ${barColor} transition-all`}
          style={{ width: `${Math.max(ratio * 100, avgScore > 0 ? 3 : 0)}%` }}
        />
      </div>
      <span className="text-right text-xs text-slate-500">
        {formatScore(avgScore)} <span className="text-slate-400">×{count}</span>
      </span>
    </div>
  );
}
