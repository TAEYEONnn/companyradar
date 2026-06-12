"use client";

import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Company } from "@/lib/types";
import { INTERVIEW_ROUND_TYPE_LABELS } from "@/lib/criteria";
import { cn } from "@/lib/utils";

type Urgency = "overdue" | "high" | "medium" | "low";

type ActionItem = {
  id: string;
  companyId: string;
  companyName: string;
  action: string;
  urgency: Urgency;
  meta?: string;
};

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - Date.parse(dateStr)) / 86_400_000);
}

function daysUntil(dateStr: string): number {
  return Math.ceil((Date.parse(dateStr) - Date.now()) / 86_400_000);
}

interface TodayPanelProps {
  companies: Company[];
  onSelectCompany: (id: string) => void;
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

export function TodayPanel({ companies, onSelectCompany }: TodayPanelProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const items = useMemo<ActionItem[]>(() => {
    const list: ActionItem[] = [];

    for (const company of companies) {
      if (["rejected", "on_hold"].includes(company.status)) continue;

      // 1. 기한 초과 할일
      for (const task of company.followUpTasks) {
        if (!task.completed && task.dueDate && task.dueDate < today) {
          list.push({
            id: `task-overdue-${task.id}`,
            companyId: company.id,
            companyName: company.name,
            action: task.title,
            urgency: "overdue",
            meta: `기한 ${task.dueDate} 초과`,
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
          const days = daysUntil(round.scheduledAt);
          const roundLabel = INTERVIEW_ROUND_TYPE_LABELS[round.type] ?? round.type;
          list.push({
            id: `interview-${round.id}`,
            companyId: company.id,
            companyName: company.name,
            action: `${roundLabel} 면접 준비`,
            urgency: days <= 3 ? "high" : "medium",
            meta: `${round.scheduledAt} · ${days}일 후`,
          });
        }
      }

      // 3. 마감 임박 미지원 공고
      if (
        company.jobDeadline &&
        company.jobStatus === "open" &&
        ["interested", "planned"].includes(company.status)
      ) {
        const days = daysUntil(company.jobDeadline);
        if (days >= 0 && days <= 7) {
          list.push({
            id: `deadline-${company.id}`,
            companyId: company.id,
            companyName: company.name,
            action: "공고 마감 전 지원",
            urgency: days <= 2 ? "high" : "medium",
            meta: `마감 ${company.jobDeadline} · ${days}일 남음`,
          });
        }
      }

      // 4. 팔로업 메일 (applied 7일 이상, 면접 미예정)
      if (company.status === "applied") {
        const lastHistory = (company.statusHistory ?? [])
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        const sinceApplied = lastHistory
          ? daysSince(lastHistory.date.slice(0, 10))
          : null;
        const hasUpcoming = company.interviewRounds.some(
          (r) => r.result === "scheduled" && r.scheduledAt >= today,
        );
        if (!hasUpcoming && sinceApplied !== null && sinceApplied >= 7) {
          list.push({
            id: `followup-${company.id}`,
            companyId: company.id,
            companyName: company.name,
            action: "팔로업 메일 발송",
            urgency: sinceApplied >= 14 ? "high" : "medium",
            meta: `지원 후 ${sinceApplied}일 경과`,
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
            companyId: company.id,
            companyName: company.name,
            action: task.title,
            urgency: "medium",
            meta: `기한 ${task.dueDate}`,
          });
        }
      }

      // 6. 면접 결과 입력 필요
      for (const round of company.interviewRounds) {
        if (round.result === "pending") {
          const roundLabel = INTERVIEW_ROUND_TYPE_LABELS[round.type] ?? round.type;
          list.push({
            id: `pending-${round.id}`,
            companyId: company.id,
            companyName: company.name,
            action: `${roundLabel} 결과 입력`,
            urgency: "low",
            meta: "결과 대기 중",
          });
        }
      }

      // 7. 회사 리서치 (interested, 리서치 없음)
      if (
        company.status === "interested" &&
        (company.researchLogs ?? []).length === 0
      ) {
        list.push({
          id: `research-${company.id}`,
          companyId: company.id,
          companyName: company.name,
          action: "회사 리서치",
          urgency: "low",
        });
      }

      // 8. 공고 상태 확인
      if (
        company.jobStatus === "unknown" &&
        ["interested", "planned"].includes(company.status)
      ) {
        list.push({
          id: `verify-${company.id}`,
          companyId: company.id,
          companyName: company.name,
          action: "공고 상태 확인",
          urgency: "low",
        });
      }
    }

    list.sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]);
    return list;
  }, [companies, today, weekEnd]);

  const remaining = items.filter((item) => !checked.has(item.id)).length;
  const doneCount = checked.size;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarCheck className="h-5 w-5 text-sky-600" />
          오늘 할 일
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {today} ·{" "}
          {items.length === 0
            ? "할 일 없음"
            : remaining > 0
              ? `${remaining}개 남음${doneCount > 0 ? ` · ${doneCount}개 완료` : ""}`
              : "모두 완료!"}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
          <CheckCircle2 className="h-8 w-8" />
          <p className="text-sm">오늘 할 일이 없습니다. 잘 하고 계세요!</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 py-1">
          {items.map((item) => {
            const isChecked = checked.has(item.id);
            const cfg = URGENCY_CONFIG[item.urgency];
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 transition-opacity",
                  isChecked && "opacity-40",
                )}
              >
                {/* 체크박스 */}
                <button
                  aria-label={isChecked ? "완료 취소" : "완료 표시"}
                  className="mt-0.5 shrink-0"
                  onClick={() => toggle(item.id)}
                  type="button"
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border-2 transition-colors",
                      isChecked
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-slate-300 hover:border-slate-500",
                    )}
                  >
                    {isChecked && (
                      <svg
                        className="h-2.5 w-2.5 text-white"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        viewBox="0 0 12 12"
                      >
                        <polyline points="1.5,6 4.5,9 10.5,3" />
                      </svg>
                    )}
                  </div>
                </button>

                {/* 긴급도 도트 */}
                <div className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", cfg.dot)} />

                {/* 내용 */}
                <div className="min-w-0 flex-1">
                  <button
                    className={cn(
                      "w-full text-left text-sm leading-snug transition-colors hover:text-slate-950",
                      isChecked ? "line-through text-slate-400" : cfg.label,
                    )}
                    onClick={() => onSelectCompany(item.companyId)}
                    type="button"
                  >
                    <span className="font-medium">{item.companyName}</span>{" "}
                    {item.action}
                  </button>
                  {item.meta && (
                    <p
                      className={cn(
                        "mt-0.5 text-xs",
                        isChecked ? "text-slate-300" : cfg.meta,
                      )}
                    >
                      {item.meta}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {doneCount > 0 && (
        <div className="border-t border-slate-100 px-4 py-2">
          <button
            className="text-xs text-slate-400 hover:text-slate-600"
            onClick={() => setChecked(new Set())}
            type="button"
          >
            완료 초기화
          </button>
        </div>
      )}
    </section>
  );
}
