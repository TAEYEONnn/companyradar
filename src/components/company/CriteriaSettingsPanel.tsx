"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  ExternalLink,
  KeyRound,
  LogOut,
  Mail,
  PanelRightOpen,
  ReceiptText,
  RotateCcw,
  Settings2,
  Trash2,
  Upload,
  UserRound,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import {
  DEFAULT_CRITERIA_SETTINGS,
  DEFAULT_SCORE_THRESHOLDS,
  ROLE_LABELS,
  ROLE_WEIGHT_PRESETS,
  SCORE_CATEGORIES,
} from "@/lib/criteria";
import { normalizeScoreThresholds } from "@/lib/scoring";
import { getSupabaseClient } from "@/lib/supabase-client";
import type { CriteriaSettings, ScoreThresholdSettings, UserRole } from "@/lib/types";

interface CriteriaSettingsPanelProps {
  settings: CriteriaSettings;
  userEmail: string;
  deletionRequested: boolean;
  onBack: () => void;
  onChange: (settings: CriteriaSettings) => void;
  onSignOut: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onDeleteAccount: (reason: string, confirmText: string) => Promise<boolean>;
  onResetPassword: () => void;
  onToast: (message: string) => void;
}

export function CriteriaSettingsPanel({
  settings,
  userEmail,
  deletionRequested,
  onChange,
  onSignOut,
  onExport,
  onImportFile,
  onDeleteAccount,
  onResetPassword,
  onToast,
}: CriteriaSettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCriteria, setShowCriteria] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [submitting, setSubmitting] = useState<"support" | "refund" | "delete" | null>(null);
  const [hasApprovedPayment, setHasApprovedPayment] = useState(false);
  const scoreThresholds = normalizeScoreThresholds(settings.scoreThresholds);

  useEffect(() => {
    let cancelled = false;
    async function loadBillingState() {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch("/api/billing/entitlement", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { hasApprovedPayment?: boolean };
        if (!cancelled) setHasApprovedPayment(Boolean(data.hasApprovedPayment));
      } catch {
        if (!cancelled) setHasApprovedPayment(false);
      }
    }
    void loadBillingState();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateScoreThreshold(key: keyof ScoreThresholdSettings, value: number) {
    onChange({
      ...settings,
      scoreThresholds: normalizeScoreThresholds({
        ...scoreThresholds,
        [key]: value,
      }),
    });
  }

  const weightSum = Object.values(settings.weights).reduce(
    (sum, weight) => sum + weight,
    0,
  );

  async function getAccessToken() {
    const supabase = getSupabaseClient();
    return supabase
      ? (await supabase.auth.getSession()).data.session?.access_token
      : undefined;
  }

  async function submitSupportRequest() {
    if (!supportMessage.trim()) {
      onToast("문의 내용을 입력해 주세요.");
      return;
    }
    setSubmitting("support");
    try {
      const token = await getAccessToken();
      if (!token) {
        onToast("로그인이 필요합니다.");
        return;
      }
      const res = await fetch("/api/support/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          requestType: "general",
          subject: "서비스 문의",
          message: supportMessage,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? "문의 접수에 실패했습니다.");
      }
      setSupportMessage("");
      onToast("문의가 접수되었습니다. 확인 후 이메일로 답변드릴게요.");
    } catch (error) {
      onToast(
        error instanceof Error
          ? error.message
          : "문의 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setSubmitting(null);
    }
  }

  async function submitRefundRequest() {
    if (!refundReason.trim()) {
      onToast("환불 요청 사유를 입력해 주세요.");
      return;
    }
    setSubmitting("refund");
    try {
      const token = await getAccessToken();
      if (!token) {
        onToast("로그인이 필요합니다.");
        return;
      }
      const res = await fetch("/api/billing/refund-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: refundReason }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? "환불 요청 접수에 실패했습니다.");
      }
      setRefundReason("");
      onToast("환불 요청이 접수되었습니다. 결제/사용 이력을 확인해 이메일로 안내드릴게요.");
    } catch (error) {
      onToast(
        error instanceof Error
          ? error.message
          : "환불 요청 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setSubmitting(null);
    }
  }

  async function handleDeleteConfirm() {
    setSubmitting("delete");
    const ok = await onDeleteAccount(deleteReason, deleteInput);
    if (ok) {
      setDeleteInput("");
      setDeleteReason("");
      setShowDeleteConfirm(false);
      onToast("탈퇴 요청이 접수되었습니다. 운영자가 확인 후 이메일로 안내드립니다.");
    } else {
      onToast("탈퇴 요청 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
    setSubmitting(null);
  }

  function changeRole(role: UserRole) {
    onChange({
      ...settings,
      userRole: role,
      weights: ROLE_WEIGHT_PRESETS[role],
    });
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <SettingsCard
        description={userEmail || "로그인 계정"}
        icon={<UserRound className="h-4 w-4" />}
        title="계정"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <ActionBox
            description="가입한 이메일로 재설정 링크를 보냅니다."
            icon={<KeyRound className="h-4 w-4" />}
            title="비밀번호 변경"
          >
            <Button onClick={onResetPassword} variant="secondary">
              재설정 메일 받기
            </Button>
          </ActionBox>
          <ActionBox
            description="현재 기기에서 로그아웃합니다."
            icon={<LogOut className="h-4 w-4" />}
            title="로그아웃"
          >
            <Button onClick={onSignOut} variant="secondary">
              로그아웃
            </Button>
          </ActionBox>
        </div>
      </SettingsCard>

      <SettingsCard
        description="직군을 바꾸면 평가 가중치와 체크리스트가 해당 직군 기준으로 바뀝니다."
        icon={<Settings2 className="h-4 w-4" />}
        title="내 직군 및 평가 기준"
      >
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">내 직군</p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
              <button
                key={role}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  settings.userRole === role
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50",
                ].join(" ")}
                onClick={() => changeRole(role)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          className="flex w-full items-center justify-between rounded-md border border-slate-200 p-3 text-left"
          onClick={() => setShowCriteria((value) => !value)}
          type="button"
        >
          <span>
            <span className="block text-sm font-medium">세부 평가 기준</span>
            <span className="block text-xs text-slate-500">
              가중치 합계 {Math.round(weightSum * 100)}%. 계산 시 자동 정규화됩니다.
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${showCriteria ? "rotate-180" : ""}`}
          />
        </button>

        {showCriteria ? (
          <div className="grid grid-cols-1 gap-6 rounded-md border border-slate-100 bg-slate-50 p-4 lg:grid-cols-[minmax(0,520px)_1fr]">
            <div className="space-y-3">
              {SCORE_CATEGORIES.map((category) => (
                <div
                  className="grid grid-cols-[minmax(120px,180px)_1fr_72px] items-center gap-3 rounded-md border border-slate-200 bg-white p-3"
                  key={category.key}
                >
                  <div>
                    <div className="text-sm font-medium">{category.title}</div>
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
              <div className="grid grid-cols-[1fr_120px] items-center gap-3 rounded-md border border-slate-200 bg-white p-3">
                <div>
                  <div className="text-sm font-medium">리스크 높음 기준</div>
                  <div className="text-xs text-slate-500">
                    걱정되는 점이 이 개수 이상이면 리스크 뱃지를 표시합니다.
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

            <div className="rounded-md border border-slate-200 bg-white p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <PanelRightOpen className="h-4 w-4" />
                점수 라벨
                <HelpTip text="회사핏 점수에 따라 어떤 후보를 먼저 볼지 나누는 기준입니다." />
              </h3>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                문구는 그대로 두고, 몇 점부터 해당 라벨로 볼지만 바꿉니다.
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <ThresholdRow
                  label="적극 지원"
                  onChange={(value) => updateScoreThreshold("strong", value)}
                  thresholdLabel="이상"
                  tone="green"
                  value={scoreThresholds.strong}
                />
                <ThresholdRow
                  label="지원 고려"
                  onChange={(value) => updateScoreThreshold("consider", value)}
                  thresholdLabel="이상"
                  tone="blue"
                  value={scoreThresholds.consider}
                />
                <ThresholdRow
                  label="정보 추가 필요"
                  onChange={(value) => updateScoreThreshold("needsInfo", value)}
                  thresholdLabel="이상"
                  tone="amber"
                  value={scoreThresholds.needsInfo}
                />
                <LabelRow label={`${scoreThresholds.needsInfo.toFixed(1)} 미만`} tone="slate" value="보류" />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  onClick={() =>
                    onChange({
                      ...settings,
                      scoreThresholds: DEFAULT_SCORE_THRESHOLDS,
                    })
                  }
                  variant="secondary"
                >
                  <RotateCcw className="h-4 w-4" />
                  점수 기준 복원
                </Button>
                <Button onClick={() => onChange(DEFAULT_CRITERIA_SETTINGS)} variant="secondary">
                  <RotateCcw className="h-4 w-4" />
                  전체 기본값
                </Button>
                <Button onClick={() => setShowCriteria(false)}>
                  <Check className="h-4 w-4" />
                  완료
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </SettingsCard>

      <SettingsCard
        description="로그인 계정 기준으로 Supabase에 자동 저장됩니다. JSON은 보조 백업입니다."
        icon={<Download className="h-4 w-4" />}
        title="데이터"
      >
        <button
          className="flex w-full items-center justify-between rounded-md border border-slate-200 p-3 text-left"
          onClick={() => setShowBackup((value) => !value)}
          type="button"
        >
          <span>
            <span className="block text-sm font-medium">고급 백업</span>
            <span className="block text-xs text-slate-500">
              JSON 가져오기/내보내기는 계정 저장의 보조 수단입니다.
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${showBackup ? "rotate-180" : ""}`}
          />
        </button>
        {showBackup ? (
          <div className="grid gap-3 rounded-md border border-slate-100 bg-slate-50 p-3 md:grid-cols-2">
            <ActionBox
              description="현재 계정의 회사 데이터를 JSON 파일로 저장합니다."
              icon={<Download className="h-4 w-4" />}
              title="JSON 내보내기"
            >
              <Button onClick={onExport} variant="secondary">
                내보내기
              </Button>
            </ActionBox>
            <ActionBox
              description="기존 JSON 백업을 현재 계정 데이터에 병합합니다."
              icon={<Upload className="h-4 w-4" />}
              title="JSON 가져오기"
            >
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="secondary"
              >
                가져오기
              </Button>
              <input
                accept="application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onImportFile(file);
                  event.target.value = "";
                }}
                ref={fileInputRef}
                type="file"
              />
            </ActionBox>
          </div>
        ) : null}
      </SettingsCard>

      <SettingsCard
        description="사용 중 막힌 부분이나 버그를 남길 수 있습니다."
        icon={<Mail className="h-4 w-4" />}
        title="도움말 및 문의"
      >
        <button
          className="flex w-full items-center justify-between rounded-md border border-slate-200 p-3 text-left"
          onClick={() => setShowSupport((value) => !value)}
          type="button"
        >
          <span>
            <span className="block text-sm font-medium">서비스 문의 접수</span>
            <span className="block text-xs text-slate-500">
              오류, 제안, 사용 중 막힌 점을 남깁니다.
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${showSupport ? "rotate-180" : ""}`}
          />
        </button>
        {showSupport ? (
          <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50 p-3">
            <Textarea
              aria-label="서비스 문의 내용"
              onChange={(event) => setSupportMessage(event.target.value)}
              placeholder="문의 내용을 적어주세요. 문제가 발생한 화면이나 상황을 함께 적으면 더 빨리 확인할 수 있어요."
              rows={4}
              value={supportMessage}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                긴급 문의는 companysignal.app@gmail.com 으로도 받을 수 있습니다.
              </p>
              <Button
                disabled={submitting === "support"}
                onClick={() => void submitSupportRequest()}
                variant="secondary"
              >
                문의 접수
              </Button>
            </div>
          </div>
        ) : null}
      </SettingsCard>

      <SettingsCard
        description="결제 기록이 있는 계정만 환불 요청을 남길 수 있습니다."
        icon={<ReceiptText className="h-4 w-4" />}
        title="결제 및 환불"
      >
        <button
          className="flex w-full items-center justify-between rounded-md border border-slate-200 p-3 text-left"
          onClick={() => setShowRefund((value) => !value)}
          type="button"
        >
          <span>
            <span className="flex items-center gap-1 text-sm font-medium">
              환불 요청
              <HelpTip text="결제 기록이 있는 계정만 요청할 수 있어요. 확인한 뒤 이메일로 안내합니다." />
            </span>
            <span className="block text-xs text-slate-500">
              결제 후 7일 이내이고 유료 이용권을 쓰지 않은 건을 확인합니다.
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${showRefund ? "rotate-180" : ""}`}
          />
        </button>
        {showRefund ? (
          hasApprovedPayment ? (
            <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm leading-6 text-slate-600">
                중복 결제나 서비스 문제도 여기로 남겨주세요. 확인 후 이메일로 안내드립니다.
              </p>
              <Textarea
                aria-label="환불 요청 사유"
                onChange={(event) => setRefundReason(event.target.value)}
                placeholder="환불 요청 사유를 적어주세요. 가능하면 결제일, 결제 수단, Toss 영수증 정보를 함께 적어주세요."
                rows={3}
                value={refundReason}
              />
              <Button
                disabled={submitting === "refund"}
                onClick={() => void submitRefundRequest()}
                variant="secondary"
              >
                환불 요청 접수
              </Button>
            </div>
          ) : (
            <p className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500">
              환불 요청 가능한 결제 이력이 없습니다.
            </p>
          )
        ) : null}
      </SettingsCard>

      <SettingsCard
        description="탈퇴 요청을 남기면 결제와 남은 데이터를 확인한 뒤 처리합니다."
        icon={<UserX className="h-4 w-4" />}
        title="회원탈퇴"
      >
        {deletionRequested ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            탈퇴 요청이 접수되어 검토 중입니다. 처리 완료 시 이메일로 안내드립니다.
          </div>
        ) : !showDeleteConfirm ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm leading-6 text-slate-600">
              요청을 남기면 결제나 남은 데이터를 확인한 뒤 이메일로 안내드립니다.
            </p>
            <Button onClick={() => setShowDeleteConfirm(true)} variant="danger">
              <Trash2 className="h-4 w-4" />
              탈퇴 요청
            </Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">
              탈퇴 요청을 접수하려면 아래에 <strong>탈퇴</strong>를 입력하세요.
            </p>
            <Textarea
              aria-label="탈퇴 사유"
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="선택 입력: 탈퇴 사유나 요청 사항"
              rows={3}
              value={deleteReason}
            />
            <Input
              aria-label="탈퇴 확인 문구"
              onChange={(event) => setDeleteInput(event.target.value)}
              placeholder="탈퇴"
              type="text"
              value={deleteInput}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInput("");
                  setDeleteReason("");
                }}
                variant="secondary"
              >
                취소
              </Button>
              <Button
                disabled={deleteInput.trim() !== "탈퇴" || submitting === "delete"}
                onClick={() => void handleDeleteConfirm()}
                variant="danger"
              >
                탈퇴 요청 접수
              </Button>
            </div>
          </div>
        )}
      </SettingsCard>

      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
        <PolicyLink href="/terms" label="이용약관" />
        <PolicyLink href="/privacy" label="개인정보 처리방침" />
        <PolicyLink href="/refund-policy" label="환불 정책" />
      </div>
    </section>
  );
}

function SettingsCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ActionBox({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 text-slate-500">{icon}</div>
        <div>
          <div className="text-sm font-medium text-slate-900">{title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function PolicyLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="flex items-center gap-1 hover:text-slate-600"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        aria-label={text}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:bg-slate-100 focus:text-slate-700 focus:outline-none"
        type="button"
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal leading-5 text-slate-600 shadow-lg group-focus-within:block group-hover:block">
        {text}
      </span>
    </span>
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

function ThresholdRow({
  label,
  onChange,
  thresholdLabel,
  tone,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  thresholdLabel: string;
  tone: "green" | "amber" | "blue";
  value: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_112px] items-center gap-3 rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge tone={tone}>{label}</Badge>
        <span className="text-xs text-slate-500">{thresholdLabel}</span>
      </div>
      <Input
        max={5}
        min={0}
        onChange={(event) => onChange(Number(event.target.value))}
        step={0.1}
        type="number"
        value={value.toFixed(1)}
      />
    </div>
  );
}
