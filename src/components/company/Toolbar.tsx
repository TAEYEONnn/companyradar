"use client";

import {
  ArrowDownWideNarrow,
  Download,
  Kanban,
  ListFilter,
  RotateCcw,
  Search,
  Table2,
  Upload,
} from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { STATUS_OPTIONS } from "@/lib/criteria";
import type { ApplicationStatus, SortMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ListMode } from "./shared";

interface ToolbarProps {
  listMode: ListMode;
  query: string;
  sortMode: SortMode;
  statusFilter: ApplicationStatus | "all";
  onExport: () => void;
  onImportFile: (file: File) => void;
  onListModeChange: (mode: ListMode) => void;
  onQueryChange: (query: string) => void;
  onReset: () => void;
  onSortModeChange: (mode: SortMode) => void;
  onStatusFilterChange: (status: ApplicationStatus | "all") => void;
}

export function Toolbar({
  listMode,
  query,
  sortMode,
  statusFilter,
  onExport,
  onImportFile,
  onListModeChange,
  onQueryChange,
  onReset,
  onSortModeChange,
  onStatusFilterChange,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
      <div className="relative min-w-56 flex-1">
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
      <div className="flex w-40 items-center gap-2">
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
      <div className="flex w-48 items-center gap-2">
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

      <div className="flex items-center gap-1">
        <Button aria-label="JSON 내보내기" onClick={onExport} size="icon" title="JSON 내보내기" variant="ghost">
          <Download className="h-4 w-4" />
        </Button>
        <Button
          aria-label="JSON 가져오기"
          onClick={() => fileInputRef.current?.click()}
          size="icon"
          title="JSON 가져오기"
          variant="ghost"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <input
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportFile(file);
            event.target.value = "";
          }}
          ref={fileInputRef}
          type="file"
        />
        <Button aria-label="샘플 데이터 초기화" onClick={onReset} size="icon" title="샘플 데이터 초기화" variant="ghost">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
