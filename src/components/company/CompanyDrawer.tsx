"use client";

import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { cn, parseLocalDate } from "@/lib/utils";
import { useCurrentDate } from "@/lib/use-current-date";
import type { Company, CompanyScoreResult, CriteriaSettings } from "@/lib/types";
import { CompanyDetailPanel } from "./CompanyDetailPanel";
import type { DrawerFocusTarget } from "./shared";

function DeadlineAlert({ company }: { company: Company }) {
  const today = useCurrentDate();
  if (!company.jobDeadline || company.jobStatus !== "open") return null;
  const daysLeft = Math.ceil(
    (parseLocalDate(company.jobDeadline).getTime() - parseLocalDate(today).getTime()) /
      86_400_000,
  );
  if (daysLeft < 0 || daysLeft > 3) return null;
  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {daysLeft === 0
        ? "오늘 마감입니다!"
        : `공고 마감 D-${daysLeft} (${company.jobDeadline})`}
    </div>
  );
}

interface CompanyDrawerProps {
  open: boolean;
  company: Company | null;
  score: CompanyScoreResult | null;
  userId: string;
  focusTarget?: DrawerFocusTarget;
  settings?: CriteriaSettings;
  hasPrev?: boolean;
  hasNext?: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit: (company: Company) => void;
  onPatch: (id: string, patch: Partial<Company>) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onStatusAutoChanged?: () => void;
  onToast?: (message: string) => void;
}

export function CompanyDrawer({
  open,
  company,
  score,
  userId,
  focusTarget,
  settings,
  hasPrev = false,
  hasNext = false,
  onClose,
  onDelete,
  onEdit,
  onPatch,
  onPrev,
  onNext,
  onStatusAutoChanged,
  onToast,
}: CompanyDrawerProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, onPrev, onNext]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <aside
        aria-label="회사 상세"
        className={cn(
          "fixed right-0 top-0 z-50 flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-200 ease-in-out sm:w-[600px] lg:w-[720px] xl:w-[800px]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {company && score ? (
          <>
            <DeadlineAlert company={company} />
            {(onPrev || onNext) && (
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                <button
                  aria-label="이전 회사"
                  className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={!hasPrev}
                  onClick={onPrev}
                  type="button"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  이전
                </button>
                <button
                  aria-label="다음 회사"
                  className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={!hasNext}
                  onClick={onNext}
                  type="button"
                >
                  다음
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <CompanyDetailPanel
              company={company}
              focusTarget={focusTarget}
              key={`${company.id}:${focusTarget?.tab ?? "summary"}:${focusTarget?.section ?? ""}`}
              settings={settings}
              onBack={onClose}
              onDelete={(id) => {
                onDelete(id);
                onClose();
              }}
              onEdit={onEdit}
              onPatch={onPatch}
              onStatusAutoChanged={onStatusAutoChanged}
              onToast={onToast}
              score={score}
              userId={userId}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            회사를 선택하세요
          </div>
        )}
      </aside>
    </>
  );
}
