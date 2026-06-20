"use client";

import { ArrowUpRight, BriefcaseBusiness, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import type {
  JobApplicationStatus,
  JobDecision,
  TrackedJobPosting,
} from "@/lib/job-tracker";

type JobFilter = "all" | "interested" | "planned" | "active" | "pass";

const DECISION_LABELS: Record<JobDecision, string> = {
  interested: "관심",
  planned: "지원 예정",
  pass: "패스",
};

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
  apply: "지원 추천",
  verify: "확인 후 결정",
  pass: "패스 고려",
} as const;

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
          throw new Error(data.error?.message || "공고 목록을 불러오지 못했습니다.");
        }
        if (active) setJobs(data.jobs ?? []);
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "공고 목록을 불러오지 못했습니다.",
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
  }, [accessToken]);

  const filteredJobs = useMemo(() => {
    if (filter === "pass") return jobs.filter((job) => job.decision === "pass");
    const visible = jobs.filter((job) => job.decision !== "pass");
    if (filter === "interested") {
      return visible.filter((job) => job.decision === "interested");
    }
    if (filter === "planned") {
      return visible.filter((job) => job.decision === "planned");
    }
    if (filter === "active") {
      return visible.filter((job) =>
        ["applied", "interviewing", "offer"].includes(
          job.applicationStatus ?? "",
        ),
      );
    }
    return visible;
  }, [filter, jobs]);

  async function updateApplicationStatus(
    jobId: string,
    applicationStatus: JobApplicationStatus,
  ) {
    setUpdatingId(jobId);
    const response = await fetch(`/api/job-postings/${jobId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ applicationStatus }),
    });
    setUpdatingId("");
    if (!response.ok) {
      setError("지원 상태를 변경하지 못했습니다.");
      return;
    }
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId ? { ...job, applicationStatus } : job,
      ),
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-emerald-700">
            공고와 지원을 한 흐름으로
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            공고·지원 목록
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            분석한 공고의 판단 근거와 지원 상태를 이어서 관리합니다.
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
        ).map(([value, label]) => (
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
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          저장한 공고를 불러오는 중...
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-4 text-center">
          <BriefcaseBusiness className="h-7 w-7 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            {filter === "all"
              ? "아직 저장한 공고가 없습니다."
              : "이 상태의 공고가 없습니다."}
          </p>
          <Link className="mt-2 text-sm text-emerald-700 underline" href="/">
            공고 핏 분석부터 시작하기
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
                    job={job}
                    key={job.id}
                    onStatusChange={(status) =>
                      void updateApplicationStatus(job.id, status)
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
                job={job}
                key={job.id}
                onStatusChange={(status) =>
                  void updateApplicationStatus(job.id, status)
                }
                updating={updatingId === job.id}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function JobTableRow({
  job,
  highlight,
  updating,
  onStatusChange,
}: {
  job: TrackedJobPosting;
  highlight: boolean;
  updating: boolean;
  onStatusChange: (status: JobApplicationStatus) => void;
}) {
  const matched = job.requirements.find(
    (item) => item.match === "matched" || item.match === "partial",
  );
  const uncertain = job.requirements.find(
    (item) => item.match === "uncertain" || item.match === "missing",
  );
  return (
    <tr className={highlight ? "bg-emerald-50" : "hover:bg-slate-50"}>
      <td className="px-3 py-3 align-top">
        <p className="truncate font-medium text-slate-900">{job.companyName}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{job.title}</p>
        <p className="mt-1 text-[11px] text-slate-400">
          {job.deadline ? `마감 ${job.deadline}` : "마감일 미확인"}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <Badge tone={recommendationTone(job.recommendation)}>
          {RECOMMENDATION_LABELS[job.recommendation]}
        </Badge>
        <p className="mt-1 text-xs text-slate-500">
          {job.score}점 · {DECISION_LABELS[job.decision]}
        </p>
      </td>
      <td className="px-3 py-3 align-top text-xs leading-5 text-slate-700">
        {matched?.profileEvidence || job.summary}
      </td>
      <td className="px-3 py-3 align-top text-xs leading-5 text-slate-600">
        {uncertain?.text || job.nextAction}
      </td>
      <td className="px-3 py-3 align-top">
        {job.decision === "pass" ? (
          <span className="text-xs text-slate-500">패스 기록</span>
        ) : (
          <Select
            aria-label={`${job.companyName} 지원 상태`}
            disabled={updating}
            onChange={(event) =>
              onStatusChange(event.target.value as JobApplicationStatus)
            }
            value={job.applicationStatus ?? job.decision}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </td>
    </tr>
  );
}

function JobMobileCard({
  job,
  highlight,
  updating,
  onStatusChange,
}: {
  job: TrackedJobPosting;
  highlight: boolean;
  updating: boolean;
  onStatusChange: (status: JobApplicationStatus) => void;
}) {
  const matched = job.requirements.find(
    (item) => item.match === "matched" || item.match === "partial",
  );
  const uncertain = job.requirements.find(
    (item) => item.match === "uncertain" || item.match === "missing",
  );
  return (
    <article
      className={[
        "rounded-lg border bg-white p-4",
        highlight ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {job.companyName}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{job.title}</p>
        </div>
        <Badge tone={recommendationTone(job.recommendation)}>
          {RECOMMENDATION_LABELS[job.recommendation]}
        </Badge>
      </div>
      <dl className="mt-3 space-y-2 text-xs leading-5">
        <div>
          <dt className="font-medium text-slate-500">핵심 매칭 이유</dt>
          <dd className="text-slate-700">{matched?.profileEvidence || job.summary}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">주요 확인 항목</dt>
          <dd className="text-slate-700">{uncertain?.text || job.nextAction}</dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500">
          {job.score}점 · {DECISION_LABELS[job.decision]}
          {job.deadline ? ` · ${job.deadline} 마감` : ""}
        </span>
        {job.decision === "pass" ? (
          <span className="text-xs text-slate-400">패스 기록</span>
        ) : (
          <Select
            aria-label={`${job.companyName} 지원 상태`}
            className="w-28"
            disabled={updating}
            onChange={(event) =>
              onStatusChange(event.target.value as JobApplicationStatus)
            }
            value={job.applicationStatus ?? job.decision}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </div>
    </article>
  );
}

function recommendationTone(
  recommendation: TrackedJobPosting["recommendation"],
): "green" | "amber" | "red" {
  if (recommendation === "apply") return "green";
  if (recommendation === "verify") return "amber";
  return "red";
}
