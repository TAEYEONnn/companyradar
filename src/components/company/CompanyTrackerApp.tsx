"use client";

import { AlertCircle, CheckCircle2, CloudOff, Loader2, Plus, RefreshCw } from "lucide-react";
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
import { importAndSaveEncryptionKey } from "@/lib/crypto";
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
  type SyncStatus,
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
import { AppSidebar, type SidebarBadges } from "./AppSidebar";
import { AuthGate } from "./AuthGate";
import { CandidateInboxPanel } from "./CandidateInboxPanel";
import { CompanyDrawer } from "./CompanyDrawer";
import { CompanyForm } from "./CompanyForm";
import { CompanyTable } from "./CompanyTable";
import { CriteriaSettingsPanel } from "./CriteriaSettingsPanel";
import { KanbanBoard } from "./KanbanBoard";
import { MigrationDialog } from "./MigrationDialog";
import {
  getDeadlineRank,
  getPriorityRank,
  isDeadlineSoon,
  isDueOrOverdue,
  type ListMode,
  type ViewMode,
} from "./shared";
import { ComparePanel } from "./ComparePanel";
import { StatsPanel } from "./StatsPanel";
import { TimelinePanel } from "./TimelinePanel";
import { TodayPanel } from "./TodayPanel";
import { type AdvancedFilter, EMPTY_ADVANCED_FILTER, Toolbar } from "./Toolbar";
import { cn, createId } from "@/lib/utils";

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
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [advancedFilter, setAdvancedFilter] = useState<AdvancedFilter>(EMPTY_ADVANCED_FILTER);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [remotePushEnabled, setRemotePushEnabled] = useState(true);
  const [storageWriteEnabled, setStorageWriteEnabled] = useState(true);
  const [migrationPrompt, setMigrationPrompt] =
    useState<MigrationPromptState | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: "idle",
    lastAt: "",
  });

  const debouncedPushRef = useRef(
    createDebouncedPush(1500, (status) => setSyncStatus(status)),
  );
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

      const score = scoreMap.get(company.id)?.companyFitScore ?? 0;
      const matchesMinScore = advancedFilter.minScore === 0 || score >= advancedFilter.minScore;
      const matchesGreen = !advancedFilter.hasGreenFlag || company.signals.greenFlags.length > 0;
      const matchesRed = !advancedFilter.hasRedFlag || company.signals.redFlags.length > 0;
      const matchesRisk = !advancedFilter.hasRisk || (scoreMap.get(company.id)?.riskCount ?? 0) > 0;
      const matchesInterviews = !advancedFilter.hasInterviews || company.interviewRounds.length > 0;

      return matchesStatus && matchesQuery && matchesMinScore && matchesGreen && matchesRed && matchesRisk && matchesInterviews;
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
  }, [companies, query, scoreMap, sortMode, statusFilter, advancedFilter]);

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

  const sidebarBadges = useMemo<SidebarBadges>(
    () => ({
      inbox: candidates.filter((c) => c.needsReview).length,
      followUp: companies.filter(
        (c) =>
          Boolean(c.jobDeadline) &&
          c.followUpTasks.some(
            (t) => !t.completed && Boolean(t.dueDate) && isDueOrOverdue(t.dueDate),
          ),
      ).length,
      deadline: companies.filter(isDeadlineSoon).length,
      waiting: companies.filter((c) =>
        ["applied", "interviewing"].includes(c.status),
      ).length,
    }),
    [companies, candidates],
  );

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
    setDrawerOpen(true);
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
      const {
        companies: incoming,
        settings: importedSettings,
        encryptionKey,
      } = await parseBackupFile(file);
      setCompanies((current) => mergeCompanies(current, incoming));
      if (importedSettings) setSettings(importedSettings);
      if (encryptionKey && userId) {
        await importAndSaveEncryptionKey(userId, encryptionKey);
      }
      const keyMsg = encryptionKey ? " (암호화 키 복원 완료)" : "";
      showToast(`${incoming.length}개 회사를 가져왔습니다.${keyMsg}`);
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
      if (drawerOpen) {
        setDrawerOpen(false);
      } else if (viewMode !== "dashboard") {
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
      <main className="min-h-screen bg-slate-100 p-5">
        <div className="mx-auto max-w-[1480px] space-y-4">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-[480px] animate-pulse rounded-xl bg-slate-200" />
        </div>
      </main>
    );
  }

  if (!session) {
    return <AuthGate />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-950">
      {/* ─── Sidebar ─── */}
      <AppSidebar
        badges={sidebarBadges}
        onNavigate={(mode) => {
          setViewMode(mode);
          setEditingCompany(null);
        }}
        onSignOut={() => void signOut()}
        userEmail={userEmail}
        viewMode={viewMode}
      />

      {/* ─── Main column ─── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5">
          <span className="text-sm font-semibold text-slate-700">
            Career Company Tracker
          </span>
          {isRemoteSyncEnabled() ? (
            <SyncStatusBadge
              onRetry={() =>
                void pushRemoteCompanies(companies, userId).then((ok) =>
                  setSyncStatus({
                    state: ok ? "ok" : "error",
                    lastAt: new Date().toISOString(),
                  }),
                )
              }
              status={syncStatus}
            />
          ) : null}
          <div className="flex-1" />
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" />
            회사 추가
          </Button>
        </header>

        {/* Summary bar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 py-2 text-sm text-slate-500">
          <span className="font-medium text-slate-800">{companies.length}개 회사</span>
          <span>·</span>
          <span>진행중 {summary.active}</span>
          <span>·</span>
          <span>평균핏 {formatScore(summary.average)}</span>
          <span>·</span>
          <span>우선순위 높음 {summary.highPriority}</span>
          <span>·</span>
          <span className={summary.highRisk > 0 ? "font-medium text-red-600" : ""}>
            리스크 {summary.highRisk}
          </span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4">
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
            ) : viewMode === "timeline" ? (
              <TimelinePanel
                companies={companies}
                onBack={() => setViewMode("dashboard")}
                onSelectCompany={(id) => {
                  setSelectedId(id);
                  setViewMode("dashboard");
                  setDrawerOpen(true);
                }}
              />
            ) : viewMode === "today" ? (
              <TodayPanel
                companies={companies}
                onBack={() => setViewMode("dashboard")}
                onSelectCompany={(id) => {
                  setSelectedId(id);
                  setViewMode("dashboard");
                  setDrawerOpen(true);
                }}
              />
            ) : viewMode === "compare" ? (
              <ComparePanel
                companies={companies.filter((c) => compareIds.includes(c.id))}
                onBack={() => setViewMode("dashboard")}
                onSelectCompany={(id) => {
                  setSelectedId(id);
                  setViewMode("dashboard");
                  setDrawerOpen(true);
                }}
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
              /* ─── Companies (table / kanban) ─── */
              <div className="rounded-lg border border-slate-200 bg-white">
                <Toolbar
                  advancedFilter={advancedFilter}
                  listMode={listMode}
                  onAdvancedFilterChange={setAdvancedFilter}
                  onExport={() => void exportBackup(companies, settings, userId)}
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
                {compareIds.length >= 2 && (
                  <div className="flex items-center justify-between border-b border-sky-100 bg-sky-50 px-4 py-2 text-sm">
                    <span className="font-medium text-sky-700">
                      {compareIds.length}개 선택됨
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
                        onClick={() => setCompareIds([])}
                        type="button"
                      >
                        선택 해제
                      </button>
                      <Button onClick={() => setViewMode("compare")} size="sm">
                        비교 보기 →
                      </Button>
                    </div>
                  </div>
                )}
                {listMode === "kanban" ? (
                  <KanbanBoard
                    companies={filteredCompanies}
                    onSelect={(id) => {
                      setSelectedId(id);
                      setDrawerOpen(true);
                    }}
                    onStatusChange={(companyId, status) =>
                      patchCompany(companyId, { status })
                    }
                    scoreMap={scoreMap}
                    selectedId={selectedCompany?.id ?? ""}
                  />
                ) : (
                  <CompanyTable
                    compareIds={compareIds}
                    companies={filteredCompanies}
                    onEdit={startEdit}
                    onSelect={(id) => {
                      setSelectedId(id);
                      setDrawerOpen(true);
                    }}
                    onToggleCompare={(id) =>
                      setCompareIds((prev) =>
                        prev.includes(id)
                          ? prev.filter((x) => x !== id)
                          : prev.length < 3
                            ? [...prev, id]
                            : prev,
                      )
                    }
                    scoreMap={scoreMap}
                    selectedId={selectedCompany?.id ?? ""}
                  />
                )}
              </div>
            )}

            <footer className="mt-6 pb-2 text-center text-xs text-slate-400">
              단축키:{" "}
              <kbd className="rounded border border-slate-300 px-1">N</kbd> 추가 ·{" "}
              <kbd className="rounded border border-slate-300 px-1">/</kbd> 검색 ·{" "}
              <kbd className="rounded border border-slate-300 px-1">S</kbd> 통계 ·{" "}
              <kbd className="rounded border border-slate-300 px-1">ESC</kbd> 닫기
              {" · "}v3.0.0
            </footer>
          </div>
        </div>
      </div>

      {/* ─── Company Drawer ─── */}
      <CompanyDrawer
        company={selectedCompany ?? null}
        onClose={() => setDrawerOpen(false)}
        onDelete={(id) => {
          setPendingDeleteId(id);
          setDrawerOpen(false);
        }}
        onEdit={(company) => {
          startEdit(company);
          setDrawerOpen(false);
        }}
        onPatch={patchCompany}
        open={drawerOpen}
        score={selectedScore ?? null}
        userId={userId}
      />

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
    </div>
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

function SyncStatusBadge({
  status,
  onRetry,
}: {
  status: SyncStatus;
  onRetry: () => void;
}) {
  const timeLabel = status.lastAt
    ? new Date(status.lastAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  if (status.state === "syncing") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
        <Loader2 className="h-3 w-3 animate-spin" />
        동기화 중…
      </span>
    );
  }
  if (status.state === "ok") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        동기화됨 {timeLabel}
      </span>
    );
  }
  if (status.state === "error") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
        <AlertCircle className="h-3 w-3" />
        동기화 실패
        <button
          className="ml-0.5 hover:text-red-800"
          onClick={onRetry}
          type="button"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </span>
    );
  }
  // idle — not yet synced this session
  return (
    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
      <CloudOff className="h-3 w-3" />
      Supabase 연결됨
    </span>
  );
}
