"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { cn, parseLocalDate } from "@/lib/utils";
import { useCurrentDate } from "@/lib/use-current-date";
import type { Company, CompanyScoreResult } from "@/lib/types";
import { CompanyDetailPanel } from "./CompanyDetailPanel";

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
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit: (company: Company) => void;
  onPatch: (id: string, patch: Partial<Company>) => void;
}

export function CompanyDrawer({
  open,
  company,
  score,
  userId,
  onClose,
  onDelete,
  onEdit,
  onPatch,
}: CompanyDrawerProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

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
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col bg-white shadow-2xl transition-transform duration-200 ease-in-out",
          "fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-200 ease-in-out sm:w-[520px]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {company && score ? (
          <>
            <DeadlineAlert company={company} />
            <CompanyDetailPanel
              company={company}
              onBack={onClose}
              onDelete={(id) => {
                onDelete(id);
                onClose();
              }}
              onEdit={onEdit}
              onPatch={onPatch}
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
