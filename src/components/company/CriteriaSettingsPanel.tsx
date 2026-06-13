"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  KeyRound,
  LogOut,
  Mail,
  PanelRightOpen,
  RotateCcw,
  Settings2,
  Trash2,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { DEFAULT_CRITERIA_SETTINGS, ROLE_LABELS, ROLE_WEIGHT_PRESETS, SCORE_CATEGORIES } from "@/lib/criteria";
import type { CriteriaSettings, UserRole } from "@/lib/types";

interface CriteriaSettingsPanelProps {
  settings: CriteriaSettings;
  userEmail: string;
  onBack: () => void;
  onChange: (settings: CriteriaSettings) => void;
  onSignOut: () => void;
  onExport: () => void;
  onDeleteAccount: () => void;
  onResetPassword: () => void;
}

export function CriteriaSettingsPanel({
  settings,
  userEmail,
  onBack,
  onChange,
  onSignOut,
  onExport,
  onDeleteAccount,
  onResetPassword,
}: CriteriaSettingsPanelProps) {
  const [deleteInput, setDeleteInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCriteria, setShowCriteria] = useState(false);

  const weightSum = Object.values(settings.weights).reduce(
    (sum, weight) => sum + weight,
    0,
  );

  function handleDeleteConfirm() {
    if (deleteInput.trim() !== "탈퇴") return;
    setDeleteInput("");
    setShowDeleteConfirm(false);
    onDeleteAccount();
  }

  return (
    <section className="space-y-6">
      {/* 계정 및 지원 */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold">계정 및 지원</h2>
          {userEmail && (
            <p className="mt-1 text-sm text-slate-500">{userEmail}</p>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {/* 비밀번호 재설정 */}
          <AccountRow
            description="가입한 이메일로 재설정 링크를 보냅니다"
            icon={<KeyRound className="h-4 w-4" />}
            label="비밀번호 재설정 메일 받기"
            onClick={onResetPassword}
          />

          {/* 내 데이터 내보내기 */}
          <AccountRow
            description="모든 회사 데이터를 JSON 파일로 백업합니다"
            icon={<Download className="h-4 w-4" />}
            label="내 데이터 내보내기"
            onClick={onExport}
          />

          {/* 서비스 문의 */}
          <AccountRow
            description="버그 신고, 기능 제안, 일반 문의"
            icon={<Mail className="h-4 w-4" />}
            label="서비스 문의"
            onClick={() => {
              const subject = encodeURIComponent("[Company Signal] 서비스 문의");
              const body = encodeURIComponent(
                `문의 유형:\n사용 중인 브라우저:\n문제가 발생한 화면:\n문의 내용:\n\n계정: ${userEmail}`,
              );
              window.location.href = `mailto:companysignal.app@gmail.com?subject=${subject}&body=${body}`;
            }}
          />

          {/* 결제/환불 문의 */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">결제/환불 문의</div>
                <div className="text-xs text-slate-500">현재 유료 결제를 제공하지 않습니다</div>
              </div>
            </div>
            <Button
              onClick={() => {
                const subject = encodeURIComponent("[Company Signal] 결제/환불 문의");
                const body = encodeURIComponent(
                  `가입 이메일: ${userEmail}\n결제일:\n결제 수단:\n환불 요청 사유:`,
                );
                window.location.href = `mailto:companysignal.app@gmail.com?subject=${subject}&body=${body}`;
              }}
              variant="secondary"
            >
              문의하기
            </Button>
          </div>

          {/* 로그아웃 */}
          <AccountRow
            icon={<LogOut className="h-4 w-4" />}
            label="로그아웃"
            onClick={onSignOut}
          />

          {/* 회원 탈퇴 */}
          <div className="p-4">
            {!showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-50 text-red-500">
                    <UserX className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-red-600">회원 탈퇴</div>
                    <div className="text-xs text-slate-500">모든 데이터가 삭제되며 복구할 수 없습니다</div>
                  </div>
                </div>
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="secondary"
                >
                  <Trash2 className="h-4 w-4" />
                  탈퇴
                </Button>
              </div>
            ) : (
              <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-700">
                  정말 탈퇴하시겠습니까? 모든 데이터가 영구 삭제됩니다.
                </p>
                <p className="text-xs text-red-600">
                  확인하려면 아래에 <strong>탈퇴</strong>를 입력하세요.
                </p>
                <input
                  className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="탈퇴"
                  type="text"
                  value={deleteInput}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteInput("");
                    }}
                    variant="secondary"
                  >
                    취소
                  </Button>
                  <button
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-red-700"
                    disabled={deleteInput.trim() !== "탈퇴"}
                    onClick={handleDeleteConfirm}
                  >
                    탈퇴 확인
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 법적 링크 */}
        <div className="flex flex-wrap gap-4 border-t border-slate-100 p-4 text-xs text-slate-400">
          <a
            className="flex items-center gap-1 hover:text-slate-600"
            href="/terms"
            rel="noopener noreferrer"
            target="_blank"
          >
            이용약관
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            className="flex items-center gap-1 hover:text-slate-600"
            href="/privacy"
            rel="noopener noreferrer"
            target="_blank"
          >
            개인정보 처리방침
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            className="flex items-center gap-1 hover:text-slate-600"
            href="/refund-policy"
            rel="noopener noreferrer"
            target="_blank"
          >
            환불 정책
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* 평가 기준 설정 — 접힘 처리 */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <button
          className="flex w-full items-center justify-between p-4 text-left"
          onClick={() => setShowCriteria((v) => !v)}
          type="button"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-medium">평가 기준 설정</div>
              <div className="text-xs text-slate-500">카테고리 가중치 및 리스크 기준 조정</div>
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${showCriteria ? "rotate-180" : ""}`}
          />
        </button>

        {showCriteria && (
          <>
            <div className="border-t border-slate-100 p-4">
              <p className="mb-2 text-xs font-medium text-slate-500">직군 선택</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
                  <button
                    key={role}
                    className={[
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      settings.userRole === role
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50",
                    ].join(" ")}
                    onClick={() =>
                      onChange({
                        ...settings,
                        userRole: role,
                        weights: ROLE_WEIGHT_PRESETS[role],
                      })
                    }
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {settings.userRole && (
                <p className="mt-1.5 text-xs text-slate-400">
                  직군 변경 시 가중치가 해당 직군 프리셋으로 업데이트됩니다
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-6 border-t border-slate-100 p-4 lg:grid-cols-[520px_1fr]">
              <div className="space-y-3">
                {SCORE_CATEGORIES.map((category) => (
                  <div
                    className="grid grid-cols-[180px_1fr_72px] items-center gap-3 rounded-md border border-slate-200 p-3"
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
                <div className="grid grid-cols-[1fr_120px] items-center gap-3 rounded-md border border-slate-200 p-3">
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
                  <LabelRow label="4.3 이상" tone="green" value="적극 지원" />
                  <LabelRow label="3.7 이상" tone="blue" value="지원 고려" />
                  <LabelRow label="3.0 이상" tone="amber" value="정보 추가 필요" />
                  <LabelRow label="3.0 미만" tone="slate" value="보류" />
                </div>
                <div className="mt-6 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                  평가 항목은 회사 크기보다 커리어 성장성, 조직 안정성, 제품 품질, 후기
                  신호, 포지션 적합도를 우선 보도록 구성되어 있습니다.
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 p-3">
              <Button onClick={() => onChange(DEFAULT_CRITERIA_SETTINGS)} variant="secondary">
                <RotateCcw className="h-4 w-4" />
                기본값 복원
              </Button>
              <Button onClick={() => setShowCriteria(false)}>
                <Check className="h-4 w-4" />
                완료
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function AccountRow({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          {description && (
            <div className="text-xs text-slate-500">{description}</div>
          )}
        </div>
      </div>
      <Button onClick={onClick} variant="secondary">
        실행
      </Button>
    </div>
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
