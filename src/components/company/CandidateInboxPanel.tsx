"use client";

import { CheckCircle2, ExternalLink, Inbox, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
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
  sourceUrl: string;
  rawText: string;
  companyName: string;
  jobTitle: string;
  discoveryReason: DiscoveryReason;
  firstImpressionNote: string;
}

interface CandidateInboxPanelProps {
  candidates: CandidateInboxItem[];
  companies: Company[];
  onBack: () => void;
  onCreate: (draft: CandidateDraft) => void;
  onDelete: (candidateId: string) => void;
  onPatch: (id: string, patch: Partial<CandidateInboxItem>) => void;
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
  sourceUrl: "",
  rawText: "",
  companyName: "",
  jobTitle: "",
  discoveryReason: "manual",
  firstImpressionNote: "",
};

export function CandidateInboxPanel({
  candidates,
  companies,
  onBack,
  onCreate,
  onDelete,
  onPatch,
  onPromote,
  onSelectCompany,
}: CandidateInboxPanelProps) {
  const [draft, setDraft] = useState<CandidateDraft>(EMPTY_DRAFT);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [parsingId, setParsingId] = useState<string | null>(null);
  const [parseError, setParseError] = useState<{ id: string; msg: string } | null>(null);

  function submitCandidate() {
    if (!draft.sourceUrl.trim() && !draft.rawText.trim() && !draft.companyName.trim()) return;
    onCreate(draft);
    setDraft(EMPTY_DRAFT);
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
        const msg = "error" in data ? data.error.message : "AI 파싱에 실패했습니다.";
        setParseError({ id: candidate.id, msg });
        onPatch(candidate.id, { parseStatus: "failed" });
        return;
      }
      onPatch(candidate.id, {
        parsedCompany: data.result,
        parseStatus: data.result.name ? "parsed" : "partial",
        needsReview: true,
      });
    } catch {
      setParseError({ id: candidate.id, msg: "네트워크 오류가 발생했습니다." });
      onPatch(candidate.id, { parseStatus: "failed" });
    } finally {
      setParsingId(null);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Inbox className="h-4 w-4" />
            Candidate Inbox
          </div>
          <h2 className="mt-1 text-lg font-semibold">검토 전 회사 후보</h2>
          <p className="mt-1 text-sm text-slate-500">
            아직 확정하지 않은 공고 URL과 원문 메모를 회사 목록과 분리해 둡니다.
          </p>
        </div>
        <Button onClick={onBack} variant="secondary">
          대시보드
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4 rounded-md border border-slate-200 p-3">
          <Field label="공고/회사 URL">
            <Input
              onChange={(event) =>
                setDraft((current) => ({ ...current, sourceUrl: event.target.value }))
              }
              placeholder="https://"
              value={draft.sourceUrl}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="회사명 (선택)">
              <Input
                onChange={(event) =>
                  setDraft((current) => ({ ...current, companyName: event.target.value }))
                }
                placeholder="예: 토스"
                value={draft.companyName}
              />
            </Field>
            <Field label="직무명 (선택)">
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
          <Field label="공고 원문/메모">
            <Textarea
              className="min-h-40"
              onChange={(event) =>
                setDraft((current) => ({ ...current, rawText: event.target.value }))
              }
              placeholder="채용공고 내용, 직무 요건, 메모 등을 자유롭게 붙여넣어 보관하세요."
              value={draft.rawText}
            />
          </Field>
          <Button onClick={submitCandidate}>
            <Plus className="h-4 w-4" />
            후보 저장
          </Button>
        </div>

        <div className="space-y-3">
          {candidates.map((candidate) => {
            const displayName =
              candidate.companyName ||
              candidate.parsedCompany?.name ||
              null;
            const isParsing = parsingId === candidate.id;
            const canParse = !isParsing && !candidate.promotedCompanyId && (Boolean(candidate.sourceUrl) || Boolean(candidate.rawText));
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
                      {isParsing ? "분석 중" : "AI 분석"}
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
              <p>아직 후보가 없습니다.</p>
              <p className="text-xs text-slate-400">공고 URL이나 메모를 위에서 추가해 보세요.</p>
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
