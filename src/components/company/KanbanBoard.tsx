"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/criteria";
import { formatScore } from "@/lib/scoring";
import type { ApplicationStatus, Company, CompanyScoreResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getPriorityTone, STATUS_TONE } from "./shared";

const KANBAN_COLUMNS: ApplicationStatus[] = [
  "interested",
  "planned",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "on_hold",
];

interface KanbanBoardProps {
  companies: Company[];
  scoreMap: Map<string, CompanyScoreResult>;
  selectedId: string;
  onSelect: (id: string) => void;
  onStatusChange: (companyId: string, status: ApplicationStatus) => void;
}

export function KanbanBoard({
  companies,
  scoreMap,
  selectedId,
  onSelect,
  onStatusChange,
}: KanbanBoardProps) {
  const [dragOverColumn, setDragOverColumn] = useState<ApplicationStatus | null>(
    null,
  );

  return (
    <div className="overflow-x-auto p-3">
      <div className="flex min-w-max gap-3">
        {KANBAN_COLUMNS.map((status) => {
          const columnCompanies = companies.filter(
            (company) => company.status === status,
          );
          return (
            <div
              className={cn(
                "w-64 shrink-0 rounded-lg border border-slate-200 bg-slate-50/60 transition-colors",
                dragOverColumn === status && "border-slate-400 bg-slate-100",
              )}
              key={status}
              onDragLeave={() => setDragOverColumn(null)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverColumn(status);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragOverColumn(null);
                const companyId = event.dataTransfer.getData("text/company-id");
                if (companyId) onStatusChange(companyId, status);
              }}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
                <span className="text-xs font-semibold uppercase text-slate-600">
                  {STATUS_LABELS[status]}
                </span>
                <Badge tone={STATUS_TONE[status]}>{columnCompanies.length}</Badge>
              </div>
              <div className="max-h-[560px] space-y-2 overflow-y-auto p-2">
                {columnCompanies.map((company) => {
                  const score = scoreMap.get(company.id);
                  return (
                    <button
                      className={cn(
                        "block w-full cursor-grab rounded-md border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-300 active:cursor-grabbing",
                        selectedId === company.id && "ring-2 ring-slate-400",
                      )}
                      draggable
                      key={company.id}
                      onClick={() => onSelect(company.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/company-id", company.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-medium text-slate-950">
                          {company.name}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-slate-700">
                          {formatScore(score?.companyFitScore ?? 0)}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">
                        {company.industry || "산업군 미입력"}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <Badge tone={getPriorityTone(company.applicationPriority)}>
                          {PRIORITY_LABELS[company.applicationPriority]}
                        </Badge>
                        {company.jobDeadline ? (
                          <Badge tone="slate">~{company.jobDeadline.slice(5)}</Badge>
                        ) : null}
                        {score?.highRisk ? <Badge tone="red">리스크</Badge> : null}
                      </div>
                    </button>
                  );
                })}
                {columnCompanies.length === 0 ? (
                  <p className="px-1 py-4 text-center text-xs text-slate-400">
                    여기로 드래그
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
