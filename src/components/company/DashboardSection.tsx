"use client";

import { Badge } from "@/components/ui/badge";
import type { Company } from "@/lib/types";

interface DashboardSectionProps {
  companies: Company[];
  label: string;
  onSelect: (id: string) => void;
  tone: "slate" | "green" | "amber" | "red" | "blue";
}

export function DashboardSection({
  companies,
  label,
  onSelect,
  tone,
}: DashboardSectionProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
        <Badge tone={tone}>{companies.length}</Badge>
      </div>
      <div className="mt-3 space-y-2">
        {companies.slice(0, 3).map((company) => (
          <button
            className="block w-full rounded-md border border-slate-100 px-2 py-2 text-left hover:bg-slate-50"
            key={company.id}
            onClick={() => onSelect(company.id)}
            type="button"
          >
            <div className="truncate text-sm font-medium text-slate-900">
              {company.name}
            </div>
            <div className="mt-1 truncate text-xs text-slate-500">
              {company.jobDeadline || company.priorityReason || "확인 필요"}
            </div>
          </button>
        ))}
        {companies.length === 0 ? (
          <p className="py-3 text-sm text-slate-400">없음</p>
        ) : null}
      </div>
    </div>
  );
}
