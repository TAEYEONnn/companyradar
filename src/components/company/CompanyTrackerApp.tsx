"use client";

import {
  AlertTriangle,
  ArrowDownWideNarrow,
  Building2,
  CalendarClock,
  Check,
  ExternalLink,
  FileText,
  ListFilter,
  PanelRightOpen,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ScoreSlider } from "@/components/ui/score-slider";
import {
  COMPANY_SIZE_LABELS,
  COMPANY_SIZE_OPTIONS,
  DEFAULT_CRITERIA_SETTINGS,
  RISK_CHECKLIST,
  SCORE_CATEGORIES,
  STATUS_LABELS,
  STATUS_OPTIONS,
} from "@/lib/criteria";
import { evaluateCompany, formatScore } from "@/lib/scoring";
import { SAMPLE_COMPANIES } from "@/lib/sample-data";
import { localStorageRepository } from "@/lib/storage";
import type {
  ApplicationStatus,
  Company,
  CompanyScoreResult,
  CriteriaSettings,
  ResearchLog,
  SortMode,
} from "@/lib/types";
import { cn, createId, today } from "@/lib/utils";

type ViewMode = "dashboard" | "form" | "settings";

const STATUS_TONE: Record<ApplicationStatus, "slate" | "green" | "amber" | "red" | "blue" | "purple"> = {
  interested: "slate",
  planned: "blue",
  applied: "purple",
  interviewing: "amber",
  rejected: "red",
  offer: "green",
  on_hold: "slate",
};

function createEmptyCompany(): Company {
  const now = new Date().toISOString();

  return {
    id: createId("company"),
    name: "",
    homepageUrl: "",
    jobPostUrl: "",
    industry: "",
    size: "unknown",
    growthInfo: "",
    productDescription: "",
    interestLevel: 3,
    status: "interested",
    memo: "",
    scores: SCORE_CATEGORIES.reduce((scores, category) => {
      scores[category.key] = category.items.reduce(
        (items, item) => {
          items[item.id] = 3;
          return items;
        },
        {} as Record<string, number>,
      );
      return scores;
    }, {} as Company["scores"]),
    researchLogs: [],
    riskFlags: [],
    interviewNotes: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function CompanyTrackerApp() {
  const [companies, setCompanies] = useState<Company[]>(SAMPLE_COMPANIES);
  const [settings, setSettings] = useState<CriteriaSettings>(
    DEFAULT_CRITERIA_SETTINGS,
  );
  const [selectedId, setSelectedId] = useState(SAMPLE_COMPANIES[0]?.id ?? "");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">(
    "all",
  );
  const [sortMode, setSortMode] = useState<SortMode>("score_desc");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const loadedCompanies = localStorageRepository.loadCompanies();
      setCompanies(loadedCompanies);
      setSettings(localStorageRepository.loadSettings());
      setSelectedId(loadedCompanies[0]?.id ?? "");
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!isReady) return;
    localStorageRepository.saveCompanies(companies);
  }, [companies, isReady]);

  useEffect(() => {
    if (!isReady) return;
    localStorageRepository.saveSettings(settings);
  }, [settings, isReady]);

  const scoreMap = useMemo(() => {
    return new Map(
      companies.map((company) => [company.id, evaluateCompany(company, settings)]),
    );
  }, [companies, settings]);

  const filteredCompanies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = companies.filter((company) => {
      const matchesStatus =
        statusFilter === "all" || company.status === statusFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [company.name, company.industry, company.productDescription]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });

    return rows.sort((a, b) => {
      if (sortMode === "updated_desc") {
        return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      }
      return (
        (scoreMap.get(b.id)?.totalScore ?? 0) -
        (scoreMap.get(a.id)?.totalScore ?? 0)
      );
    });
  }, [companies, query, scoreMap, sortMode, statusFilter]);

  const selectedCompany =
    companies.find((company) => company.id === selectedId) ??
    filteredCompanies[0] ??
    companies[0];

  const selectedScore = selectedCompany
    ? scoreMap.get(selectedCompany.id)
    : undefined;

  const summary = useMemo(() => {
    const active = companies.filter(
      (company) => !["rejected", "on_hold"].includes(company.status),
    ).length;
    const highRisk = companies.filter(
      (company) => scoreMap.get(company.id)?.highRisk,
    ).length;
    const average =
      companies.reduce(
        (sum, company) => sum + (scoreMap.get(company.id)?.totalScore ?? 0),
        0,
      ) / Math.max(companies.length, 1);

    return { active, highRisk, average };
  }, [companies, scoreMap]);

  function upsertCompany(company: Company) {
    const nextCompany = {
      ...company,
      updatedAt: new Date().toISOString(),
    };

    setCompanies((current) => {
      const exists = current.some((item) => item.id === nextCompany.id);
      if (exists) {
        return current.map((item) =>
          item.id === nextCompany.id ? nextCompany : item,
        );
      }
      return [nextCompany, ...current];
    });
    setSelectedId(nextCompany.id);
    setViewMode("dashboard");
    setEditingCompany(null);
  }

  function deleteCompany(companyId: string) {
    setCompanies((current) => current.filter((company) => company.id !== companyId));
    if (selectedId === companyId) {
      setSelectedId(companies.find((company) => company.id !== companyId)?.id ?? "");
    }
  }

  function patchCompany(companyId: string, patch: Partial<Company>) {
    setCompanies((current) =>
      current.map((company) =>
        company.id === companyId
          ? { ...company, ...patch, updatedAt: new Date().toISOString() }
          : company,
      ),
    );
  }

  function startCreate() {
    setEditingCompany(createEmptyCompany());
    setViewMode("form");
  }

  function startEdit(company: Company) {
    setEditingCompany(company);
    setViewMode("form");
  }

  function resetSampleData() {
    localStorageRepository.reset();
    setCompanies(SAMPLE_COMPANIES);
    setSettings(DEFAULT_CRITERIA_SETTINGS);
    setSelectedId(SAMPLE_COMPANIES[0]?.id ?? "");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-5 py-5">
        <header className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Building2 className="h-4 w-4" />
              Career Company Tracker
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
              좋은 회사 후보를 평가하고 추적
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              aria-label="평가 기준 설정"
              onClick={() => setViewMode("settings")}
              variant="secondary"
            >
              <Settings2 className="h-4 w-4" />
              기준 설정
            </Button>
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4" />
              회사 추가
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-4 gap-3">
          <Metric label="전체 회사" value={`${companies.length}`} />
          <Metric label="진행 중" value={`${summary.active}`} />
          <Metric label="평균 점수" value={formatScore(summary.average)} />
          <Metric
            label="리스크 높음"
            tone={summary.highRisk > 0 ? "red" : "green"}
            value={`${summary.highRisk}`}
          />
        </section>

        {viewMode === "settings" ? (
          <CriteriaSettingsPanel
            onBack={() => setViewMode("dashboard")}
            onChange={setSettings}
            settings={settings}
          />
        ) : viewMode === "form" && editingCompany ? (
          <CompanyForm
            company={editingCompany}
            onCancel={() => {
              setEditingCompany(null);
              setViewMode("dashboard");
            }}
            onSubmit={upsertCompany}
          />
        ) : (
          <section className="grid min-h-[680px] grid-cols-[minmax(720px,1fr)_420px] gap-4">
            <div className="rounded-lg border border-slate-200 bg-white">
              <Toolbar
                query={query}
                sortMode={sortMode}
                statusFilter={statusFilter}
                onQueryChange={setQuery}
                onReset={resetSampleData}
                onSortModeChange={setSortMode}
                onStatusFilterChange={setStatusFilter}
              />
              <CompanyTable
                companies={filteredCompanies}
                scoreMap={scoreMap}
                selectedId={selectedCompany?.id ?? ""}
                onEdit={startEdit}
                onSelect={setSelectedId}
              />
            </div>
            {selectedCompany && selectedScore ? (
              <CompanyDetailPanel
                company={selectedCompany}
                score={selectedScore}
                onDelete={deleteCompany}
                onEdit={startEdit}
                onPatch={patchCompany}
              />
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
                선택된 회사가 없습니다.
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "green" | "red";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-2 text-2xl font-semibold",
          tone === "green" && "text-emerald-700",
          tone === "red" && "text-red-700",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Toolbar({
  query,
  sortMode,
  statusFilter,
  onQueryChange,
  onReset,
  onSortModeChange,
  onStatusFilterChange,
}: {
  query: string;
  sortMode: SortMode;
  statusFilter: ApplicationStatus | "all";
  onQueryChange: (query: string) => void;
  onReset: () => void;
  onSortModeChange: (mode: SortMode) => void;
  onStatusFilterChange: (status: ApplicationStatus | "all") => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 p-3">
      <div className="relative min-w-72 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          aria-label="회사 검색"
          className="pl-9"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="회사명, 산업군, 제품 설명 검색"
          value={query}
        />
      </div>
      <div className="flex w-44 items-center gap-2">
        <ListFilter className="h-4 w-4 text-slate-400" />
        <Select
          aria-label="상태 필터"
          onChange={(event) =>
            onStatusFilterChange(event.target.value as ApplicationStatus | "all")
          }
          value={statusFilter}
        >
          <option value="all">전체 상태</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex w-52 items-center gap-2">
        <ArrowDownWideNarrow className="h-4 w-4 text-slate-400" />
        <Select
          aria-label="정렬"
          onChange={(event) => onSortModeChange(event.target.value as SortMode)}
          value={sortMode}
        >
          <option value="score_desc">점수순</option>
          <option value="updated_desc">최근 수정순</option>
        </Select>
      </div>
      <Button onClick={onReset} variant="ghost">
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CompanyTable({
  companies,
  scoreMap,
  selectedId,
  onEdit,
  onSelect,
}: {
  companies: Company[];
  scoreMap: Map<string, CompanyScoreResult>;
  selectedId: string;
  onEdit: (company: Company) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">회사</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">총점</th>
            <th className="px-4 py-3">판단</th>
            <th className="px-4 py-3">리스크</th>
            <th className="px-4 py-3">관심도</th>
            <th className="px-4 py-3">수정</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => {
            const score = scoreMap.get(company.id);
            return (
              <tr
                className={cn(
                  "cursor-pointer border-t border-slate-100 hover:bg-slate-50",
                  selectedId === company.id && "bg-slate-50",
                )}
                key={company.id}
                onClick={() => onSelect(company.id)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-950">{company.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {company.industry} · {COMPANY_SIZE_LABELS[company.size]}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[company.status]}>
                    {STATUS_LABELS[company.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="text-lg font-semibold">
                    {formatScore(score?.totalScore ?? 0)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    tone={
                      score?.recommendationLabel === "적극 지원"
                        ? "green"
                        : score?.recommendationLabel === "지원 고려"
                          ? "blue"
                          : score?.recommendationLabel === "정보 추가 필요"
                            ? "amber"
                            : "slate"
                    }
                  >
                    {score?.recommendationLabel}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={score?.highRisk ? "red" : "slate"}>
                    {score?.highRisk ? "리스크 높음" : `${score?.riskCount ?? 0}개`}
                  </Badge>
                </td>
                <td className="px-4 py-3">{company.interestLevel}/5</td>
                <td className="px-4 py-3">
                  <Button
                    aria-label={`${company.name} 수정`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(company);
                    }}
                    size="icon"
                    variant="ghost"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {companies.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-slate-500">
          조건에 맞는 회사가 없습니다.
        </div>
      ) : null}
    </div>
  );
}

function CompanyDetailPanel({
  company,
  score,
  onDelete,
  onEdit,
  onPatch,
}: {
  company: Company;
  score: CompanyScoreResult;
  onDelete: (companyId: string) => void;
  onEdit: (company: Company) => void;
  onPatch: (companyId: string, patch: Partial<Company>) => void;
}) {
  const [researchDraft, setResearchDraft] = useState<Omit<ResearchLog, "id">>({
    source: "",
    link: "",
    positiveSignals: "",
    negativeSignals: "",
    questions: "",
    createdAt: today(),
  });
  const [noteDraft, setNoteDraft] = useState("");

  function addResearchLog() {
    if (!researchDraft.source.trim()) return;
    onPatch(company.id, {
      researchLogs: [
        {
          id: createId("research"),
          ...researchDraft,
        },
        ...company.researchLogs,
      ],
    });
    setResearchDraft({
      source: "",
      link: "",
      positiveSignals: "",
      negativeSignals: "",
      questions: "",
      createdAt: today(),
    });
  }

  function addInterviewNote() {
    if (!noteDraft.trim()) return;
    onPatch(company.id, {
      interviewNotes: [
        {
          id: createId("note"),
          title: "면접 메모",
          content: noteDraft,
          createdAt: today(),
        },
        ...company.interviewNotes,
      ],
    });
    setNoteDraft("");
  }

  return (
    <aside className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{company.name}</h2>
            {score.highRisk ? (
              <Badge tone="red">
                <AlertTriangle className="mr-1 h-3 w-3" />
                리스크 높음
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">{company.industry}</p>
        </div>
        <div className="flex gap-1">
          <Button aria-label="수정" onClick={() => onEdit(company)} size="icon" variant="ghost">
            <Pencil className="h-4 w-4" />
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

      <div className="max-h-[790px] space-y-5 overflow-y-auto p-4">
        <section className="grid grid-cols-3 gap-2">
          <Metric label="총점" value={formatScore(score.totalScore)} />
          <Metric label="리스크" value={`${score.riskCount}개`} tone={score.highRisk ? "red" : "slate"} />
          <Metric label="관심도" value={`${company.interestLevel}/5`} />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">기본 정보</h3>
            <Badge tone={STATUS_TONE[company.status]}>{STATUS_LABELS[company.status]}</Badge>
          </div>
          <InfoRow label="규모" value={COMPANY_SIZE_LABELS[company.size]} />
          <InfoRow label="제품" value={company.productDescription} />
          <InfoRow label="성장 정보" value={company.growthInfo} />
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
            리서치 로그
          </h3>
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <Input
              aria-label="출처"
              onChange={(event) =>
                setResearchDraft((draft) => ({
                  ...draft,
                  source: event.target.value,
                }))
              }
              placeholder="출처"
              value={researchDraft.source}
            />
            <Input
              aria-label="링크"
              onChange={(event) =>
                setResearchDraft((draft) => ({
                  ...draft,
                  link: event.target.value,
                }))
              }
              placeholder="링크"
              value={researchDraft.link}
            />
            <Textarea
              aria-label="긍정 신호"
              onChange={(event) =>
                setResearchDraft((draft) => ({
                  ...draft,
                  positiveSignals: event.target.value,
                }))
              }
              placeholder="긍정 신호"
              value={researchDraft.positiveSignals}
            />
            <Textarea
              aria-label="부정 신호"
              onChange={(event) =>
                setResearchDraft((draft) => ({
                  ...draft,
                  negativeSignals: event.target.value,
                }))
              }
              placeholder="부정 신호"
              value={researchDraft.negativeSignals}
            />
            <Textarea
              aria-label="확인 필요 사항"
              onChange={(event) =>
                setResearchDraft((draft) => ({
                  ...draft,
                  questions: event.target.value,
                }))
              }
              placeholder="확인 필요 사항"
              value={researchDraft.questions}
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
                <span className="text-xs text-slate-500">{log.createdAt}</span>
              </div>
              {log.link ? (
                <a
                  className="mt-1 inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
                  href={log.link}
                  rel="noreferrer"
                  target="_blank"
                >
                  링크 열기 <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              <Signal label="긍정" value={log.positiveSignals} />
              <Signal label="부정" value={log.negativeSignals} />
              <Signal label="확인" value={log.questions} />
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4" />
            면접 메모
          </h3>
          <div className="flex gap-2">
            <Input
              aria-label="면접 메모"
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="면접에서 들은 신호, 질문, 인상"
              value={noteDraft}
            />
            <Button onClick={addInterviewNote} size="sm">
              추가
            </Button>
          </div>
          {company.interviewNotes.map((note) => (
            <div className="rounded-md border border-slate-200 p-3" key={note.id}>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{note.title}</span>
                <span>{note.createdAt}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{note.content}</p>
            </div>
          ))}
        </section>
      </div>
    </aside>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px,1fr] gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <p className="mt-2 text-sm text-slate-700">
      <span className="font-medium text-slate-500">{label}: </span>
      {value}
    </p>
  );
}

function CompanyForm({
  company,
  onCancel,
  onSubmit,
}: {
  company: Company;
  onCancel: () => void;
  onSubmit: (company: Company) => void;
}) {
  const [draft, setDraft] = useState<Company>(company);

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

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
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

      <div className="grid grid-cols-[420px,1fr] gap-5 p-4">
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
          <Field label="투자/매출/성장 정보">
            <Textarea
              onChange={(event) => update("growthInfo", event.target.value)}
              value={draft.growthInfo}
            />
          </Field>
          <Field label="제품/서비스 설명">
            <Textarea
              onChange={(event) =>
                update("productDescription", event.target.value)
              }
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
                      key={item.id}
                      label={item.label}
                      onChange={(value) =>
                        updateScore(category.key, item.id, value)
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
            <div className="mt-3 grid grid-cols-2 gap-2">
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
        </div>
      </div>
    </section>
  );
}

function CriteriaSettingsPanel({
  settings,
  onBack,
  onChange,
}: {
  settings: CriteriaSettings;
  onBack: () => void;
  onChange: (settings: CriteriaSettings) => void;
}) {
  const weightSum = Object.values(settings.weights).reduce(
    (sum, weight) => sum + weight,
    0,
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div>
          <h2 className="text-lg font-semibold">평가 기준 설정</h2>
          <p className="mt-1 text-sm text-slate-500">
            기본 가중치: 사업 20%, 조직 25%, 디자인 성장 30%, 조건 15%, 적합도 10%
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => onChange(DEFAULT_CRITERIA_SETTINGS)}
            variant="secondary"
          >
            <RotateCcw className="h-4 w-4" />
            기본값
          </Button>
          <Button onClick={onBack}>
            <Check className="h-4 w-4" />
            완료
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[520px,1fr] gap-6 p-4">
        <div className="space-y-3">
          {SCORE_CATEGORIES.map((category) => (
            <div
              className="grid grid-cols-[180px,1fr,72px] items-center gap-3 rounded-md border border-slate-200 p-3"
              key={category.key}
            >
              <div>
                <div className="font-medium">{category.title}</div>
                <div className="text-xs text-slate-500">
                  {category.items.length}개 항목
                </div>
              </div>
              <input
                aria-label={`${category.title} 가중치`}
                className="accent-slate-900"
                max={50}
                min={0}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    weights: {
                      ...settings.weights,
                      [category.key]: Number(event.target.value) / 100,
                    },
                  })
                }
                type="range"
                value={Math.round(settings.weights[category.key] * 100)}
              />
              <Input
                aria-label={`${category.title} 가중치 숫자`}
                max={50}
                min={0}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    weights: {
                      ...settings.weights,
                      [category.key]: Number(event.target.value) / 100,
                    },
                  })
                }
                type="number"
                value={Math.round(settings.weights[category.key] * 100)}
              />
            </div>
          ))}
          <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            현재 합계 {Math.round(weightSum * 100)}%. 합계가 100%가 아니어도 점수
            계산 시 자동 정규화됩니다.
          </div>
          <div className="grid grid-cols-[1fr,120px] items-center gap-3 rounded-md border border-slate-200 p-3">
            <div>
              <div className="font-medium">리스크 높음 기준</div>
              <div className="text-sm text-slate-500">
                체크된 경고 신호가 이 개수 이상이면 별도 뱃지를 표시합니다.
              </div>
            </div>
            <Input
              max={7}
              min={1}
              onChange={(event) =>
                onChange({
                  ...settings,
                  highRiskThreshold: Number(event.target.value),
                })
              }
              type="number"
              value={settings.highRiskThreshold}
            />
          </div>
        </div>

        <div className="rounded-md border border-slate-200 p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <PanelRightOpen className="h-4 w-4" />
            점수 라벨
          </h3>
          <div className="mt-4 space-y-2 text-sm">
            <LabelRow label="4.3 이상" value="적극 지원" tone="green" />
            <LabelRow label="3.7 이상" value="지원 고려" tone="blue" />
            <LabelRow label="3.0 이상" value="정보 추가 필요" tone="amber" />
            <LabelRow label="3.0 미만" value="보류" tone="slate" />
          </div>
          <div className="mt-6 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            평가 항목은 회사 크기보다 커리어 성장성, 조직 안정성, 제품 품질,
            후기 신호, 포지션 적합도를 우선 보도록 구성되어 있습니다.
          </div>
        </div>
      </div>
    </section>
  );
}

function LabelRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "green" | "amber" | "blue";
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 p-3">
      <span className="text-slate-500">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}
