"use client";

import {
  ArrowRight,
  Bookmark,
  CalendarPlus,
  Check,
  Loader2,
  LogIn,
  Pencil,
  Radar,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { ResumeProfileEditor } from "@/components/fit/ResumeProfileEditor";
import { CompanyOverviewCard } from "@/components/company/CompanyOverviewCard";
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
import { USER_COPY } from "@/lib/user-copy";

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
    label: "지원해볼 만해요",
    description: "필수 조건과 지금까지의 경험이 꽤 잘 맞아요.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  verify: {
    label: "몇 가지만 더 확인해봐요",
    description: "지원 전에 짚고 넘어갈 조건이 있어요.",
    tone: "border-amber-200 bg-amber-50 text-amber-950",
  },
  pass: {
    label: "지금은 우선순위가 낮아요",
    description: "핵심 조건과 현재 경험 사이에 차이가 있어요.",
    tone: "border-rose-200 bg-rose-50 text-rose-950",
  },
};

const MATCH_COPY: Record<
  RequirementMatch,
  { label: string; className: string }
> = {
  matched: {
    label: "잘 맞아요",
    className: "bg-emerald-100 text-emerald-800",
  },
  partial: {
    label: "어느 정도 맞아요",
    className: "bg-sky-100 text-sky-800",
  },
  missing: {
    label: "경험이 부족해요",
    className: "bg-rose-100 text-rose-800",
  },
  uncertain: {
    label: "확인이 필요해요",
    className: "bg-amber-100 text-amber-900",
  },
};

export function FitAnalyzerApp() {
  const router = useRouter();
  const resumeInteractionRef = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState<CandidateProfile | null>(
    null,
  );
  const [profileWarnings, setProfileWarnings] = useState<string[]>([]);
  const [showResumeInput, setShowResumeInput] = useState(true);
  const [resumeMode, setResumeMode] = useState<"file" | "text">("file");
  const [resumeParsing, setResumeParsing] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [editingExistingProfile, setEditingExistingProfile] = useState(false);
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
  const [analysisErrorCode, setAnalysisErrorCode] = useState("");
  const [urlHint, setUrlHint] = useState("");
  const [isFetchingJob, setIsFetchingJob] = useState(false);
  const [jobSourceDomain, setJobSourceDomain] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState<JobDecision | null>(null);
  const [saveError, setSaveError] = useState("");
  const [savedJobId, setSavedJobId] = useState("");
  const [savedJobCount, setSavedJobCount] = useState(0);
  const [analyticsConsent, setAnalyticsConsent] = useState<
    "accepted" | "declined" | null
  >(null);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      const storedProfile = parseStoredCandidateProfile(
        localStorage.getItem(PROFILE_KEY),
      );
      setProfile(storedProfile);
      if (storedProfile) setShowResumeInput(false);
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
        if (!resumeInteractionRef.current) setShowResumeInput(false);
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

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    let active = true;
    void fetch("/api/job-postings", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (response) => {
        const data = (await response.json()) as { jobs?: unknown[] };
        if (active && response.ok) setSavedJobCount(data.jobs?.length ?? 0);
      })
      .catch(() => {
        // The analysis flow remains usable when the count cannot be loaded.
      });
    return () => {
      active = false;
    };
  }, [session?.access_token]);

  useEffect(() => {
    if (!savedJobId) return;
    const timer = window.setTimeout(() => {
      router.push(`/tracker?job=${encodeURIComponent(savedJobId)}`);
    }, 3_000);
    return () => window.clearTimeout(timer);
  }, [savedJobId, router]);

  const canSubmit =
    Boolean(
      (!showResumeInput && profile) ||
        (showResumeInput &&
          resumeMode === "text" &&
          resumeText.trim().length >= 50),
    ) &&
    !profileDraft &&
    !resumeParsing &&
    !isFetchingJob &&
    Boolean(
      jobMode === "url"
        ? jobText.trim().length > 0
        : jobText.trim().length >= 50,
    );

  async function analyze() {
    if (!canSubmit || loading) return;

    const activeProfile = showResumeInput ? null : profile;
    const normalizedJobText = jobText.trim();
    const normalizedResumeText = activeProfile ? "" : resumeText.trim();

    // Pre-validation: guard against empty texts before calling the AI
    if (!normalizedJobText) {
      setError("채용공고 내용이 없어요. 공고 URL을 입력하고 잠시 기다리거나 내용을 붙여넣어 주세요.");
      return;
    }
    if (!activeProfile && normalizedResumeText.length < 50) {
      setError("이력서 내용이 준비되지 않았어요. 이력서를 업로드하거나 텍스트를 붙여넣어 주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setAnalysisErrorCode("");
    setUrlHint("");
    setAnalysis(null);
    setDecision("");
    const startedAt = performance.now();

    console.log("[fit-analyzer]", {
      stage: "analyze-fit-request",
      jobMode,
      jobTextLength: normalizedJobText.length,
      resumeTextLength: normalizedResumeText.length,
      hasCandidateProfile: Boolean(activeProfile),
    });

    trackFitEvent("fit_analysis_submitted", {
      job_input_mode: jobMode,
      has_saved_profile: Boolean(activeProfile),
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
          jobText: normalizedJobText,
          resumeText: normalizedResumeText,
          candidateProfile: activeProfile,
          confidenceBefore,
        }),
      });
      const data = (await response.json()) as AnalyzeResponse;
      if (!data.ok || !data.result) {
        setAnalysisErrorCode(data.errorCode ?? "unknown");
        throw new Error(data.error || "분석 요청에 실패했습니다.");
      }

      setAnalysis(data.result);
      setProfile(data.result.candidateProfile);
      setShowResumeInput(false);
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
    setAnalysisErrorCode("");
    setUrlHint("");
    setJobSourceDomain("");
    trackFitEvent("second_job_analysis_started");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editProfile() {
    if (!profile) return;
    resumeInteractionRef.current = true;
    setProfileDraft({ ...profile });
    setProfileWarnings([]);
    setEditingExistingProfile(true);
    setShowResumeInput(true);
    setResumeError("");
  }

  function replaceProfile() {
    resumeInteractionRef.current = true;
    setProfileDraft(null);
    setProfileWarnings([]);
    setEditingExistingProfile(false);
    setShowResumeInput(true);
    setResumeMode("file");
    setResumeText("");
    setResumeError("");
  }

  function cancelProfileChange() {
    resumeInteractionRef.current = false;
    setProfileDraft(null);
    setProfileWarnings([]);
    setEditingExistingProfile(false);
    setResumeError("");
    if (profile) setShowResumeInput(false);
  }

  async function fetchJobFromUrl(url: string) {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || isFetchingJob) return;
    setIsFetchingJob(true);
    const prevJobText = jobText;
    setJobText("");
    setUrlHint("");
    trackFitEvent("fit_input_started");
    try {
      setJobSourceDomain(new URL(trimmedUrl).hostname);
    } catch {
      setJobSourceDomain("");
    }
    try {
      const response = await fetch("/api/fetch-job-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        text?: string;
        error?: string;
        errorCode?: string;
      };
      if (!data.ok || typeof data.text !== "string" || !data.text.trim()) {
        setJobMode("text");
        setJobText(prevJobText);
        setUrlHint(
          data.error ??
            "URL에서 공고를 가져오지 못했어요. 공고 내용을 아래에 붙여넣어 주세요.",
        );
        return;
      }
      setJobText(data.text);
      console.log("[fit-analyzer]", {
        stage: "job-text-fetched",
        textLength: data.text.length,
      });
    } catch {
      setJobMode("text");
      setJobText(prevJobText);
      setUrlHint("URL에서 공고를 가져오지 못했어요. 공고 내용을 아래에 붙여넣어 주세요.");
    } finally {
      setIsFetchingJob(false);
    }
  }

  function confirmProfileDraft() {
    if (!profileDraft) return;
    const confirmed = {
      ...profileDraft,
      targetRole: profileDraft.targetRole.trim(),
      skills: cleanProfileList(profileDraft.skills),
      domains: cleanProfileList(profileDraft.domains),
      achievements: cleanProfileList(profileDraft.achievements),
      updatedAt: new Date().toISOString(),
    };
    setProfile(confirmed);
    resumeInteractionRef.current = false;
    setProfileDraft(null);
    setProfileWarnings([]);
    setShowResumeInput(false);
    setResumeText("");
    localStorage.setItem(PROFILE_KEY, serializeCandidateProfile(confirmed));
    if (session?.access_token) {
      void saveCandidateProfile(confirmed, session.access_token);
    }
    trackFitEvent(
      editingExistingProfile ? "profile_edited" : "profile_confirmed",
    );
    setEditingExistingProfile(false);
  }

  async function parseResumeFile(file: File) {
    if (resumeParsing) return;
    resumeInteractionRef.current = true;
    setResumeParsing(true);
    setResumeError("");
    setProfileDraft(null);
    const fileType = resumeFileType(file.name);
    trackFitEvent("resume_upload_started", { file_type: fileType });
    try {
      // Browser-side validation before upload
      if (fileType === "unsupported") {
        throw new ResumeUploadError(USER_COPY.resume.unsupported, "unsupported_file");
      }
      if (file.size > 4 * 1024 * 1024) {
        throw new ResumeUploadError(USER_COPY.resume.tooLarge, "file_too_large");
      }

      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/parse-resume", {
        method: "POST",
        headers: {
          "x-companyradar-client": getClientId(),
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: form,
      });

      // Handle non-JSON responses by status code
      if (response.status === 413) {
        throw new ResumeUploadError(USER_COPY.resume.payloadTooLarge, "payload_too_large");
      }

      let data: ParseResumeResponse;
      try {
        data = (await response.json()) as ParseResumeResponse;
      } catch {
        const code = response.status >= 500 ? "ai_failed" : "invalid_response";
        const message =
          response.status >= 500
            ? USER_COPY.ai.unavailable
            : USER_COPY.resume.parseFailed;
        throw new ResumeUploadError(message, code);
      }

      if (!response.ok || !data.ok || !data.profile) {
        throw new ResumeUploadError(
          data.error || USER_COPY.resume.parseFailed,
          data.errorCode || "parse_failed",
        );
      }
      setProfileDraft(data.profile);
      setProfileWarnings(data.warnings ?? []);
      setEditingExistingProfile(Boolean(profile));
      trackFitEvent("resume_parse_completed", {
        file_type: fileType,
        warning_count: data.warnings?.length ?? 0,
      });
    } catch (caught) {
      const uploadError =
        caught instanceof ResumeUploadError
          ? caught
          : new ResumeUploadError(USER_COPY.resume.parseFailed, "parse_failed");
      setResumeError(uploadError.message);
      trackFitEvent("resume_parse_failed", {
        file_type: fileType,
        error_code: uploadError.code,
      });
    } finally {
      setResumeParsing(false);
      setDragActive(false);
    }
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
      setSavedJobCount((count) => count + (data.duplicate ? 0 : 1));
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

  function handleCompanyNameChange(name: string) {
    setAnalysis((prev) =>
      prev
        ? {
            ...prev,
            companyName: name,
            jobPosting: { ...prev.jobPosting, companyName: name },
          }
        : prev,
    );
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
              지원 관리{savedJobCount > 0 ? ` (${savedJobCount})` : ""}
            </Link>
            {authReady ? (
              session ? (
                <div className="flex items-center gap-3">
                  <span className="hidden max-w-40 truncate text-xs text-slate-500 sm:inline">
                    {session.user.email}
                  </span>
                  <button
                    className="text-xs text-slate-500 hover:text-slate-900"
                    onClick={() => { void getSupabaseClient()?.auth.signOut(); }}
                    type="button"
                  >
                    로그아웃
                  </button>
                </div>
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
              지원 전에 빠르게 체크
            </p>
            <h1
              aria-label="이 공고, 나랑 얼마나 맞을까?"
              className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-6xl"
            >
              이 공고, 나랑
              <br />
              얼마나 맞을까?
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              이력서와 채용공고를 맞춰보고, 잘 맞는 점과 확인할 점을
              깔끔하게 정리해드려요.
            </p>
          </section>

          {!analysis ? (
            loading ? (
              <AnalysisProgress />
            ) : (
            <section className="mt-10 grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-900/10 bg-white p-5 shadow-sm sm:p-7">
                <StepHeader
                  description="파일을 올리면 커리어 정보만 먼저 정리해드려요."
                  number="1"
                  title="내 이력서"
                />
                {profile && !showResumeInput ? (
                  <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-emerald-950">
                          이 프로필로 분석할게요
                        </p>
                        <p className="mt-1 text-sm text-emerald-800">
                          {profile.targetRole || "목표 직무 미확인"}
                          {profile.yearsExperience !== null
                            ? ` · 경력 ${profile.yearsExperience}년`
                            : ""}
                        </p>
                      </div>
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
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button onClick={editProfile} size="sm" variant="secondary">
                        <Pencil className="h-3.5 w-3.5" />
                        수정
                      </Button>
                      <Button
                        onClick={replaceProfile}
                        size="sm"
                        variant="ghost"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        새 이력서로 바꾸기
                      </Button>
                    </div>
                  </div>
                ) : profileDraft ? (
                  <ResumeProfileEditor
                    onCancel={cancelProfileChange}
                    onChange={setProfileDraft}
                    onConfirm={confirmProfileDraft}
                    profile={profileDraft}
                    warnings={profileWarnings}
                  />
                ) : (
                  <div className="mt-6">
                    {profile ? (
                      <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <span>새 내용을 확정하기 전까지 기존 프로필은 그대로 유지돼요.</span>
                        <button
                          className="shrink-0 font-medium text-slate-900"
                          onClick={cancelProfileChange}
                          type="button"
                        >
                          취소
                        </button>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                      <ModeButton
                        active={resumeMode === "file"}
                        label="파일 올리기"
                        onClick={() => {
                          resumeInteractionRef.current = true;
                          setResumeMode("file");
                        }}
                      />
                      <ModeButton
                        active={resumeMode === "text"}
                        label="텍스트로 직접 입력"
                        onClick={() => {
                          resumeInteractionRef.current = true;
                          setResumeMode("text");
                        }}
                      />
                    </div>
                    {resumeError ? (
                      <div
                        aria-live="polite"
                        className="mt-4 rounded-lg bg-rose-50 px-3 py-4 text-sm text-rose-700"
                      >
                        <p>{resumeError}</p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <button
                            className="text-xs font-medium text-rose-800 underline underline-offset-2"
                            onClick={() => setResumeError("")}
                            type="button"
                          >
                            다시 올리기
                          </button>
                          <button
                            className="text-xs font-medium text-rose-800 underline underline-offset-2"
                            onClick={() => {
                              setResumeError("");
                              setResumeMode("text");
                            }}
                            type="button"
                          >
                            내용 직접 붙여넣기
                          </button>
                        </div>
                      </div>
                    ) : resumeMode === "file" ? (
                      <label
                        className={cn(
                          "mt-4 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-5 py-8 text-center transition",
                          dragActive
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-slate-300 bg-slate-50 hover:border-slate-500 hover:bg-white",
                          resumeParsing && "pointer-events-none opacity-70",
                        )}
                        htmlFor="resume-file"
                        onDragEnter={(event) => {
                          event.preventDefault();
                          setDragActive(true);
                        }}
                        onDragLeave={(event) => {
                          event.preventDefault();
                          setDragActive(false);
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const file = event.dataTransfer.files[0];
                          if (file) void parseResumeFile(file);
                        }}
                      >
                        <input
                          accept=".pdf,.docx,.txt"
                          className="sr-only"
                          id="resume-file"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void parseResumeFile(file);
                            event.target.value = "";
                          }}
                          type="file"
                        />
                        {resumeParsing ? (
                          <>
                            <Loader2 className="h-7 w-7 animate-spin text-emerald-700" />
                            <p className="mt-3 font-semibold">커리어 정보를 정리하고 있어요</p>
                            <p className="mt-1 text-sm text-slate-500">
                              파일은 저장하지 않아요.
                            </p>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="h-8 w-8 text-slate-500" />
                            <p className="mt-3 font-semibold">
                              이력서 파일을 여기에 놓아주세요
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              또는 눌러서 파일 선택
                            </p>
                            <p className="mt-4 text-xs text-slate-400">
                              PDF, DOCX, TXT · 최대 4MB
                            </p>
                          </>
                        )}
                      </label>
                    ) : (
                      <div className="mt-4">
                        <Label htmlFor="resume-text">이력서 내용</Label>
                        <Textarea
                          className="mt-2 min-h-56"
                          id="resume-text"
                          onChange={(event) => {
                            resumeInteractionRef.current = true;
                            setResumeText(event.target.value);
                          }}
                          onFocus={() => trackFitEvent("fit_input_started")}
                          placeholder="경력, 프로젝트, 역량 내용을 붙여넣어 주세요."
                          value={resumeText}
                        />
                      </div>
                    )}
                    <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-slate-500">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      파일과 원문은 저장하지 않아요. 확인한 커리어 정보만
                      저장합니다.
                    </p>
                  </div>
                )}
              </article>

              <article className="rounded-2xl border border-slate-900/10 bg-white p-5 shadow-sm sm:p-7">
                <StepHeader
                  description="URL이나 공고 내용을 넣어주세요."
                  number="2"
                  title="채용공고"
                />
                <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                  <ModeButton
                    active={jobMode === "url"}
                    label="공고 URL"
                    onClick={() => { setJobMode("url"); setUrlHint(""); }}
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
                        onBlur={(event) => {
                          if (event.target.value.trim()) {
                            void fetchJobFromUrl(event.target.value);
                          }
                        }}
                        onChange={(event) => {
                          setJobUrl(event.target.value);
                          if (jobText) setJobText("");
                          setUrlHint("");
                        }}
                        onFocus={() => trackFitEvent("fit_input_started")}
                        placeholder="https://..."
                        type="url"
                        value={jobUrl}
                      />
                      {isFetchingJob ? (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          공고를 가져오는 중이에요...
                        </p>
                      ) : jobText ? (
                        <p className="mt-1.5 text-xs text-emerald-600">
                          공고 내용을 가져왔어요 ({jobText.length}자){jobSourceDomain ? ` · ${jobSourceDomain}` : ""}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Label htmlFor="job-text">공고 원문</Label>
                      {jobUrl && (
                        <p className="mt-1 truncate text-xs text-slate-400">
                          URL: {jobUrl}
                        </p>
                      )}
                      <Textarea
                        autoFocus
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

                {urlHint ? (
                  <div
                    aria-live="polite"
                    className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700"
                  >
                    {urlHint}
                  </div>
                ) : error ? (
                  <div
                    aria-live="polite"
                    className="mt-4 rounded-lg bg-rose-50 px-3 py-3 text-sm text-rose-700"
                  >
                    <p>{error}</p>
                    {analysisErrorCode === "quota_unavailable" ? (
                      <div className="mt-2">
                        <Button
                          onClick={() => void analyze()}
                          size="sm"
                          variant="secondary"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          다시 시도
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <Button
                  className="mt-6 h-12 text-base"
                  disabled={!canSubmit || loading || isFetchingJob}
                  onClick={() => void analyze()}
                  width="fill"
                >
                  {isFetchingJob ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      공고를 가져오는 중이에요
                    </>
                  ) : (
                    <>
                      나와 맞는지 확인하기
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </article>
            </section>
            )
          ) : (
            <FitResultView
              analysis={analysis}
              confidenceAfter={confidenceAfter}
              decision={decision}
              onAnalyzeAnother={analyzeAnother}
              onCompanyNameChange={handleCompanyNameChange}
              onConfidenceAfterChange={setConfidenceAfter}
              onSaveDecision={(value) => void saveDecision(value)}
              saveError={saveError}
              saveLoading={saveLoading}
              savedJobId={savedJobId}
            />
          )}
        </div>

        {analyticsConsent === null ? (
          <div className="mx-3 mb-3 mt-8 max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:fixed sm:inset-x-3 sm:bottom-3 sm:z-50 sm:mx-auto sm:mt-0">
            <p className="text-sm font-medium">더 나은 사용 경험을 위해</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              이력서나 개인정보는 빼고, 어떤 기능을 사용했는지만 익명으로
              확인해요.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                onClick={() => updateConsent("declined")}
                size="sm"
                variant="ghost"
              >
                괜찮아요
              </Button>
              <Button onClick={() => updateConsent("accepted")} size="sm">
                동의할게요
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
        <footer className="border-t border-slate-200 py-6 text-center">
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-slate-400">
            <Link className="hover:text-slate-600" href="/terms">이용약관</Link>
            <Link className="hover:text-slate-600" href="/privacy">개인정보처리방침</Link>
            <Link className="hover:text-slate-600" href="/refund-policy">환불정책</Link>
            <a className="hover:text-slate-600" href="mailto:support@companyradar.io">문의하기</a>
          </nav>
        </footer>
      </main>
    </>
  );
}

const ANALYSIS_STEPS = [
  "공고를 읽고 있어요...",
  "요구사항을 파악하고 있어요...",
  "경력과 맞춰보고 있어요...",
  "결과를 정리하고 있어요...",
];

function AnalysisProgress() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1) % ANALYSIS_STEPS.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="mt-10 flex min-h-64 items-center justify-center rounded-2xl border border-slate-900/10 bg-white p-8 shadow-sm">
      <div className="text-center">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-emerald-600" />
        <p className="mt-5 text-lg font-medium text-slate-900">
          {ANALYSIS_STEPS[step]}
        </p>
        <p className="mt-1.5 text-sm text-slate-500">
          보통 15~30초 정도 걸려요
        </p>
      </div>
    </section>
  );
}

function FitResultView({
  analysis,
  confidenceAfter,
  decision,
  onAnalyzeAnother,
  onCompanyNameChange,
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
  onCompanyNameChange: (name: string) => void;
  onConfidenceAfterChange: (value: number) => void;
  onSaveDecision: (decision: JobDecision) => void;
  saveError: string;
  saveLoading: JobDecision | null;
  savedJobId: string;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
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
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  className="rounded border border-current bg-transparent px-2 py-0.5 text-sm font-semibold outline-none placeholder:opacity-50"
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onCompanyNameChange(nameInput.trim() || analysis.companyName);
                      setEditingName(false);
                    }
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  placeholder="회사명 입력"
                  value={nameInput}
                />
                <button
                  aria-label="확인"
                  className="opacity-70 hover:opacity-100"
                  onClick={() => {
                    onCompanyNameChange(nameInput.trim() || analysis.companyName);
                    setEditingName(false);
                  }}
                  type="button"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                {analysis.companyName || "회사 미확인"}
                {analysis.roleTitle ? ` · ${analysis.roleTitle}` : ""}
                <button
                  aria-label="회사명 수정"
                  className="opacity-50 hover:opacity-100"
                  onClick={() => {
                    setNameInput(analysis.companyName || "");
                    setEditingName(true);
                  }}
                  type="button"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </p>
            )}
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
            emptyMessage="바로 연결되는 경험은 아직 찾지 못했어요."
            items={groups.matched}
            title="잘 맞는 경험"
          />
          <RequirementGroup
            emptyMessage="크게 부족한 조건은 없어요."
            items={groups.missing}
            title="아쉬운 조건"
          />
          <RequirementGroup
            emptyMessage="따로 확인할 조건은 없어요."
            items={groups.uncertain}
            title="지원 전에 확인할 것"
          />
          {analysis.companyOverview ? (
            <CompanyOverviewCard overview={analysis.companyOverview} />
          ) : null}
        </div>

        <aside className="h-fit space-y-5 lg:sticky lg:top-5">
          <div className="rounded-2xl border border-slate-900/10 bg-slate-950 p-5 text-white">
            <p className="text-xs font-semibold uppercase text-slate-400">
              지금 먼저 할 일
            </p>
            <p className="mt-3 text-lg font-medium leading-7">
              {analysis.nextAction}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-900/10 bg-white p-5">
            <p className="font-semibold">이 공고, 어떻게 둘까요?</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              저장해두면 지원 관리에서 바로 이어갈 수 있어요.
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
                label="관심으로 저장"
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
                label="이번엔 패스"
                onClick={() => onSaveDecision("pass")}
              />
            </div>
            <fieldset className="mt-5">
              <legend className="text-sm font-semibold">
                분석을 보고 나니 얼마나 확신이 드나요?
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
                  지원 관리에 저장했어요.
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  3초 뒤 저장한 공고로 이동해요.
                </p>
                <Link
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 underline underline-offset-4"
                  href={`/tracker?job=${encodeURIComponent(savedJobId)}`}
                >
                  저장한 공고 보기
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </div>

          <Button onClick={onAnalyzeAnother} variant="secondary" width="fill">
            <RotateCcw className="h-4 w-4" />
            다른 공고도 확인하기
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
                    text={item.jobEvidence || "공고에서 근거를 찾지 못했어요."}
                  />
                  <Evidence
                    label="내 경력 근거"
                    text={item.profileEvidence || "내 경력에서 근거를 찾지 못했어요."}
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

interface ParseResumeResponse {
  ok: boolean;
  profile?: CandidateProfile;
  warnings?: string[];
  error?: string;
  errorCode?: string;
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
      setError("로그인 연결이 아직 준비되지 않았어요.");
      return;
    }
    const nextEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError("이메일 주소를 다시 확인해주세요.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("비밀번호는 8자 이상으로 만들어주세요.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("비밀번호가 서로 달라요.");
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
        setError(USER_COPY.auth.invalidCredentials);
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
      setError("가입을 마치지 못했어요. 잠시 후 다시 해주세요.");
      return;
    }
    if (data.session) {
      onSuccess();
    } else {
      setMessage(
        "확인 메일을 보냈어요. 인증하고 돌아오면 이 분석 결과를 바로 저장할게요.",
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
              분석 결과 이어서 저장
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {mode === "login" ? "로그인하고 이어갈까요?" : "계정을 만들고 저장할까요?"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              지금 본 결과는 그대로 둘게요. 로그인만 하면 지원 관리에 저장돼요.
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
              ? "잠시만요..."
              : mode === "login"
                ? "로그인하고 이어가기"
                : "가입하고 이어가기"}
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

class ResumeUploadError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ResumeUploadError";
  }
}

function cleanProfileList(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function resumeFileType(name: string): string {
  const extension = name.toLowerCase().split(".").pop();
  return extension === "pdf" || extension === "docx" || extension === "txt"
    ? extension
    : "unsupported";
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
