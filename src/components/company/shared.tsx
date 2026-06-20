import type { ApplicationPriority, ApplicationStatus, Company } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ViewMode = "jobs" | "dashboard" | "form" | "quick-add" | "settings" | "stats" | "timeline" | "compare" | "today" | "coach";
export type ListMode = "table" | "kanban";
export type DrawerDetailTab = "summary" | "prep" | "research" | "interview" | "private" | "ai";

export interface DrawerFocusTarget {
  tab: DrawerDetailTab;
  section?: string;
}

export const STATUS_TONE: Record<
  ApplicationStatus,
  "slate" | "green" | "amber" | "red" | "blue" | "purple"
> = {
  interested: "slate",
  planned: "blue",
  applied: "purple",
  interviewing: "amber",
  rejected: "red",
  offer: "green",
  on_hold: "slate",
};

export function getPriorityTone(
  priority: ApplicationPriority,
): "slate" | "green" | "amber" | "red" | "blue" | "purple" {
  if (priority === "high") return "red";
  if (priority === "medium") return "amber";
  if (priority === "low") return "slate";
  return "blue";
}

export function getPriorityRank(priority: ApplicationPriority): number {
  const ranks: Record<ApplicationPriority, number> = {
    high: 4,
    medium: 3,
    low: 2,
    watch: 1,
  };
  return ranks[priority];
}

export function getDeadlineRank(company: Company): number {
  if (!company.jobDeadline) return Number.MAX_SAFE_INTEGER;
  return Date.parse(company.jobDeadline);
}

export function isDeadlineSoon(company: Company): boolean {
  if (company.jobStatus !== "open" || !company.jobDeadline) return false;
  const diff = Date.parse(company.jobDeadline) - Date.now();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  return diff >= 0 && diff <= fourteenDays;
}

export function isDueOrOverdue(date: string): boolean {
  if (!date) return false;
  return Date.parse(date) <= Date.now();
}

export function Metric({
  compact = false,
  label,
  value,
  tone = "slate",
}: {
  compact?: boolean;
  label: string;
  value: string;
  tone?: "slate" | "green" | "red";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white",
        compact ? "px-2.5 py-2" : "px-4 py-3",
      )}
    >
      <div className={cn("font-semibold uppercase text-slate-500", compact ? "text-[11px]" : "text-xs")}>{label}</div>
      <div
        className={cn(
          "whitespace-nowrap font-semibold",
          compact ? "mt-1 text-sm" : "mt-2 text-xl",
          tone === "green" && "text-emerald-700",
          tone === "red" && "text-red-700",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value || value === "없음") return null;
  return (
    <div className="grid grid-cols-[96px_1fr] items-start gap-4 text-sm leading-7">
      <span className="text-slate-500">{label}</span>
      <span className="whitespace-pre-line leading-7 text-slate-800">{value}</span>
    </div>
  );
}
