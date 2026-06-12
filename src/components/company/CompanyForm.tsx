"use client";

import { Save, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
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
} from "@/lib/types";

interface ParsedJobPost {
  name?: string;
  industry?: string;
  productDescription?: string;
  jobDeadline?: string;
  candidateReason?: string;
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
    if (!draft.jobPostUrl.trim()) {
      setParseError("먼저 채용공고 URL을 입력해주세요.");
      return;
    }
    setParsing(true);
    setParseError("");
    try {
      const response = await fetch("/api/parse-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: draft.jobPostUrl }),
      });
      const data = (await response.json()) as
        | { ok: true; result: ParsedJobPost }
        | { ok: false; error: string };

      if (!data.ok) {
        setParseError(data.error);
        return;
      }

      const parsed = data.result;
      setDraft((current) => ({
        ...current,
        name: current.name || parsed.name || current.name,
        industry: current.industry || parsed.industry || current.industry,
        productDescription:
          current.productDescription ||
          parsed.productDescription ||
          current.productDescription,
        jobDeadline: current.jobDeadline || parsed.jobDeadline || current.jobDeadline,
        candidateReason:
          current.candidateReason ||
          parsed.candidateReason ||
          current.candidateReason,
        evidenceLevel: Math.max(current.evidenceLevel, 2) as EvidenceLevel,
        lastCheckedAt: new Date().toISOString().slice(0, 10),
      }));
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
          <div className="space-y-1">
            <Button
              disabled={parsing}
              onClick={autoFillFromJobPost}
              size="sm"
              variant="secondary"
            >
              <Sparkles className="h-4 w-4" />
              {parsing ? "공고 분석 중..." : "공고 URL에서 자동 채우기 (AI)"}
            </Button>
            {parseError ? (
              <p className="text-xs text-red-600">{parseError}</p>
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
