"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "삭제",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      onClick={onCancel}
      role="dialog"
    >
      <div
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="rounded-full bg-red-50 p-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel} variant="secondary">
            취소
          </Button>
          <Button autoFocus onClick={onConfirm} variant="danger">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
