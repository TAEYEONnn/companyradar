"use client";

import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ApplicationChecklist } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  COMPANY_SIZE_LABELS,
  STATUS_LABELS,
} from "@/lib/criteria";
import { formatScore } from "@/lib/scoring";
import type { Company, CompanyScoreResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { STATUS_TONE } from "./shared";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

interface CompanyTableProps {
  companies: Company[];
  scoreMap: Map<string, CompanyScoreResult>;
  selectedId: string;
  selectedIds?: string[];
  onEdit: (company: Company) => void;
  onSelect: (id: string) => void;
  onSetSelectedIds?: (ids: string[]) => void;
  onToggleSelected?: (id: string) => void;
}

export function CompanyTable({
  companies,
  scoreMap,
  selectedId,
  selectedIds = [],
  onEdit,
  onSelect,
  onSetSelectedIds,
  onToggleSelected,
}: CompanyTableProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);

  const totalPages = Math.ceil(companies.length / pageSize);
  const safePage = Math.min(page, Math.max(totalPages - 1, 0));
  const start = safePage * pageSize;
  const end = start + pageSize;
  const pageCompanies = companies.slice(start, end);
  const allCompanyIds = companies.map((company) => company.id);
  const allSelected =
    allCompanyIds.length > 0 && allCompanyIds.every((id) => selectedIds.includes(id));

  return (
    <div>
      <div className="overflow-x-auto">
        <table
          aria-label="회사 목록"
          className="w-full min-w-[560px] border-collapse text-left text-sm"
          role="grid"
        >
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              {onToggleSelected && (
                <th className="w-8 px-2 py-3" scope="col">
                  <input
                    aria-label="현재 목록 전체 선택"
                    checked={allSelected}
                    className="h-4 w-4 cursor-pointer accent-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={allCompanyIds.length === 0}
                    onChange={() =>
                      onSetSelectedIds?.(allSelected ? [] : allCompanyIds)
                    }
                    type="checkbox"
                  />
                </th>
              )}
              <th className="px-4 py-3" scope="col">회사</th>
              <th className="px-4 py-3" scope="col">회사핏</th>
              <th className="px-4 py-3" scope="col">상태</th>
              <th className="px-4 py-3" scope="col">수정</th>
            </tr>
          </thead>
          <tbody>
            {pageCompanies.map((company) => {
              const score = scoreMap.get(company.id);
              const isSelected = selectedId === company.id;
              const isChecked = selectedIds.includes(company.id);
              return (
                <tr
                  aria-selected={isSelected}
                  className={cn(
                    "cursor-pointer border-t border-slate-100 hover:bg-slate-50",
                    isSelected && "bg-slate-50",
                    isChecked && "bg-sky-50 ring-1 ring-inset ring-sky-200",
                  )}
                  key={company.id}
                  onClick={() => onSelect(company.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(company.id);
                    }
                  }}
                  role="row"
                  tabIndex={0}
                >
                  {onToggleSelected && (
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        aria-label={`${company.name} 선택`}
                        checked={isChecked}
                        className="h-4 w-4 cursor-pointer accent-sky-600"
                        onChange={() => onToggleSelected(company.id)}
                        type="checkbox"
                      />
                    </td>
                  )}

                  {/* 회사 */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-950">{company.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {company.industry} · {COMPANY_SIZE_LABELS[company.size]}
                    </div>
                    <ChecklistDots checklist={company.applicationChecklist} />
                  </td>

                  {/* 회사핏 + Evidence */}
                  <td className="px-4 py-3">
                    <div className="text-lg font-semibold leading-tight">
                      {formatScore(score?.companyFitScore ?? 0)}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      Lv.{Math.round(score?.averageEvidenceLevel ?? company.evidenceLevel)}
                    </div>
                  </td>

                  {/* 상태 */}
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[company.status]}>
                      {STATUS_LABELS[company.status]}
                    </Badge>
                  </td>

                  {/* 수정 */}
                  <td className="px-4 py-3">
                    <Button
                      aria-label={`${company.name} 수정`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(company);
                      }}
                      size="icon"
                      variant="ghost"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {companies.length === 0 && (
          <div className="flex h-64 items-center justify-center text-sm text-slate-500">
            조건에 맞는 회사가 없습니다.
          </div>
        )}
      </div>

      {/* Pagination */}
      {companies.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>페이지당</span>
            <select
              aria-label="페이지 크기"
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              onChange={(e) => {
                setPage(0);
                setPageSize(Number(e.target.value) as PageSizeOption);
              }}
              value={pageSize}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}개</option>
              ))}
            </select>
            <span>· 전체 {companies.length}개</span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                aria-label="이전 페이지"
                className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                disabled={safePage === 0}
                onClick={() => setPage((p) => p - 1)}
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i)
                .filter((i) => Math.abs(i - safePage) <= 2)
                .map((i) => (
                  <button
                    aria-label={`${i + 1} 페이지`}
                    className={cn(
                      "flex h-7 min-w-[28px] items-center justify-center rounded border px-1.5 text-xs",
                      i === safePage
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50",
                    )}
                    key={i}
                    onClick={() => setPage(i)}
                    type="button"
                  >
                    {i + 1}
                  </button>
                ))}

              <button
                aria-label="다음 페이지"
                className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                type="button"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CHECKLIST_KEYS: (keyof ApplicationChecklist)[] = [
  "resumeReady",
  "portfolioReady",
  "coverLetterReady",
  "referralChecked",
  "submitted",
];

function ChecklistDots({ checklist }: { checklist: ApplicationChecklist }) {
  const done = CHECKLIST_KEYS.filter((k) => checklist[k]).length;
  if (done === 0) return null;
  return (
    <div className="mt-1 flex items-center gap-1">
      {CHECKLIST_KEYS.map((k) => (
        <div
          key={k}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            checklist[k] ? "bg-emerald-500" : "bg-slate-200",
          )}
        />
      ))}
      <span className="ml-0.5 text-xs text-slate-400">{done}/5</span>
    </div>
  );
}
