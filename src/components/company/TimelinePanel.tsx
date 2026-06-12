"use client";

import { ArrowLeft, CalendarDays } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  INTERVIEW_ROUND_TYPE_LABELS,
  ROUND_RESULT_LABELS,
} from "@/lib/criteria";
import type { Company } from "@/lib/types";
import { STATUS_TONE } from "./shared";

interface TimelineEvent {
  companyId: string;
  companyName: string;
  companyStatus: Company["status"];
  roundId: string;
  type: string;
  title: string;
  scheduledAt: string;
  result: string;
}

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
  const { upcoming, past } = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    const events: TimelineEvent[] = [];

    for (const company of companies) {
      for (const round of company.interviewRounds) {
        if (!round.scheduledAt) continue;
        events.push({
          companyId: company.id,
          companyName: company.name,
          companyStatus: company.status,
          roundId: round.id,
          type: INTERVIEW_ROUND_TYPE_LABELS[round.type] ?? round.type,
          title: round.title,
          scheduledAt: round.scheduledAt,
          result: round.result,
        });
      }
    }

    events.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

    return {
      upcoming: events.filter((e) => e.scheduledAt >= now),
      past: events.filter((e) => e.scheduledAt < now).reverse(),
    };
  }, [companies]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarDays className="h-5 w-5" />
            면접 타임라인
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            전체 회사의 면접 일정을 시간순으로 확인합니다.
          </p>
        </div>
        <Button onClick={onBack} variant="secondary">
          <ArrowLeft className="h-4 w-4" />
          대시보드
        </Button>
      </div>

      <div className="divide-y divide-slate-100 p-4 space-y-6">
        <TimelineSection
          emptyMessage="예정된 면접이 없습니다."
          events={upcoming}
          onSelectCompany={onSelectCompany}
          title="예정"
          upcoming
        />
        <div className="pt-2">
          <TimelineSection
            emptyMessage="완료된 면접이 없습니다."
            events={past}
            onSelectCompany={onSelectCompany}
            title="지난 일정"
          />
        </div>
      </div>
    </section>
  );
}

function TimelineSection({
  title,
  events,
  upcoming,
  emptyMessage,
  onSelectCompany,
}: {
  title: string;
  events: TimelineEvent[];
  upcoming?: boolean;
  emptyMessage: string;
  onSelectCompany: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {events.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        <ol className="relative border-l border-slate-200 space-y-4 pl-5">
          {events.map((event) => (
            <li key={event.roundId} className="relative">
              <div
                className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white ${
                  event.result === "passed"
                    ? "bg-emerald-500"
                    : event.result === "rejected"
                      ? "bg-red-400"
                      : event.result === "canceled"
                        ? "bg-slate-300"
                        : upcoming
                          ? "bg-sky-500"
                          : "bg-slate-400"
                }`}
              />
              <button
                className="w-full text-left group"
                onClick={() => onSelectCompany(event.companyId)}
                type="button"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">
                    {event.scheduledAt}
                  </span>
                  <Badge tone={STATUS_TONE[event.companyStatus]}>
                    {event.companyName}
                  </Badge>
                  <span className="text-xs text-slate-500">{event.type}</span>
                  <ResultBadge result={event.result} />
                </div>
                <div className="mt-0.5 text-sm font-medium text-slate-800 group-hover:text-slate-950">
                  {event.title}
                </div>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ResultBadge({ result }: { result: string }) {
  const tone =
    result === "passed"
      ? "green"
      : result === "rejected"
        ? "red"
        : result === "canceled"
          ? "slate"
          : "amber";

  const label =
    ROUND_RESULT_LABELS[result as keyof typeof ROUND_RESULT_LABELS] ?? result;

  return <Badge tone={tone}>{label}</Badge>;
}
