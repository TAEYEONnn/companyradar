"use client";

import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  COMPANY_SIZE_LABELS,
  JOB_STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/criteria";
import { formatScore } from "@/lib/scoring";
import type { Company, CompanyScoreResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getPriorityTone, STATUS_TONE } from "./shared";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

interface CompanyTableProps {
  companies: Company[];
  scoreMap: Map<string, CompanyScoreResult>;
  selectedId: string;
  compareIds?: string[];
  onEdit: (company: Company) => void;
  onSelect: (id: string) => void;
  onToggleCompare?: (id: string) => void;
}

export function CompanyTable({
  companies,
  scoreMap,
  selectedId,
  compareIds = [],
  onEdit,
  onSelect,
  onToggleCompare,
}: CompanyTableProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);

  // Reset to first page when data changes
  useEffect(() => {
    setPage(0);
  }, [companies.length, pageSize]);

  const totalPages = Math.ceil(companies.length / pageSize);
  const start = page * pageSize;
  const end = start + pageSize;
  const pageCompanies = companies.slice(start, end);

  return (
    <div>
      <div className="overflow-x-auto">
        <table
          aria-label="회사 목록"
          className="w-full min-w-[860px] border-collapse text-left text-sm"
          role="grid"
        >
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              {onToggleCompare && <th className="w-8 px-2 py-3" scope="col" />}
              <th className="px-4 py-3" scope="col">회사</th>
              <th className="px-4 py-3" scope="col">회사핏</th>
              <th className="px-4 py-3" scope="col">지원 우선순위</th>
              <th className="px-4 py-3" scope="col">상태</th>
              <th className="px-4 py-3" scope="col">공고 상태</th>
              <th className="px-4 py-3" scope="col">리스크</th>
              <th className="px-4 py-3" scope="col">수정</th>
            </tr>
          </thead>
          <tbody>
            {pageCompanies.map((company) => {
              const score = scoreMap.get(company.id);
              const isSelected = selectedId === company.id;
              const isComparing = compareIds.includes(company.id);
              const canAddCompare = !isComparing && compareIds.length < 3;
              return (
                <tr
                  aria-selected={isSelected}
                  className={cn(
                    "cursor-pointer border-t border-slate-100 hover:bg-slate-50",
                    isSelected && "bg-slate-50",
                    isComparing && "ring-1 ring-inset ring-sky-300",
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
                  {onToggleCompare && (
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        aria-label={`${company.name} 비교 선택`}
                        checked={isComparing}
                        className="h-4 w-4 cursor-pointer accent-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={!canAddCompare && !isComparing}
                        onChange={() => onToggleCompare(company.id)}
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

                  {/* 지원 우선순위 */}
                  <td className="px-4 py-3">
                    <Badge tone={getPriorityTone(company.applicationPriority)}>
                      {PRIORITY_LABELS[company.applicationPriority]}
                    </Badge>
                    {company.priorityReason && (
                      <div className="mt-1 max-w-36 truncate text-xs text-slate-500">
                        {company.priorityReason}
                      </div>
                    )}
                  </td>

                  {/* 상태 */}
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[company.status]}>
                      {STATUS_LABELS[company.status]}
                    </Badge>
                  </td>

                  {/* 공고 상태 */}
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        company.jobStatus === "open"
                          ? "green"
                          : company.jobStatus === "closed"
                            ? "red"
                            : "slate"
                      }
                    >
                      {JOB_STATUS_LABELS[company.jobStatus]}
                    </Badge>
                    {company.jobDeadline && (
                      <div className="mt-0.5 text-xs text-slate-500">
                        {company.jobDeadline}
                      </div>
                    )}
                  </td>

                  {/* 리스크 */}
                  <td className="px-4 py-3">
                    <Badge tone={score?.highRisk ? "red" : "slate"}>
                      {score?.highRisk ? "높음" : `${score?.riskCount ?? 0}개`}
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
              onChange={(e) => setPageSize(Number(e.target.value) as PageSizeOption)}
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
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i)
                .filter((i) => Math.abs(i - page) <= 2)
                .map((i) => (
                  <button
                    aria-label={`${i + 1} 페이지`}
                    className={cn(
                      "flex h-7 min-w-[28px] items-center justify-center rounded border px-1.5 text-xs",
                      i === page
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
                disabled={page >= totalPages - 1}
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
