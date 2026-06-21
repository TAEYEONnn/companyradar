"use client";

import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import type {
  JobApplicationStatus,
  JobDecision,
  TrackedJobPosting,
} from "@/lib/job-tracker";
import { USER_COPY } from "@/lib/user-copy";
import { SavedJobFullView } from "./SavedJobFullView";

type JobFilter = "all" | "interested" | "planned" | "active" | "pass";

const DECISION_LABELS: Record<JobDecision, string> = {
  interested: "관심",
  planned: "지원 예정",
  pass: "패스",
};

const STAGE_LABELS: Partial<Record<string, string>> = {
  interested: "관심",
  planned: "지원 예정",
  applied: "지원 완료",
  interviewing: "면접 중",
  offer: "합격",
  rejected: "불합격",
  on_hold: "보류",
  pass: "패스",
};

function effectiveStage(job: TrackedJobPosting): string {
  if (job.decision === "pass") return "pass";
  return job.applicationStatus ?? job.decision;
}

function stageToFilter(stage: string): JobFilter {
  if (stage === "planned") return "planned";
  if (stage === "interested") return "interested";
  if (stage === "pass") return "pass";
  if (["applied", "interviewing", "offer"].includes(stage)) return "active";
  return "all";
}

const STATUS_LABELS: Record<JobApplicationStatus, string> = {
  interested: "관심",
  planned: "지원 예정",
  applied: "지원 완료",
  interviewing: "면접 진행",
  rejected: "불합격",
  offer: "오퍼",
  on_hold: "보류",
};

const RECOMMENDATION_LABELS = {
  apply: "지원해볼 만해요",
  verify: "조금 더 확인해봐요",
  pass: "우선순위가 낮아요",
} as const;

const MATCH_LABELS: Record<string, string> = {
  matched: "잘 맞아요",
  partial: "어느 정도",
  missing: "부족해요",
  uncertain: "확인 필요",
};

const MATCH_CLASS: Record<string, string> = {
  matched: "bg-emerald-100 text-emerald-800",
  partial: "bg-sky-100 text-sky-800",
  missing: "bg-rose-100 text-rose-800",
  uncertain: "bg-amber-100 text-amber-900",
};

export function JobPostingsPanel({
  accessToken,
  selectedJobId,
}: {
  accessToken: string;
  selectedJobId?: string;
}) {
  const [jobs, setJobs] = useState<TrackedJobPosting[]>([]);
  const [filter, setFilter] = useState<JobFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [fullViewJobId, setFullViewJobId] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/job-postings", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = (await response.json()) as {
          jobs?: TrackedJobPosting[];
          error?: { message?: string };
        };
        if (!response.ok) {
          throw new Error(data.error?.message || USER_COPY.save.loadedFailed);
        }
        if (active) {
          const loadedJobs = data.jobs ?? [];
          setJobs(loadedJobs);
          const selected = loadedJobs.find((job) => job.id === selectedJobId);
          if (selected?.decision === "pass") setFilter("pass");
          if (selected) setFullViewJobId(selected.id);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : USER_COPY.save.loadedFailed,
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [accessToken, selectedJobId]);

  const filteredJobs = useMemo(() => {
    if (filter === "pass") return jobs.filter((job) => job.decision === "pass");
    const visible = jobs.filter((job) => job.decision !== "pass");
    if (filter === "interested") {
      return visible.filter((job) => effectiveStage(job) === "interested");
    }
    if (filter === "planned") {
      return visible.filter((job) => effectiveStage(job) === "planned");
    }
    if (filter === "active") {
      return visible.filter((job) =>
        ["applied", "interviewing", "offer"].includes(effectiveStage(job)),
      );
    }
    return visible;
  }, [filter, jobs]);

  const tabCounts = useMemo(() => {
    const visible = jobs.filter((j) => j.decision !== "pass");
    return {
      all: visible.length,
      interested: visible.filter((j) => effectiveStage(j) === "interested").length,
      planned: visible.filter((j) => effectiveStage(j) === "planned").length,
      active: visible.filter((j) =>
        ["applied", "interviewing", "offer"].includes(effectiveStage(j)),
      ).length,
      pass: jobs.filter((j) => j.decision === "pass").length,
    };
  }, [jobs]);
  const fullViewJob = jobs.find((job) => job.id === fullViewJobId) ?? null;

  async function updateApplicationStatus(
    jobId: string,
    applicationStatus: JobApplicationStatus,
    onRevert: () => void,
  ) {
    setUpdatingId(jobId);
    try {
      const response = await fetch(`/api/job-postings/${jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ applicationStatus }),
      });
      if (!response.ok) {
        onRevert();
        setError(USER_COPY.save.failed);
        setTimeout(() => setError(""), 4000);
        return;
      }
      setJobs((current) =>
        current.map((job) =>
          job.id === jobId ? { ...job, applicationStatus } : job,
        ),
      );
    } catch {
      onRevert();
      setError(USER_COPY.save.failed);
      setTimeout(() => setError(""), 4000);
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-emerald-700">
            분석한 공고를 바로 이어서
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            지원 현황
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            관심 공고와 지원 현황을 한눈에 정리해요.
          </p>
        </div>
        <Link
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700"
          href="/"
        >
          새 공고 분석
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "전체"],
            ["interested", "관심"],
            ["planned", "지원 예정"],
            ["active", "진행 중"],
            ["pass", "패스"],
          ] as const
        ).map(([value, label]) => {
          const count = tabCounts[value];
          return (
            <button
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                filter === value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              ].join(" ")}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {label}{jobs.length > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          저장한 공고를 불러오고 있어요...
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-4 text-center">
          <BriefcaseBusiness className="h-7 w-7 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            {filter === "all"
              ? "아직 저장한 공고가 없어요."
              : "여기에 해당하는 공고가 없어요."}
          </p>
          <Link
            className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white"
            href="/"
          >
            공고 URL 붙여넣기
          </Link>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white sm:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="w-[24%] px-3 py-2.5 font-medium">회사·공고</th>
                  <th className="w-[15%] px-3 py-2.5 font-medium">판단</th>
                  <th className="w-[27%] px-3 py-2.5 font-medium">핵심 이유</th>
                  <th className="w-[17%] px-3 py-2.5 font-medium">확인할 점</th>
                  <th className="w-[17%] px-3 py-2.5 font-medium">지원 상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map((job) => (
                  <JobTableRow
                    highlight={selectedJobId === job.id}
                    initialExpanded={selectedJobId === job.id}
                    job={job}
                    key={job.id}
                    onFilterChange={setFilter}
                    onOpenFull={() => setFullViewJobId(job.id)}
                    onStatusChange={(status, onRevert) =>
                      void updateApplicationStatus(job.id, status, onRevert)
                    }
                    updating={updatingId === job.id}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 sm:hidden">
            {filteredJobs.map((job) => (
              <JobMobileCard
                highlight={selectedJobId === job.id}
                initialExpanded={selectedJobId === job.id}
                job={job}
                key={job.id}
                onFilterChange={setFilter}
                onOpenFull={() => setFullViewJobId(job.id)}
                onStatusChange={(status, onRevert) =>
                  void updateApplicationStatus(job.id, status, onRevert)
                }
                updating={updatingId === job.id}
              />
            ))}
          </div>
        </>
      )}
      {fullViewJob ? (
        <SavedJobFullView
          job={fullViewJob}
          onClose={() => setFullViewJobId("")}
          onStatusChange={(status) =>
            void updateApplicationStatus(fullViewJob.id, status, () => undefined)
          }
          updating={updatingId === fullViewJob.id}
        />
      ) : null}
    </section>
  );
}

function JobTableRow({
  job,
  highlight,
  updating,
  onStatusChange,
  onOpenFull,
  onFilterChange,
  initialExpanded,
}: {
  job: TrackedJobPosting;
  highlight: boolean;
  updating: boolean;
  initialExpanded?: boolean;
  onStatusChange: (
    status: JobApplicationStatus,
    onRevert: () => void,
  ) => void;
  onOpenFull: () => void;
  onFilterChange?: (filter: JobFilter) => void;
}) {
  const [expanded, setExpanded] = useState(initialExpanded ?? false);
  const [localStatus, setLocalStatus] = useState<JobApplicationStatus>(
    job.applicationStatus ?? (job.decision as JobApplicationStatus),
  );
  const matched = job.requirements.find(
    (item) => item.match === "matched" || item.match === "partial",
  );
  const uncertain = job.requirements.find(
    (item) => item.match === "uncertain" || item.match === "missing",
  );
  return (
    <>
      <tr
        className={[
          "cursor-pointer",
          highlight ? "bg-emerald-50" : "hover:bg-slate-50",
        ].join(" ")}
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="px-3 py-3 align-top">
          <p className="truncate font-medium text-slate-900">{job.companyName}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{job.title}</p>
          <p className="mt-1 text-xs text-slate-400">
            {job.deadline ? `마감 ${job.deadline}` : "마감일을 확인해주세요"}
          </p>
        </td>
        <td className="px-3 py-3 align-top">
          <Badge tone={recommendationTone(job.recommendation)}>
            {RECOMMENDATION_LABELS[job.recommendation]}
          </Badge>
          <p className="mt-1 text-xs text-slate-500">
            {job.score}점 ·{" "}
            <button
              className="underline-offset-2 hover:text-slate-800 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onFilterChange?.(stageToFilter(effectiveStage(job)));
              }}
              type="button"
            >
              {STAGE_LABELS[effectiveStage(job)] ?? DECISION_LABELS[job.decision]}
            </button>
          </p>
        </td>
        <td className="px-3 py-3 align-top text-xs leading-5 text-slate-700">
          {matched?.profileEvidence || job.summary}
        </td>
        <td className="px-3 py-3 align-top text-xs leading-5 text-slate-600">
          {uncertain?.text || job.nextAction}
        </td>
        <td
          className="px-3 py-3 align-top"
          onClick={(e) => e.stopPropagation()}
        >
          {job.decision === "pass" ? (
            <span className="text-xs text-slate-500">패스 기록</span>
          ) : (
            <Select
              aria-label={`${job.companyName} 지원 상태`}
              disabled={updating}
              onChange={(event) => {
                const next = event.target.value as JobApplicationStatus;
                const prev = localStatus;
                setLocalStatus(next);
                onStatusChange(next, () => setLocalStatus(prev));
              }}
              value={localStatus}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
          <button
            aria-label={expanded ? "상세 접기" : "상세 보기"}
            className="mt-1.5 flex items-center gap-0.5 text-xs text-slate-400 hover:text-slate-700"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            type="button"
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {expanded ? "접기" : "상세"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-slate-100">
          <td className="bg-slate-50 px-4 py-4" colSpan={5}>
            <JobDetailPanel job={job} onOpenFull={onOpenFull} />
          </td>
        </tr>
      )}
    </>
  );
}

function JobMobileCard({
  job,
  highlight,
  updating,
  onStatusChange,
  onOpenFull,
  onFilterChange,
  initialExpanded,
}: {
  job: TrackedJobPosting;
  highlight: boolean;
  updating: boolean;
  initialExpanded?: boolean;
  onStatusChange: (
    status: JobApplicationStatus,
    onRevert: () => void,
  ) => void;
  onOpenFull: () => void;
  onFilterChange?: (filter: JobFilter) => void;
}) {
  const [expanded, setExpanded] = useState(initialExpanded ?? false);
  const [localStatus, setLocalStatus] = useState<JobApplicationStatus>(
    job.applicationStatus ?? (job.decision as JobApplicationStatus),
  );
  const matched = job.requirements.find(
    (item) => item.match === "matched" || item.match === "partial",
  );
  const uncertain = job.requirements.find(
    (item) => item.match === "uncertain" || item.match === "missing",
  );
  return (
    <article
      className={[
        "rounded-lg border bg-white",
        highlight
          ? "border-emerald-400 ring-2 ring-emerald-100"
          : "border-slate-200",
      ].join(" ")}
    >
      <button
        className="w-full p-4 text-left"
        onClick={() => setExpanded((e) => !e)}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {job.companyName}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">{job.title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge tone={recommendationTone(job.recommendation)}>
              {RECOMMENDATION_LABELS[job.recommendation]}
            </Badge>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </div>
        <dl className="mt-3 space-y-2 text-xs leading-5">
          <div>
            <dt className="font-medium text-slate-500">핵심 매칭 이유</dt>
            <dd className="text-slate-700">
              {matched?.profileEvidence || job.summary}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">주요 확인 항목</dt>
            <dd className="text-slate-700">
              {uncertain?.text || job.nextAction}
            </dd>
          </div>
        </dl>
      </button>
      <div
        className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 pb-4 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-slate-500">
          {job.score}점 ·{" "}
          <button
            className="underline-offset-2 hover:text-slate-800 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onFilterChange?.(stageToFilter(effectiveStage(job)));
            }}
            type="button"
          >
            {STAGE_LABELS[effectiveStage(job)] ?? DECISION_LABELS[job.decision]}
          </button>
          {job.deadline ? ` · ${job.deadline} 마감` : ""}
        </span>
        {job.decision === "pass" ? (
          <span className="text-xs text-slate-400">패스 기록</span>
        ) : (
          <Select
            aria-label={`${job.companyName} 지원 상태`}
            className="w-28"
            disabled={updating}
            onChange={(event) => {
              const next = event.target.value as JobApplicationStatus;
              const prev = localStatus;
              setLocalStatus(next);
              onStatusChange(next, () => setLocalStatus(prev));
            }}
            value={localStatus}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </div>
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
          <JobDetailPanel job={job} onOpenFull={onOpenFull} />
        </div>
      )}
    </article>
  );
}

function JobDetailPanel({
  job,
  onOpenFull,
}: {
  job: TrackedJobPosting;
  onOpenFull: () => void;
}) {
  const matched = job.requirements.filter(
    (r) => r.match === "matched" || r.match === "partial",
  );
  const missing = job.requirements.filter((r) => r.match === "missing");
  const uncertain = job.requirements.filter((r) => r.match === "uncertain");

  return (
    <div className="space-y-4">
      <button
        className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-700"
        onClick={(event) => {
          event.stopPropagation();
          onOpenFull();
        }}
        type="button"
      >
        전체 분석 보기
      </button>
      {job.canonicalUrl ? (
        <a
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 underline underline-offset-2"
          href={job.canonicalUrl}
          onClick={(e) => e.stopPropagation()}
          rel="noopener noreferrer"
          target="_blank"
        >
          공고 원문 보기
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
      {job.nextAction ? (
        <div className="rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-medium leading-5 text-white">
          {job.nextAction}
        </div>
      ) : null}
      {matched.length > 0 && (
        <RequirementMiniList items={matched} title="잘 맞는 경험" />
      )}
      {missing.length > 0 && (
        <RequirementMiniList items={missing} title="아쉬운 조건" />
      )}
      {uncertain.length > 0 && (
        <RequirementMiniList items={uncertain} title="확인할 것" />
      )}
    </div>
  );
}

function RequirementMiniList({
  title,
  items,
}: {
  title: string;
  items: TrackedJobPosting["requirements"];
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-500">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li className="flex items-start gap-2 text-xs leading-5" key={item.id}>
            <span
              className={[
                "mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                MATCH_CLASS[item.match] ?? "bg-slate-100 text-slate-700",
              ].join(" ")}
            >
              {MATCH_LABELS[item.match] ?? item.match}
            </span>
            <span className="text-slate-700">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function recommendationTone(
  recommendation: TrackedJobPosting["recommendation"],
): "green" | "amber" | "red" {
  if (recommendation === "apply") return "green";
  if (recommendation === "verify") return "amber";
  return "red";
}
