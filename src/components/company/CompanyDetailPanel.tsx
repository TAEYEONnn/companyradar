"use client";

import {
  AlertTriangle,
  BookOpenText,
  CalendarClock,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Flag,
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
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { getApiErrorMessage } from "@/lib/api-error";
import { getCompanyValidationReasons, getValidationCompletePatch } from "@/lib/company-validation";
import {
  COMPANY_SIZE_LABELS,
  DESIGNER_FIT_LABELS,
  DISCOVERY_REASON_LABELS,
  EVIDENCE_LEVEL_LABELS,
  EVIDENCE_LEVEL_OPTIONS,
  INTERVIEW_ROUND_TYPE_LABELS,
  INTERVIEW_ROUND_TYPE_OPTIONS,
  JOB_STATUS_LABELS,
  PRIORITY_LABELS,
  ROUND_RESULT_LABELS,
  ROUND_RESULT_OPTIONS,
  STATUS_LABELS,
} from "@/lib/criteria";
import { formatScore } from "@/lib/scoring";
import type {
  Company,
  CompanyScoreResult,
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
  getKeyFingerprint,
  importAndSaveEncryptionKey,
} from "@/lib/crypto";
import { getSupabaseClient } from "@/lib/supabase-client";
import { createId, today } from "@/lib/utils";
import { InfoRow, Metric, STATUS_TONE } from "./shared";

interface CompanyDetailPanelProps {
  company: Company;
  score: CompanyScoreResult;
  userId: string;
  onBack?: () => void;
  onDelete: (companyId: string) => void;
  onEdit: (company: Company) => void;
  onPatch: (companyId: string, patch: Partial<Company>) => void;
}

export function CompanyDetailPanel({
  company,
  score,
  userId,
  onBack,
  onDelete,
  onEdit,
  onPatch,
}: CompanyDetailPanelProps) {
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
        setAiResearchError(getApiErrorMessage(res, data, "AI 리서치 생성에 실패했습니다."));
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
      setAiResearchError("AI 리서치 요청에 실패했습니다.");
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

  return (
    <aside className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div className="min-w-0 flex-1">
          {onBack ? (
            <button
              className="mb-2 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 xl:hidden"
              onClick={onBack}
              type="button"
            >
              ← 목록으로
            </button>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{company.name}</h2>
            {score.highRisk ? (
              <Badge tone="red">
                <AlertTriangle className="mr-1 h-3 w-3" />
                리스크 높음
              </Badge>
            ) : null}
            {score.needsValidation ? <Badge tone="amber">검증 필요</Badge> : null}
            {company.isSampleData ? <Badge tone="blue">Sample</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">{company.industry}</p>
          {validationReasons.length > 0 && (
            <>
              <div className="mt-2 flex flex-wrap gap-1">
                {validationReasons.map((reason) => (
                  <Badge key={reason} tone="amber">
                    {reason}
                  </Badge>
                ))}
              </div>
              <div className="mt-2">
                <Button
                  onClick={() => onPatch(company.id, getValidationCompletePatch(today()))}
                  size="sm"
                  variant="secondary"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  검증 완료
                </Button>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-1">
          <Button aria-label="수정" onClick={() => onEdit(company)} size="icon" variant="ghost">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            aria-label="인쇄/PDF"
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

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <section className="grid grid-cols-3 gap-2">
          <Metric label="회사핏" value={formatScore(score.companyFitScore)} />
          <Metric label="우선순위" value={PRIORITY_LABELS[company.applicationPriority]} />
          <Metric label="근거" value={`Lv.${Math.round(score.averageEvidenceLevel)}`} />
        </section>
        <section className="grid grid-cols-3 gap-2">
          <Metric
            label="리스크"
            tone={score.highRisk ? "red" : "slate"}
            value={`${score.riskCount}개`}
          />
          <Metric label="공고 상태" value={JOB_STATUS_LABELS[company.jobStatus]} />
          <Metric label="관심도" value={`${company.interestLevel}/5`} />
        </section>

        <NextActionBanner company={company} />

        <section className="space-y-2">
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
            label="발견 이유"
            value={`${DISCOVERY_REASON_LABELS[company.discoveryReason]} · ${company.firstImpressionNote || "첫인상 메모 없음"}`}
          />
          <InfoRow
            label="공고 상태"
            value={`${JOB_STATUS_LABELS[company.jobStatus]} · ${company.jobDeadline || "마감 미확인"}`}
          />
          <InfoRow
            label="근거 수준"
            value={`${EVIDENCE_LEVEL_LABELS[company.evidenceLevel]} · ${company.needsRefresh ? "재검증 필요" : "최신"}`}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <DateStampButton
              label="확인"
              onStamp={() => onPatch(company.id, { lastCheckedAt: today() })}
              value={company.lastCheckedAt}
            />
            <DateStampButton
              label="리서치"
              onStamp={() => onPatch(company.id, { lastResearchedAt: today() })}
              value={company.lastResearchedAt}
            />
            <DateStampButton
              label="검증"
              onStamp={() =>
                onPatch(company.id, getValidationCompletePatch(today()))
              }
              value={company.lastVerifiedAt}
            />
          </div>
          <InfoRow label="제품" value={company.productDescription} />
          <InfoRow label="성장 정보" value={company.growthInfo} />
          <InfoRow label="후보 이유" value={company.candidateReason || "없음"} />
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

        <CompanySummarySection company={company} userId={userId} />

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">평가 점수</h3>
          {score.categoryScores.map((category) => (
            <div className="space-y-1" key={category.key}>
              <div className="flex justify-between text-sm">
                <span>{category.title}</span>
                <span className="font-semibold">{formatScore(category.average)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-slate-900"
                  style={{ width: `${(category.average / 5) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">디자이너 적합도</h3>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(DESIGNER_FIT_LABELS).map(([key, label]) => (
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

        <section className="space-y-2">
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

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">경고 신호</h3>
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
            <p className="text-sm text-slate-500">체크된 경고 신호가 없습니다.</p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4" />
            구조화 신호
          </h3>
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <Select
              aria-label="신호 유형"
              onChange={(event) =>
                setSignalKind(event.target.value as keyof Company["signals"])
              }
              value={signalKind}
            >
              <option value="greenFlags">Green flag</option>
              <option value="redFlags">Red flag</option>
              <option value="unknowns">Unknown</option>
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
              신호 추가
            </Button>
          </div>
          <SignalGroup
            kind="greenFlags"
            onRemove={removeSignal}
            signals={company.signals.greenFlags}
            title="Green flags"
            tone="green"
          />
          <SignalGroup
            kind="redFlags"
            onRemove={removeSignal}
            signals={company.signals.redFlags}
            title="Red flags"
            tone="red"
          />
          <SignalGroup
            kind="unknowns"
            onRemove={removeSignal}
            signals={company.signals.unknowns}
            title="Unknowns"
            tone="amber"
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <BookOpenText className="h-4 w-4" />
              리서치 로그
            </h3>
            <Button
              disabled={aiResearchLoading}
              onClick={() => void generateAiResearchLog()}
              size="sm"
              variant="secondary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiResearchLoading ? "분석 중..." : "AI 리서치"}
            </Button>
          </div>
          {aiResearchError && (
            <p className="text-xs text-red-600">{aiResearchError}</p>
          )}
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <Input
              aria-label="리서치 출처"
              onChange={(event) =>
                setLogDraft((draft) => ({ ...draft, source: event.target.value }))
              }
              placeholder="출처 (예: 블라인드, 잡플래닛, 기사)"
              value={logDraft.source}
            />
            <Input
              aria-label="리서치 링크"
              onChange={(event) =>
                setLogDraft((draft) => ({ ...draft, link: event.target.value }))
              }
              placeholder="링크 URL"
              value={logDraft.link}
            />
            <Textarea
              aria-label="긍정 신호"
              className="min-h-16"
              onChange={(event) =>
                setLogDraft((draft) => ({
                  ...draft,
                  positiveSignals: event.target.value,
                }))
              }
              placeholder="긍정 신호"
              value={logDraft.positiveSignals}
            />
            <Textarea
              aria-label="부정 신호"
              className="min-h-16"
              onChange={(event) =>
                setLogDraft((draft) => ({
                  ...draft,
                  negativeSignals: event.target.value,
                }))
              }
              placeholder="부정 신호"
              value={logDraft.negativeSignals}
            />
            <Textarea
              aria-label="추가 확인 질문"
              className="min-h-16"
              onChange={(event) =>
                setLogDraft((draft) => ({ ...draft, questions: event.target.value }))
              }
              placeholder="면접/커피챗에서 확인할 질문"
              value={logDraft.questions}
            />
            <Button onClick={addResearchLog} size="sm">
              <Plus className="h-4 w-4" />
              로그 추가
            </Button>
          </div>
          {company.researchLogs.map((log) => (
            <div className="rounded-md border border-slate-200 p-3" key={log.id}>
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{log.source}</strong>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{log.createdAt}</span>
                  <button
                    aria-label="리서치 로그 삭제"
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
                <p className="mt-2 text-sm text-emerald-700">+ {log.positiveSignals}</p>
              ) : null}
              {log.negativeSignals ? (
                <p className="mt-1 text-sm text-red-700">- {log.negativeSignals}</p>
              ) : null}
              {log.questions ? (
                <p className="mt-1 text-sm text-slate-700">? {log.questions}</p>
              ) : null}
            </div>
          ))}
          {company.researchLogs.length === 0 ? (
            <p className="text-sm text-slate-400">기록 없음</p>
          ) : null}
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4" />
            면접 라운드
          </h3>
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
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
                <p className="mt-2 text-sm text-slate-700">{round.memo}</p>
              ) : null}
            </div>
          ))}
        </section>

        <section className="space-y-3">
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
                        ? { ...item, completed: event.target.checked }
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

        <EncryptedNoteSection
          company={company}
          onPatch={onPatch}
          userId={userId}
        />

        <section className="space-y-3">
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
          onPatch={onPatch}
        />

        <DraftEmailSection company={company} />
      </div>
    </aside>
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
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <Badge tone={tone}>{signals.length}</Badge>
      </div>
      <div className="space-y-2">
        {signals.map((signal) => (
          <div className="rounded-md bg-slate-50 p-2" key={signal.id}>
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm">{signal.label}</strong>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Lv.{signal.confidence}</span>
                <button
                  aria-label="신호 삭제"
                  className="text-slate-400 hover:text-red-600"
                  onClick={() => onRemove(kind, signal.id)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm text-slate-700">
              {signal.reason ?? signal.description}
            </p>
            {signal.evidenceText ? (
              <blockquote className="mt-1 border-l-2 border-slate-300 pl-2 text-xs italic text-slate-500">
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
          <p className="text-sm text-slate-400">기록 없음</p>
        ) : null}
      </div>
    </div>
  );
}

// "다음 액션" summary banner — shown when applied/interviewing
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
        <span>
          <strong>후속조치 없음</strong> — {STATUS_LABELS[company.status]} 상태인데 팔로업 태스크가 없습니다.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span>
        <strong>다음 액션:</strong> {next.title}
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
  const [decrypted, setDecrypted] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [saving, setSaving] = useState(false);
  const keyRef = useRef<CryptoKey | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getEncryptionKey(userId).then(async (key) => {
      if (cancelled) return;
      keyRef.current = key;
      const plain = await decryptNote(key, company.privateSensitiveNote);
      const fp = await getKeyFingerprint(key);
      if (!cancelled) {
        setDecrypted(plain);
        setFingerprint(fp);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, company.privateSensitiveNote]);

  const handleChange = useCallback(
    async (text: string) => {
      setDecrypted(text);
      if (!keyRef.current) return;
      setSaving(true);
      const ct = await encryptNote(keyRef.current, text);
      onPatch(company.id, { privateSensitiveNote: ct });
      setSaving(false);
    },
    [company.id, onPatch],
  );

  async function handleDownload() {
    if (!keyRef.current) return;
    const b64 = await exportEncryptionKey(keyRef.current);
    const blob = new Blob([b64], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enc-key-${fingerprint}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    const b64 = (await file.text()).trim();
    const key = await importAndSaveEncryptionKey(userId, b64);
    keyRef.current = key;
    const plain = await decryptNote(key, company.privateSensitiveNote);
    const fp = await getKeyFingerprint(key);
    setDecrypted(plain);
    setFingerprint(fp);
    if (importInputRef.current) importInputRef.current.value = "";
  }

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Lock className="h-4 w-4" />
        민감 메모
        <span className="ml-auto flex items-center gap-1 font-mono text-xs font-normal text-slate-400">
          키 지문: {fingerprint || "…"}
          {saving && <RefreshCw className="h-3 w-3 animate-spin" />}
        </span>
      </h3>
      <p className="text-xs text-slate-500">
        AES-GCM 256-bit 암호화 — 이 기기의 브라우저 localStorage에만 키가 저장됩니다.
      </p>
      <Textarea
        aria-label="민감 메모 (암호화 저장)"
        onChange={(e) => void handleChange(e.target.value)}
        placeholder="연봉/처우 협상 내용, 내부자 정보, 인맥 연결 등 민감한 메모"
        rows={4}
        value={decrypted}
      />
      <div className="flex gap-2">
        <Button onClick={handleDownload} size="sm" variant="secondary">
          <Download className="mr-1 h-3 w-3" />
          키 백업
        </Button>
        <Button
          onClick={() => importInputRef.current?.click()}
          size="sm"
          variant="secondary"
        >
          <Upload className="mr-1 h-3 w-3" />
          키 가져오기
        </Button>
        <input
          accept=".txt"
          className="hidden"
          onChange={(e) => void handleImport(e)}
          ref={importInputRef}
          type="file"
        />
      </div>
    </section>
  );
}

// Quick date-stamp button: shows last value and a refresh icon
function DateStampButton({
  label,
  value,
  onStamp,
}: {
  label: string;
  value: string;
  onStamp: () => void;
}) {
  return (
    <button
      className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:border-slate-400 hover:bg-white transition"
      onClick={onStamp}
      title={`오늘 날짜로 갱신`}
      type="button"
    >
      <RefreshCw className="h-3 w-3 text-slate-400" />
      {label}
      <span className="text-slate-400">{value || "미기록"}</span>
    </button>
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
  onPatch,
}: {
  company: Company;
  encKey: CryptoKey | null;
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
          <Sparkles className="h-3.5 w-3.5" />
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
          회사 정보·신호·리서치 로그를 바탕으로 AI가 요약을 작성합니다.
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
