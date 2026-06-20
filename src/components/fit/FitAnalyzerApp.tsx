"use client";

import {
  ArrowRight,
  Bookmark,
  CalendarPlus,
  Loader2,
  LogIn,
  Radar,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Script from "next/script";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import {
  chooseNewestCandidateProfile,
  parsePendingFitSave,
  parseStoredCandidateProfile,
  serializePendingFitSave,
  serializeCandidateProfile,
  trackFitEvent,
} from "@/lib/fit-client";
import type { PendingFitSave } from "@/lib/fit-client";
import type {
  CandidateProfile,
  FitAnalysis,
  FitRecommendation,
  FitRequirement,
  RequirementMatch,
} from "@/lib/fit-analysis";
import { cn } from "@/lib/utils";
import type {
  JobDecision,
  SaveFitResultResponse,
} from "@/lib/job-tracker";
import { scoreBand } from "@/lib/job-tracker";
import { getSupabaseClient } from "@/lib/supabase-client";

const PROFILE_KEY = "companyradar:candidate-profile:v1";
const CLIENT_KEY = "companyradar:client-id";
const CONSENT_KEY = "companyradar:analytics-consent";
const PENDING_SAVE_KEY = "companyradar:pending-fit-save:v1";

type JobInputMode = "url" | "text";
type Decision = "apply" | "verify" | "pass";

interface AnalyzeResponse {
  ok: boolean;
  result?: FitAnalysis;
  error?: string;
  errorCode?: string;
}

const RECOMMENDATION_COPY: Record<
  FitRecommendation,
  { label: string; description: string; tone: string }
> = {
  apply: {
    label: "지원 추천",
    description: "핵심 필수요건과 경력 근거가 대체로 연결됩니다.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  verify: {
    label: "확인 후 결정",
    description: "지원 전에 확인해야 할 필수요건이나 근거가 있습니다.",
    tone: "border-amber-200 bg-amber-50 text-amber-950",
  },
  pass: {
    label: "패스 고려",
    description: "현재 경력과 핵심 필수요건 사이에 큰 간극이 있습니다.",
    tone: "border-rose-200 bg-rose-50 text-rose-950",
  },
};

const MATCH_COPY: Record<
  RequirementMatch,
  { label: string; className: string }
> = {
  matched: {
    label: "매칭",
    className: "bg-emerald-100 text-emerald-800",
  },
  partial: {
    label: "부분 매칭",
    className: "bg-sky-100 text-sky-800",
  },
  missing: {
    label: "부족",
    className: "bg-rose-100 text-rose-800",
  },
  uncertain: {
    label: "확인 필요",
    className: "bg-amber-100 text-amber-900",
  },
};

export function FitAnalyzerApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jobMode, setJobMode] = useState<JobInputMode>("url");
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [confidenceBefore, setConfidenceBefore] = useState(3);
  const [confidenceAfter, setConfidenceAfter] = useState(3);
  const [decision, setDecision] = useState<Decision | "">("");
  const [analysis, setAnalysis] = useState<FitAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState<JobDecision | null>(null);
  const [saveError, setSaveError] = useState("");
  const [savedJobId, setSavedJobId] = useState("");
  const [analyticsConsent, setAnalyticsConsent] = useState<
    "accepted" | "declined" | null
  >(null);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      setProfile(
        parseStoredCandidateProfile(localStorage.getItem(PROFILE_KEY)),
      );
      const consent = localStorage.getItem(CONSENT_KEY);
      if (consent === "accepted" || consent === "declined") {
        setAnalyticsConsent(consent);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      queueMicrotask(() => setAuthReady(true));
      return;
    }
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (nextSession) setAuthOpen(false);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    const token = accessToken;
    let active = true;
    async function syncProfile() {
      try {
        const response = await fetch("/api/candidate-profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as {
          profile?: CandidateProfile | null;
        };
        const localProfile = parseStoredCandidateProfile(
          localStorage.getItem(PROFILE_KEY),
        );
        const selected = chooseNewestCandidateProfile(
          localProfile,
          response.ok ? (data.profile ?? null) : null,
        );
        if (!active || !selected) return;
        setProfile(selected);
        localStorage.setItem(
          PROFILE_KEY,
          serializeCandidateProfile(selected),
        );
        if (
          !data.profile ||
          Date.parse(selected.updatedAt) > Date.parse(data.profile.updatedAt)
        ) {
          await saveCandidateProfile(selected, token);
        }
      } catch {
        // Local structured profile remains available when remote sync fails.
      }
    }
    void syncProfile();
    return () => {
      active = false;
    };
  }, [session?.access_token]);

  const canSubmit =
    Boolean(profile || resumeText.trim().length >= 50) &&
    Boolean(
      jobMode === "url"
        ? jobUrl.trim().length > 0
        : jobText.trim().length >= 50,
    );

  async function analyze() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");
    setAnalysis(null);
    setDecision("");
    const startedAt = performance.now();
    trackFitEvent("fit_analysis_submitted", {
      job_input_mode: jobMode,
      has_saved_profile: Boolean(profile),
      confidence_before: confidenceBefore,
    });

    try {
      const response = await fetch("/api/analyze-fit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-companyradar-client": getClientId(),
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          jobUrl: jobMode === "url" ? jobUrl.trim() : "",
          jobText: jobMode === "text" ? jobText.trim() : "",
          resumeText: profile ? "" : resumeText.trim(),
          candidateProfile: profile,
          confidenceBefore,
        }),
      });
      const data = (await response.json()) as AnalyzeResponse;
      if (!data.ok || !data.result) {
        if (data.errorCode === "fetch_failed") setJobMode("text");
        throw new Error(data.error || "분석 요청에 실패했습니다.");
      }

      setAnalysis(data.result);
      setProfile(data.result.candidateProfile);
      localStorage.setItem(
        PROFILE_KEY,
        serializeCandidateProfile(data.result.candidateProfile),
      );
      setResumeText("");
      if (session?.access_token) {
        void saveCandidateProfile(
          data.result.candidateProfile,
          session.access_token,
        );
      }
      trackFitEvent("fit_analysis_completed", {
        recommendation: data.result.recommendation,
        score_band: scoreBand(data.result.score),
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "분석 요청에 실패했습니다.";
      setError(message);
      trackFitEvent("fit_analysis_failed", {
        error_code: dataSafeErrorCode(message),
      });
    } finally {
      setLoading(false);
    }
  }

  function analyzeAnother() {
    setAnalysis(null);
    setJobUrl("");
    setJobText("");
    setDecision("");
    setConfidenceBefore(3);
    setConfidenceAfter(3);
    setError("");
    trackFitEvent("second_job_analysis_started");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearProfile() {
    localStorage.removeItem(PROFILE_KEY);
    setProfile(null);
    setResumeText("");
  }

  function updateConsent(value: "accepted" | "declined") {
    localStorage.setItem(CONSENT_KEY, value);
    setAnalyticsConsent(value);
  }

  async function saveDecision(nextDecision: JobDecision) {
    if (!analysis || saveLoading) return;
    setSaveError("");
    setSavedJobId("");
    setDecision(decisionToLegacy(nextDecision));
    trackFitEvent("fit_save_clicked", { decision: nextDecision });

    const pending: PendingFitSave = {
      analysis,
      decision: nextDecision,
      sourceUrl: jobMode === "url" ? jobUrl.trim() : "",
      createdAt: new Date().toISOString(),
    };

    if (!session?.access_token) {
      localStorage.setItem(
        PENDING_SAVE_KEY,
        serializePendingFitSave(pending),
      );
      trackFitEvent("fit_auth_required", { decision: nextDecision });
      setAuthOpen(true);
      return;
    }
    await persistFitResult(pending, session.access_token);
  }

  async function persistFitResult(
    pending: PendingFitSave,
    accessToken: string,
  ) {
    setSaveLoading(pending.decision);
    setSaveError("");
    try {
      const response = await fetch("/api/fit-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          analysis: pending.analysis,
          jobPosting: pending.analysis.jobPosting,
          sourceUrl: pending.sourceUrl,
          decision: pending.decision,
        }),
      });
      const data = (await response.json()) as
        | ({ ok: true } & SaveFitResultResponse)
        | { error?: { message?: string } };
      if (!response.ok || !("ok" in data)) {
        throw new Error(
          "error" in data
            ? data.error?.message
            : "분석 결과를 저장하지 못했습니다.",
        );
      }
      localStorage.removeItem(PENDING_SAVE_KEY);
      setSavedJobId(data.jobPostingId);
      setDecision(decisionToLegacy(data.decision));
      trackFitEvent("fit_result_saved", {
        decision: data.decision,
        duplicate: data.duplicate,
        recommendation: pending.analysis.recommendation,
      });
      trackFitEvent("fit_decision_recorded", {
        decision: data.decision,
        confidence_before: confidenceBefore,
        confidence_after: confidenceAfter,
        recommendation: pending.analysis.recommendation,
      });
      if (data.applicationStatus === "planned") {
        trackFitEvent("application_started", { source: "fit_result" });
      }
    } catch (caught) {
      setSaveError(
        caught instanceof Error
          ? caught.message
          : "분석 결과를 저장하지 못했습니다.",
      );
    } finally {
      setSaveLoading(null);
    }
  }

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    const pending = parsePendingFitSave(
      localStorage.getItem(PENDING_SAVE_KEY),
    );
    if (!pending) {
      localStorage.removeItem(PENDING_SAVE_KEY);
      return;
    }
    queueMicrotask(() => {
      setAnalysis(pending.analysis);
      setDecision(decisionToLegacy(pending.decision));
      void persistFitResult(pending, accessToken);
    });
  // Pending save is intentionally consumed only when authentication changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  return (
    <>
      {analyticsConsent === "accepted" ? <GoogleAnalytics /> : null}
      <main className="min-h-screen bg-[#f5f3ee] text-slate-950">
        <header className="border-b border-slate-900/10 bg-[#f5f3ee]/95">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <Link className="flex items-center gap-2 font-semibold" href="/">
              <Radar className="h-5 w-5" />
              CompanyRadar
            </Link>
            <Link
              className="text-sm text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline"
              href="/tracker"
            >
              지원 관리
            </Link>
            {authReady ? (
              session ? (
                <span className="hidden max-w-48 truncate text-xs text-slate-500 sm:inline">
                  {session.user.email}
                </span>
              ) : (
                <button
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-950"
                  onClick={() => setAuthOpen(true)}
                  type="button"
                >
                  <LogIn className="h-4 w-4" />
                  로그인
                </button>
              )
            ) : null}
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
          <section className="max-w-3xl">
            <p className="text-sm font-semibold text-emerald-700">
              공고 핏 의사결정 도구
            </p>
            <h1
              aria-label="이 공고, 지원할지 5분 안에 결정하세요"
              className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-6xl"
            >
              이 공고, 지원할지
              <br />
              5분 안에 결정하세요
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              공고와 내 경력을 근거 문장으로 비교해 지원 추천, 확인할 점,
              다음 행동을 정리합니다. 점수만 보여주지 않습니다.
            </p>
          </section>

          {!analysis ? (
            <section className="mt-10 grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-900/10 bg-white p-5 shadow-sm sm:p-7">
                <StepHeader
                  description="처음 한 번만 입력하면 다음 공고부터 다시 사용할 수 있습니다."
                  number="1"
                  title="내 경력"
                />
                {profile ? (
                  <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-emerald-950">
                          저장된 프로필 사용 중
                        </p>
                        <p className="mt-1 text-sm text-emerald-800">
                          {profile.targetRole || "목표 직무 미확인"}
                          {profile.yearsExperience !== null
                            ? ` · 경력 ${profile.yearsExperience}년`
                            : ""}
                        </p>
                      </div>
                      <button
                        className="shrink-0 text-xs font-medium text-emerald-800 underline"
                        onClick={clearProfile}
                        type="button"
                      >
                        다시 입력
                      </button>
                    </div>
                    {profile.skills.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {profile.skills.slice(0, 8).map((skill) => (
                          <span
                            className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-700"
                            key={skill}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-6">
                    <Label htmlFor="resume-text">이력서 텍스트</Label>
                    <Textarea
                      className="mt-2 min-h-56"
                      id="resume-text"
                      onChange={(event) => setResumeText(event.target.value)}
                      onFocus={() => trackFitEvent("fit_input_started")}
                      placeholder="이력서의 경력, 프로젝트, 역량 내용을 붙여넣으세요."
                      value={resumeText}
                    />
                    <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-slate-500">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      이력서 원문은 저장하지 않습니다. 분석 후 직무·연차·역량만
                      이 기기에 저장합니다.
                    </p>
                  </div>
                )}
              </article>

              <article className="rounded-2xl border border-slate-900/10 bg-white p-5 shadow-sm sm:p-7">
                <StepHeader
                  description="URL 수집이 막히면 공고 원문 입력으로 자동 전환합니다."
                  number="2"
                  title="채용공고"
                />
                <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                  <ModeButton
                    active={jobMode === "url"}
                    label="공고 URL"
                    onClick={() => setJobMode("url")}
                  />
                  <ModeButton
                    active={jobMode === "text"}
                    label="원문 붙여넣기"
                    onClick={() => setJobMode("text")}
                  />
                </div>
                <div className="mt-4">
                  {jobMode === "url" ? (
                    <>
                      <Label htmlFor="job-url">공고 URL</Label>
                      <Input
                        className="mt-2"
                        id="job-url"
                        onChange={(event) => setJobUrl(event.target.value)}
                        onFocus={() => trackFitEvent("fit_input_started")}
                        placeholder="https://..."
                        type="url"
                        value={jobUrl}
                      />
                    </>
                  ) : (
                    <>
                      <Label htmlFor="job-text">공고 원문</Label>
                      <Textarea
                        className="mt-2 min-h-40"
                        id="job-text"
                        onChange={(event) => setJobText(event.target.value)}
                        onFocus={() => trackFitEvent("fit_input_started")}
                        placeholder="주요업무, 자격요건, 우대사항을 붙여넣으세요."
                        value={jobText}
                      />
                    </>
                  )}
                </div>

                <fieldset className="mt-6">
                  <legend className="text-sm font-semibold">
                    지금 지원 여부에 얼마나 확신하나요?
                  </legend>
                  <ConfidencePicker
                    onChange={setConfidenceBefore}
                    value={confidenceBefore}
                  />
                </fieldset>

                {error ? (
                  <p
                    aria-live="polite"
                    className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
                  >
                    {error}
                  </p>
                ) : null}
                <Button
                  className="mt-6 h-12 text-base"
                  disabled={!canSubmit || loading}
                  onClick={() => void analyze()}
                  width="fill"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      근거를 비교하고 있습니다
                    </>
                  ) : (
                    <>
                      핏 분석하기
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="mt-3 text-center text-xs leading-5 text-slate-400">
                  입력 내용은 분석을 위해 AI 제공자에게 전송됩니다.
                </p>
              </article>
            </section>
          ) : (
            <FitResultView
              analysis={analysis}
              confidenceAfter={confidenceAfter}
              decision={decision}
              onAnalyzeAnother={analyzeAnother}
              onConfidenceAfterChange={setConfidenceAfter}
              onSaveDecision={(value) => void saveDecision(value)}
              saveError={saveError}
              saveLoading={saveLoading}
              savedJobId={savedJobId}
            />
          )}
        </div>

        {analyticsConsent === null ? (
          <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <p className="text-sm font-medium">사용성 개선 데이터 수집</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              원문이나 개인 정보 없이 분석 완료·결정 기록 같은 행동 이벤트만
              GA4로 수집합니다.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                onClick={() => updateConsent("declined")}
                size="sm"
                variant="ghost"
              >
                거절
              </Button>
              <Button onClick={() => updateConsent("accepted")} size="sm">
                동의
              </Button>
            </div>
          </div>
        ) : null}
        {authOpen ? (
          <FitAuthModal
            onClose={() => setAuthOpen(false)}
            onSuccess={() => setAuthOpen(false)}
          />
        ) : null}
      </main>
    </>
  );
}

function FitResultView({
  analysis,
  confidenceAfter,
  decision,
  onAnalyzeAnother,
  onConfidenceAfterChange,
  onSaveDecision,
  saveError,
  saveLoading,
  savedJobId,
}: {
  analysis: FitAnalysis;
  confidenceAfter: number;
  decision: Decision | "";
  onAnalyzeAnother: () => void;
  onConfidenceAfterChange: (value: number) => void;
  onSaveDecision: (decision: JobDecision) => void;
  saveError: string;
  saveLoading: JobDecision | null;
  savedJobId: string;
}) {
  const copy = RECOMMENDATION_COPY[analysis.recommendation];
  const groups = useMemo(
    () => ({
      matched: analysis.requirements.filter(
        (item) => item.match === "matched" || item.match === "partial",
      ),
      missing: analysis.requirements.filter(
        (item) => item.match === "missing",
      ),
      uncertain: analysis.requirements.filter(
        (item) => item.match === "uncertain",
      ),
    }),
    [analysis.requirements],
  );

  return (
    <section className="mt-10">
      <div className={cn("rounded-2xl border p-6 sm:p-8", copy.tone)}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold">
              {analysis.companyName || "회사 미확인"}
              {analysis.roleTitle ? ` · ${analysis.roleTitle}` : ""}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {copy.label}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 opacity-80">
              {analysis.summary || copy.description}
            </p>
          </div>
          <div className="shrink-0">
            <p className="text-xs font-semibold uppercase opacity-60">
              보조 핏 점수
            </p>
            <p className="mt-1 text-5xl font-semibold tracking-tight">
              {analysis.score}
              <span className="text-lg opacity-50">/100</span>
            </p>
            <p className="mt-1 text-xs opacity-60">
              근거 충족률 {analysis.evidenceCoverage}%
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <RequirementGroup
            emptyMessage="명확히 연결된 요구사항이 없습니다."
            items={groups.matched}
            title="연결되는 경험"
          />
          <RequirementGroup
            emptyMessage="명확한 부족 요건이 없습니다."
            items={groups.missing}
            title="부족한 요건"
          />
          <RequirementGroup
            emptyMessage="추가로 확인할 요건이 없습니다."
            items={groups.uncertain}
            title="확인 필요한 요건"
          />
        </div>

        <aside className="h-fit space-y-5 lg:sticky lg:top-5">
          <div className="rounded-2xl border border-slate-900/10 bg-slate-950 p-5 text-white">
            <p className="text-xs font-semibold uppercase text-slate-400">
              가장 중요한 다음 행동
            </p>
            <p className="mt-3 text-lg font-medium leading-7">
              {analysis.nextAction}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-900/10 bg-white p-5">
            <p className="font-semibold">이 공고를 어떻게 관리할까요?</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              저장하면 지원 관리 목록에서 다음 행동을 이어갈 수 있습니다.
            </p>
            <div className="mt-4 grid gap-2">
              <DecisionButton
                active={decision === "apply"}
                disabled={saveLoading !== null}
                icon={
                  saveLoading === "interested" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )
                }
                label="관심 공고로 저장"
                onClick={() => onSaveDecision("interested")}
              />
              <DecisionButton
                active={decision === "verify"}
                disabled={saveLoading !== null}
                icon={
                  saveLoading === "planned" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarPlus className="h-4 w-4" />
                  )
                }
                label="지원 예정으로 저장"
                onClick={() => onSaveDecision("planned")}
              />
              <DecisionButton
                active={decision === "pass"}
                disabled={saveLoading !== null}
                icon={
                  saveLoading === "pass" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )
                }
                label="패스"
                onClick={() => onSaveDecision("pass")}
              />
            </div>
            <fieldset className="mt-5">
              <legend className="text-sm font-semibold">
                지금은 얼마나 확신하나요?
              </legend>
              <ConfidencePicker
                onChange={onConfidenceAfterChange}
                value={confidenceAfter}
              />
            </fieldset>
            {saveError ? (
              <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                {saveError}
              </p>
            ) : null}
            {savedJobId ? (
              <div className="mt-4 rounded-lg bg-emerald-50 p-3">
                <p className="text-sm font-medium text-emerald-900">
                  지원 관리에 저장했습니다.
                </p>
                <Link
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 underline underline-offset-4"
                  href={`/tracker?job=${encodeURIComponent(savedJobId)}`}
                >
                  지원 관리에서 보기
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </div>

          <Button onClick={onAnalyzeAnother} variant="secondary" width="fill">
            <RotateCcw className="h-4 w-4" />
            다른 공고 분석
          </Button>
        </aside>
      </div>
    </section>
  );
}

function RequirementGroup({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: FitRequirement[];
  emptyMessage: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-900/10 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-sm text-slate-400">{items.length}개</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {items.map((item) => {
            const matchCopy = MATCH_COPY[item.match];
            return (
              <article className="py-4 first:pt-0 last:pb-0" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{item.text}</p>
                  <div className="flex gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {item.importance === "required" ? "필수" : "우대"}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-xs",
                        matchCopy.className,
                      )}
                    >
                      {matchCopy.label}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs leading-5 sm:grid-cols-2">
                  <Evidence
                    label="공고 근거"
                    text={item.jobEvidence || "직접 근거 없음"}
                  />
                  <Evidence
                    label="내 경력 근거"
                    text={item.profileEvidence || "직접 근거 없음"}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Evidence({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-slate-700">{text}</p>
    </div>
  );
}

function StepHeader({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
        {number}
      </span>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium",
        active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ConfidencePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          aria-label={`확신도 ${score}점`}
          aria-pressed={value === score}
          className={cn(
            "h-10 rounded-lg border text-sm font-semibold",
            value === score
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-400",
          )}
          key={score}
          onClick={() => onChange(score)}
          type="button"
        >
          {score}
        </button>
      ))}
    </div>
  );
}

function DecisionButton({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium",
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 text-slate-700 hover:border-slate-400",
      )}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="companyradar-ga" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${measurementId}',{send_page_view:true});`}
      </Script>
    </>
  );
}

function FitAuthModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("로그인 설정이 완료되지 않았습니다.");
      return;
    }
    const nextEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError("올바른 이메일을 입력해주세요.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("비밀번호는 8자 이상 입력해주세요.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: nextEmail,
        password,
      });
      setLoading(false);
      if (signInError) {
        setError("이메일 또는 비밀번호를 확인해주세요.");
        return;
      }
      onSuccess();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: nextEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
      },
    });
    setLoading(false);
    if (signUpError) {
      setError("회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (data.session) {
      onSuccess();
    } else {
      setMessage(
        "가입 확인 메일을 보냈습니다. 확인 후 돌아오면 현재 분석 결과가 자동 저장됩니다.",
      );
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
    >
      <section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              분석 결과 저장
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {mode === "login" ? "로그인해주세요" : "계정을 만들어주세요"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              로그인하면 현재 결과를 잃지 않고 지원 관리에 저장합니다.
            </p>
          </div>
          <button
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <form className="mt-5 space-y-3" onSubmit={submit}>
          <div>
            <Label htmlFor="fit-auth-email">이메일</Label>
            <Input
              autoComplete="email"
              className="mt-1.5"
              id="fit-auth-email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </div>
          <div>
            <Label htmlFor="fit-auth-password">비밀번호</Label>
            <Input
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              className="mt-1.5"
              id="fit-auth-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "signup" ? "8자 이상" : ""}
              type="password"
              value={password}
            />
          </div>
          {mode === "signup" ? (
            <div>
              <Label htmlFor="fit-auth-confirm">비밀번호 확인</Label>
              <Input
                autoComplete="new-password"
                className="mt-1.5"
                id="fit-auth-confirm"
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                value={confirmPassword}
              />
            </div>
          ) : null}
          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-800">
              {message}
            </p>
          ) : null}
          <Button disabled={loading} width="fill">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading
              ? "처리 중..."
              : mode === "login"
                ? "로그인하고 저장"
                : "가입하고 저장"}
          </Button>
        </form>
        <button
          className="mt-4 text-sm text-slate-500 hover:text-slate-900"
          onClick={() => {
            setMode((value) => (value === "login" ? "signup" : "login"));
            setError("");
            setMessage("");
          }}
          type="button"
        >
          {mode === "login"
            ? "계정이 없나요? 회원가입"
            : "이미 계정이 있나요? 로그인"}
        </button>
      </section>
    </div>
  );
}

async function saveCandidateProfile(
  profile: CandidateProfile,
  accessToken: string,
) {
  await fetch("/api/candidate-profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(profile),
  });
}

function decisionToLegacy(decision: JobDecision): Decision {
  if (decision === "interested") return "apply";
  if (decision === "planned") return "verify";
  return "pass";
}

function dataSafeErrorCode(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("사용량") || normalized.includes("분석 10회")) {
    return "quota_exceeded";
  }
  if (normalized.includes("공고")) return "job_input";
  if (normalized.includes("이력서") || normalized.includes("프로필")) {
    return "profile_input";
  }
  return "analysis_failed";
}

function getClientId(): string {
  const existing = localStorage.getItem(CLIENT_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(CLIENT_KEY, next);
  return next;
}
