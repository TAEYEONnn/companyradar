"use client";

import { CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Inbox, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  DISCOVERY_REASON_LABELS,
  DISCOVERY_REASON_OPTIONS,
} from "@/lib/criteria";
import { getSupabaseClient } from "@/lib/supabase-client";
import type { CandidateInboxItem, Company, DiscoveryReason } from "@/lib/types";

interface CandidateDraft {
  unifiedInput: string;
  companyName: string;
  jobTitle: string;
  discoveryReason: DiscoveryReason;
  firstImpressionNote: string;
}

interface AiCredit {
  freeUsesRemaining: number;
  unlimited: boolean;
}

interface CandidateInboxPanelProps {
  candidates: CandidateInboxItem[];
  companies: Company[];
  aiCredit?: AiCredit | null;
  onBack: () => void;
  onCreate: (draft: { sourceUrl: string; rawText: string; companyName: string; jobTitle: string; discoveryReason: DiscoveryReason; firstImpressionNote: string }) => CandidateInboxItem | undefined;
  onDelete: (candidateId: string) => void;
  onPatch: (id: string, patch: Partial<CandidateInboxItem>) => void;
  onParseSuccess?: () => void;
  onPromote: (candidate: CandidateInboxItem) => void;
  onSelectCompany?: (id: string) => void;
}

const PARSE_STATUS_LABELS: Record<CandidateInboxItem["parseStatus"], string> = {
  idle: "대기",
  fetching: "수집 중",
  parsed: "파싱 완료",
  partial: "부분 파싱",
  failed: "실패",
  needs_manual_input: "직접 입력 필요",
};

const EMPTY_DRAFT: CandidateDraft = {
  unifiedInput: "",
  companyName: "",
  jobTitle: "",
  discoveryReason: "manual",
  firstImpressionNote: "",
};

export function CandidateInboxPanel({
  candidates,
  companies,
  aiCredit,
  onBack,
  onCreate,
  onDelete,
  onPatch,
  onParseSuccess,
  onPromote,
  onSelectCompany,
}: CandidateInboxPanelProps) {
  const [draft, setDraft] = useState<CandidateDraft>(EMPTY_DRAFT);
  const [showExtra, setShowExtra] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [parsingId, setParsingId] = useState<string | null>(null);
  const [parseError, setParseError] = useState<{ id: string; msg: string } | null>(null);

  function resolvedDraft() {
    const isUrl = /^https?:\/\//.test(draft.unifiedInput.trim());
    return {
      sourceUrl: isUrl ? draft.unifiedInput.trim() : "",
      rawText: isUrl ? "" : draft.unifiedInput.trim(),
      companyName: draft.companyName,
      jobTitle: draft.jobTitle,
      discoveryReason: draft.discoveryReason,
      firstImpressionNote: draft.firstImpressionNote,
    };
  }

  function submitCandidate() {
    if (!draft.unifiedInput.trim() && !draft.companyName.trim()) return;
    onCreate(resolvedDraft());
    setDraft(EMPTY_DRAFT);
  }

  async function submitAndParse() {
    if (!draft.unifiedInput.trim() && !draft.companyName.trim()) return;
    const candidate = onCreate(resolvedDraft());
    setDraft(EMPTY_DRAFT);
    if (candidate) {
      await parseCandidate(candidate);
    }
  }

  async function parseCandidate(candidate: CandidateInboxItem) {
    if (!candidate.sourceUrl && !candidate.rawText) return;
    setParsingId(candidate.id);
    setParseError(null);
    onPatch(candidate.id, { parseStatus: "fetching" });
    let accessToken: string | undefined;
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token;
      }
    } catch { /* non-fatal */ }
    try {
      const res = await fetch("/api/parse-job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          url: candidate.sourceUrl || undefined,
          rawText: candidate.rawText || undefined,
        }),
      });
      const data = (await res.json()) as
        | { ok: true; result: Partial<Company> & { name?: string; industry?: string } }
        | { error: { code?: string; message: string } };
      if (!res.ok || !("ok" in data) || !data.ok) {
        const msg = "error" in data ? data.error.message : "공고를 정리하지 못했어요.";
        setParseError({ id: candidate.id, msg });
        onPatch(candidate.id, { parseStatus: "failed" });
        return;
      }
      onPatch(candidate.id, {
        parsedCompany: data.result,
        parseStatus: data.result.name ? "parsed" : "partial",
        needsReview: true,
      });
      onParseSuccess?.();
    } catch {
      setParseError({ id: candidate.id, msg: "네트워크 오류가 발생했습니다." });
      onPatch(candidate.id, { parseStatus: "failed" });
    } finally {
      setParsingId(null);
    }
  }

  const hasAiCredit = aiCredit ? (aiCredit.unlimited || aiCredit.freeUsesRemaining > 0) : true;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold">
            <Inbox className="h-4 w-4 text-slate-500" />
            공고 정리
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            공고 URL이나 원문을 저장하고 AI로 정리해보세요.
          </p>
          {aiCredit && !aiCredit.unlimited ? (
            <p
              className={[
                "mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                aiCredit.freeUsesRemaining > 0
                  ? "bg-sky-50 text-sky-700"
                  : "bg-slate-100 text-slate-500",
              ].join(" ")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiCredit.freeUsesRemaining > 0
                ? `무료 AI 분석 ${aiCredit.freeUsesRemaining}회 남음`
                : "무료 분석 소진 · 추후 추가 예정"}
            </p>
          ) : null}
        </div>
        <Button onClick={onBack} variant="secondary">
          대시보드
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-3 rounded-md border border-slate-200 p-3">
          <Textarea
            className="min-h-36 text-sm"
            onChange={(event) =>
              setDraft((current) => ({ ...current, unifiedInput: event.target.value }))
            }
            placeholder="공고 URL 또는 원문을 붙여넣으세요"
            value={draft.unifiedInput}
          />

          <button
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
            onClick={() => setShowExtra((v) => !v)}
            type="button"
          >
            {showExtra ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            추가 정보 입력
          </button>

          {showExtra ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="회사명">
                  <Input
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, companyName: event.target.value }))
                    }
                    placeholder="예: 토스"
                    value={draft.companyName}
                  />
                </Field>
                <Field label="직무명">
                  <Input
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, jobTitle: event.target.value }))
                    }
                    placeholder="예: 프로덕트 디자이너"
                    value={draft.jobTitle}
                  />
                </Field>
              </div>
              <Field label="발견 이유">
                <Select
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      discoveryReason: event.target.value as DiscoveryReason,
                    }))
                  }
                  value={draft.discoveryReason}
                >
                  {DISCOVERY_REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="첫인상 메모">
                <Textarea
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      firstImpressionNote: event.target.value,
                    }))
                  }
                  placeholder="왜 저장했는지, 지금 확인할 포인트"
                  value={draft.firstImpressionNote}
                />
              </Field>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Button disabled={!hasAiCredit} onClick={() => void submitAndParse()}>
              <Sparkles className="h-4 w-4" />
              AI로 정리하기
            </Button>
            <button
              className="text-center text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
              onClick={submitCandidate}
              type="button"
            >
              저장만 하기
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {candidates.map((candidate) => {
            const displayName =
              candidate.companyName ||
              candidate.parsedCompany?.name ||
              null;
            const isParsing = parsingId === candidate.id;
            const canParse =
              !isParsing &&
              !candidate.promotedCompanyId &&
              (Boolean(candidate.sourceUrl) || Boolean(candidate.rawText)) &&
              hasAiCredit;
            return (
              <article className="rounded-md border border-slate-200 p-3" key={candidate.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={candidate.needsReview ? "amber" : "green"}>
                        {candidate.needsReview ? "확인 필요" : "추가됨"}
                      </Badge>
                      <Badge tone="slate">
                        {PARSE_STATUS_LABELS[candidate.parseStatus]}
                      </Badge>
                      <span className="text-sm font-semibold">
                        {DISCOVERY_REASON_LABELS[candidate.discoveryReason]}
                      </span>
                    </div>
                    {displayName ? (
                      <p className="mt-1.5 text-sm font-semibold text-slate-800">
                        {displayName}
                        {candidate.jobTitle ? (
                          <span className="ml-1.5 text-xs font-normal text-slate-500">
                            · {candidate.jobTitle}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    {candidate.sourceUrl ? (
                      <a
                        className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline"
                        href={candidate.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        후보 링크 <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      aria-label="AI로 공고 분석"
                      disabled={!canParse}
                      onClick={() => void parseCandidate(candidate)}
                      size="sm"
                      variant="secondary"
                    >
                      {isParsing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {isParsing
                        ? "분석 중"
                        : !hasAiCredit && !candidate.promotedCompanyId
                          ? "AI 분석 완료"
                          : aiCredit && !aiCredit.unlimited && aiCredit.freeUsesRemaining > 0
                            ? `AI 분석 · 무료 ${aiCredit.freeUsesRemaining}회`
                            : "AI 분석"}
                    </Button>
                    <Button
                      aria-label="회사 목록에 추가"
                      disabled={Boolean(candidate.promotedCompanyId)}
                      onClick={() => onPromote(candidate)}
                      size="icon"
                      variant="ghost"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label="후보 삭제"
                      onClick={() => setPendingDeleteId(candidate.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {parseError?.id === candidate.id ? (
                  <p className="mt-2 text-xs text-red-600">{parseError.msg}</p>
                ) : null}

                {(candidate.parseStatus === "parsed" || candidate.parseStatus === "partial") &&
                !candidate.promotedCompanyId ? (
                  <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs leading-5 text-amber-700">
                    AI 초안 · 회사명·마감일을 확인하세요.
                  </p>
                ) : null}
                {candidate.parsedCompany?.name && !candidate.companyName ? (
                  <p className="mt-2 text-xs text-slate-500">
                    AI 추출: <span className="font-medium text-slate-700">{candidate.parsedCompany.name}</span>
                    {candidate.parsedCompany.industry ? ` · ${candidate.parsedCompany.industry}` : ""}
                  </p>
                ) : null}

                {candidate.firstImpressionNote ? (
                  <p className="mt-2 text-sm text-slate-700">
                    {candidate.firstImpressionNote}
                  </p>
                ) : null}
                {candidate.rawText ? (
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-slate-500">
                    {candidate.rawText}
                  </p>
                ) : null}
                {candidate.promotedCompanyId ? (
                  <p className="mt-2 text-xs text-emerald-700">
                    회사 목록에 추가됨:{" "}
                    {onSelectCompany ? (
                      <button
                        className="font-medium underline hover:text-emerald-900"
                        onClick={() => onSelectCompany(candidate.promotedCompanyId!)}
                        type="button"
                      >
                        {companies.find((c) => c.id === candidate.promotedCompanyId)?.name ?? candidate.promotedCompanyId}
                      </button>
                    ) : (
                      (companies.find((c) => c.id === candidate.promotedCompanyId)?.name ?? candidate.promotedCompanyId)
                    )}
                  </p>
                ) : null}
              </article>
            );
          })}

          {candidates.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 text-sm text-slate-500">
              <p>공고를 붙여넣으면 AI가 초안을 정리해요.</p>
            </div>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        description="이 작업은 되돌릴 수 없습니다."
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) onDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        open={pendingDeleteId !== null}
        title="후보를 삭제할까요?"
      />
    </section>
  );
}
