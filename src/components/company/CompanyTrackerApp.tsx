"use client";

import { BarChart3, Building2, Plus, Settings2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { exportBackup, mergeCompanies, parseBackupFile } from "@/lib/backup";
import { createEmptyCompany } from "@/lib/company-factory";
import { DEFAULT_CRITERIA_SETTINGS } from "@/lib/criteria";
import {
  createDebouncedPush,
  deleteRemoteCompany,
  isRemoteSyncEnabled,
  mergeByUpdatedAt,
  pullRemoteCompanies,
  pushRemoteCompanies,
} from "@/lib/remote-sync";
import { evaluateCompany, formatScore } from "@/lib/scoring";
import {
  cloneSampleCompaniesForUser,
  hasUserCompanies,
  localStorageRepository,
} from "@/lib/storage";
import { getSupabaseClient } from "@/lib/supabase-client";
import type {
  ApplicationStatus,
  Company,
  CriteriaSettings,
  SortMode,
} from "@/lib/types";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { AuthGate } from "./AuthGate";
import { CompanyDetailPanel } from "./CompanyDetailPanel";
import { CompanyForm } from "./CompanyForm";
import { CompanyTable } from "./CompanyTable";
import { CriteriaSettingsPanel } from "./CriteriaSettingsPanel";
import { DashboardSection } from "./DashboardSection";
import { KanbanBoard } from "./KanbanBoard";
import {
  getDeadlineRank,
  getPriorityRank,
  isDeadlineSoon,
  isDueOrOverdue,
  Metric,
  type ListMode,
  type ViewMode,
} from "./shared";
import { StatsPanel } from "./StatsPanel";
import { Toolbar } from "./Toolbar";

export function CompanyTrackerApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [settings, setSettings] = useState<CriteriaSettings>(
    DEFAULT_CRITERIA_SETTINGS,
  );
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">(
    "all",
  );
  const [sortMode, setSortMode] = useState<SortMode>("score_desc");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [listMode, setListMode] = useState<ListMode>("table");
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [remotePushEnabled, setRemotePushEnabled] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const debouncedPushRef = useRef(createDebouncedPush());
  const userId = session?.user.id ?? "";
  const userEmail = session?.user.email ?? "";

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      queueMicrotask(() => setIsAuthLoading(false));
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setCompanies([]);
        setSelectedId("");
        setEditingCompany(null);
        setViewMode("dashboard");
        setIsReady(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 초기 로드: 사용자별 localStorage → Supabase user-owned rows → user-owned seed
  useEffect(() => {
    if (!userId) return;
    queueMicrotask(async () => {
      setIsReady(false);
      setRemotePushEnabled(true);

      const loadedCompanies = localStorageRepository.loadCompanies(userId);
      setSettings(localStorageRepository.loadSettings(userId));

      if (isRemoteSyncEnabled()) {
        const remote = await pullRemoteCompanies(userId);
        if (remote === null) {
          setCompanies(loadedCompanies);
          setSelectedId(loadedCompanies[0]?.id ?? "");
          setRemotePushEnabled(false);
          setIsReady(true);
          showToast("Supabase 데이터를 불러오지 못해 로컬 데이터만 표시합니다.");
          return;
        }
        if (remote && remote.length > 0) {
          const merged = mergeByUpdatedAt([], remote);
          setCompanies(merged);
          setSelectedId(merged[0]?.id ?? "");
          setIsReady(true);
          showToast("Supabase에서 데이터를 동기화했습니다.");
          return;
        }
      }

      if (hasUserCompanies(loadedCompanies)) {
        setCompanies(loadedCompanies);
        setSelectedId(loadedCompanies[0]?.id ?? "");
        setRemotePushEnabled(false);
        setIsReady(true);
        showToast("로컬 사용자 데이터가 감지됐습니다. v0.3.2 마이그레이션 전까지 로컬에만 저장됩니다.");
        return;
      }

      const ownedSeed = cloneSampleCompaniesForUser();
      setCompanies(ownedSeed);
      setSelectedId(ownedSeed[0]?.id ?? "");
      setIsReady(true);
      if (isRemoteSyncEnabled()) {
        void pushRemoteCompanies(ownedSeed, userId);
      }
    });
  }, [userId]);

  // 저장: localStorage 즉시 + Supabase 디바운스 push
  useEffect(() => {
    if (!isReady || !userId) return;
    localStorageRepository.saveCompanies(companies, userId);
    if (remotePushEnabled) debouncedPushRef.current(companies, userId);
  }, [companies, isReady, remotePushEnabled, userId]);

  useEffect(() => {
    if (!isReady || !userId) return;
    localStorageRepository.saveSettings(settings, userId);
  }, [settings, isReady, userId]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  }

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
      if (sortMode === "priority_desc") {
        return (
          getPriorityRank(b.applicationPriority) -
          getPriorityRank(a.applicationPriority)
        );
      }
      if (sortMode === "deadline_asc") {
        return getDeadlineRank(a) - getDeadlineRank(b);
      }
      return (
        (scoreMap.get(b.id)?.companyFitScore ?? 0) -
        (scoreMap.get(a.id)?.companyFitScore ?? 0)
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
    const needsValidation = companies.filter(
      (company) => scoreMap.get(company.id)?.needsValidation,
    ).length;
    const highPriority = companies.filter(
      (company) => company.applicationPriority === "high",
    ).length;
    const average =
      companies.reduce(
        (sum, company) => sum + (scoreMap.get(company.id)?.companyFitScore ?? 0),
        0,
      ) / Math.max(companies.length, 1);

    return { active, highRisk, needsValidation, highPriority, average };
  }, [companies, scoreMap]);

  const dashboardSections = useMemo(() => {
    const deadlineSoon = companies.filter(isDeadlineSoon);
    const waitingResponse = companies.filter((company) =>
      ["applied", "interviewing"].includes(company.status),
    );
    const followUpNeeded = companies.filter((company) =>
      company.followUpTasks.some(
        (task) => !task.completed && isDueOrOverdue(task.dueDate),
      ),
    );
    const lackingInfo = companies.filter(
      (company) =>
        scoreMap.get(company.id)?.needsValidation ||
        company.jobStatus === "unknown" ||
        company.needsRefresh,
    );

    return { deadlineSoon, waitingResponse, followUpNeeded, lackingInfo };
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

  function confirmDeleteCompany() {
    if (!pendingDeleteId || !userId) return;
    const companyId = pendingDeleteId;
    setCompanies((current) =>
      current.filter((company) => company.id !== companyId),
    );
    if (selectedId === companyId) {
      setSelectedId(
        companies.find((company) => company.id !== companyId)?.id ?? "",
      );
    }
    void deleteRemoteCompany(companyId, userId);
    setPendingDeleteId(null);
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
    if (!userId) return;
    const ownedSeed = cloneSampleCompaniesForUser();
    localStorageRepository.reset(userId);
    setCompanies(ownedSeed);
    setSettings(DEFAULT_CRITERIA_SETTINGS);
    setSelectedId(ownedSeed[0]?.id ?? "");
    setRemotePushEnabled(true);
    if (isRemoteSyncEnabled()) {
      void pushRemoteCompanies(ownedSeed, userId);
    }
  }

  async function signOut() {
    const supabase = getSupabaseClient();
    await supabase?.auth.signOut();
  }

  async function handleImportFile(file: File) {
    try {
      const { companies: incoming, settings: importedSettings } =
        await parseBackupFile(file);
      setCompanies((current) => mergeCompanies(current, incoming));
      if (importedSettings) setSettings(importedSettings);
      showToast(`${incoming.length}개 회사를 가져왔습니다.`);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "가져오기에 실패했습니다.",
      );
    }
  }

  useKeyboardShortcuts({
    onNewCompany: () => {
      if (viewMode === "dashboard") startCreate();
    },
    onEscape: () => {
      if (viewMode !== "dashboard") {
        setEditingCompany(null);
        setViewMode("dashboard");
      }
    },
    onFocusSearch: () => {
      const input = document.querySelector<HTMLInputElement>(
        'input[data-shortcut="search"]',
      );
      input?.focus();
    },
    onOpenStats: () => {
      if (viewMode === "dashboard") setViewMode("stats");
    },
  });

  const pendingDeleteCompany = pendingDeleteId
    ? companies.find((company) => company.id === pendingDeleteId)
    : null;

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        로그인 상태를 확인하는 중...
      </main>
    );
  }

  if (!session) {
    return <AuthGate />;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-4 py-5 sm:px-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Building2 className="h-4 w-4" />
              Career Company Tracker
              {isRemoteSyncEnabled() ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  Supabase 동기화
                </span>
              ) : null}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
              좋은 회사 후보를 평가하고 추적
            </h1>
            <div className="mt-1 text-xs text-slate-500">
              {userEmail} · 사용자별 Supabase row로 저장
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              aria-label="지원 통계 보기"
              onClick={() => setViewMode("stats")}
              variant="secondary"
            >
              <BarChart3 className="h-4 w-4" />
              통계
            </Button>
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
            <Button onClick={signOut} variant="ghost">
              로그아웃
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="전체 회사" value={`${companies.length}`} />
          <Metric label="진행 중" value={`${summary.active}`} />
          <Metric label="평균 회사핏" value={formatScore(summary.average)} />
          <Metric label="우선순위 높음" value={`${summary.highPriority}`} />
          <Metric
            label="리스크 높음"
            tone={summary.highRisk > 0 ? "red" : "green"}
            value={`${summary.highRisk}`}
          />
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardSection
            companies={dashboardSections.deadlineSoon}
            label="마감 임박"
            onSelect={setSelectedId}
            tone="amber"
          />
          <DashboardSection
            companies={dashboardSections.waitingResponse}
            label="회신 대기"
            onSelect={setSelectedId}
            tone="blue"
          />
          <DashboardSection
            companies={dashboardSections.followUpNeeded}
            label="팔로업 필요"
            onSelect={setSelectedId}
            tone="red"
          />
          <DashboardSection
            companies={dashboardSections.lackingInfo}
            label="정보 부족 후보"
            onSelect={setSelectedId}
            tone="slate"
          />
        </section>

        {viewMode === "settings" ? (
          <CriteriaSettingsPanel
            onBack={() => setViewMode("dashboard")}
            onChange={setSettings}
            settings={settings}
          />
        ) : viewMode === "stats" ? (
          <StatsPanel
            companies={companies}
            onBack={() => setViewMode("dashboard")}
            scoreMap={scoreMap}
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
          <section className="grid min-h-[680px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-lg border border-slate-200 bg-white">
              <Toolbar
                listMode={listMode}
                onExport={() => exportBackup(companies, settings)}
                onImportFile={handleImportFile}
                onListModeChange={setListMode}
                onQueryChange={setQuery}
                onReset={resetSampleData}
                onSortModeChange={setSortMode}
                onStatusFilterChange={setStatusFilter}
                query={query}
                sortMode={sortMode}
                statusFilter={statusFilter}
              />
              {listMode === "kanban" ? (
                <KanbanBoard
                  companies={filteredCompanies}
                  onSelect={setSelectedId}
                  onStatusChange={(companyId, status) =>
                    patchCompany(companyId, { status })
                  }
                  scoreMap={scoreMap}
                  selectedId={selectedCompany?.id ?? ""}
                />
              ) : (
                <CompanyTable
                  companies={filteredCompanies}
                  onEdit={startEdit}
                  onSelect={setSelectedId}
                  scoreMap={scoreMap}
                  selectedId={selectedCompany?.id ?? ""}
                />
              )}
            </div>
            {selectedCompany && selectedScore ? (
              <CompanyDetailPanel
                company={selectedCompany}
                onDelete={(companyId) => setPendingDeleteId(companyId)}
                onEdit={startEdit}
                onPatch={patchCompany}
                score={selectedScore}
              />
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
                선택된 회사가 없습니다.
              </div>
            )}
          </section>
        )}

        <footer className="pb-2 text-center text-xs text-slate-400">
          단축키: <kbd className="rounded border border-slate-300 px-1">N</kbd> 회사
          추가 · <kbd className="rounded border border-slate-300 px-1">/</kbd> 검색 ·{" "}
          <kbd className="rounded border border-slate-300 px-1">S</kbd> 통계 ·{" "}
          <kbd className="rounded border border-slate-300 px-1">ESC</kbd> 돌아가기
        </footer>
      </div>

      <ConfirmDialog
        description={
          pendingDeleteCompany
            ? `"${pendingDeleteCompany.name}"의 평가, 리서치 로그, 면접 기록이 모두 삭제됩니다.`
            : undefined
        }
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDeleteCompany}
        open={pendingDeleteId !== null}
        title="회사를 삭제할까요?"
      />

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
