import { cn } from "@/lib/utils";

interface ScoreSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export function ScoreSlider({ label, value, onChange }: ScoreSliderProps) {
  return (
    <div className="grid grid-cols-[minmax(180px,1fr)_180px_32px] items-center gap-3">
      <span className="text-sm text-slate-700">{label}</span>
      <input
        aria-label={label}
        className="accent-slate-900"
        max={5}
        min={1}
        onChange={(event) => onChange(Number(event.target.value))}
        step={1}
        type="range"
        value={value}
      />
      <span
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-semibold",
          value >= 4
            ? "bg-emerald-50 text-emerald-700"
            : value <= 2
              ? "bg-red-50 text-red-700"
              : "bg-slate-100 text-slate-700",
        )}
      >
        {value}
      </span>
    </div>
  );
}
