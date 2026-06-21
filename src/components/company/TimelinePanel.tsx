"use client";

import { ArrowLeft, CalendarDays, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrentDate } from "@/lib/use-current-date";
import {
  INTERVIEW_ROUND_TYPE_LABELS,
  ROUND_RESULT_LABELS,
  STATUS_LABELS,
} from "@/lib/criteria";
import type { Company } from "@/lib/types";
import type { ApplicationEvent } from "@/lib/job-tracker";
import { STATUS_TONE, type DrawerFocusTarget } from "./shared";

type EventKind = "status" | "interview" | "application";

interface UnifiedEvent {
  id: string;
  companyId: string;
  companyName: string;
  companyStatus: Company["status"];
  jobPostingId?: string;
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
  accessToken: string;
  companies: Company[];
  onBack: () => void;
  onSelectCompany: (id: string, target?: DrawerFocusTarget) => void;
}

export function TimelinePanel({
  accessToken,
  companies,
  onBack,
  onSelectCompany,
}: TimelinePanelProps) {
  const today = useCurrentDate();
  const [applicationEvents, setApplicationEvents] = useState<ApplicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadEvents() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/application-events?days=365", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = (await response.json()) as {
          events?: ApplicationEvent[];
          error?: { message?: string };
        };
        if (!response.ok) {
          throw new Error(data.error?.message || "지원 일정을 불러오지 못했어요.");
        }
        if (active) setApplicationEvents(data.events ?? []);
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "지원 일정을 불러오지 못했어요.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadEvents();
    return () => {
      active = false;
    };
  }, [accessToken]);

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
    }

    for (const event of applicationEvents) {
      const status = isCompanyStatus(event.toStatus)
        ? event.toStatus
        : "interested";
      events.push({
        id: `application-${event.id}`,
        companyId: "",
        companyName: event.companyName,
        companyStatus: status,
        jobPostingId: event.jobPostingId,
        date: event.occurredAt.slice(0, 10),
        kind: "application",
        title: applicationEventTitle(event),
        subtitle: event.jobTitle || event.note || undefined,
        dotColor: STATUS_DOT[status],
      });
    }

    events.sort((a, b) => a.date.localeCompare(b.date));

    return {
      past: events.filter((e) => e.date <= today),
      upcoming: events.filter((e) => e.date > today),
    };
  }, [applicationEvents, companies, today]);

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
            지원 일정
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            상태 변경 · 면접 이력
          </p>
        </div>
        <Button onClick={onBack} variant="secondary">
          <ArrowLeft className="h-4 w-4" />
          지원 현황
        </Button>
      </div>

      <div className="divide-y divide-slate-100 p-4 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            지원 기록을 불러오고 있어요
          </div>
        ) : null}
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
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
            emptyMessage="아직 지원 기록이 없어요."
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
  onSelectCompany: (id: string, target?: DrawerFocusTarget) => void;
}) {
  const router = useRouter();
  if (groups.length === 0 && !emptyMessage) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-600">{title}</h3>
      {groups.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-400">{emptyMessage}</p>
          <Link
            className="mt-3 inline-flex text-sm font-semibold text-emerald-700 underline underline-offset-4"
            href="/"
          >
            공고 분석하러 가기
          </Link>
        </div>
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
                    onClick={() => {
                      if (event.jobPostingId) {
                        router.push(`/tracker?job=${encodeURIComponent(event.jobPostingId)}`);
                        return;
                      }
                      onSelectCompany(event.companyId, getTimelineDrawerTarget(event));
                    }}
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

function getTimelineDrawerTarget(event: UnifiedEvent): DrawerFocusTarget {
  return {
    tab: event.kind === "interview" ? "interview" : "summary",
  };
}

function applicationEventTitle(event: ApplicationEvent): string {
  if (event.eventType === "saved") {
    return event.toStatus === "pass" ? "패스로 정리" : "공고 저장";
  }
  if (event.eventType === "decision_changed") {
    return `결정 변경 · ${applicationStatusLabel(event.toStatus)}`;
  }
  return applicationStatusLabel(event.toStatus);
}

function applicationStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    interested: "관심",
    planned: "지원 예정",
    applied: "지원 완료",
    interviewing: "면접 진행",
    rejected: "불합격",
    offer: "합격",
    on_hold: "보류",
    pass: "패스",
  };
  return labels[value] ?? value;
}

function isCompanyStatus(value: string): value is Company["status"] {
  return [
    "interested",
    "planned",
    "applied",
    "interviewing",
    "rejected",
    "offer",
    "on_hold",
  ].includes(value);
}
