"use client";

import { Pencil } from "lucide-react";
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

interface CompanyTableProps {
  companies: Company[];
  scoreMap: Map<string, CompanyScoreResult>;
  selectedId: string;
  onEdit: (company: Company) => void;
  onSelect: (id: string) => void;
}

export function CompanyTable({
  companies,
  scoreMap,
  selectedId,
  onEdit,
  onSelect,
}: CompanyTableProps) {
  return (
    <div className="overflow-x-auto">
      <table
        aria-label="회사 목록"
        className="w-full min-w-[980px] border-collapse text-left text-sm"
        role="grid"
      >
        <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3" scope="col">회사</th>
            <th className="px-4 py-3" scope="col">상태</th>
            <th className="px-4 py-3" scope="col">회사핏</th>
            <th className="px-4 py-3" scope="col">지원 우선순위</th>
            <th className="px-4 py-3" scope="col">근거</th>
            <th className="px-4 py-3" scope="col">공고</th>
            <th className="px-4 py-3" scope="col">리스크</th>
            <th className="px-4 py-3" scope="col">수정</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => {
            const score = scoreMap.get(company.id);
            const isSelected = selectedId === company.id;
            return (
              <tr
                aria-selected={isSelected}
                className={cn(
                  "cursor-pointer border-t border-slate-100 hover:bg-slate-50",
                  isSelected && "bg-slate-50",
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
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-950">{company.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {company.industry} · {COMPANY_SIZE_LABELS[company.size]}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[company.status]}>
                    {STATUS_LABELS[company.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="text-lg font-semibold">
                    {formatScore(score?.companyFitScore ?? 0)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={getPriorityTone(company.applicationPriority)}>
                    {PRIORITY_LABELS[company.applicationPriority]}
                  </Badge>
                  <div className="mt-1 max-w-40 truncate text-xs text-slate-500">
                    {company.priorityReason}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={score?.needsValidation ? "amber" : "green"}>
                    {score?.needsValidation ? "검증 필요" : "확인됨"}
                  </Badge>
                  <div className="mt-1 text-xs text-slate-500">
                    Lv.{Math.round(score?.averageEvidenceLevel ?? company.evidenceLevel)}
                  </div>
                </td>
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
                  <div className="mt-1 text-xs text-slate-500">
                    {company.jobDeadline || "마감 미확인"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={score?.highRisk ? "red" : "slate"}>
                    {score?.highRisk ? "리스크 높음" : `${score?.riskCount ?? 0}개`}
                  </Badge>
                </td>
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
      {companies.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-slate-500">
          조건에 맞는 회사가 없습니다.
        </div>
      ) : null}
    </div>
  );
}
