"use client";

import { ArrowLeft, CalendarCheck, CheckCircle2, Clock, Flag } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { INTERVIEW_ROUND_TYPE_LABELS, STATUS_LABELS } from "@/lib/criteria";
import type { Company } from "@/lib/types";
import { isDueOrOverdue, isDeadlineSoon, STATUS_TONE } from "./shared";

interface TodayPanelProps {
  companies: Company[];
  onBack: () => void;
  onSelectCompany: (id: string) => void;
}

export function TodayPanel({ companies, onBack, onSelectCompany }: TodayPanelProps) {
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const sections = useMemo(() => {
    // 이번 주 면접 예정
    const upcomingInterviews: Array<{
      companyId: string;
      companyName: string;
      status: Company["status"];
      roundType: string;
      roundTitle: string;
      scheduledAt: string;
    }> = [];

    // 기한 초과·임박 할일
    const dueTasks: Array<{
      companyId: string;
      companyName: string;
      taskTitle: string;
      dueDate: string;
      overdue: boolean;
    }> = [];

    // 마감 임박 공고
    const deadlineSoon: Array<{
      companyId: string;
      companyName: string;
      status: Company["status"];
      deadline: string;
    }> = [];

    // 팔로업 필요 (면접 후 결과 대기)
    const pendingResults: Array<{
      companyId: string;
      companyName: string;
      status: Company["status"];
      roundTitle: string;
    }> = [];

    for (const company of companies) {
      // 이번 주 면접
      for (const round of company.interviewRounds) {
        if (
          round.scheduledAt &&
          round.result === "scheduled" &&
          round.scheduledAt >= today &&
          round.scheduledAt <= weekEnd
        ) {
          upcomingInterviews.push({
            companyId: company.id,
            companyName: company.name,
            status: company.status,
            roundType: INTERVIEW_ROUND_TYPE_LABELS[round.type] ?? round.type,
            roundTitle: round.title,
            scheduledAt: round.scheduledAt,
          });
        }
      }

      // 할일
      for (const task of company.followUpTasks) {
        if (!task.completed && task.dueDate) {
          const overdue = isDueOrOverdue(task.dueDate);
          const soon = task.dueDate <= weekEnd;
          if (overdue || soon) {
            dueTasks.push({
              companyId: company.id,
              companyName: company.name,
              taskTitle: task.title,
              dueDate: task.dueDate,
              overdue,
            });
          }
        }
      }

      // 마감 임박 공고
      if (isDeadlineSoon(company)) {
        deadlineSoon.push({
          companyId: company.id,
          companyName: company.name,
          status: company.status,
          deadline: company.jobDeadline,
        });
      }

      // 결과 대기 중인 라운드
      for (const round of company.interviewRounds) {
        if (round.result === "pending") {
          pendingResults.push({
            companyId: company.id,
            companyName: company.name,
            status: company.status,
            roundTitle: round.title || INTERVIEW_ROUND_TYPE_LABELS[round.type],
          });
        }
      }
    }

    upcomingInterviews.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    dueTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    deadlineSoon.sort((a, b) => a.deadline.localeCompare(b.deadline));

    return { upcomingInterviews, dueTasks, deadlineSoon, pendingResults };
  }, [companies, today, weekEnd]);

  const totalItems =
    sections.upcomingInterviews.length +
    sections.dueTasks.length +
    sections.deadlineSoon.length +
    sections.pendingResults.length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarCheck className="h-5 w-5" />
            오늘 할 일
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {today} 기준 · 이번 주 면접·할일·마감·팔로업
          </p>
        </div>
        <Button onClick={onBack} variant="secondary">
          <ArrowLeft className="h-4 w-4" />
          대시보드
        </Button>
      </div>

      {totalItems === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
          <CheckCircle2 className="h-8 w-8" />
          <p className="text-sm">이번 주 예정된 항목이 없습니다. 잘 하고 계세요!</p>
        </div>
      ) : (
        <div className="space-y-6 p-4">
          <TodaySection
            color="sky"
            emptyText="이번 주 예정된 면접이 없습니다."
            icon={<CalendarCheck className="h-4 w-4" />}
            title={`이번 주 면접 (${sections.upcomingInterviews.length})`}
          >
            {sections.upcomingInterviews.map((item, i) => (
              <TodayRow
                key={i}
                badge={<Badge tone={STATUS_TONE[item.status]}>{item.companyName}</Badge>}
                label={`${item.roundType} · ${item.roundTitle}`}
                meta={item.scheduledAt}
                onClick={() => onSelectCompany(item.companyId)}
              />
            ))}
          </TodaySection>

          <TodaySection
            color="amber"
            emptyText="마감 임박 공고가 없습니다."
            icon={<Flag className="h-4 w-4" />}
            title={`공고 마감 임박 (${sections.deadlineSoon.length})`}
          >
            {sections.deadlineSoon.map((item, i) => (
              <TodayRow
                key={i}
                badge={<Badge tone={STATUS_TONE[item.status]}>{STATUS_LABELS[item.status]}</Badge>}
                label={item.companyName}
                meta={`마감 ${item.deadline}`}
                onClick={() => onSelectCompany(item.companyId)}
              />
            ))}
          </TodaySection>

          <TodaySection
            color="red"
            emptyText="기한 초과·임박 할일이 없습니다."
            icon={<Clock className="h-4 w-4" />}
            title={`할일 기한 (${sections.dueTasks.length})`}
          >
            {sections.dueTasks.map((item, i) => (
              <TodayRow
                key={i}
                badge={
                  <Badge tone={item.overdue ? "red" : "amber"}>
                    {item.overdue ? "기한 초과" : "임박"}
                  </Badge>
                }
                label={`${item.companyName} · ${item.taskTitle}`}
                meta={item.dueDate}
                onClick={() => onSelectCompany(item.companyId)}
              />
            ))}
          </TodaySection>

          <TodaySection
            color="slate"
            emptyText="결과 대기 중인 면접이 없습니다."
            icon={<CheckCircle2 className="h-4 w-4" />}
            title={`결과 대기 (${sections.pendingResults.length})`}
          >
            {sections.pendingResults.map((item, i) => (
              <TodayRow
                key={i}
                badge={<Badge tone={STATUS_TONE[item.status]}>{item.companyName}</Badge>}
                label={item.roundTitle}
                meta="결과 입력 필요"
                onClick={() => onSelectCompany(item.companyId)}
              />
            ))}
          </TodaySection>
        </div>
      )}
    </section>
  );
}

function TodaySection({
  title,
  icon,
  color,
  emptyText,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  color: "sky" | "amber" | "red" | "slate";
  emptyText: string;
  children: React.ReactNode;
}) {
  const colorClass = {
    sky: "text-sky-600",
    amber: "text-amber-600",
    red: "text-red-600",
    slate: "text-slate-500",
  }[color];

  const items = Array.isArray(children) ? children.filter(Boolean) : [];

  return (
    <div>
      <h3 className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${colorClass}`}>
        {icon}
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyText}</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}

function TodayRow({
  badge,
  label,
  meta,
  onClick,
}: {
  badge: React.ReactNode;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
      onClick={onClick}
      type="button"
    >
      {badge}
      <span className="flex-1 truncate text-slate-700">{label}</span>
      <span className="shrink-0 text-xs text-slate-400">{meta}</span>
    </button>
  );
}
