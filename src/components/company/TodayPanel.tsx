"use client";

import { ArrowRight, CalendarCheck, CheckCircle2, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCompanyValidationReasons } from "@/lib/company-validation";
import type { Company } from "@/lib/types";
import { INTERVIEW_ROUND_TYPE_LABELS } from "@/lib/criteria";
import { addDays, cn, parseLocalDate, today as formatToday } from "@/lib/utils";
import { useCurrentDate } from "@/lib/use-current-date";

type Urgency = "overdue" | "high" | "medium" | "low";

type ActionItem = {
  id: string;
  type: "follow-up" | "interview" | "deadline" | "generated-follow-up" | "pending-result" | "validation";
  companyId: string;
  companyName: string;
  action: string;
  urgency: Urgency;
  meta?: string;
  taskId?: string;
  validationReasons?: string[];
  canCompleteDirectly: boolean;
};

function daysSince(dateStr: string, nowMs: number): number {
  const local = parseLocalDate(dateStr);
  return Math.floor((nowMs - local.getTime()) / 86_400_000);
}

function daysUntil(dateStr: string, nowMs: number): number {
  const local = parseLocalDate(dateStr);
  return Math.ceil((local.getTime() - nowMs) / 86_400_000);
}

const URGENCY_ORDER: Record<Urgency, number> = {
  overdue: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const URGENCY_CONFIG: Record<Urgency, { dot: string; label: string; meta: string }> = {
  overdue: { dot: "bg-red-500", label: "text-red-700", meta: "text-red-500" },
  high: { dot: "bg-amber-500", label: "text-amber-800", meta: "text-amber-600" },
  medium: { dot: "bg-sky-500", label: "text-slate-700", meta: "text-slate-400" },
  low: { dot: "bg-slate-300", label: "text-slate-600", meta: "text-slate-400" },
};

interface TodayPanelProps {
  companies: Company[];
  onCompleteFollowUpTask: (companyId: string, taskId: string) => void;
  onMarkVerified: (companyId: string) => void;
  onSelectCompany: (id: string) => void;
}

export function TodayPanel({
  companies,
  onCompleteFollowUpTask,
  onMarkVerified,
  onSelectCompany,
}: TodayPanelProps) {
  const today = useCurrentDate();
  const todayMs = useMemo(() => parseLocalDate(today).getTime(), [today]);
  const weekEnd = useMemo(
    () => formatToday(addDays(parseLocalDate(today), 7)),
    [today],
  );

  const items = useMemo<ActionItem[]>(() => {
    const list: ActionItem[] = [];

    for (const company of companies) {
      if (["rejected", "on_hold"].includes(company.status)) continue;

      // 1. 기한 초과 할일
      for (const task of company.followUpTasks) {
        if (!task.completed && task.dueDate && task.dueDate < today) {
          list.push({
            id: `task-overdue-${task.id}`,
            type: "follow-up",
            companyId: company.id,
            companyName: company.name,
            action: task.title,
            urgency: "overdue",
            meta: `기한 ${task.dueDate} 초과`,
            taskId: task.id,
            canCompleteDirectly: true,
          });
        }
      }

      // 2. 이번 주 면접 준비
      for (const round of company.interviewRounds) {
        if (
          round.result === "scheduled" &&
          round.scheduledAt &&
          round.scheduledAt >= today &&
          round.scheduledAt <= weekEnd
        ) {
          const days = daysUntil(round.scheduledAt, todayMs);
          const roundLabel = INTERVIEW_ROUND_TYPE_LABELS[round.type] ?? round.type;
          list.push({
            id: `interview-${round.id}`,
            type: "interview",
            companyId: company.id,
            companyName: company.name,
            action: `${roundLabel} 면접 준비`,
            urgency: days <= 3 ? "high" : "medium",
            meta: `${round.scheduledAt} · ${days}일 후`,
            canCompleteDirectly: false,
          });
        }
      }

      // 3. 마감 임박 미지원 공고
      if (
        company.jobDeadline &&
        company.jobStatus === "open" &&
        ["interested", "planned"].includes(company.status)
      ) {
        const days = daysUntil(company.jobDeadline, todayMs);
        if (days >= 0 && days <= 7) {
          list.push({
            id: `deadline-${company.id}`,
            type: "deadline",
            companyId: company.id,
            companyName: company.name,
            action: "공고 마감 전 지원",
            urgency: days <= 2 ? "high" : "medium",
            meta: `마감 ${company.jobDeadline} · ${days}일 남음`,
            canCompleteDirectly: false,
          });
        }
      }

      // 4. 팔로업 메일 (applied 7일 이상, 면접 미예정)
      if (company.status === "applied") {
        const lastHistory = (company.statusHistory ?? [])
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        const sinceApplied = lastHistory
          ? daysSince(lastHistory.date.slice(0, 10), todayMs)
          : null;
        const hasUpcoming = company.interviewRounds.some(
          (r) => r.result === "scheduled" && r.scheduledAt >= today,
        );
        if (!hasUpcoming && sinceApplied !== null && sinceApplied >= 7) {
          list.push({
            id: `followup-${company.id}`,
            type: "generated-follow-up",
            companyId: company.id,
            companyName: company.name,
            action: "팔로업 메일 발송",
            urgency: sinceApplied >= 14 ? "high" : "medium",
            meta: `지원 후 ${sinceApplied}일 경과`,
            canCompleteDirectly: false,
          });
        }
      }

      // 5. 이번 주 기한 할일
      for (const task of company.followUpTasks) {
        if (
          !task.completed &&
          task.dueDate &&
          task.dueDate >= today &&
          task.dueDate <= weekEnd
        ) {
          list.push({
            id: `task-due-${task.id}`,
            type: "follow-up",
            companyId: company.id,
            companyName: company.name,
            action: task.title,
            urgency: "medium",
            meta: `기한 ${task.dueDate}`,
            taskId: task.id,
            canCompleteDirectly: true,
          });
        }
      }

      // 6. 면접 결과 입력 필요
      for (const round of company.interviewRounds) {
        if (round.result === "pending") {
          const roundLabel = INTERVIEW_ROUND_TYPE_LABELS[round.type] ?? round.type;
          list.push({
            id: `pending-${round.id}`,
            type: "pending-result",
            companyId: company.id,
            companyName: company.name,
            action: `${roundLabel} 결과 입력`,
            urgency: "low",
            meta: "결과 대기 중",
            canCompleteDirectly: false,
          });
        }
      }

      const validationReasons = getCompanyValidationReasons(company, today);
      if (validationReasons.length > 0) {
        list.push({
          id: `validation-${company.id}`,
          type: "validation",
          companyId: company.id,
          companyName: company.name,
          action: "정보 검증 필요",
          urgency: company.needsRefresh ? "high" : "low",
          meta: `${validationReasons.length}개 사유`,
          validationReasons,
          canCompleteDirectly: false,
        });
      }
    }

    list.sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]);
    return list;
  }, [companies, today, todayMs, weekEnd]);

  const completableItems = items.filter((item) => item.canCompleteDirectly && item.taskId);
  const actionRequiredCount = items.length - completableItems.length;

  function completeAllDirectTasks() {
    for (const item of completableItems) {
      if (item.taskId) onCompleteFollowUpTask(item.companyId, item.taskId);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarCheck className="h-5 w-5 text-sky-600" />
            오늘 할 일
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {today} ·{" "}
            {items.length === 0
              ? "할 일 없음"
              : `${items.length}개 남음${actionRequiredCount > 0 ? ` · 확인 필요 ${actionRequiredCount}개` : ""}`}
          </p>
        </div>
        {completableItems.length > 0 && (
          <Button
            onClick={completeAllDirectTasks}
            size="sm"
            variant="primary"
          >
            <CheckCircle2 className="h-4 w-4" />
            완료 가능한 항목 전체 완료
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
          <CheckCircle2 className="h-8 w-8" />
          <p className="text-sm">오늘 할 일이 없습니다. 잘 하고 계세요!</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 py-1">
          {items.map((item) => {
            const cfg = URGENCY_CONFIG[item.urgency];
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 px-4 py-3"
              >
                {item.canCompleteDirectly && item.taskId ? (
                  <button
                    aria-label={`${item.action} 완료`}
                    className="mt-0.5 shrink-0"
                    onClick={() => onCompleteFollowUpTask(item.companyId, item.taskId!)}
                    type="button"
                  >
                    <div className="flex h-4 w-4 items-center justify-center rounded border-2 border-slate-300 transition-colors hover:border-emerald-500 hover:bg-emerald-50" />
                  </button>
                ) : (
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50">
                    {item.type === "validation" ? (
                      <ShieldCheck className="h-3 w-3 text-amber-500" />
                    ) : (
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                )}

                {/* 긴급도 도트 */}
                <div className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", cfg.dot)} />

                {/* 내용 */}
                <div className="min-w-0 flex-1">
                  <button
                    className={cn(
                      "w-full text-left text-sm leading-snug transition-colors hover:text-slate-950",
                      cfg.label,
                    )}
                    onClick={() => onSelectCompany(item.companyId)}
                    type="button"
                  >
                    <span className="font-medium">{item.companyName}</span>{" "}
                    {item.action}
                  </button>
                  {item.meta && (
                    <p className={cn("mt-0.5 text-xs", cfg.meta)}>
                      {item.meta}
                    </p>
                  )}
                  {item.validationReasons && item.validationReasons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.validationReasons.slice(0, 4).map((reason) => (
                        <Badge key={reason} tone="amber">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {item.type === "validation" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        onClick={() => onSelectCompany(item.companyId)}
                        size="sm"
                        variant="secondary"
                      >
                        상세 확인
                      </Button>
                      <Button
                        onClick={() => onMarkVerified(item.companyId)}
                        size="sm"
                        variant="secondary"
                      >
                        검증 완료
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
