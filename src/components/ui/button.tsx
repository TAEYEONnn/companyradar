import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonWidth = "hug" | "fill";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
  width?: ButtonWidth;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  width = "hug",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:pointer-events-none disabled:opacity-50",

        width === "hug" && "w-fit flex-none",
        width === "fill" && "w-full",

        variant === "primary" &&
          "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",

        variant === "secondary" &&
          "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",

        variant === "ghost" &&
          "border-transparent bg-transparent text-slate-700 hover:bg-slate-100",

        variant === "danger" &&
          "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",

        size === "sm" && "h-8 px-3",
        size === "md" && "h-10 px-4",
        size === "icon" && "h-9 w-9 p-0",

        className,
      )}
      {...props}
    />
  );
}
