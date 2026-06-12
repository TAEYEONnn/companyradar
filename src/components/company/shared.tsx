import type { ApplicationPriority, ApplicationStatus, Company } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ViewMode = "dashboard" | "form" | "settings" | "stats" | "inbox" | "timeline" | "compare";
export type ListMode = "table" | "kanban";

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
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "green" | "red";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-2 whitespace-nowrap text-xl font-semibold",
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
  return (
    <div className="grid grid-cols-[86px_1fr] gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}
