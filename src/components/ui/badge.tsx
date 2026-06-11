import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "slate" | "green" | "amber" | "red" | "blue" | "purple";
}

export function Badge({ className, tone = "slate", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
        tone === "slate" && "border-slate-200 bg-slate-50 text-slate-700",
        tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "amber" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "red" && "border-red-200 bg-red-50 text-red-700",
        tone === "blue" && "border-sky-200 bg-sky-50 text-sky-700",
        tone === "purple" && "border-violet-200 bg-violet-50 text-violet-700",
        className,
      )}
      {...props}
    />
  );
}
