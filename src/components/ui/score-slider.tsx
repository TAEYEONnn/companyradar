import { cn } from "@/lib/utils";
import { EVIDENCE_LEVEL_OPTIONS } from "@/lib/criteria";
import type { EvidenceLevel } from "@/lib/types";

interface ScoreSliderProps {
  evidenceLevel: EvidenceLevel;
  label: string;
  value: number;
  onEvidenceChange: (value: EvidenceLevel) => void;
  onChange: (value: number) => void;
}

export function ScoreSlider({
  evidenceLevel,
  label,
  value,
  onEvidenceChange,
  onChange,
}: ScoreSliderProps) {
  return (
    <div className="space-y-1.5 sm:grid sm:grid-cols-[minmax(180px,1fr)_160px_32px_160px] sm:items-center sm:space-y-0 sm:gap-3">
      <span className="text-sm text-slate-700">{label}</span>
      {/* On mobile: flex row with slider + badge; on sm+: two separate grid cells via sm:contents */}
      <div className="flex items-center gap-2 sm:contents">
        <input
          aria-label={label}
          className="flex-1 accent-slate-900 sm:flex-none"
          max={5}
          min={1}
          onChange={(event) => onChange(Number(event.target.value))}
          step={1}
          type="range"
          value={value}
        />
        <span
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
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
      <select
        aria-label={`${label} 근거 수준`}
        className="h-8 w-full truncate rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        onChange={(event) =>
          onEvidenceChange(Number(event.target.value) as EvidenceLevel)
        }
        value={evidenceLevel}
      >
        {EVIDENCE_LEVEL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            Lv.{option.value} {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
