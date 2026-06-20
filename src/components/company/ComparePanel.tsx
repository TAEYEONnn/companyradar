"use client";

import { ArrowLeft, GitCompareArrows, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getApiErrorMessage } from "@/lib/api-error";
import { PRIORITY_LABELS, SCORE_CATEGORIES, STATUS_LABELS } from "@/lib/criteria";
import { formatScore } from "@/lib/scoring";
import type { Company, CompanyScoreResult } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase-client";
import { getPriorityTone, STATUS_TONE } from "./shared";

interface ComparePanelProps {
  companies: Company[];
  scoreMap: Map<string, CompanyScoreResult>;
  onBack: () => void;
  onSelectCompany: (id: string) => void;
}

export function ComparePanel({
  companies,
  scoreMap,
  onBack,
  onSelectCompany,
}: ComparePanelProps) {
  const cols = companies.slice(0, 3);
  const [aiComparison, setAiComparison] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  async function runAiCompare() {
    setAiLoading(true);
    setAiError("");
    let accessToken: string | undefined;
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token;
      }
    } catch { /* non-fatal */ }

    try {
      const res = await fetch("/api/compare-companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          companies: cols.map((c) => ({
            name: c.name,
            industry: c.industry,
            productDescription: c.productDescription,
            candidateReason: c.candidateReason,
            applicationPriority: c.applicationPriority,
            status: c.status,
            fitScore: scoreMap.get(c.id)?.companyFitScore,
            greenFlags: c.signals.greenFlags.map((s) => s.label),
            redFlags: c.signals.redFlags.map((s) => s.label),
            riskFlags: c.riskFlags,
          })),
        }),
      });
      const data = (await res.json()) as
        | { ok: true; comparison: string }
        | { error: { code?: string; message: string } };
      if (!("ok" in data) || !data.ok) {
        setAiError(getApiErrorMessage(res, data, "회사 비교를 만들지 못했어요."));
        return;
      }
      setAiComparison(data.comparison);
    } catch {
      setAiError("회사 비교를 만들지 못했어요.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <GitCompareArrows className="h-5 w-5" />
            회사 비교
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {cols.length}개 회사를 나란히 비교합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button disabled={aiLoading} onClick={() => void runAiCompare()} variant="secondary">
            <Sparkles className="h-4 w-4" />
            {aiLoading ? "분석 중..." : "AI 비교 분석"}
          </Button>
          <Button onClick={onBack} variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            대시보드
          </Button>
        </div>
      </div>

      {aiError && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          {aiError}
        </div>
      )}
      {aiComparison && (
        <div className="space-y-2 border-b border-sky-100 bg-sky-50 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
            <Sparkles className="h-3.5 w-3.5" />
            AI 비교 분석
          </p>
          {aiComparison.split("\n\n").map((para, i) => (
            <p className="text-sm leading-relaxed text-slate-700" key={i}>
              {para}
            </p>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="w-36 px-4 py-3 text-left text-xs font-semibold text-slate-500" />
              {cols.map((c) => (
                <th
                  className="min-w-[200px] px-4 py-3 text-left"
                  key={c.id}
                  scope="col"
                >
                  <button
                    className="text-left hover:underline"
                    onClick={() => onSelectCompany(c.id)}
                    type="button"
                  >
                    <div className="font-semibold text-slate-900">{c.name}</div>
                    <div className="text-xs font-normal text-slate-500">{c.industry}</div>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* 상태 */}
            <CompareRow label="상태">
              {cols.map((c) => (
                <Badge key={c.id} tone={STATUS_TONE[c.status]}>
                  {STATUS_LABELS[c.status]}
                </Badge>
              ))}
            </CompareRow>

            {/* 회사핏 점수 */}
            <CompareRow label="회사핏 점수">
              {cols.map((c) => {
                const s = scoreMap.get(c.id)?.companyFitScore ?? 0;
                const tone = s >= 4.3 ? "green" : s >= 3.7 ? "amber" : s > 0 ? "slate" : "slate";
                return (
                  <span
                    key={c.id}
                    className={`text-xl font-bold ${tone === "green" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-slate-700"}`}
                  >
                    {formatScore(s)}
                  </span>
                );
              })}
            </CompareRow>

            {/* 카테고리별 점수 */}
            {SCORE_CATEGORIES.map((cat) => (
              <CompareRow key={cat.key} label={cat.title} sub>
                {cols.map((c) => {
                  const catScore = scoreMap.get(c.id)?.categoryScores.find(
                    (cs) => cs.key === cat.key,
                  );
                  const avg = catScore?.average ?? 0;
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-sky-500 transition-all"
                          style={{ width: `${(avg / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600">{avg > 0 ? avg.toFixed(1) : "—"}</span>
                    </div>
                  );
                })}
              </CompareRow>
            ))}

            {/* 우선순위 */}
            <CompareRow label="지원 우선순위">
              {cols.map((c) => (
                <Badge key={c.id} tone={getPriorityTone(c.applicationPriority)}>
                  {PRIORITY_LABELS[c.applicationPriority]}
                </Badge>
              ))}
            </CompareRow>

            {/* 리스크 */}
            <CompareRow label="리스크">
              {cols.map((c) => {
                const score = scoreMap.get(c.id);
                return (
                  <Badge key={c.id} tone={score?.highRisk ? "red" : "slate"}>
                    {score?.highRisk ? "높음" : `${score?.riskCount ?? 0}개`}
                  </Badge>
                );
              })}
            </CompareRow>

            {/* 신호 */}
            <CompareRow label="Green / Red 신호">
              {cols.map((c) => (
                <div key={c.id} className="flex items-center gap-1 text-xs">
                  <span className="font-semibold text-emerald-600">
                    ↑{c.signals.greenFlags.length}
                  </span>
                  <span className="text-slate-300">/</span>
                  <span className="font-semibold text-red-500">
                    ↓{c.signals.redFlags.length}
                  </span>
                </div>
              ))}
            </CompareRow>

            {/* 면접 */}
            <CompareRow label="면접 라운드">
              {cols.map((c) => {
                const total = c.interviewRounds.length;
                const passed = c.interviewRounds.filter((r) => r.result === "passed").length;
                return (
                  <span key={c.id} className="text-sm text-slate-700">
                    {total === 0 ? "—" : `통과 ${passed} / 전체 ${total}`}
                  </span>
                );
              })}
            </CompareRow>

            {/* 마감일 */}
            <CompareRow label="공고 마감">
              {cols.map((c) => (
                <span key={c.id} className="text-sm text-slate-700">
                  {c.jobDeadline || "미확인"}
                </span>
              ))}
            </CompareRow>

            {/* 제품/서비스 */}
            <CompareRow label="제품 요약">
              {cols.map((c) => (
                <span key={c.id} className="line-clamp-2 text-xs text-slate-600">
                  {c.productDescription || "—"}
                </span>
              ))}
            </CompareRow>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompareRow({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: boolean;
  children: React.ReactNode;
}) {
  const cells = Array.isArray(children) ? children : [children];
  return (
    <tr className={sub ? "bg-slate-50/40" : ""}>
      <td className={`px-4 py-3 text-xs font-medium text-slate-500 ${sub ? "pl-6" : ""}`}>
        {label}
      </td>
      {cells.map((cell, i) => (
        <td className="px-4 py-3" key={i}>
          {cell}
        </td>
      ))}
    </tr>
  );
}
