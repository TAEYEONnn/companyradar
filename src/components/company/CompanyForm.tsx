"use client";

import { Save, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { getSupabaseClient } from "@/lib/supabase-client";
import { ScoreSlider } from "@/components/ui/score-slider";
import {
  COMPANY_SIZE_OPTIONS,
  DISCOVERY_REASON_OPTIONS,
  EVIDENCE_LEVEL_OPTIONS,
  JOB_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  RISK_CHECKLIST,
  SCORE_CATEGORIES,
  STATUS_OPTIONS,
  DESIGNER_FIT_LABELS,
} from "@/lib/criteria";
import type {
  ApplicationPriority,
  ApplicationStatus,
  Company,
  EvidenceLevel,
  JobStatus,
  ResearchSignal,
} from "@/lib/types";
import { createId } from "@/lib/utils";

interface ParsedSignal {
  label: string;
  reason: string;
  evidenceText: string;
  confidence: 1 | 2 | 3;
}

interface ParsedJobPost {
  name?: string;
  industry?: string;
  productDescription?: string;
  jobDeadline?: string;
  candidateReason?: string;
  signals?: {
    greenFlags?: ParsedSignal[];
    redFlags?: ParsedSignal[];
    unknowns?: ParsedSignal[];
  };
}

interface CompanyFormProps {
  company: Company;
  onCancel: () => void;
  onSubmit: (company: Company) => void;
}

export function CompanyForm({ company, onCancel, onSubmit }: CompanyFormProps) {
  const [draft, setDraft] = useState<Company>(company);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parseSuccess, setParseSuccess] = useState("");
  const [rawTextMode, setRawTextMode] = useState(false);
  const [rawText, setRawText] = useState("");

  function update<K extends keyof Company>(key: K, value: Company[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateScore(categoryKey: string, itemId: string, value: number) {
    setDraft((current) => ({
      ...current,
      scores: {
        ...current.scores,
        [categoryKey]: {
          ...current.scores[categoryKey as keyof Company["scores"]],
          [itemId]: value,
        },
      },
    }));
  }

  function updateScoreEvidence(
    categoryKey: string,
    itemId: string,
    value: EvidenceLevel,
  ) {
    setDraft((current) => ({
      ...current,
      scoreEvidence: {
        ...current.scoreEvidence,
        [categoryKey]: {
          ...current.scoreEvidence[categoryKey as keyof Company["scoreEvidence"]],
          [itemId]: value,
        },
      },
    }));
  }

  function toggleRisk(flag: string) {
    setDraft((current) => {
      const exists = current.riskFlags.includes(flag);
      return {
        ...current,
        riskFlags: exists
          ? current.riskFlags.filter((item) => item !== flag)
          : [...current.riskFlags, flag],
      };
    });
  }

  async function autoFillFromJobPost() {
    const hasUrl = draft.jobPostUrl.trim().length > 0;
    const hasHomepage = draft.homepageUrl.trim().length > 0;
    const hasRaw = rawText.trim().length >= 50;

    if (!hasUrl && !hasRaw) {
      setParseError(rawTextMode ? "공고 텍스트를 50자 이상 입력해주세요." : "먼저 채용공고 URL을 입력해주세요.");
      return;
    }

    setParsing(true);
    setParseError("");
    setParseSuccess("");

    let accessToken: string | undefined;
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token;
      }
    } catch {
      // non-fatal
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };

    function doFetch(body: object): Promise<ParsedJobPost> {
      return fetch("/api/parse-job", { method: "POST", headers, body: JSON.stringify(body) })
        .then((r) => r.json() as Promise<{ ok: true; result: ParsedJobPost } | { ok: false; error: string; errorCode?: string }>)
        .then((d) => {
          if (!d.ok) {
            const err = new Error(d.error) as Error & { errorCode?: string };
            err.errorCode = d.errorCode;
            throw err;
          }
          return d.result;
        });
    }

    // Build ordered source list (rawText-only or URL pair)
    const sources: Array<{ promise: Promise<ParsedJobPost>; sourceUrl: string; label: string }> = [];
    if (hasRaw) {
      sources.push({ promise: doFetch({ rawText: rawText.trim() }), sourceUrl: "", label: "텍스트" });
    } else {
      if (hasUrl) sources.push({ promise: doFetch({ url: draft.jobPostUrl }), sourceUrl: draft.jobPostUrl, label: "채용공고" });
      if (hasHomepage) sources.push({ promise: doFetch({ url: draft.homepageUrl }), sourceUrl: draft.homepageUrl, label: "홈페이지" });
    }

    try {
      const settled = await Promise.allSettled(sources.map((s) => s.promise));
      const now = new Date().toISOString();

      function toSignals(
        items: ParsedSignal[] | undefined,
        type: ResearchSignal["type"],
        sourceUrl: string,
      ): ResearchSignal[] {
        if (!items?.length) return [];
        return items.map((s) => ({
          id: createId("signal"),
          label: s.label,
          description: s.reason,
          reason: s.reason,
          evidenceText: s.evidenceText,
          type,
          sourceUrl,
          confidence: s.confidence as EvidenceLevel,
          createdAt: now,
        }));
      }

      const successes: Array<{ result: ParsedJobPost; sourceUrl: string }> = [];
      const errors: Array<{ label: string; message: string; errorCode?: string }> = [];

      settled.forEach((outcome, i) => {
        if (outcome.status === "fulfilled") {
          successes.push({ result: outcome.value, sourceUrl: sources[i].sourceUrl });
        } else {
          const err = outcome.reason as Error & { errorCode?: string };
          errors.push({ label: sources[i].label, message: err.message ?? "파싱 실패", errorCode: err.errorCode });
        }
      });

      if (successes.length === 0) {
        const first = errors[0];
        const fetchFailed = first?.errorCode === "fetch_failed" || first?.errorCode === "text_extraction_failed";
        setParseError(
          fetchFailed && !rawTextMode
            ? `${first.message} → 아래 "텍스트 직접 붙여넣기"를 눌러주세요.`
            : (first?.message ?? "자동 채우기 요청에 실패했습니다."),
        );
        return;
      }

      // First successful result fills scalar fields; later ones only fill still-empty fields
      const merged: ParsedJobPost = {};
      for (const { result } of successes) {
        if (!merged.name) merged.name = result.name;
        if (!merged.industry) merged.industry = result.industry;
        if (!merged.productDescription) merged.productDescription = result.productDescription;
        if (!merged.jobDeadline) merged.jobDeadline = result.jobDeadline;
        if (!merged.candidateReason) merged.candidateReason = result.candidateReason;
      }

      const allGreen: ResearchSignal[] = [];
      const allRed: ResearchSignal[] = [];
      const allUnknown: ResearchSignal[] = [];
      for (const { result, sourceUrl } of successes) {
        allGreen.push(...toSignals(result.signals?.greenFlags, "green", sourceUrl));
        allRed.push(...toSignals(result.signals?.redFlags, "red", sourceUrl));
        allUnknown.push(...toSignals(result.signals?.unknowns, "unknown", sourceUrl));
      }

      setDraft((current) => ({
        ...current,
        name: current.name || merged.name || current.name,
        industry: current.industry || merged.industry || current.industry,
        productDescription: current.productDescription || merged.productDescription || current.productDescription,
        jobDeadline: current.jobDeadline || merged.jobDeadline || current.jobDeadline,
        candidateReason: current.candidateReason || merged.candidateReason || current.candidateReason,
        evidenceLevel: Math.max(current.evidenceLevel, 2) as EvidenceLevel,
        needsRefresh: true,
        lastCheckedAt: now.slice(0, 10),
        signals: {
          greenFlags: [...allGreen, ...current.signals.greenFlags],
          redFlags: [...allRed, ...current.signals.redFlags],
          unknowns: [...allUnknown, ...current.signals.unknowns],
        },
      }));

      if (errors.length > 0) {
        setParseError(`일부 소스 파싱 실패 (${errors.map((e) => e.label).join(", ")})`);
      } else {
        setParseSuccess(
          successes.length >= 2
            ? `${successes.length}개 소스 분석 완료 (${successes.map((_, i) => sources[i].label).join(" + ")})`
            : "분석 완료",
        );
      }
    } catch {
      setParseError("자동 채우기 요청에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setParsing(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h2 className="text-lg font-semibold">
            {company.name ? "회사 수정" : "회사 추가"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            기본 정보, 평가 점수, 경고 신호를 함께 기록합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onCancel} variant="secondary">
            취소
          </Button>
          <Button disabled={!draft.name.trim()} onClick={() => onSubmit(draft)}>
            <Save className="h-4 w-4" />
            저장
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 p-4 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Field label="회사명">
            <Input
              onChange={(event) => update("name", event.target.value)}
              placeholder="회사명"
              value={draft.name}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="홈페이지 URL">
              <Input
                onChange={(event) => update("homepageUrl", event.target.value)}
                placeholder="https://"
                value={draft.homepageUrl}
              />
            </Field>
            <Field label="채용공고 URL">
              <Input
                onChange={(event) => update("jobPostUrl", event.target.value)}
                placeholder="https://"
                value={draft.jobPostUrl}
              />
            </Field>
          </div>
          <div className="space-y-2">
            {rawTextMode ? (
              <Textarea
                onChange={(event) => setRawText(event.target.value)}
                placeholder="채용공고 내용을 여기에 붙여넣으세요 (50자 이상)"
                rows={5}
                value={rawText}
              />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={parsing}
                onClick={autoFillFromJobPost}
                size="sm"
                variant="secondary"
              >
                <Sparkles className="h-4 w-4" />
                {parsing
                  ? "공고 분석 중..."
                  : rawTextMode
                    ? "텍스트로 자동 채우기 (AI)"
                    : draft.homepageUrl.trim() && draft.jobPostUrl.trim()
                      ? "공고+홈페이지 분석 (AI)"
                      : "공고 URL에서 자동 채우기 (AI)"}
              </Button>
              <button
                className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
                onClick={() => {
                  setRawTextMode((v) => !v);
                  setParseError("");
                  setParseSuccess("");
                }}
                type="button"
              >
                {rawTextMode ? "URL로 전환" : "텍스트 직접 붙여넣기"}
              </button>
            </div>
            {parseError ? (
              <p className="text-xs text-red-600">{parseError}</p>
            ) : null}
            {parseSuccess && !parseError ? (
              <p className="text-xs text-emerald-600">{parseSuccess}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="산업군">
              <Input
                onChange={(event) => update("industry", event.target.value)}
                placeholder="B2B SaaS, Fintech..."
                value={draft.industry}
              />
            </Field>
            <Field label="회사 규모">
              <Select
                onChange={(event) =>
                  update("size", event.target.value as Company["size"])
                }
                value={draft.size}
              >
                {COMPANY_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="관심도">
              <Input
                max={5}
                min={1}
                onChange={(event) =>
                  update("interestLevel", Number(event.target.value))
                }
                type="number"
                value={draft.interestLevel}
              />
            </Field>
            <Field label="지원 상태">
              <Select
                onChange={(event) =>
                  update("status", event.target.value as ApplicationStatus)
                }
                value={draft.status}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="지원 우선순위">
              <Select
                onChange={(event) =>
                  update(
                    "applicationPriority",
                    event.target.value as ApplicationPriority,
                  )
                }
                value={draft.applicationPriority}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="근거 수준">
              <Select
                onChange={(event) =>
                  update("evidenceLevel", Number(event.target.value) as EvidenceLevel)
                }
                value={draft.evidenceLevel}
              >
                {EVIDENCE_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    Lv.{option.value} {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="우선순위 이유">
            <Textarea
              onChange={(event) => update("priorityReason", event.target.value)}
              value={draft.priorityReason}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="발견 이유">
              <Select
                onChange={(event) =>
                  update(
                    "discoveryReason",
                    event.target.value as Company["discoveryReason"],
                  )
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
            <Field label="공고 상태">
              <Select
                onChange={(event) =>
                  update("jobStatus", event.target.value as JobStatus)
                }
                value={draft.jobStatus}
              >
                {JOB_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="공고 마감일">
              <Input
                onChange={(event) => update("jobDeadline", event.target.value)}
                type="date"
                value={draft.jobDeadline}
              />
            </Field>
            <Field label="최근 확인일">
              <Input
                onChange={(event) => update("lastCheckedAt", event.target.value)}
                type="date"
                value={draft.lastCheckedAt}
              />
            </Field>
          </div>
          <Field label="첫인상 메모">
            <Textarea
              onChange={(event) => update("firstImpressionNote", event.target.value)}
              value={draft.firstImpressionNote}
            />
          </Field>
          <Field label="후보 저장 이유">
            <Textarea
              onChange={(event) => update("candidateReason", event.target.value)}
              value={draft.candidateReason}
            />
          </Field>
          <Field label="투자/매출/성장 정보">
            <Textarea
              onChange={(event) => update("growthInfo", event.target.value)}
              value={draft.growthInfo}
            />
          </Field>
          <Field label="제품/서비스 설명">
            <Textarea
              onChange={(event) => update("productDescription", event.target.value)}
              value={draft.productDescription}
            />
          </Field>
          <Field label="메모">
            <Textarea
              onChange={(event) => update("memo", event.target.value)}
              value={draft.memo}
            />
          </Field>
        </div>

        <div className="space-y-5">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">좋은 회사 평가 기준</h3>
            {SCORE_CATEGORIES.map((category) => (
              <div className="rounded-md border border-slate-200 p-3" key={category.key}>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-semibold">{category.title}</h4>
                  <Badge>{Math.round(category.weight * 100)}%</Badge>
                </div>
                <div className="space-y-3">
                  {category.items.map((item) => (
                    <ScoreSlider
                      evidenceLevel={draft.scoreEvidence[category.key][item.id]}
                      key={item.id}
                      label={item.label}
                      onChange={(value) => updateScore(category.key, item.id, value)}
                      onEvidenceChange={(value) =>
                        updateScoreEvidence(category.key, item.id, value)
                      }
                      value={draft.scores[category.key][item.id]}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-md border border-slate-200 p-3">
            <h3 className="text-sm font-semibold">경고 신호 체크리스트</h3>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {RISK_CHECKLIST.map((flag) => (
                <label
                  className="flex items-start gap-2 rounded-md border border-slate-200 p-2 text-sm"
                  key={flag}
                >
                  <input
                    checked={draft.riskFlags.includes(flag)}
                    className="mt-1 accent-slate-900"
                    onChange={() => toggleRisk(flag)}
                    type="checkbox"
                  />
                  <span>{flag}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-slate-200 p-3">
            <h3 className="text-sm font-semibold">디자이너 적합도 체크리스트</h3>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(DESIGNER_FIT_LABELS).map(([key, label]) => (
                <label
                  className="flex items-start gap-2 rounded-md border border-slate-200 p-2 text-sm"
                  key={key}
                >
                  <input
                    checked={draft.designerFit[key as keyof Company["designerFit"]]}
                    className="mt-1 accent-slate-900"
                    onChange={(event) =>
                      update("designerFit", {
                        ...draft.designerFit,
                        [key]: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
