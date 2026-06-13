"use client";

import { AlertCircle, CheckCircle2, CloudOff, Loader2, Menu, Plus, RefreshCw, Trash2, X } from "lucide-react";
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
import {
  getCompanyValidationReasons,
  getValidationCompletePatch,
  VALIDATION_REASON_LABELS,
} from "@/lib/company-validation";
import { importAndSaveEncryptionKey } from "@/lib/crypto";
import { createEmptyCompany } from "@/lib/company-factory";
import { DEFAULT_CRITERIA_SETTINGS, ROLE_LABELS } from "@/lib/criteria";
import { isDevToolsEnabled } from "@/lib/dev-tools";
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
  loadUserRole,
  localStorageRepository,
  markMigrationCompleted,
  normalizeSamplesForRole,
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
import { OnboardingModal } from "./OnboardingModal";
import { AuthGate } from "./AuthGate";
import { BillingPrompt } from "./BillingPrompt";
import { CandidateInboxPanel } from "./CandidateInboxPanel";
import { CompanyDrawer } from "./CompanyDrawer";
import { CompanyForm } from "./CompanyForm";
import { CompanyTable } from "./CompanyTable";
import { CriteriaSettingsPanel } from "./CriteriaSettingsPanel";
import { CoachPanel } from "./CoachPanel";
import { KanbanBoard } from "./KanbanBoard";
import { MigrationDialog } from "./MigrationDialog";
import {
  getDeadlineRank,
  getPriorityRank,
  isDeadlineSoon,
  type DrawerFocusTarget,
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

const ROLE_SAMPLE_NAMES: Record<string, string> = {
  designer: "토스",
  pm: "당근",
  frontend: "채널코퍼레이션",
  ux_researcher: "LINE Plus",
  marketer: "카카오스타일",
};

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
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [advancedFilter, setAdvancedFilter] = useState<AdvancedFilter>(EMPTY_ADVANCED_FILTER);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFocusTarget, setDrawerFocusTarget] = useState<DrawerFocusTarget>({ tab: "summary" });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [remotePushEnabled, setRemotePushEnabled] = useState(true);
  const [storageWriteEnabled, setStorageWriteEnabled] = useState(true);
  const [migrationPrompt, setMigrationPrompt] =
    useState<MigrationPromptState | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [selectedDeleteOpen, setSelectedDeleteOpen] = useState(false);
  const [sampleResetOpen, setSampleResetOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: "idle",
    lastAt: "",
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [browserOrigin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );

  const debouncedPushRef = useRef(
    createDebouncedPush(1500, (status) => setSyncStatus(status)),
  );
  const userId = session?.user.id ?? "";
  const userEmail = session?.user.email ?? "";
  const devToolsEnabled = useMemo(
    () => isDevToolsEnabled({ origin: browserOrigin, userEmail }),
    [browserOrigin, userEmail],
  );
  const effectiveUserId = userId || (devToolsEnabled ? "dev_local_user" : "");

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
        setDeletionRequested(false);
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
      const loadedCompanies = userScopedCompanies;
      const loadedSettings = localStorageRepository.loadSettings(userId);
      const preferredRole = loadedSettings.userRole ?? loadUserRole(userId) ?? "designer";
      const migrationCompletedAt = getMigrationCompletedAt(userId);
      setSettings(loadedSettings);
      if (shouldShowOnboarding(loadedSettings, userEmail, devToolsEnabled)) {
        setShowOnboarding(true);
      }

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
          const fallbackCompanies = normalizeSamplesForRole(
            loadedCompanies.length > 0 ? loadedCompanies : [],
            preferredRole,
          );
          setCompanies(fallbackCompanies);
          setSelectedId(fallbackCompanies[0]?.id ?? "");
          setRemotePushEnabled(false);
          setStorageWriteEnabled(true);
          setIsReady(true);
          showToast("Supabase 데이터를 불러오지 못해 이 기기 저장소에 임시 저장합니다.");
          return;
        }
        remoteCompanies = remote ?? [];
      }

      if (
        !migrationCompletedAt &&
        userScopedCompanies.length === 0 &&
        hasUserCompanies(legacyCompanies)
      ) {
        const displayCompanies =
          remoteCompanies.length > 0 ? remoteCompanies : legacyCompanies;
        setCompanies(displayCompanies);
        setSelectedId(displayCompanies[0]?.id ?? "");
        setRemotePushEnabled(false);
        setStorageWriteEnabled(false);
        setMigrationPrompt({
          localCompanies: legacyCompanies,
          remoteCompanies,
        });
        setIsReady(true);
        return;
      }

      if (remoteCompanies.length > 0) {
        const merged = normalizeSamplesForRole(
          mergeByUpdatedAt(loadedCompanies, remoteCompanies),
          preferredRole,
        );
        const localHasUserCompanies = hasUserCompanies(loadedCompanies);
        const remoteHasUserCompanies = hasUserCompanies(remoteCompanies);
        const mergedDiffersFromRemote =
          companySyncSignature(merged) !== companySyncSignature(remoteCompanies);

        setCompanies(merged);
        setSelectedId(merged[0]?.id ?? "");
        setStorageWriteEnabled(true);
        setIsReady(true);

        if (isRemoteSyncEnabled() && mergedDiffersFromRemote) {
          void pushRemoteCompanies(merged, userId);
        }

        showToast(
          localHasUserCompanies && (mergedDiffersFromRemote || !remoteHasUserCompanies)
            ? "기기 데이터와 Supabase 데이터를 병합했습니다."
            : "Supabase에서 데이터를 동기화했습니다.",
        );
        return;
      }

      if (hasUserCompanies(loadedCompanies)) {
        const normalizedCompanies = normalizeSamplesForRole(loadedCompanies, preferredRole);
        setCompanies(normalizedCompanies);
        setSelectedId(normalizedCompanies[0]?.id ?? "");
        setRemotePushEnabled(true);
        setStorageWriteEnabled(true);
        setIsReady(true);
        if (isRemoteSyncEnabled()) {
          void pushRemoteCompanies(normalizedCompanies, userId);
        }
        return;
      }

      const ownedSeed = normalizeSamplesForRole([], preferredRole);
      setCompanies(ownedSeed);
      setSelectedId(ownedSeed[0]?.id ?? "");
      setStorageWriteEnabled(true);
      setIsReady(true);
      if (shouldShowOnboarding(loadedSettings, userEmail, devToolsEnabled)) {
        setShowOnboarding(true);
      }
      if (isRemoteSyncEnabled()) {
        void pushRemoteCompanies(ownedSeed, userId);
      }
    });
  }, [devToolsEnabled, userEmail, userId]);

  useEffect(() => {
    if (!userId) return;
    queueMicrotask(async () => {
      const token = session?.access_token;
      if (!token) return;
      try {
        const res = await fetch("/api/account/delete-request", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as { ok?: boolean; request?: unknown };
        if (res.ok && json.ok) setDeletionRequested(Boolean(json.request));
      } catch {
        // 탈퇴 요청 상태는 보조 표시이므로 실패해도 앱 사용을 막지 않습니다.
      }
    });
  }, [session?.access_token, userId]);

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
      const validationReasons = getCompanyValidationReasons(company);
      const matchesValidation =
        !advancedFilter.needsValidation ||
        scoreMap.get(company.id)?.needsValidation ||
        validationReasons.length > 0;

      return matchesStatus && matchesQuery && matchesMinScore && matchesGreen && matchesRed && matchesRisk && matchesInterviews && matchesValidation;
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

  const hasOnlySampleCompanies =
    companies.length > 0 && companies.every((company) => company.isSampleData);

  const dashboardSections = useMemo(() => {
    const deadlineSoon = companies.filter(isDeadlineSoon);
    const waitingResponse = companies.filter((company) =>
      ["applied", "interviewing"].includes(company.status),
    );
    const followUpNeeded = companies.filter((company) =>
      company.followUpTasks.some(
        (task) => !task.completed && task.dueDate && Date.parse(task.dueDate) <= Date.now(),
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
      deadline: companies.filter(isDeadlineSoon).length,
    }),
    [companies, candidates],
  );

  function openCompanyDrawer(id: string, focusTarget: DrawerFocusTarget = { tab: "summary" }) {
    setSelectedId(id);
    setDrawerFocusTarget(focusTarget);
    setDrawerOpen(true);
  }

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
    setViewMode("dashboard");
    openCompanyDrawer(nextCompany.id);
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
    setDrawerOpen(false);
  }

  function confirmSelectedDeleteCompanies() {
    if (selectedCompanyIds.length === 0 || !userId) return;
    const ids = new Set(selectedCompanyIds);
    setCompanies((current) => current.filter((company) => !ids.has(company.id)));
    if (ids.has(selectedId)) {
      setSelectedId(companies.find((company) => !ids.has(company.id))?.id ?? "");
      setDrawerOpen(false);
    }
    for (const id of selectedCompanyIds) {
      void deleteRemoteCompany(id, userId);
    }
    setSelectedCompanyIds([]);
    setSelectedDeleteOpen(false);
    showToast(`${ids.size}개 회사를 삭제했습니다.`);
  }

  function patchCompany(companyId: string, patch: Partial<Company>) {
    setCompanies((current) =>
      current.map((company) => {
        if (company.id !== companyId) return company;
        const next = { ...company, ...patch, updatedAt: new Date().toISOString() };
        if (patch.status && patch.status !== company.status) {
          next.statusHistory = [
            { status: patch.status, date: new Date().toISOString().slice(0, 10), note: "" },
            ...(company.statusHistory ?? []),
          ];
        }
        return next;
      }),
    );
  }

  function completeFollowUpTask(companyId: string, taskId: string) {
    setCompanies((current) =>
      current.map((company) =>
        company.id === companyId
          ? {
              ...company,
              followUpTasks: company.followUpTasks.map((task) =>
                task.id === taskId
                  ? { ...task, completed: true, completedAt: new Date().toISOString() }
                  : task,
              ),
              updatedAt: new Date().toISOString(),
            }
          : company,
      ),
    );
  }

  function reopenFollowUpTask(companyId: string, taskId: string) {
    setCompanies((current) =>
      current.map((company) =>
        company.id === companyId
          ? {
              ...company,
              followUpTasks: company.followUpTasks.map((task) =>
                task.id === taskId
                  ? { ...task, completed: false, completedAt: undefined }
                  : task,
              ),
              updatedAt: new Date().toISOString(),
            }
          : company,
      ),
    );
  }

  function deleteFollowUpTask(companyId: string, taskId: string) {
    setCompanies((current) =>
      current.map((company) =>
        company.id === companyId
          ? {
              ...company,
              followUpTasks: company.followUpTasks.filter((task) => task.id !== taskId),
              updatedAt: new Date().toISOString(),
            }
          : company,
      ),
    );
  }

  function markCompanyVerified(companyId: string) {
    patchCompany(companyId, getValidationCompletePatch());
    showToast("공고 확인일을 오늘로 기록했습니다.");
  }

  function startCreate() {
    setEditingCompany(createEmptyCompany());
    setViewMode("form");
  }

  function startEdit(company: Company) {
    setEditingCompany(company);
    setViewMode("form");
  }

  function updateSettings(nextSettings: CriteriaSettings) {
    const previousRole = settings.userRole;
    setSettings(nextSettings);
    if (nextSettings.userRole && nextSettings.userRole !== previousRole) {
      setCompanies((current) => normalizeSamplesForRole(current, nextSettings.userRole));
    }
  }

  function resetSampleData() {
    if (!userId) return;
    const ownedSeed = cloneSampleCompaniesForUser(settings.userRole ?? "designer");
    localStorageRepository.reset(userId);
    setCompanies(ownedSeed);
    setSettings(DEFAULT_CRITERIA_SETTINGS);
    setSelectedId(ownedSeed[0]?.id ?? "");
    setSelectedCompanyIds([]);
    setRemotePushEnabled(true);
    if (isRemoteSyncEnabled()) {
      void pushRemoteCompanies(ownedSeed, userId);
    }
    setSampleResetOpen(false);
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

  async function deleteAccount(reason: string, confirmText: string) {
    if (!userId || !session?.access_token) return false;
    try {
      const res = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reason, confirmText }),
      });
      if (!res.ok) return false;
      setDeletionRequested(true);
      return true;
    } catch {
      return false;
    }
  }

  async function resetPassword() {
    if (!userEmail) return;
    const supabase = getSupabaseClient();
    const { error } = await supabase?.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    }) ?? { error: null };
    if (error) {
      showToast("메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } else {
      showToast(`${userEmail}로 비밀번호 재설정 메일을 보냈습니다.`);
    }
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
      if (viewMode === "dashboard") {
        setMobileMenuOpen(false);
        startCreate();
      }
    },
    onEscape: () => {
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
      } else if (drawerOpen) {
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
        : cloneSampleCompaniesForUser(settings.userRole ?? "designer");
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
    <div className="flex min-h-screen flex-col overflow-hidden bg-slate-100 text-slate-950 md:h-screen md:flex-row">
      {/* ─── Sidebar ─── */}
      <AppSidebar
        appliedCount={
          companies.filter((c) => c.status === "applied").length
        }
        badges={sidebarBadges}
        className="hidden md:flex"
        devToolsEnabled={devToolsEnabled}
        onNavigate={(mode) => {
          setViewMode(mode);
          setEditingCompany(null);
        }}
        onSignOut={() => void signOut()}
        userEmail={userEmail}
        viewMode={viewMode}
      />

      {/* ─── Mobile sidebar drawer ─── */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 md:hidden",
          mobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileMenuOpen(false)}
      />
      <div
        aria-label="모바일 메뉴"
        aria-modal="true"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-white shadow-2xl transition-transform duration-200 ease-in-out md:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
        role="dialog"
      >
        <button
          aria-label="메뉴 닫기"
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
        <AppSidebar
          appliedCount={
            companies.filter((c) => c.status === "applied").length
          }
          badges={sidebarBadges}
          className="h-full w-full border-r-0"
          devToolsEnabled={devToolsEnabled}
          onNavigate={(mode) => {
            setViewMode(mode);
            setEditingCompany(null);
            setMobileMenuOpen(false);
          }}
          onSignOut={() => {
            setMobileMenuOpen(false);
            void signOut();
          }}
          userEmail={userEmail}
          viewMode={viewMode}
        />
      </div>

      {/* ─── Main column ─── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 sm:px-5">
          <Button
            aria-label="메뉴 열기"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(true)}
            size="sm"
            variant="secondary"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <span className="truncate text-sm font-semibold text-slate-700">
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
            <span className="hidden sm:inline">회사 추가</span>
          </Button>
        </header>

        {/* Summary bar */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 sm:px-5">
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
          <div className="p-3 sm:p-4">
            {viewMode === "settings" ? (
              <CriteriaSettingsPanel
                deletionRequested={deletionRequested}
                onBack={() => setViewMode("dashboard")}
                onChange={updateSettings}
                onDeleteAccount={deleteAccount}
                onExport={() => void exportBackup(companies, settings, userId)}
                onImportFile={handleImportFile}
                onResetPassword={() => void resetPassword()}
                onSignOut={() => void signOut()}
                onToast={showToast}
                settings={settings}
                userEmail={userEmail}
              />
            ) : viewMode === "inbox" ? (
              <CandidateInboxPanel
                candidates={candidates}
                companies={companies}
                onBack={() => setViewMode("dashboard")}
                onCreate={createCandidate}
                onDelete={removeCandidate}
                onPromote={promoteCandidate}
                onSelectCompany={(id) => {
                  setViewMode("dashboard");
                  openCompanyDrawer(id);
                }}
              />
            ) : viewMode === "stats" ? (
              <StatsPanel
                companies={companies}
                onBack={() => setViewMode("dashboard")}
                scoreMap={scoreMap}
                settings={settings}
              />
            ) : viewMode === "timeline" ? (
              <TimelinePanel
                companies={companies}
                onBack={() => setViewMode("dashboard")}
                onSelectCompany={openCompanyDrawer}
              />
            ) : viewMode === "today" ? (
              <TodayPanel
                companies={companies}
                onCompleteFollowUpTask={completeFollowUpTask}
                onDeleteFollowUpTask={deleteFollowUpTask}
                onMarkVerified={markCompanyVerified}
                onOpenCompanyList={() => setViewMode("dashboard")}
                onReopenFollowUpTask={reopenFollowUpTask}
                onSelectCompany={openCompanyDrawer}
              />
            ) : viewMode === "coach" ? (
              <CoachPanel
                companies={companies}
                settings={settings}
                onBack={() => setViewMode("dashboard")}
                scoreMap={scoreMap}
              />
            ) : viewMode === "compare" ? (
              <ComparePanel
                companies={companies.filter((c) => selectedCompanyIds.includes(c.id))}
                onBack={() => setViewMode("dashboard")}
                onSelectCompany={(id) => {
                  setViewMode("dashboard");
                  openCompanyDrawer(id);
                }}
                scoreMap={scoreMap}
              />
            ) : viewMode === "form" && editingCompany ? (
              <CompanyForm
                company={editingCompany}
                settings={settings}
                onCancel={() => {
                  setEditingCompany(null);
                  setViewMode("dashboard");
                }}
                onSubmit={upsertCompany}
              />
            ) : (
              /* ─── Companies (table / kanban) ─── */
              <div className="rounded-lg border border-slate-200 bg-white">
                {hasOnlySampleCompanies ? (
                  <div className="border-b border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800">
                    현재 직군 예시 회사 1개만 표시 중입니다. 새 회사를 추가하면 로그인 계정 기준으로 자동 저장됩니다.
                  </div>
                ) : null}
                <Toolbar
                  advancedFilter={advancedFilter}
                  devToolsEnabled={devToolsEnabled}
                  listMode={listMode}
                  onAdvancedFilterChange={setAdvancedFilter}
                  onListModeChange={setListMode}
                  onQueryChange={setQuery}
                  onReset={() => setSampleResetOpen(true)}
                  onSortModeChange={setSortMode}
                  onStatusFilterChange={setStatusFilter}
                  query={query}
                  sortMode={sortMode}
                  statusFilter={statusFilter}
                />
                {selectedCompanyIds.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 bg-sky-50 px-4 py-2 text-sm">
                    <div>
                      <span className="font-medium text-sky-700">
                        {selectedCompanyIds.length}개 선택됨
                      </span>
                      <span className="ml-2 text-xs text-sky-600">
                        삭제 가능 · 비교는 2-3개 선택 시 가능
                      </span>
                      {selectedCompanyIds.length > 3 && (
                        <span className="ml-2 text-xs font-medium text-amber-700">
                          비교는 최대 3개까지 가능
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
                        onClick={() => setSelectedCompanyIds([])}
                        type="button"
                      >
                        선택 해제
                      </button>
                      {selectedCompanyIds.length >= 2 && selectedCompanyIds.length <= 3 && (
                        <Button onClick={() => setViewMode("compare")} size="sm">
                          비교 보기 →
                        </Button>
                      )}
                      <Button
                        onClick={() => setSelectedDeleteOpen(true)}
                        size="sm"
                        variant="danger"
                      >
                        <Trash2 className="h-4 w-4" />
                        선택 삭제
                      </Button>
                    </div>
                  </div>
                )}
                {listMode === "kanban" ? (
                  <KanbanBoard
                    companies={filteredCompanies}
                    onSelect={openCompanyDrawer}
                    onStatusChange={(companyId, status) =>
                      patchCompany(companyId, { status })
                    }
                    scoreMap={scoreMap}
                    selectedId={selectedCompany?.id ?? ""}
                  />
                ) : (
                  <CompanyTable
                    companies={filteredCompanies}
                    onAddCompany={startCreate}
                    onEdit={startEdit}
                    onResetFilter={() => {
                      setQuery("");
                      setStatusFilter("all");
                      setAdvancedFilter(EMPTY_ADVANCED_FILTER);
                    }}
                    onSelect={openCompanyDrawer}
                    onSetSelectedIds={setSelectedCompanyIds}
                    onToggleSelected={(id) =>
                      setSelectedCompanyIds((prev) =>
                        prev.includes(id)
                          ? prev.filter((x) => x !== id)
                          : [...prev, id],
                      )
                    }
                    scoreMap={scoreMap}
                    selectedIds={selectedCompanyIds}
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
              {" · "}v4.0.0
            </footer>
          </div>
        </div>
      </div>

      {/* ─── Company Drawer ─── */}
      <CompanyDrawer
        company={selectedCompany ?? null}
        focusTarget={drawerFocusTarget}
        hasNext={
          selectedCompany
            ? filteredCompanies.findIndex((c) => c.id === selectedCompany.id) < filteredCompanies.length - 1
            : false
        }
        hasPrev={
          selectedCompany
            ? filteredCompanies.findIndex((c) => c.id === selectedCompany.id) > 0
            : false
        }
        onClose={() => setDrawerOpen(false)}
        onDelete={(id) => {
          setPendingDeleteId(id);
        }}
        onEdit={(company) => {
          startEdit(company);
          setDrawerOpen(false);
        }}
        onNext={() => {
          if (!selectedCompany) return;
          const idx = filteredCompanies.findIndex((c) => c.id === selectedCompany.id);
          const next = filteredCompanies[idx + 1];
          if (next) openCompanyDrawer(next.id);
        }}
        onPatch={patchCompany}
        onPrev={() => {
          if (!selectedCompany) return;
          const idx = filteredCompanies.findIndex((c) => c.id === selectedCompany.id);
          const prev = filteredCompanies[idx - 1];
          if (prev) openCompanyDrawer(prev.id);
        }}
        onToast={showToast}
        open={drawerOpen}
        score={selectedScore ?? null}
        settings={settings}
        userId={effectiveUserId}
      />

      <ConfirmDialog
        description={
          pendingDeleteCompany
            ? `"${pendingDeleteCompany.name}"의 평가, 회사 조사 메모, 면접 기록이 모두 삭제됩니다.`
            : undefined
        }
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDeleteCompany}
        open={pendingDeleteId !== null}
        title="회사를 삭제할까요?"
      />

      <ConfirmDialog
        confirmLabel="선택 삭제"
        description={`${selectedCompanyIds.length}개 회사의 평가, 회사 조사 메모, 면접 기록이 모두 삭제됩니다.`}
        onCancel={() => setSelectedDeleteOpen(false)}
        onConfirm={confirmSelectedDeleteCompanies}
        open={selectedDeleteOpen}
        title="선택한 회사를 삭제할까요?"
      />

      <ConfirmDialog
        confirmLabel="예시 데이터로 교체"
        description={(() => {
          const role = settings.userRole ?? "designer";
          const sampleName = ROLE_SAMPLE_NAMES[role] ?? "";
          const roleName = ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
          return `현재 목록을 지우고 ${roleName} 직군 예시 데이터(${sampleName})로 교체합니다. 기존 데이터는 JSON 백업 후 진행하는 것을 권장합니다.`;
        })()}
        onCancel={() => setSampleResetOpen(false)}
        onConfirm={resetSampleData}
        open={sampleResetOpen}
        title="예시 데이터로 교체할까요?"
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

      <BillingPrompt />

      {showOnboarding && (
        <OnboardingModal
          allowSkip={devToolsEnabled}
          userId={userId}
          onComplete={(role, patch) => {
            setSettings((prev) => ({ ...prev, ...patch }));
            setCompanies((current) => normalizeSamplesForRole(current, role));
            setShowOnboarding(false);
          }}
          onSkip={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}

function companySyncSignature(companies: Company[]) {
  return companies
    .map((company) => `${company.id}:${company.updatedAt}`)
    .sort()
    .join("|");
}

function createCompanyFromCandidate(candidate: CandidateInboxItem): Company {
  const now = new Date().toISOString();
  const company = createEmptyCompany();
  const parsed = candidate.parsedCompany;
  const inferredName =
    parsed?.name ||
    getHostLabel(candidate.sourceUrl) ||
    "검토 후보";

  return {
    ...company,
    name: inferredName,
    industry: parsed?.industry ?? company.industry,
    productDescription: parsed?.productDescription ?? company.productDescription,
    jobDeadline: parsed?.jobDeadline ?? company.jobDeadline,
    candidateReason:
      parsed?.candidateReason ||
      candidate.firstImpressionNote ||
      "Candidate Inbox에서 승격한 후보입니다.",
    signals: parsed?.signals ?? company.signals,
    homepageUrl: candidate.sourceUrl,
    jobPostUrl: candidate.sourceUrl,
    sourceUrls: candidate.sourceUrl ? [candidate.sourceUrl] : [],
    discoveryReason: candidate.discoveryReason,
    firstImpressionNote: candidate.firstImpressionNote,
    memo: candidate.rawText,
    evidenceLevel: parsed?.signals?.greenFlags?.length ? 2 : 1,
    sourceConfidence: 1,
    needsRefresh: true,
    validationReason: [
      VALIDATION_REASON_LABELS.aiExtracted,
      VALIDATION_REASON_LABELS.staleJobCheck,
      ...(parsed?.jobDeadline ? [] : [VALIDATION_REASON_LABELS.missingDeadline]),
      VALIDATION_REASON_LABELS.lowEvidence,
    ],
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

function shouldShowOnboarding(
  settings: CriteriaSettings,
  userEmail: string,
  devToolsEnabled: boolean,
): boolean {
  return (
    (devToolsEnabled && userEmail.toLowerCase() === "dev@example.com") ||
    !settings.userRole
  );
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
        자동 저장 중
      </span>
    );
  }
  if (status.state === "ok") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        자동 저장됨 {timeLabel}
      </span>
    );
  }
  if (status.state === "error") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
        <AlertCircle className="h-3 w-3" />
        임시 저장 중
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
      자동 저장 대기
    </span>
  );
}
