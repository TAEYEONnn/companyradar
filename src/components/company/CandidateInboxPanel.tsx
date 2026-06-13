"use client";

import { CheckCircle2, ExternalLink, Inbox, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  DISCOVERY_REASON_LABELS,
  DISCOVERY_REASON_OPTIONS,
} from "@/lib/criteria";
import type { CandidateInboxItem, Company, DiscoveryReason } from "@/lib/types";

interface CandidateDraft {
  sourceUrl: string;
  rawText: string;
  discoveryReason: DiscoveryReason;
  firstImpressionNote: string;
}

interface CandidateInboxPanelProps {
  candidates: CandidateInboxItem[];
  companies: Company[];
  onBack: () => void;
  onCreate: (draft: CandidateDraft) => void;
  onDelete: (candidateId: string) => void;
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

export function CandidateInboxPanel({
  candidates,
  companies,
  onBack,
  onCreate,
  onDelete,
  onPromote,
  onSelectCompany,
}: CandidateInboxPanelProps) {
  const [draft, setDraft] = useState<CandidateDraft>({
    sourceUrl: "",
    rawText: "",
    discoveryReason: "manual",
    firstImpressionNote: "",
  });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function submitCandidate() {
    if (!draft.sourceUrl.trim() && !draft.rawText.trim()) return;
    onCreate(draft);
    setDraft({
      sourceUrl: "",
      rawText: "",
      discoveryReason: "manual",
      firstImpressionNote: "",
    });
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
                setDraft((current) => ({
                  ...current,
                  sourceUrl: event.target.value,
                }))
              }
              placeholder="https://"
              value={draft.sourceUrl}
            />
          </Field>
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
          {candidates.map((candidate) => (
            <article className="rounded-md border border-slate-200 p-3" key={candidate.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
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
                  {candidate.sourceUrl ? (
                    <a
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline"
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

              {candidate.firstImpressionNote ? (
                <p className="mt-3 text-sm text-slate-700">
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
          ))}

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
