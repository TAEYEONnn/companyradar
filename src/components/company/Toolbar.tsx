"use client";

import {
  ArrowDownWideNarrow,
  Kanban,
  ListFilter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { STATUS_OPTIONS } from "@/lib/criteria";
import type { ApplicationStatus, SortMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ListMode } from "./shared";

export interface AdvancedFilter {
  minScore: number;       // 0 = off
  hasGreenFlag: boolean;
  hasRedFlag: boolean;
  hasRisk: boolean;
  hasInterviews: boolean;
  needsValidation: boolean;
}

export const EMPTY_ADVANCED_FILTER: AdvancedFilter = {
  minScore: 0,
  hasGreenFlag: false,
  hasRedFlag: false,
  hasRisk: false,
  hasInterviews: false,
  needsValidation: false,
};

function isFilterActive(f: AdvancedFilter) {
  return (
    f.minScore > 0 ||
    f.hasGreenFlag ||
    f.hasRedFlag ||
    f.hasRisk ||
    f.hasInterviews ||
    f.needsValidation
  );
}

interface ToolbarProps {
  devToolsEnabled?: boolean;
  hasSampleCompanies?: boolean;
  listMode: ListMode;
  query: string;
  sortMode: SortMode;
  statusFilter: ApplicationStatus | "all";
  advancedFilter?: AdvancedFilter;
  onAdvancedFilterChange?: (f: AdvancedFilter) => void;
  onAddSamples?: () => void;
  onDeleteSamples?: () => void;
  onListModeChange: (mode: ListMode) => void;
  onQueryChange: (query: string) => void;
  onReset: () => void;
  onSortModeChange: (mode: SortMode) => void;
  onStatusFilterChange: (status: ApplicationStatus | "all") => void;
}

export function Toolbar({
  devToolsEnabled = false,
  hasSampleCompanies = false,
  listMode,
  query,
  sortMode,
  statusFilter,
  advancedFilter = EMPTY_ADVANCED_FILTER,
  onAdvancedFilterChange,
  onAddSamples,
  onDeleteSamples,
  onListModeChange,
  onQueryChange,
  onReset,
  onSortModeChange,
  onStatusFilterChange,
}: ToolbarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const active = isFilterActive(advancedFilter);
  const activeFilterCount = [
    advancedFilter.hasGreenFlag,
    advancedFilter.hasRedFlag,
    advancedFilter.hasRisk,
    advancedFilter.hasInterviews,
    advancedFilter.needsValidation,
    advancedFilter.minScore > 0,
  ].filter(Boolean).length;

  function toggleChip(key: keyof Omit<AdvancedFilter, "minScore">) {
    onAdvancedFilterChange?.({ ...advancedFilter, [key]: !advancedFilter[key] });
  }

  return (
    <div className="border-b border-slate-200">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative w-full flex-none sm:min-w-56 sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            aria-label="회사 검색"
            className="pl-9"
            data-shortcut="search"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="회사명, 산업군, 제품 설명 검색"
            value={query}
          />
        </div>
        <div className="flex flex-1 items-center gap-2 sm:w-40 sm:flex-none">
          <ListFilter className="h-4 w-4 shrink-0 text-slate-400" />
          <Select
            aria-label="상태 필터"
            onChange={(event) =>
              onStatusFilterChange(event.target.value as ApplicationStatus | "all")
            }
            value={statusFilter}
          >
            <option value="all">전체 상태</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-1 items-center gap-2 sm:w-48 sm:flex-none">
          <ArrowDownWideNarrow className="h-4 w-4 shrink-0 text-slate-400" />
          <Select
            aria-label="정렬"
            onChange={(event) => onSortModeChange(event.target.value as SortMode)}
            value={sortMode}
          >
            <option value="score_desc">점수순</option>
            <option value="priority_desc">지원 우선순위순</option>
            <option value="deadline_asc">마감 임박순</option>
            <option value="updated_desc">최근 수정순</option>
          </Select>
        </div>

        <div className="flex items-center rounded-md border border-slate-200 p-0.5">
          <button
            aria-label="테이블 보기"
            aria-pressed={listMode === "table"}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium",
              listMode === "table"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
            onClick={() => onListModeChange("table")}
            type="button"
          >
            <Table2 className="h-3.5 w-3.5" />
            테이블
          </button>
          <button
            aria-label="칸반 보기"
            aria-pressed={listMode === "kanban"}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium",
              listMode === "kanban"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
            onClick={() => onListModeChange("kanban")}
            type="button"
          >
            <Kanban className="h-3.5 w-3.5" />
            칸반
          </button>
        </div>

        {onAdvancedFilterChange && (
          <button
            aria-label="고급 필터"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
              active || showAdvanced
                ? "border-sky-300 bg-sky-50 text-sky-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50",
            )}
            onClick={() => setShowAdvanced((v) => !v)}
            type="button"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            필터
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold leading-none text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        {onAddSamples ? (
          <Button onClick={onAddSamples} size="sm" variant="ghost">
            예시 추가
          </Button>
        ) : null}
        {hasSampleCompanies && onDeleteSamples ? (
          <Button onClick={onDeleteSamples} size="sm" variant="ghost">
            샘플 삭제
          </Button>
        ) : null}
        {devToolsEnabled ? (
        <div className="flex items-center gap-1">
          <Button aria-label="직군 예시 데이터 초기화" onClick={onReset} size="sm" title="직군 예시 데이터 초기화" variant="ghost">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
        ) : null}
      </div>

      {showAdvanced && onAdvancedFilterChange && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2">
          <span className="text-xs font-medium text-slate-500">고급 필터:</span>

          <FilterChip
            active={advancedFilter.hasGreenFlag}
            label="Green 신호 있음"
            onClick={() => toggleChip("hasGreenFlag")}
          />
          <FilterChip
            active={advancedFilter.hasRedFlag}
            label="Red 신호 있음"
            onClick={() => toggleChip("hasRedFlag")}
          />
          <FilterChip
            active={advancedFilter.hasRisk}
            label="리스크 있음"
            onClick={() => toggleChip("hasRisk")}
          />
          <FilterChip
            active={advancedFilter.hasInterviews}
            label="면접 기록 있음"
            onClick={() => toggleChip("hasInterviews")}
          />
          <FilterChip
            active={advancedFilter.needsValidation}
            label="확인 필요"
            onClick={() => toggleChip("needsValidation")}
          />

          {/* 최소 점수 */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">최소 점수</span>
            <select
              aria-label="최소 점수 필터"
              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700"
              onChange={(e) =>
                onAdvancedFilterChange({
                  ...advancedFilter,
                  minScore: Number(e.target.value),
                })
              }
              value={advancedFilter.minScore}
            >
              <option value={0}>전체</option>
              <option value={3.0}>3.0+</option>
              <option value={3.7}>3.7+</option>
              <option value={4.3}>4.3+</option>
            </select>
          </div>

          {active && (
            <button
              className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
              onClick={() => onAdvancedFilterChange(EMPTY_ADVANCED_FILTER)}
              type="button"
            >
              <X className="h-3 w-3" />
              초기화
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-sky-400 bg-sky-100 text-sky-700"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
