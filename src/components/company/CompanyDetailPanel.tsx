"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BookOpenText,
  CalendarClock,
  CircleHelp,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Flag,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { getApiErrorMessage } from "@/lib/api-error";
import { getCompanyValidationReasons, getValidationCompletePatch } from "@/lib/company-validation";
import {
  COMPANY_SIZE_LABELS,
  DISCOVERY_REASON_LABELS,
  EVIDENCE_LEVEL_LABELS,
  EVIDENCE_LEVEL_OPTIONS,
  INTERVIEW_ROUND_TYPE_LABELS,
  INTERVIEW_ROUND_TYPE_OPTIONS,
  JOB_STATUS_LABELS,
  PRIORITY_LABELS,
  ROLE_FIT_CHECKLIST_TITLE,
  ROLE_FIT_LABELS,
  getRoleScoreCategories,
  ROUND_RESULT_LABELS,
  ROUND_RESULT_OPTIONS,
  STATUS_LABELS,
} from "@/lib/criteria";
import { formatScore } from "@/lib/scoring";
import type {
  Company,
  CompanyScoreResult,
  CriteriaSettings,
  EvidenceLevel,
  InterviewRound,
  InterviewRoundType,
  PrepCategory,
  PrepQuestion,
  ResearchSignal,
  StatusHistoryEntry,
} from "@/lib/types";
import {
  decryptNote,
  encryptNote,
  exportEncryptionKey,
  getEncryptionKey,
  importAndSaveEncryptionKey,
} from "@/lib/crypto";
import { getSupabaseClient } from "@/lib/supabase-client";
import { createId, today } from "@/lib/utils";
import { InfoRow, Metric, STATUS_TONE, type DrawerDetailTab, type DrawerFocusTarget } from "./shared";

interface CompanyDetailPanelProps {
  company: Company;
  score: CompanyScoreResult;
  userId: string;
  focusTarget?: DrawerFocusTarget;
  settings?: CriteriaSettings;
  onBack?: () => void;
  onDelete: (companyId: string) => void;
  onEdit: (company: Company) => void;
  onPatch: (companyId: string, patch: Partial<Company>) => void;
  onToast?: (message: string) => void;
}

export function CompanyDetailPanel({
  company,
  score,
  userId,
  focusTarget,
  settings,
  onBack,
  onDelete,
  onEdit,
  onPatch,
  onToast,
}: CompanyDetailPanelProps) {
  const userRole = settings?.userRole ?? "designer";
  const fitLabels = ROLE_FIT_LABELS[userRole];
  const fitTitle = ROLE_FIT_CHECKLIST_TITLE[userRole];
  const scoreCategories = getRoleScoreCategories(userRole);
  const [panelKey, setPanelKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    if (!userId) return;
    let canceled = false;
    getEncryptionKey(userId)
      .then((key) => {
        if (!canceled) setPanelKey(key);
      })
      .catch(() => {
        if (!canceled) setPanelKey(null);
      });
    return () => {
      canceled = true;
    };
  }, [userId]);

  const [signalKind, setSignalKind] =
    useState<keyof Company["signals"]>("greenFlags");
  const [signalDraft, setSignalDraft] = useState<Omit<ResearchSignal, "id">>({
    label: "",
    description: "",
    sourceUrl: "",
    confidence: 2,
    createdAt: today(),
  });
  const [taskDraft, setTaskDraft] = useState({ title: "", dueDate: today() });
  const [roundDraft, setRoundDraft] = useState<{
    type: InterviewRoundType;
    title: string;
    scheduledAt: string;
    memo: string;
  }>({ type: "first", title: "", scheduledAt: today(), memo: "" });
  const [noteDraft, setNoteDraft] = useState("");
  const [logDraft, setLogDraft] = useState({
    source: "",
    link: "",
    positiveSignals: "",
    negativeSignals: "",
    questions: "",
  });
  const [aiResearchLoading, setAiResearchLoading] = useState(false);
  const [aiResearchError, setAiResearchError] = useState("");
  const validationReasons = getCompanyValidationReasons(company);
  const [activeTab, setActiveTab] = useState<DrawerDetailTab>(focusTarget?.tab ?? "summary");
  const [headerCompact, setHeaderCompact] = useState(false);
  const detailTabs: { id: DrawerDetailTab; label: string; count?: number }[] = [
    { id: "summary", label: "요약" },
    {
      id: "prep",
      label: "지원 준비",
      count: company.followUpTasks.filter((task) => !task.completed).length,
    },
    {
      id: "research",
      label: "회사 조사",
      count:
        company.researchLogs.length +
        company.signals.greenFlags.length +
        company.signals.redFlags.length +
        company.signals.unknowns.length,
    },
    {
      id: "interview",
      label: "면접",
      count: company.interviewRounds.length + company.interviewNotes.length,
    },
    { id: "private", label: "민감 메모" },
    { id: "ai", label: "AI" },
  ];

  useEffect(() => {
    if (!focusTarget?.section) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-drawer-section="${focusTarget.section}"]`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, focusTarget]);

  async function generateAiResearchLog() {
    setAiResearchLoading(true);
    setAiResearchError("");
    let accessToken: string | undefined;
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token;
      }
    } catch { /* non-fatal */ }
    try {
      const res = await fetch("/api/research-company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          companyName: company.name,
          homepageUrl: company.homepageUrl,
          industry: company.industry,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; result: { source: string; link: string; positiveSignals: string; negativeSignals: string; questions: string } }
        | { error: { code?: string; message: string } };
      if (!("ok" in data) || !data.ok) {
      setAiResearchError(getApiErrorMessage(res, data, "AI 회사 조사에 실패했습니다."));
        return;
      }
      onPatch(company.id, {
        researchLogs: [
          { id: createId("log"), ...data.result, createdAt: today() },
          ...company.researchLogs,
        ],
        lastResearchedAt: today(),
      });
    } catch {
      setAiResearchError("AI 회사 조사 요청에 실패했습니다.");
    } finally {
      setAiResearchLoading(false);
    }
  }

  function addSignal() {
    if (!signalDraft.label.trim()) return;
    onPatch(company.id, {
      signals: {
        ...company.signals,
        [signalKind]: [
          { id: createId("signal"), ...signalDraft },
          ...company.signals[signalKind],
        ],
      },
    });
    setSignalDraft({
      label: "",
      description: "",
      sourceUrl: "",
      confidence: 2,
      createdAt: today(),
    });
  }

  function removeSignal(kind: keyof Company["signals"], signalId: string) {
    onPatch(company.id, {
      signals: {
        ...company.signals,
        [kind]: company.signals[kind].filter((item) => item.id !== signalId),
      },
    });
  }

  function addFollowUpTask() {
    if (!taskDraft.title.trim()) return;
    onPatch(company.id, {
      followUpTasks: [
        {
          id: createId("task"),
          title: taskDraft.title,
          dueDate: taskDraft.dueDate,
          completed: false,
          createdAt: today(),
        },
        ...company.followUpTasks,
      ],
    });
    setTaskDraft({ title: "", dueDate: today() });
  }

  function removeFollowUpTask(taskId: string) {
    onPatch(company.id, {
      followUpTasks: company.followUpTasks.filter((task) => task.id !== taskId),
    });
  }

  function addInterviewRound() {
    if (!roundDraft.title.trim()) return;
    onPatch(company.id, {
      interviewRounds: [
        {
          id: createId("round"),
          type: roundDraft.type,
          title: roundDraft.title,
          scheduledAt: roundDraft.scheduledAt,
          result: "scheduled",
          memo: roundDraft.memo,
          createdAt: today(),
        },
        ...company.interviewRounds,
      ],
    });
    setRoundDraft({ type: "first", title: "", scheduledAt: today(), memo: "" });
  }

  function patchRound(roundId: string, patch: Partial<InterviewRound>) {
    onPatch(company.id, {
      interviewRounds: company.interviewRounds.map((round) =>
        round.id === roundId ? { ...round, ...patch } : round,
      ),
    });
  }

  function removeRound(roundId: string) {
    onPatch(company.id, {
      interviewRounds: company.interviewRounds.filter(
        (round) => round.id !== roundId,
      ),
    });
  }

  async function addInterviewNote() {
    if (!noteDraft.trim()) return;
    const content = panelKey
      ? await encryptNote(panelKey, noteDraft)
      : noteDraft;
    onPatch(company.id, {
      interviewNotes: [
        {
          id: createId("note"),
          title: "면접 메모",
          content,
          createdAt: today(),
        },
        ...company.interviewNotes,
      ],
    });
    setNoteDraft("");
  }

  function removeInterviewNote(noteId: string) {
    onPatch(company.id, {
      interviewNotes: company.interviewNotes.filter((note) => note.id !== noteId),
    });
  }

  function addResearchLog() {
    if (!logDraft.source.trim()) return;
    onPatch(company.id, {
      researchLogs: [
        { id: createId("log"), ...logDraft, createdAt: today() },
        ...company.researchLogs,
      ],
      lastResearchedAt: today(),
    });
    setLogDraft({
      source: "",
      link: "",
      positiveSignals: "",
      negativeSignals: "",
      questions: "",
    });
  }

  function removeResearchLog(logId: string) {
    onPatch(company.id, {
      researchLogs: company.researchLogs.filter((log) => log.id !== logId),
    });
  }

  function markJobPostingChecked() {
    onPatch(company.id, getValidationCompletePatch(today()));
    onToast?.("공고 확인일을 오늘로 기록했습니다.");
  }

  return (
    <aside className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="shrink-0 border-b border-slate-200 px-3 pt-3 transition-[padding-bottom] duration-200" style={{ paddingBottom: headerCompact ? "8px" : "12px" }}>
        {/* 항상 보임: 내비 + 회사명 + 상태 + 액션 */}
        <div className="flex items-center justify-between gap-2">
          {onBack ? (
            <Button aria-label="뒤로가기" onClick={onBack} size="sm" variant="ghost">
              <ArrowLeft className="h-4 w-4" />
              뒤로가기
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">
            <Button aria-label="수정" onClick={() => onEdit(company)} size="icon" variant="ghost">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              aria-label="PDF/인쇄"
              onClick={() => window.print()}
              size="icon"
              variant="ghost"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              aria-label="삭제"
              onClick={() => onDelete(company.id)}
              size="icon"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold leading-6 sm:text-lg">{company.name}</h2>
            <Badge tone={STATUS_TONE[company.status]}>{STATUS_LABELS[company.status]}</Badge>
            {score.highRisk ? (
              <Badge tone="red">
                <AlertTriangle className="mr-1 h-3 w-3" />
                리스크 높음
              </Badge>
            ) : null}
            {score.needsValidation ? <Badge tone="amber">확인 필요</Badge> : null}
            {company.isSampleData ? <Badge tone="blue">Sample</Badge> : null}
          </div>
        </div>

        {/* 스크롤 시 접히는 영역 */}
        <div
          className="overflow-hidden transition-[max-height,opacity] duration-200"
          style={{ maxHeight: headerCompact ? "0px" : "300px", opacity: headerCompact ? 0 : 1 }}
        >
          <p className="mt-0.5 text-xs leading-5 text-slate-500">
            {company.industry || "업종 미입력"} · {PRIORITY_LABELS[company.applicationPriority]} · 회사핏 {formatScore(score.companyFitScore)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {company.homepageUrl ? (
              <a
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                href={company.homepageUrl}
                rel="noreferrer"
                target="_blank"
              >
                홈페이지 <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {company.jobPostUrl ? (
              <a
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                href={company.jobPostUrl}
                rel="noreferrer"
                target="_blank"
              >
                채용공고 <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          {validationReasons.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {validationReasons.map((reason) => (
                <Badge key={reason} tone="amber">
                  {reason}
                </Badge>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
            <span className="font-medium text-slate-700">
              공고 상태 · 마지막 확인 {formatShortDate(company.lastCheckedAt)}
              <DrawerHelpTip text="공고가 아직 열려 있는지 직접 확인했을 때 눌러주세요." />
            </span>
            <Button onClick={markJobPostingChecked} size="sm" variant="secondary">
              <ClipboardCheck className="h-3.5 w-3.5" />
              공고 확인했어요
            </Button>
          </div>
        </div>
      </div>

      <nav className="shrink-0 overflow-x-auto border-b border-slate-200 bg-white px-3 pb-3 pt-2">
        <div className="flex min-w-max gap-1">
          {detailTabs.map((tab) => (
            <button
              aria-pressed={activeTab === tab.id}
              className={[
                "inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100",
              ].join(" ")}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
              {tab.count ? (
                <span className={activeTab === tab.id ? "text-white/75" : "text-slate-400"}>
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      <div
        className="min-h-0 flex-1 space-y-7 overflow-y-auto px-4 pb-8 pt-5"
        onScroll={(e) => {
          const y = e.currentTarget.scrollTop;
          if (y > 60 && !headerCompact) setHeaderCompact(true);
          else if (y < 10 && headerCompact) setHeaderCompact(false);
        }}
      >
        {activeTab === "summary" ? (
          <>
        <section className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" data-drawer-section="summary">
          <Metric compact label="회사핏" value={formatScore(score.companyFitScore)} />
          <Metric compact label="우선순위" value={PRIORITY_LABELS[company.applicationPriority]} />
          <Metric compact label="정보 깊이" value={`${Math.round(score.averageEvidenceLevel)} / 5`} />
        </section>
        <section className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <Metric
            compact
            label="리스크"
            tone={score.highRisk ? "red" : "slate"}
            value={`${score.riskCount}개`}
          />
          <Metric compact label="공고 상태" value={JOB_STATUS_LABELS[company.jobStatus]} />
          <Metric compact label="관심도" value={`${company.interestLevel}/5`} />
        </section>

        <NextActionBanner company={company} />

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">기본 정보</h3>
            <Badge tone={STATUS_TONE[company.status]}>
              {STATUS_LABELS[company.status]}
            </Badge>
          </div>
          <InfoRow label="규모" value={COMPANY_SIZE_LABELS[company.size]} />
          <InfoRow
            label="우선순위"
            value={`${PRIORITY_LABELS[company.applicationPriority]} · ${company.priorityReason}`}
          />
          <InfoRow
            label="관심 갖게 된 계기"
            value={`${DISCOVERY_REASON_LABELS[company.discoveryReason]} · ${company.firstImpressionNote || "첫인상 메모 없음"}`}
          />
          <InfoRow
            label="공고 상태"
            value={`${JOB_STATUS_LABELS[company.jobStatus]} · ${company.jobDeadline || "마감 미확인"}`}
          />
          <InfoRow
            label="정보 출처"
            value={`${EVIDENCE_LEVEL_LABELS[company.evidenceLevel]} · ${company.needsRefresh ? "오래됐어요" : "최근에 확인했어요"}`}
          />
          <InfoRow label="제품" value={company.productDescription} />
          <InfoRow label="성장 정보" value={company.growthInfo} />
          <InfoRow label="관심 이유" value={company.candidateReason || "없음"} />
          <InfoRow label="메모" value={company.memo || "없음"} />
          <div className="flex gap-2 pt-1">
            {company.homepageUrl ? (
              <a
                className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline"
                href={company.homepageUrl}
                rel="noreferrer"
                target="_blank"
              >
                홈페이지 <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {company.jobPostUrl ? (
              <a
                className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline"
                href={company.jobPostUrl}
                rel="noreferrer"
                target="_blank"
              >
                채용공고 <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </section>

        <StatusHistorySection statusHistory={company.statusHistory ?? []} />
          </>
        ) : null}

        {activeTab === "ai" ? (
          <CompanySummarySection company={company} userId={userId} />
        ) : null}

        {activeTab === "summary" ? (
        <section className="space-y-4">
          <h3 className="flex items-center gap-1 text-sm font-semibold">
            평가 점수
            <DrawerHelpTip text="내가 정한 기준으로 이 회사가 얼마나 맞는지 계산한 점수입니다." />
          </h3>
          {score.categoryScores.map((category) => {
            const displayCategory =
              scoreCategories.find((item) => item.key === category.key) ?? category;
            return (
            <div className="space-y-2" key={category.key}>
              <div className="flex justify-between text-sm">
                <span>{displayCategory.title}</span>
                <span className="font-semibold">{formatScore(category.average)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-slate-900"
                  style={{ width: `${(category.average / 5) * 100}%` }}
                />
              </div>
            </div>
            );
          })}
        </section>
        ) : null}

        {activeTab === "prep" ? (
          <>
        <section className="space-y-4">
          <h3 className="text-sm font-semibold">{fitTitle}</h3>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(fitLabels).map(([key, label]) => (
              <label
                className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-sm"
                key={key}
              >
                <input
                  checked={company.designerFit[key as keyof Company["designerFit"]]}
                  className="accent-slate-900"
                  onChange={(event) =>
                    onPatch(company.id, {
                      designerFit: {
                        ...company.designerFit,
                        [key]: event.target.checked,
                      },
                    })
                  }
                  type="checkbox"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardCheck className="h-4 w-4" />
            지원 준비 체크리스트
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {[
              ["resumeReady", "이력서 준비"],
              ["portfolioReady", "포트폴리오 준비"],
              ["coverLetterReady", "지원동기/자기소개 준비"],
              ["referralChecked", "추천인/네트워크 확인"],
              ["submitted", "지원 제출 완료"],
            ].map(([key, label]) => (
              <label
                className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-sm"
                key={key}
              >
                <input
                  checked={
                    company.applicationChecklist[
                      key as keyof Company["applicationChecklist"]
                    ]
                  }
                  className="accent-slate-900"
                  onChange={(event) =>
                    onPatch(company.id, {
                      applicationChecklist: {
                        ...company.applicationChecklist,
                        [key]: event.target.checked,
                      },
                    })
                  }
                  type="checkbox"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>
          </>
        ) : null}

        {activeTab === "research" ? (
          <>
        <section className="space-y-4">
          <h3 className="text-sm font-semibold">걱정되는 점</h3>
          {company.riskFlags.length > 0 ? (
            <div className="space-y-1">
              {company.riskFlags.map((flag) => (
                <div className="flex items-start gap-2 text-sm text-red-700" key={flag}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {flag}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7 text-slate-500">체크된 걱정되는 점이 없습니다.</p>
          )}
        </section>

          <section className="space-y-4" data-drawer-section="prep">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4" />
            좋은 점/걱정되는 점
          </h3>
          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <Select
              aria-label="신호 유형"
              onChange={(event) =>
                setSignalKind(event.target.value as keyof Company["signals"])
              }
              value={signalKind}
            >
              <option value="greenFlags">좋은 점</option>
              <option value="redFlags">걱정되는 점</option>
              <option value="unknowns">더 확인할 점</option>
            </Select>
            <Input
              aria-label="신호 라벨"
              onChange={(event) =>
                setSignalDraft((draft) => ({ ...draft, label: event.target.value }))
              }
              placeholder="라벨"
              value={signalDraft.label}
            />
            <Textarea
              aria-label="신호 설명"
              onChange={(event) =>
                setSignalDraft((draft) => ({
                  ...draft,
                  description: event.target.value,
                }))
              }
              placeholder="설명"
              value={signalDraft.description}
            />
            <Input
              aria-label="출처 URL"
              onChange={(event) =>
                setSignalDraft((draft) => ({
                  ...draft,
                  sourceUrl: event.target.value,
                }))
              }
              placeholder="출처 URL"
              value={signalDraft.sourceUrl}
            />
            <Select
              aria-label="신뢰도"
              onChange={(event) =>
                setSignalDraft((draft) => ({
                  ...draft,
                  confidence: Number(event.target.value) as EvidenceLevel,
                }))
              }
              value={signalDraft.confidence}
            >
              {EVIDENCE_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Lv.{option.value} {option.label}
                </option>
              ))}
            </Select>
            <Button onClick={addSignal} size="sm">
              <Plus className="h-4 w-4" />
              기록 추가
            </Button>
          </div>
          <SignalGroup
            kind="greenFlags"
            onRemove={removeSignal}
            signals={company.signals.greenFlags}
            title="좋은 점"
            tone="green"
          />
          <SignalGroup
            kind="redFlags"
            onRemove={removeSignal}
            signals={company.signals.redFlags}
            title="걱정되는 점"
            tone="red"
          />
          <SignalGroup
            kind="unknowns"
            onRemove={removeSignal}
            signals={company.signals.unknowns}
            title="더 확인할 점"
            tone="amber"
          />
        </section>

          <section className="space-y-4" data-drawer-section="research">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <BookOpenText className="h-4 w-4" />
              회사 조사 메모
            </h3>
            <Button
              disabled={aiResearchLoading}
              onClick={() => void generateAiResearchLog()}
              size="sm"
              variant="secondary"
            >
              {aiResearchLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {aiResearchLoading ? "분석 중..." : "AI로 회사 조사"}
            </Button>
          </div>
          {aiResearchError && (
            <p className="text-xs text-red-600">{aiResearchError}</p>
          )}
          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <Input
              aria-label="회사 조사 출처"
              onChange={(event) =>
                setLogDraft((draft) => ({ ...draft, source: event.target.value }))
              }
              placeholder="출처 (예: 블라인드, 잡플래닛, 기사)"
              value={logDraft.source}
            />
            <Input
              aria-label="회사 조사 링크"
              onChange={(event) =>
                setLogDraft((draft) => ({ ...draft, link: event.target.value }))
              }
              placeholder="링크 URL"
              value={logDraft.link}
            />
            <Textarea
              aria-label="좋아 보이는 점"
              className="min-h-16"
              onChange={(event) =>
                setLogDraft((draft) => ({
                  ...draft,
                  positiveSignals: event.target.value,
                }))
              }
              placeholder="좋아 보이는 점"
              value={logDraft.positiveSignals}
            />
            <Textarea
              aria-label="걱정되는 점"
              className="min-h-16"
              onChange={(event) =>
                setLogDraft((draft) => ({
                  ...draft,
                  negativeSignals: event.target.value,
                }))
              }
              placeholder="걱정되는 점"
              value={logDraft.negativeSignals}
            />
            <Textarea
              aria-label="추가 확인 질문"
              className="min-h-16"
              onChange={(event) =>
                setLogDraft((draft) => ({ ...draft, questions: event.target.value }))
              }
              placeholder="면접이나 커피챗에서 물어볼 것"
              value={logDraft.questions}
            />
            <Button onClick={addResearchLog} size="sm">
              <Plus className="h-4 w-4" />
              메모 추가
            </Button>
          </div>
          {company.researchLogs.map((log) => (
            <div className="rounded-md border border-slate-200 p-3" key={log.id}>
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{log.source}</strong>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{log.createdAt}</span>
                  <button
                    aria-label="회사 조사 메모 삭제"
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => removeResearchLog(log.id)}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {log.link ? (
                <a
                  className="mt-1 inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
                  href={log.link}
                  rel="noreferrer"
                  target="_blank"
                >
                  출처 링크 <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              {log.positiveSignals ? (
                <p className="mt-2 text-sm leading-7 text-emerald-700">+ {log.positiveSignals}</p>
              ) : null}
              {log.negativeSignals ? (
                <p className="mt-1 text-sm leading-7 text-red-700">- {log.negativeSignals}</p>
              ) : null}
              {log.questions ? (
                <p className="mt-1 text-sm leading-7 text-slate-700">? {log.questions}</p>
              ) : null}
            </div>
          ))}
          {company.researchLogs.length === 0 ? (
            <p className="text-sm text-slate-400">기록 없음</p>
          ) : null}
        </section>
          </>
        ) : null}

        {activeTab === "interview" ? (
          <>
          <section className="space-y-4" data-drawer-section="interview">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4" />
            면접 라운드
          </h3>
          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <Select
              aria-label="라운드 유형"
              onChange={(event) =>
                setRoundDraft((draft) => ({
                  ...draft,
                  type: event.target.value as InterviewRoundType,
                }))
              }
              value={roundDraft.type}
            >
              {INTERVIEW_ROUND_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              aria-label="라운드 제목"
              onChange={(event) =>
                setRoundDraft((draft) => ({ ...draft, title: event.target.value }))
              }
              placeholder="예: 1차 제품 인터뷰"
              value={roundDraft.title}
            />
            <Input
              aria-label="면접 날짜"
              onChange={(event) =>
                setRoundDraft((draft) => ({
                  ...draft,
                  scheduledAt: event.target.value,
                }))
              }
              type="date"
              value={roundDraft.scheduledAt}
            />
            <Textarea
              aria-label="라운드 메모"
              onChange={(event) =>
                setRoundDraft((draft) => ({ ...draft, memo: event.target.value }))
              }
              placeholder="질문, 준비할 점, 받은 인상"
              value={roundDraft.memo}
            />
            <Button onClick={addInterviewRound} size="sm">
              라운드 추가
            </Button>
          </div>
          {company.interviewRounds.map((round) => (
            <div className="rounded-md border border-slate-200 p-3" key={round.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone="slate">{INTERVIEW_ROUND_TYPE_LABELS[round.type]}</Badge>
                  <strong className="text-sm">{round.title}</strong>
                </div>
                <button
                  aria-label="라운드 삭제"
                  className="text-slate-400 hover:text-red-600"
                  onClick={() => removeRound(round.id)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-500">{round.scheduledAt}</span>
                <select
                  aria-label="라운드 결과"
                  className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-slate-500"
                  onChange={(event) =>
                    patchRound(round.id, {
                      result: event.target.value as InterviewRound["result"],
                    })
                  }
                  value={round.result}
                >
                  {ROUND_RESULT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {ROUND_RESULT_LABELS[option.value]}
                    </option>
                  ))}
                </select>
              </div>
              {round.memo ? (
                <p className="mt-2 text-sm leading-7 text-slate-700">{round.memo}</p>
              ) : null}
            </div>
          ))}
        </section>
          </>
        ) : null}

        {activeTab === "prep" ? (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Flag className="h-4 w-4" />
            다음 할일
          </h3>
          <div className="grid grid-cols-[1fr_128px_64px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <Input
              aria-label="할일"
              onChange={(event) =>
                setTaskDraft((draft) => ({ ...draft, title: event.target.value }))
              }
              placeholder="예: 채용담당자에게 팔로업 메일"
              value={taskDraft.title}
            />
            <Input
              aria-label="할일 기한"
              onChange={(event) =>
                setTaskDraft((draft) => ({ ...draft, dueDate: event.target.value }))
              }
              type="date"
              value={taskDraft.dueDate}
            />
            <Button onClick={addFollowUpTask} size="sm">
              추가
            </Button>
          </div>
          {company.followUpTasks.map((task) => (
            <div
              className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm"
              key={task.id}
            >
              <input
                aria-label={`${task.title} 완료`}
                checked={task.completed}
                className="mt-1 accent-slate-900"
                onChange={(event) =>
                  onPatch(company.id, {
                    followUpTasks: company.followUpTasks.map((item) =>
                      item.id === task.id
                        ? {
                            ...item,
                            completed: event.target.checked,
                            completedAt: event.target.checked
                              ? new Date().toISOString()
                              : undefined,
                          }
                        : item,
                    ),
                  })
                }
                type="checkbox"
              />
              <span
                className={
                  task.completed ? "flex-1 text-slate-400 line-through" : "flex-1"
                }
              >
                {task.title}
                <span className="ml-2 text-xs text-slate-500">{task.dueDate}</span>
              </span>
              <button
                aria-label="할일 삭제"
                className="text-slate-400 hover:text-red-600"
                onClick={() => removeFollowUpTask(task.id)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </section>
        ) : null}

        {activeTab === "private" ? (
        <div data-drawer-section="private">
        <EncryptedNoteSection
          company={company}
          onPatch={onPatch}
          userId={userId}
        />
        </div>
        ) : null}

        {activeTab === "interview" ? (
          <>
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4" />
            면접 메모
            <Lock aria-label="암호화 저장" className="ml-1 h-3 w-3 text-slate-400" />
          </h3>
          <div className="flex items-center gap-2">
            <Input
              aria-label="면접 메모"
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="면접에서 들은 신호, 질문, 인상"
              value={noteDraft}
            />
            <Button onClick={() => void addInterviewNote()} size="sm">
              추가
            </Button>
          </div>
          {company.interviewNotes.map((note) => (
            <InterviewNoteItem
              encKey={panelKey}
              key={note.id}
              note={note}
              onRemove={removeInterviewNote}
            />
          ))}
        </section>

        <PrepQuestionSection
          company={company}
          encKey={panelKey}
          settings={settings}
          onPatch={onPatch}
        />
          </>
        ) : null}

        {activeTab === "ai" ? <DraftEmailSection company={company} /> : null}
      </div>
    </aside>
  );
}

function DrawerHelpTip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex align-middle">
      <button
        aria-label={text}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:bg-slate-100 focus:text-slate-700 focus:outline-none"
        type="button"
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal leading-5 text-slate-600 shadow-lg group-focus-within:block group-hover:block">
        {text}
      </span>
    </span>
  );
}

function SignalGroup({
  kind,
  onRemove,
  signals,
  title,
  tone,
}: {
  kind: keyof Company["signals"];
  onRemove: (kind: keyof Company["signals"], signalId: string) => void;
  signals: ResearchSignal[];
  title: string;
  tone: "green" | "red" | "amber";
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <Badge tone={tone}>{signals.length}</Badge>
      </div>
      <div className="space-y-2">
        {signals.map((signal) => (
          <div className="rounded-md bg-slate-50 p-3" key={signal.id}>
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm">{signal.label}</strong>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Lv.{signal.confidence}</span>
                <button
                  aria-label="기록 삭제"
                  className="text-slate-400 hover:text-red-600"
                  onClick={() => onRemove(kind, signal.id)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              {signal.reason ?? signal.description}
            </p>
            {signal.evidenceText ? (
              <blockquote className="mt-2 border-l-2 border-slate-300 pl-2 text-xs italic leading-6 text-slate-500">
                {signal.evidenceText}
              </blockquote>
            ) : null}
            {signal.sourceUrl ? (
              <a
                className="mt-1 inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
                href={signal.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                출처 <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        ))}
        {signals.length === 0 ? (
          <p className="text-sm leading-7 text-slate-400">아직 기록이 없습니다.</p>
        ) : null}
      </div>
    </div>
  );
}

// Shows the next follow-up task for active applications.
function NextActionBanner({ company }: { company: Company }) {
  const needsAction =
    company.status === "applied" || company.status === "interviewing";
  if (!needsAction) return null;

  const pending = company.followUpTasks.filter((t) => !t.completed);
  const sorted = [...pending].sort(
    (a, b) => (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1,
  );
  const next = sorted[0];

  if (!next) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <Flag className="h-3.5 w-3.5 shrink-0" />
        <span className="leading-5">
          <strong>다음 할 일 없음</strong> — {STATUS_LABELS[company.status]} 상태인데 다음 할 일이 없습니다.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span className="leading-5">
        <strong>다음 할 일:</strong> {next.title}
        {next.dueDate ? (
          <span className="ml-1 font-medium">· {next.dueDate}</span>
        ) : null}
        {pending.length > 1 ? (
          <span className="ml-1 text-sky-600">외 {pending.length - 1}개</span>
        ) : null}
      </span>
    </div>
  );
}

function EncryptedNoteSection({
  company,
  userId,
  onPatch,
}: {
  company: Company;
  userId: string;
  onPatch: (companyId: string, patch: Partial<Company>) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [encKey, setEncKey] = useState<CryptoKey | null>(null);
  const [keyStatus, setKeyStatus] = useState<"loading" | "ready" | "error">("loading");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function loadKey() {
      setKeyStatus("loading");
      setFeedback(null);
      try {
        const key = await getEncryptionKey(userId);
        if (cancelled) return;
        keyRef.current = key;
        setEncKey(key);
        setKeyStatus("ready");
      } catch {
        if (cancelled) return;
        keyRef.current = null;
        setEncKey(null);
        setKeyStatus("error");
      }
    }
    void loadKey();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function retryLoadKey() {
    if (!userId) return;
    setKeyStatus("loading");
    setFeedback(null);
    try {
      const key = await getEncryptionKey(userId);
      keyRef.current = key;
      setEncKey(key);
      setKeyStatus("ready");
    } catch {
      keyRef.current = null;
      setEncKey(null);
      setKeyStatus("error");
      setFeedback({
        tone: "error",
        message: "암호화 키를 준비하지 못했습니다. 다시 시도해 주세요.",
      });
    }
  }

  const notes = [
    ...(company.privateSensitiveNotes ?? []),
    ...(company.privateSensitiveNote
      ? [
          {
            id: "legacy-private-sensitive-note",
            title: "이전 민감 메모",
            content: company.privateSensitiveNote,
            createdAt: company.updatedAt || company.createdAt,
          },
        ]
      : []),
  ];

  async function addPrivateNote() {
    if (!content.trim() || !keyRef.current) return;
    setFeedback(null);
    setSaving(true);
    try {
      const encryptedContent = await encryptNote(keyRef.current, content.trim());
      onPatch(company.id, {
        privateSensitiveNotes: [
          {
            id: createId("private-note"),
            title: title.trim() || "민감 메모",
            content: encryptedContent,
            createdAt: today(),
          },
          ...(company.privateSensitiveNotes ?? []),
        ],
      });
      setTitle("");
      setContent("");
      setFeedback({ tone: "success", message: "민감 메모가 저장되었습니다." });
    } catch {
      setFeedback({ tone: "error", message: "민감 메모 저장에 실패했습니다. 잠시 후 다시 시도하세요." });
    } finally {
      setSaving(false);
    }
  }

  function removePrivateNote(noteId: string) {
    if (noteId === "legacy-private-sensitive-note") {
      onPatch(company.id, { privateSensitiveNote: "" });
      return;
    }
    onPatch(company.id, {
      privateSensitiveNotes: (company.privateSensitiveNotes ?? []).filter(
        (note) => note.id !== noteId,
      ),
    });
  }

  async function handleDownload() {
    if (!keyRef.current) return;
    const b64 = await exportEncryptionKey(keyRef.current);
    const blob = new Blob([b64], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sensitive-note-key-backup.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    const b64 = (await file.text()).trim();
    const key = await importAndSaveEncryptionKey(userId, b64);
    keyRef.current = key;
    setEncKey(key);
    setKeyStatus("ready");
    if (importInputRef.current) importInputRef.current.value = "";
  }

  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Lock className="h-4 w-4" />
        민감 메모
        {saving && <RefreshCw className="ml-auto h-3 w-3 animate-spin text-slate-400" />}
      </h3>
      <p className="text-sm leading-6 text-slate-500">
        연봉 협상, 처우 조건, 내부자에게 들은 내용, 소개자 정보처럼 공개 목록에 섞이면 곤란한 내용을 따로 남겨두세요.
      </p>

      <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
        <Input
          aria-label="민감 메모 제목"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="제목 예: 연봉 협상 메모"
          value={title}
        />
        <Textarea
          aria-label="민감 메모 내용"
          onChange={(event) => setContent(event.target.value)}
          placeholder="내용을 입력하세요. 예: 희망 연봉, 협상 포인트, 확인해야 할 민감한 조건"
          rows={4}
          value={content}
        />
        <div className="flex justify-end">
          <Button disabled={!content.trim() || saving || keyStatus !== "ready"} onClick={() => void addPrivateNote()} size="sm">
            {keyStatus === "loading" ? "암호화 준비 중" : saving ? "저장 중" : "저장"}
          </Button>
        </div>
        {keyStatus === "error" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span>암호화 키를 준비하지 못했습니다. 다시 시도해 주세요.</span>
            <Button onClick={() => void retryLoadKey()} size="sm" variant="secondary">
              다시 시도
            </Button>
          </div>
        ) : null}
        {feedback ? (
          <p
            className={
              feedback.tone === "success"
                ? "text-xs font-medium text-emerald-700"
                : "text-xs font-medium text-red-600"
            }
          >
            {feedback.message}
          </p>
        ) : null}
      </div>

      {notes.length > 0 ? (
        <div className="space-y-2">
          {notes.map((note) => (
            <PrivateSensitiveNoteItem
              encKey={encKey}
              key={note.id}
              note={note}
              onRemove={removePrivateNote}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400">
          저장된 민감 메모가 없습니다.
        </p>
      )}

      <details className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        <summary className="cursor-pointer font-medium text-slate-600">
          고급 복구 옵션
        </summary>
        <p className="mt-2 leading-5">
          다른 브라우저나 기기에서 기존 민감 메모가 열리지 않을 때만 사용하세요.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={handleDownload} size="sm" variant="secondary">
            <Download className="mr-1 h-3 w-3" />
            복구 키 내보내기
          </Button>
          <Button
            onClick={() => importInputRef.current?.click()}
            size="sm"
            variant="secondary"
          >
            <Upload className="mr-1 h-3 w-3" />
            복구 키 가져오기
          </Button>
          <input
            accept=".txt"
            className="hidden"
            onChange={(event) => void handleImport(event)}
            ref={importInputRef}
            type="file"
          />
        </div>
      </details>
    </section>
  );
}

function formatShortDate(value: string) {
  if (!value) return "미기록";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1].slice(2)}.${match[2]}.${match[3]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const year = String(date.getFullYear()).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function PrivateSensitiveNoteItem({
  note,
  encKey,
  onRemove,
}: {
  note: { id: string; title: string; content: string; createdAt: string };
  encKey: CryptoKey | null;
  onRemove: (id: string) => void;
}) {
  const [plaintext, setPlaintext] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    if (!encKey) return () => {
      canceled = true;
    };
    decryptNote(encKey, note.content).then((value) => {
      if (!canceled) setPlaintext(value);
    });
    return () => {
      canceled = true;
    };
  }, [encKey, note.content]);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-slate-800">
            {note.title}
          </h4>
          <p className="mt-0.5 text-xs text-slate-400">
            {formatShortDate(note.createdAt)}
          </p>
        </div>
        <Button onClick={() => onRemove(note.id)} size="sm" variant="ghost">
          <Trash2 className="h-3.5 w-3.5" />
          삭제
        </Button>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
        {plaintext ?? <span className="animate-pulse text-slate-400">불러오는 중...</span>}
      </p>
    </div>
  );
}

function InterviewNoteItem({
  note,
  encKey,
  onRemove,
}: {
  note: { id: string; title: string; content: string; createdAt: string };
  encKey: CryptoKey | null;
  onRemove: (id: string) => void;
}) {
  const [plaintext, setPlaintext] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    const text = encKey
      ? decryptNote(encKey, note.content)
      : Promise.resolve(note.content);
    text.then((value) => {
      if (!canceled) setPlaintext(value);
    });
    return () => {
      canceled = true;
    };
  }, [encKey, note.content]);

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{note.title}</span>
        <div className="flex items-center gap-2">
          <span>{note.createdAt}</span>
          <button
            aria-label="메모 삭제"
            className="text-slate-400 hover:text-red-600"
            onClick={() => onRemove(note.id)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-700">
        {plaintext ?? <span className="animate-pulse text-slate-400">복호화 중…</span>}
      </p>
    </div>
  );
}

const PREP_CATEGORY_LABELS: Record<PrepCategory, string> = {
  behavioral: "행동 기반",
  technical: "기술",
  culture: "컬처핏",
  situational: "상황 판단",
};

const PREP_CATEGORY_OPTIONS: PrepCategory[] = [
  "behavioral",
  "technical",
  "culture",
  "situational",
];

function PrepQuestionSection({
  company,
  encKey,
  settings,
  onPatch,
}: {
  company: Company;
  encKey: CryptoKey | null;
  settings?: CriteriaSettings;
  onPatch: (companyId: string, patch: Partial<Company>) => void;
}) {
  const [category, setCategory] = useState<PrepCategory>("behavioral");
  const [question, setQuestion] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState("");

  async function generateAiQuestions() {
    setGenLoading(true);
    setGenError("");
    let accessToken: string | undefined;
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token;
      }
    } catch { /* non-fatal */ }

    try {
      const res = await fetch("/api/gen-prep-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          companyName: company.name,
          industry: company.industry,
          productDescription: company.productDescription,
          candidateReason: company.candidateReason,
          greenFlags: company.signals.greenFlags.map((s) => s.label),
          redFlags: company.signals.redFlags.map((s) => s.label),
          userRole: settings?.userRole,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; questions: { category: string; question: string }[] }
        | { error: { code?: string; message: string } };

      if (!("ok" in data) || !data.ok) {
        const msg = getApiErrorMessage(res, data, "AI 질문 생성에 실패했습니다.");
        setGenError(msg);
        return;
      }

      const validCategories: PrepCategory[] = ["behavioral", "technical", "culture", "situational"];
      const newQuestions = data.questions
        .filter((q): q is { category: PrepCategory; question: string } =>
          validCategories.includes(q.category as PrepCategory),
        )
        .map((q) => ({
          id: createId("prep"),
          category: q.category,
          question: q.question,
          answer: "",
          createdAt: today(),
        }));

      onPatch(company.id, {
        prepQuestions: [...newQuestions, ...(company.prepQuestions ?? [])],
      });
    } catch {
      setGenError("AI 질문 생성 요청에 실패했습니다.");
    } finally {
      setGenLoading(false);
    }
  }

  async function addQuestion() {
    if (!question.trim()) return;
    const answer = encKey ? await encryptNote(encKey, "") : "";
    onPatch(company.id, {
      prepQuestions: [
        {
          id: createId("prep"),
          category,
          question,
          answer,
          createdAt: today(),
        },
        ...(company.prepQuestions ?? []),
      ],
    });
    setQuestion("");
  }

  function removeQuestion(id: string) {
    onPatch(company.id, {
      prepQuestions: (company.prepQuestions ?? []).filter((q) => q.id !== id),
    });
  }

  async function patchAnswer(id: string, text: string) {
    const answer = encKey ? await encryptNote(encKey, text) : text;
    onPatch(company.id, {
      prepQuestions: (company.prepQuestions ?? []).map((q) =>
        q.id === id ? { ...q, answer } : q,
      ),
    });
  }

  const grouped = PREP_CATEGORY_OPTIONS.map((cat) => ({
    cat,
    items: (company.prepQuestions ?? []).filter((q) => q.category === cat),
  })).filter((g) => g.items.length > 0);

  const total = (company.prepQuestions ?? []).length;
  const answered = encKey
    ? null
    : (company.prepQuestions ?? []).filter((q) => Boolean(q.answer.trim())).length;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpenText className="h-4 w-4" />
          면접 준비 Q&A
          <Lock aria-label="암호화 저장" className="ml-1 h-3 w-3 text-slate-400" />
          {total > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${answered === total ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {answered !== null ? `${answered}/${total}` : total}
            </span>
          )}
        </h3>
        <Button
          disabled={genLoading}
          onClick={() => void generateAiQuestions()}
          size="sm"
          variant="secondary"
        >
          {genLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {genLoading ? "생성 중..." : "AI 질문 생성"}
        </Button>
      </div>
      {genError ? <p className="text-xs text-red-600">{genError}</p> : null}
      <div className="flex gap-2">
        <Select
          aria-label="카테고리"
          className="w-32 shrink-0"
          onChange={(e) => setCategory(e.target.value as PrepCategory)}
          value={category}
        >
          {PREP_CATEGORY_OPTIONS.map((cat) => (
            <option key={cat} value={cat}>
              {PREP_CATEGORY_LABELS[cat]}
            </option>
          ))}
        </Select>
        <Input
          aria-label="예상 질문"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addQuestion();
          }}
          placeholder="예상 질문 입력"
          value={question}
        />
        <Button onClick={() => void addQuestion()} size="sm">
          추가
        </Button>
      </div>

      {grouped.length === 0 ? (
        <p className="text-xs text-slate-400">아직 준비된 질문이 없습니다.</p>
      ) : (
        grouped.map(({ cat, items }) => (
          <div key={cat}>
            <div className="mb-1 text-xs font-semibold text-slate-500">
              {PREP_CATEGORY_LABELS[cat]}
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <PrepQuestionCard
                  encKey={encKey}
                  isOpen={activeId === item.id}
                  item={item}
                  key={item.id}
                  onAnswerChange={(text) => void patchAnswer(item.id, text)}
                  onRemove={() => removeQuestion(item.id)}
                  onToggle={() =>
                    setActiveId(activeId === item.id ? null : item.id)
                  }
                />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function PrepQuestionCard({
  item,
  encKey,
  isOpen,
  onToggle,
  onRemove,
  onAnswerChange,
}: {
  item: PrepQuestion;
  encKey: CryptoKey | null;
  isOpen: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onAnswerChange: (text: string) => void;
}) {
  const [decrypted, setDecrypted] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let canceled = false;
    const text = encKey
      ? decryptNote(encKey, item.answer)
      : Promise.resolve(item.answer);
    text.then((value) => {
      if (!canceled) setDecrypted(value);
    });
    return () => {
      canceled = true;
    };
  }, [isOpen, encKey, item.answer]);

  return (
    <div className="rounded-md border border-slate-200">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          className="flex-1 text-left text-sm font-medium text-slate-800 hover:text-slate-950"
          onClick={onToggle}
          type="button"
        >
          {item.question}
        </button>
        <button
          aria-label="질문 삭제"
          className="ml-2 text-slate-400 hover:text-red-600"
          onClick={onRemove}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {isOpen ? (
        <div className="border-t border-slate-100 p-3">
          <Textarea
            aria-label="답변"
            onChange={(e) => {
              setDecrypted(e.target.value);
              onAnswerChange(e.target.value);
            }}
            placeholder="답변 준비 (STAR 형식 권장: Situation / Task / Action / Result)"
            rows={5}
            value={decrypted}
          />
        </div>
      ) : null}
    </div>
  );
}

type EmailType = "apply" | "followup" | "thank_you";

const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  apply: "지원 이메일",
  followup: "후속 문의",
  thank_you: "면접 감사",
};

function DraftEmailSection({ company }: { company: Company }) {
  const [emailType, setEmailType] = useState<EmailType>("apply");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setDraft("");
    try {
      const supabase = getSupabaseClient();
      const token = supabase
        ? (await supabase.auth.getSession()).data.session?.access_token
        : undefined;

      const signalsSummary = [
        ...company.signals.greenFlags.map((s) => `✓ ${s.reason ?? s.description}`),
        ...company.signals.redFlags.map((s) => `✗ ${s.reason ?? s.description}`),
      ]
        .slice(0, 6)
        .join(", ");

      const res = await fetch("/api/draft-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          emailType,
          companyName: company.name,
          jobTitle: company.industry,
          productDescription: company.productDescription,
          candidateReason: company.candidateReason,
          signalsSummary,
        }),
      });

      const json = (await res.json()) as { draft?: string; error?: { code?: string; message: string } };
      if (!res.ok || !json.draft) {
        setDraft(`오류: ${getApiErrorMessage(res, json, "초안 생성 실패")}`);
      } else {
        setDraft(json.draft);
      }
    } catch {
      setDraft("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Mail className="h-4 w-4" />
        AI 이메일 초안
      </h3>
      <div className="flex gap-2">
        <Select
          aria-label="이메일 유형"
          className="w-36 shrink-0"
          onChange={(e) => setEmailType(e.target.value as EmailType)}
          value={emailType}
        >
          {(Object.keys(EMAIL_TYPE_LABELS) as EmailType[]).map((t) => (
            <option key={t} value={t}>
              {EMAIL_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Button disabled={loading} onClick={() => void generate()} size="sm">
          {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
          {loading ? "생성 중…" : "초안 생성"}
        </Button>
      </div>
      {draft ? (
        <div className="relative">
          <Textarea
            aria-label="이메일 초안"
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            value={draft}
          />
          <button
            aria-label="클립보드 복사"
            className="absolute right-2 top-2 rounded-md bg-white p-1.5 text-slate-500 shadow-sm hover:text-slate-900"
            onClick={() => void copyToClipboard()}
            type="button"
          >
            <Copy className="h-4 w-4" />
            {copied ? (
              <span className="ml-1 text-xs text-emerald-600">복사됨</span>
            ) : null}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function StatusHistorySection({ statusHistory }: { statusHistory: StatusHistoryEntry[] }) {
  if (statusHistory.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">상태 변경 이력</h3>
      <ol className="relative border-l border-slate-200 pl-4 text-xs text-slate-600">
        {statusHistory.map((entry, i) => (
          <li className="mb-3 last:mb-0" key={i}>
            <div className="absolute -left-1.5 mt-0.5 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
            <time className="text-slate-400">{entry.date}</time>
            <p className="mt-0.5 font-medium text-slate-800">
              {STATUS_LABELS[entry.status]}
            </p>
            {entry.note ? <p className="text-slate-500">{entry.note}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function CompanySummarySection({
  company,
  userId: _userId,
}: {
  company: Company;
  userId: string;
}) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateSummary() {
    setLoading(true);
    setError("");

    let accessToken: string | undefined;
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token;
      }
    } catch { /* non-fatal */ }

    if (!accessToken) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/summarize-company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          companyName: company.name,
          industry: company.industry,
          productDescription: company.productDescription,
          candidateReason: company.candidateReason,
          applicationPriority: company.applicationPriority,
          status: company.status,
          greenFlags: company.signals.greenFlags.map((s) => s.label),
          redFlags: company.signals.redFlags.map((s) => s.label),
          riskFlags: company.riskFlags,
          researchLogs: company.researchLogs.map((l) => ({
            source: l.source,
            positiveSignals: l.positiveSignals,
            negativeSignals: l.negativeSignals,
          })),
        }),
      });

      const data = (await res.json()) as
        | { ok: true; summary: string }
        | { error: { code?: string; message: string } };

      if (!("ok" in data) || !data.ok) {
        const msg = getApiErrorMessage(res, data, "AI 요약 생성에 실패했습니다.");
        setError(msg);
        return;
      }

      setSummary(data.summary);
    } catch {
      setError("AI 요약 생성 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-sky-500" />
          AI 회사 요약
        </h3>
        <Button
          disabled={loading}
          onClick={() => void generateSummary()}
          size="sm"
          variant="secondary"
        >
          {summary ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {loading ? "생성 중..." : summary ? "재생성" : "AI 요약 생성"}
        </Button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {!summary && !loading && !error ? (
        <p className="text-xs text-slate-400">
          회사 정보와 내가 적은 메모를 바탕으로 AI가 요약을 작성합니다.
        </p>
      ) : null}
      {summary ? (
        <div className="space-y-2 rounded-md border border-sky-100 bg-sky-50 p-3">
          {summary.split("\n\n").map((para, i) => (
            <p className="text-sm leading-relaxed text-slate-700" key={i}>
              {para}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
