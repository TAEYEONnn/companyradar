"use client";

import { BarChart3, Building2, Inbox, Plus, Settings2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteCandidateInboxItem,
  pullCandidateInboxItems,
  upsertCandidateInboxItem,
} from "@/lib/candidate-sync";
import { exportBackup, mergeCompanies, parseBackupFile } from "@/lib/backup";
import { createEmptyCompany } from "@/lib/company-factory";
import { DEFAULT_CRITERIA_SETTINGS } from "@/lib/criteria";
import { planCompanyMigration } from "@/lib/migration";
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
  getMigrationCompletedAt,
  hasUserCompanies,
  localStorageRepository,
  markMigrationCompleted,
  readLegacyCompanies,
  readUserScopedCompanies,
} from "@/lib/storage";
import { getSupabaseClient } from "@/lib/supabase-client";
import type {
  ApplicationStatus,
  CandidateInboxItem,
  Company,
  CriteriaSettings,
  DiscoveryReason,
  SortMode,
} from "@/lib/types";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { AuthGate } from "./AuthGate";
import { CandidateInboxPanel } from "./CandidateInboxPanel";
import { CompanyDetailPanel } from "./CompanyDetailPanel";
import { CompanyForm } from "./CompanyForm";
import { CompanyTable } from "./CompanyTable";
import { CriteriaSettingsPanel } from "./CriteriaSettingsPanel";
import { DashboardSection } from "./DashboardSection";
import { KanbanBoard } from "./KanbanBoard";
import { MigrationDialog } from "./MigrationDialog";
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
import { createId } from "@/lib/utils";

interface MigrationPromptState {
  localCompanies: Company[];
  remoteCompanies: Company[];
}

export function CompanyTrackerApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [candidates, setCandidates] = useState<CandidateInboxItem[]>([]);
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
  const [storageWriteEnabled, setStorageWriteEnabled] = useState(true);
  const [migrationPrompt, setMigrationPrompt] =
    useState<MigrationPromptState | null>(null);
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
        setCandidates([]);
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

      const userScopedCompanies = readUserScopedCompanies(userId);
      const legacyCompanies = readLegacyCompanies();
      const loadedCompanies =
        userScopedCompanies.length > 0 ? userScopedCompanies : legacyCompanies;
      const loadedSettings = localStorageRepository.loadSettings(userId);
      const migrationCompletedAt = getMigrationCompletedAt(userId);
      setSettings(loadedSettings);

      const remoteCandidates = await pullCandidateInboxItems(userId);
      if (remoteCandidates === null) {
        setCandidates([]);
        showToast("Candidate Inbox 테이블을 불러오지 못했습니다. migration 적용을 확인하세요.");
      } else {
        setCandidates(remoteCandidates);
      }

      let remoteCompanies: Company[] = [];

      if (isRemoteSyncEnabled()) {
        const remote = await pullRemoteCompanies(userId);
        if (remote === null) {
          setCompanies(loadedCompanies);
          setSelectedId(loadedCompanies[0]?.id ?? "");
          setRemotePushEnabled(false);
          setStorageWriteEnabled(true);
          setIsReady(true);
          showToast("Supabase 데이터를 불러오지 못해 로컬 데이터만 표시합니다.");
          return;
        }
        remoteCompanies = remote ?? [];
      }

      if (
        !migrationCompletedAt &&
        hasUserCompanies(loadedCompanies)
      ) {
        const displayCompanies =
          remoteCompanies.length > 0 ? remoteCompanies : loadedCompanies;
        setCompanies(displayCompanies);
        setSelectedId(displayCompanies[0]?.id ?? "");
        setRemotePushEnabled(false);
        setStorageWriteEnabled(false);
        setMigrationPrompt({
          localCompanies: loadedCompanies,
          remoteCompanies,
        });
        setIsReady(true);
        return;
      }

      if (remoteCompanies.length > 0) {
          const merged = mergeByUpdatedAt([], remoteCompanies);
          setCompanies(merged);
          setSelectedId(merged[0]?.id ?? "");
          setStorageWriteEnabled(true);
          setIsReady(true);
          showToast("Supabase에서 데이터를 동기화했습니다.");
          return;
      }

      if (hasUserCompanies(loadedCompanies)) {
        setCompanies(loadedCompanies);
        setSelectedId(loadedCompanies[0]?.id ?? "");
        setRemotePushEnabled(true);
        setStorageWriteEnabled(true);
        setIsReady(true);
        if (isRemoteSyncEnabled()) {
          void pushRemoteCompanies(loadedCompanies, userId);
        }
        return;
      }

      const ownedSeed = cloneSampleCompaniesForUser();
      setCompanies(ownedSeed);
      setSelectedId(ownedSeed[0]?.id ?? "");
      setStorageWriteEnabled(true);
      setIsReady(true);
      if (isRemoteSyncEnabled()) {
        void pushRemoteCompanies(ownedSeed, userId);
      }
    });
  }, [userId]);

  // 저장: localStorage 즉시 + Supabase 디바운스 push
  useEffect(() => {
    if (!isReady || !userId) return;
    if (storageWriteEnabled) {
      localStorageRepository.saveCompanies(companies, userId);
    }
    if (remotePushEnabled) debouncedPushRef.current(companies, userId);
  }, [companies, isReady, remotePushEnabled, storageWriteEnabled, userId]);

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

  function createCandidate(draft: {
    sourceUrl: string;
    rawText: string;
    discoveryReason: DiscoveryReason;
    firstImpressionNote: string;
  }) {
    if (!userId) return;
    const now = new Date().toISOString();
    const candidate: CandidateInboxItem = {
      id: createId("candidate"),
      sourceUrl: draft.sourceUrl.trim(),
      rawText: draft.rawText.trim(),
      discoveryReason: draft.discoveryReason,
      firstImpressionNote: draft.firstImpressionNote.trim(),
      parsedCompany: null,
      parseStatus: "idle",
      needsReview: true,
      promotedCompanyId: "",
      createdAt: now,
      updatedAt: now,
    };
    setCandidates((current) => [candidate, ...current]);
    void upsertCandidateInboxItem(candidate, userId).then((saved) => {
      if (!saved) showToast("Candidate Inbox 저장에 실패했습니다.");
    });
  }

  function removeCandidate(candidateId: string) {
    if (!userId) return;
    setCandidates((current) =>
      current.filter((candidate) => candidate.id !== candidateId),
    );
    void deleteCandidateInboxItem(candidateId, userId).then((deleted) => {
      if (!deleted) showToast("Candidate Inbox 삭제에 실패했습니다.");
    });
  }

  function promoteCandidate(candidate: CandidateInboxItem) {
    if (!userId || candidate.promotedCompanyId) return;
    const company = createCompanyFromCandidate(candidate);
    upsertCompany(company);
    const updatedCandidate = {
      ...candidate,
      needsReview: false,
      promotedCompanyId: company.id,
      updatedAt: new Date().toISOString(),
    };
    setCandidates((current) =>
      current.map((item) =>
        item.id === candidate.id ? updatedCandidate : item,
      ),
    );
    void upsertCandidateInboxItem(updatedCandidate, userId).then((saved) => {
      if (!saved) showToast("승격 상태 저장에 실패했습니다.");
    });
    showToast(`${company.name} 후보를 회사 목록으로 승격했습니다.`);
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

  const migrationPlan = useMemo(() => {
    if (!migrationPrompt) return null;
    return planCompanyMigration(
      migrationPrompt.localCompanies,
      migrationPrompt.remoteCompanies,
    );
  }, [migrationPrompt]);

  async function uploadLocalCompaniesToSupabase() {
    if (!migrationPrompt || !migrationPlan || !userId) return;
    const nextCompanies = mergeByUpdatedAt(
      migrationPrompt.remoteCompanies,
      migrationPlan.uniqueLocalCompanies,
    );
    const pushed = isRemoteSyncEnabled()
      ? await pushRemoteCompanies(nextCompanies, userId)
      : false;
    if (!pushed) {
      showToast("Supabase 업로드에 실패했습니다. 로컬 데이터는 유지됩니다.");
      return;
    }
    localStorageRepository.saveCompanies(nextCompanies, userId);
    markMigrationCompleted(userId);
    setCompanies(nextCompanies);
    setSelectedId(nextCompanies[0]?.id ?? "");
    setRemotePushEnabled(true);
    setStorageWriteEnabled(true);
    setMigrationPrompt(null);
    showToast(
      migrationPlan.duplicates.length > 0
        ? `${migrationPlan.uniqueLocalCompanies.length}개 업로드, ${migrationPlan.duplicates.length}개는 병합 후보로 제외했습니다.`
        : `${migrationPlan.uniqueLocalCompanies.length}개 로컬 회사를 Supabase에 업로드했습니다.`,
    );
  }

  async function useRemoteCompaniesOnly() {
    if (!migrationPrompt || !userId) return;
    const nextCompanies =
      migrationPrompt.remoteCompanies.length > 0
        ? migrationPrompt.remoteCompanies
        : cloneSampleCompaniesForUser();
    const pushed =
      migrationPrompt.remoteCompanies.length > 0 || !isRemoteSyncEnabled()
        ? true
        : await pushRemoteCompanies(nextCompanies, userId);
    if (!pushed) {
      showToast("Supabase 초기 seed 저장에 실패했습니다.");
      return;
    }
    localStorageRepository.saveCompanies(nextCompanies, userId);
    markMigrationCompleted(userId);
    setCompanies(nextCompanies);
    setSelectedId(nextCompanies[0]?.id ?? "");
    setRemotePushEnabled(true);
    setStorageWriteEnabled(true);
    setMigrationPrompt(null);
    showToast("Supabase 데이터를 기준으로 사용합니다.");
  }

  function backupLocalCompaniesForLater() {
    if (!migrationPrompt) return;
    exportBackup(migrationPrompt.localCompanies, settings);
    setCompanies(migrationPrompt.localCompanies);
    setSelectedId(migrationPrompt.localCompanies[0]?.id ?? "");
    setRemotePushEnabled(false);
    setStorageWriteEnabled(true);
    setMigrationPrompt(null);
    showToast("JSON 백업을 생성했습니다. 이번 세션은 로컬 데이터로 계속합니다.");
  }

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
              aria-label="Candidate Inbox 보기"
              onClick={() => setViewMode("inbox")}
              variant="secondary"
            >
              <Inbox className="h-4 w-4" />
              후보 {candidates.filter((candidate) => candidate.needsReview).length}
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
        ) : viewMode === "inbox" ? (
          <CandidateInboxPanel
            candidates={candidates}
            onBack={() => setViewMode("dashboard")}
            onCreate={createCandidate}
            onDelete={removeCandidate}
            onPromote={promoteCandidate}
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

      {migrationPrompt && migrationPlan ? (
        <MigrationDialog
          localCompanies={migrationPrompt.localCompanies}
          migrationPlan={migrationPlan}
          onBackupLater={backupLocalCompaniesForLater}
          onUploadLocal={uploadLocalCompaniesToSupabase}
          onUseRemoteOnly={useRemoteCompaniesOnly}
          remoteCompanies={migrationPrompt.remoteCompanies}
        />
      ) : null}
    </main>
  );
}

function createCompanyFromCandidate(candidate: CandidateInboxItem): Company {
  const now = new Date().toISOString();
  const company = createEmptyCompany();
  const inferredName =
    candidate.parsedCompany?.name ||
    getHostLabel(candidate.sourceUrl) ||
    "검토 후보";

  return {
    ...company,
    name: inferredName,
    homepageUrl: candidate.sourceUrl,
    jobPostUrl: candidate.sourceUrl,
    sourceUrls: candidate.sourceUrl ? [candidate.sourceUrl] : [],
    discoveryReason: candidate.discoveryReason,
    firstImpressionNote: candidate.firstImpressionNote,
    candidateReason:
      candidate.firstImpressionNote || "Candidate Inbox에서 승격한 후보입니다.",
    memo: candidate.rawText,
    evidenceLevel: 1,
    sourceConfidence: 1,
    needsRefresh: true,
    createdAt: now,
    updatedAt: now,
  };
}

function getHostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
