"use client";

import {
  ExternalLink,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type {
  JobApplicationStatus,
  TrackedJobPosting,
} from "@/lib/job-tracker";
import { cn } from "@/lib/utils";
import { CompanyOverviewCard } from "./CompanyOverviewCard";

const STATUS_STEPS: Array<{
  value: JobApplicationStatus;
  label: string;
  hint: string;
}> = [
  { value: "interested", label: "관심", hint: "지원 여부를 살펴보는 단계예요." },
  { value: "planned", label: "지원 예정", hint: "이력서와 포트폴리오를 준비해보세요." },
  { value: "applied", label: "지원 완료", hint: "2주 동안 연락이 없다면 확인해보세요." },
  { value: "interviewing", label: "면접 중", hint: "예상 질문과 답변을 정리해보세요." },
  { value: "offer", label: "합격", hint: "조건과 입사 일정을 확인해보세요." },
  { value: "rejected", label: "불합격", hint: "배운 점만 남기고 다음 기회를 찾아봐요." },
];

export function SavedJobFullView({
  job,
  updating,
  onClose,
  onStatusChange,
}: {
  job: TrackedJobPosting;
  updating: boolean;
  onClose: () => void;
  onStatusChange: (status: JobApplicationStatus) => void;
}) {
  const status =
    job.applicationStatus ??
    (job.decision === "pass" ? null : job.decision);
  const currentStep = STATUS_STEPS.find((step) => step.value === status);
  const grouped = {
    matched: job.requirements.filter(
      (item) => item.match === "matched" || item.match === "partial",
    ),
    missing: job.requirements.filter((item) => item.match === "missing"),
    uncertain: job.requirements.filter((item) => item.match === "uncertain"),
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] bg-white sm:bg-black/40 sm:p-4"
      role="dialog"
    >
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-slate-50 sm:rounded-lg sm:border sm:border-slate-200 sm:shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-emerald-700">
              {job.companyName}
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold text-slate-950">
              {job.title}
            </h2>
          </div>
          <button
            aria-label="전체 분석 닫기"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-5 p-4 pb-24 sm:p-6">
            <section className="grid gap-4 rounded-lg bg-slate-950 p-5 text-white sm:grid-cols-[1fr_auto] sm:p-6">
              <div>
                <Badge tone={recommendationTone(job.recommendation)}>
                  {recommendationLabel(job.recommendation)}
                </Badge>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
                  {job.summary}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-4xl font-semibold">{job.score}</p>
                <p className="mt-1 text-xs text-slate-400">
                  근거 충족률 {job.evidenceCoverage}%
                </p>
              </div>
            </section>

            {job.decision !== "pass" ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h3 className="font-semibold">지원 단계</h3>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {STATUS_STEPS.map((step) => (
                    <button
                      aria-pressed={status === step.value}
                      className={cn(
                        "min-h-10 rounded-md border px-2 py-2 text-xs font-medium",
                        status === step.value
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400",
                      )}
                      disabled={updating}
                      key={step.value}
                      onClick={() => onStatusChange(step.value)}
                      type="button"
                    >
                      {updating && status === step.value ? (
                        <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
                      ) : (
                        step.label
                      )}
                    </button>
                  ))}
                </div>
                {currentStep ? (
                  <p className="mt-3 text-sm text-slate-500">
                    {currentStep.hint}
                  </p>
                ) : null}
              </section>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <div className="space-y-5">
                <RequirementSection
                  items={grouped.matched}
                  title="잘 맞는 경험"
                />
                <RequirementSection
                  items={grouped.missing}
                  title="아쉬운 조건"
                />
                <RequirementSection
                  items={grouped.uncertain}
                  title="지원 전에 확인할 것"
                />
                {job.companyOverview ? (
                  <CompanyOverviewCard overview={job.companyOverview} />
                ) : null}
                {job.structuredData ? (
                  <section className="rounded-lg border border-slate-200 bg-white p-5">
                    <h3 className="font-semibold">공고 내용 정리</h3>
                    <StructuredList
                      items={job.structuredData.responsibilities}
                      title="공고에서 맡게 될 일"
                    />
                    <StructuredList
                      items={job.structuredData.requiredQualifications}
                      title="꼭 필요한 조건"
                    />
                    <StructuredList
                      items={job.structuredData.preferredQualifications}
                      title="있으면 좋은 조건"
                    />
                  </section>
                ) : null}
              </div>

              <aside className="space-y-4 lg:sticky lg:top-5 lg:h-fit">
                <div className="rounded-lg bg-white p-5 ring-1 ring-slate-200">
                  <p className="text-xs font-semibold text-slate-500">
                    지금 먼저 할 일
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-900">
                    {job.nextAction}
                  </p>
                </div>
                {job.canonicalUrl ? (
                  <a
                    className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
                    href={job.canonicalUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    공고 원문 보기
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
                <Link
                  className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
                  href="/"
                >
                  <RotateCcw className="h-4 w-4" />
                  다른 공고 분석
                </Link>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequirementSection({
  title,
  items,
}: {
  title: string;
  items: TrackedJobPosting["requirements"];
}) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 divide-y divide-slate-100">
        {items.map((item) => (
          <article className="py-3 first:pt-0 last:pb-0" key={item.id}>
            <p className="text-sm font-medium text-slate-900">{item.text}</p>
            <div className="mt-2 grid gap-2 text-xs leading-5 sm:grid-cols-2">
              <Evidence label="공고 근거" text={item.jobEvidence} />
              <Evidence label="내 경력 근거" text={item.profileEvidence} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Evidence({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-slate-700">{text || "확인된 근거가 없어요."}</p>
    </div>
  );
}

function StructuredList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li className="text-sm leading-6 text-slate-700" key={item}>
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function recommendationLabel(
  value: TrackedJobPosting["recommendation"],
): string {
  if (value === "apply") return "지원해볼 만해요";
  if (value === "verify") return "조금 더 확인해봐요";
  return "우선순위가 낮아요";
}

function recommendationTone(
  value: TrackedJobPosting["recommendation"],
): "green" | "amber" | "red" {
  if (value === "apply") return "green";
  if (value === "verify") return "amber";
  return "red";
}
