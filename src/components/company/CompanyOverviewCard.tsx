import { Building2, ChevronRight } from "lucide-react";
import type { CompanyOverview } from "@/lib/fit-analysis";

export function CompanyOverviewCard({
  overview,
}: {
  overview: CompanyOverview;
}) {
  const hasContent =
    overview.industry ||
    overview.productSummary ||
    overview.appealPoints.length > 0 ||
    overview.greenSignals.length > 0 ||
    overview.cautionSignals.length > 0 ||
    overview.unknownSignals.length > 0;

  if (!hasContent) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
        <h3 className="text-base font-semibold">회사 정보도 함께 정리했어요</h3>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        공고에서 확인된 내용만 담았어요.
      </p>
      <div className="mt-4 space-y-4">
        {overview.industry || overview.productSummary ? (
          <div>
            {overview.industry ? (
              <p className="text-sm">
                <span className="font-medium text-slate-600">업종</span>{" "}
                <span className="text-slate-800">{overview.industry}</span>
              </p>
            ) : null}
            {overview.productSummary ? (
              <p className="mt-1 text-sm leading-6 text-slate-700">
                {overview.productSummary}
              </p>
            ) : null}
          </div>
        ) : null}
        <OverviewList
          items={overview.appealPoints}
          title="지원 매력 포인트"
          tone="emerald"
        />
        <OverviewList
          items={overview.greenSignals}
          title="긍정 신호"
          tone="emerald"
        />
        <OverviewList
          items={overview.cautionSignals}
          title="주의 신호"
          tone="amber"
        />
        <OverviewList
          items={overview.unknownSignals}
          title="확인이 필요해요"
          tone="slate"
        />
      </div>
    </section>
  );
}

function OverviewList({
  items,
  title,
  tone,
}: {
  items: string[];
  title: string;
  tone: "emerald" | "amber" | "slate";
}) {
  if (items.length === 0) return null;
  const titleClass = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    slate: "text-slate-500",
  }[tone];
  const dotClass = {
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    slate: "text-slate-400",
  }[tone];

  return (
    <div>
      <p className={`text-xs font-semibold ${titleClass}`}>{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li
            className="flex items-start gap-1.5 text-sm leading-6 text-slate-700"
            key={item}
          >
            <ChevronRight className={`mt-1 h-3.5 w-3.5 shrink-0 ${dotClass}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
