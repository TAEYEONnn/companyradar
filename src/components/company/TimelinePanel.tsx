"use client";

import { ArrowLeft, CalendarDays } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addDays, parseLocalDate, today as formatToday } from "@/lib/utils";
import { useCurrentDate } from "@/lib/use-current-date";
import {
  INTERVIEW_ROUND_TYPE_LABELS,
  ROUND_RESULT_LABELS,
  STATUS_LABELS,
} from "@/lib/criteria";
import type { Company } from "@/lib/types";
import { STATUS_TONE } from "./shared";

type EventKind = "status" | "interview" | "task" | "deadline";

interface UnifiedEvent {
  id: string;
  companyId: string;
  companyName: string;
  companyStatus: Company["status"];
  date: string;
  kind: EventKind;
  title: string;
  subtitle?: string;
  dotColor: string;
}

const STATUS_DOT: Record<Company["status"], string> = {
  interested: "bg-slate-400",
  planned: "bg-sky-400",
  applied: "bg-sky-500",
  interviewing: "bg-violet-500",
  offer: "bg-emerald-500",
  rejected: "bg-red-400",
  on_hold: "bg-slate-300",
};

interface TimelinePanelProps {
  companies: Company[];
  onBack: () => void;
  onSelectCompany: (id: string) => void;
}

export function TimelinePanel({
  companies,
  onBack,
  onSelectCompany,
}: TimelinePanelProps) {
  const today = useCurrentDate();
  const todayMs = useMemo(() => parseLocalDate(today).getTime(), [today]);
  const twoWeeksOut = useMemo(
    () => formatToday(addDays(parseLocalDate(today), 14)),
    [today],
  );

  const { past, upcoming } = useMemo(() => {
    const events: UnifiedEvent[] = [];

    for (const company of companies) {
      // 상태 변경 이력
      for (const entry of company.statusHistory ?? []) {
        const date = entry.date.slice(0, 10);
        events.push({
          id: `status-${company.id}-${date}-${entry.status}`,
          companyId: company.id,
          companyName: company.name,
          companyStatus: company.status,
          date,
          kind: "status",
          title: STATUS_LABELS[entry.status] ?? entry.status,
          subtitle: entry.note || undefined,
          dotColor: STATUS_DOT[entry.status] ?? "bg-slate-400",
        });
      }

      // 면접 일정
      for (const round of company.interviewRounds) {
        if (!round.scheduledAt) continue;
        const dotColor =
          round.result === "passed"
            ? "bg-emerald-500"
            : round.result === "rejected"
              ? "bg-red-400"
              : round.result === "canceled"
                ? "bg-slate-300"
                : round.result === "pending"
                  ? "bg-amber-400"
                  : "bg-sky-500";
        const resultLabel =
          ROUND_RESULT_LABELS[round.result as keyof typeof ROUND_RESULT_LABELS];
        events.push({
          id: `interview-${round.id}`,
          companyId: company.id,
          companyName: company.name,
          companyStatus: company.status,
          date: round.scheduledAt.slice(0, 10),
          kind: "interview",
          title: `${INTERVIEW_ROUND_TYPE_LABELS[round.type] ?? round.type}${round.title ? ` · ${round.title}` : ""}`,
          subtitle: resultLabel,
          dotColor,
        });
      }

      // 할일 기한 (미완료, 앞으로 14일 이내 + 이미 지난 것)
      for (const task of company.followUpTasks) {
        if (!task.dueDate || task.completed) continue;
        if (task.dueDate > twoWeeksOut) continue;
        events.push({
          id: `task-${task.id}`,
          companyId: company.id,
          companyName: company.name,
          companyStatus: company.status,
          date: task.dueDate,
          kind: "task",
          title: task.title,
          subtitle: task.dueDate < today ? "기한 초과" : "할일 기한",
          dotColor: task.dueDate < today ? "bg-red-400" : "bg-blue-400",
        });
      }

      // 공고 마감
      if (company.jobDeadline && company.jobStatus === "open") {
        const days = Math.ceil(
          (parseLocalDate(company.jobDeadline).getTime() - todayMs) / 86_400_000,
        );
        if (days >= -7 && days <= 30) {
          events.push({
            id: `deadline-${company.id}`,
            companyId: company.id,
            companyName: company.name,
            companyStatus: company.status,
            date: company.jobDeadline,
            kind: "deadline",
            title: "공고 마감",
            subtitle: days < 0 ? "마감 완료" : `${days}일 남음`,
            dotColor: days <= 3 ? "bg-red-500" : "bg-amber-400",
          });
        }
      }
    }

    events.sort((a, b) => a.date.localeCompare(b.date));

    return {
      past: events.filter((e) => e.date <= today),
      upcoming: events.filter((e) => e.date > today),
    };
  }, [companies, today, todayMs, twoWeeksOut]);

  // Group events by date
  function groupByDate(events: UnifiedEvent[]): [string, UnifiedEvent[]][] {
    const map = new Map<string, UnifiedEvent[]>();
    for (const event of events) {
      const group = map.get(event.date) ?? [];
      group.push(event);
      map.set(event.date, group);
    }
    return Array.from(map.entries());
  }

  const pastGroups = groupByDate(past).reverse(); // latest first
  const upcomingGroups = groupByDate(upcoming);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarDays className="h-5 w-5 text-violet-600" />
            지원 타임라인
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            전체 상태 변경 · 면접 · 할일 · 마감 이력
          </p>
        </div>
        <Button onClick={onBack} variant="secondary">
          <ArrowLeft className="h-4 w-4" />
          대시보드
        </Button>
      </div>

      <div className="divide-y divide-slate-100 p-4 space-y-8">
        {/* 예정 */}
        {upcomingGroups.length > 0 && (
          <TimelineSection
            emptyMessage=""
            groups={upcomingGroups}
            onSelectCompany={onSelectCompany}
            title="예정"
            upcoming
          />
        )}

        {/* 지난 이력 */}
        <div className={upcomingGroups.length > 0 ? "pt-2" : ""}>
          <TimelineSection
            emptyMessage="기록된 이력이 없습니다."
            groups={pastGroups}
            onSelectCompany={onSelectCompany}
            title="지난 이력"
          />
        </div>
      </div>
    </section>
  );
}

function TimelineSection({
  title,
  groups,
  upcoming,
  emptyMessage,
  onSelectCompany,
}: {
  title: string;
  groups: [string, UnifiedEvent[]][];
  upcoming?: boolean;
  emptyMessage: string;
  onSelectCompany: (id: string) => void;
}) {
  if (groups.length === 0 && !emptyMessage) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-600">{title}</h3>
      {groups.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, events]) => (
            <div key={date} className="flex gap-3">
              {/* 날짜 레이블 */}
              <div className="w-20 shrink-0 pt-0.5 text-right">
                <span
                  className={`text-xs font-mono ${upcoming ? "text-violet-600 font-semibold" : "text-slate-400"}`}
                >
                  {date.slice(5)}
                </span>
              </div>

              {/* 이벤트 목록 */}
              <div className="flex-1 space-y-1.5 border-l border-slate-200 pl-4">
                {events.map((event) => (
                  <button
                    className="group flex w-full items-start gap-2 text-left"
                    key={event.id}
                    onClick={() => onSelectCompany(event.companyId)}
                    type="button"
                  >
                    {/* 도트 */}
                    <div
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white ring-1 ring-slate-200 ${event.dotColor}`}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={STATUS_TONE[event.companyStatus]}>
                          {event.companyName}
                        </Badge>
                        <span className="text-sm text-slate-700 group-hover:text-slate-950">
                          {event.title}
                        </span>
                      </div>
                      {event.subtitle && (
                        <span className="mt-0.5 text-xs text-slate-400">
                          {event.subtitle}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
