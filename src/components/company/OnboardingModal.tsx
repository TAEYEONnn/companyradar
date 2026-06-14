"use client";

import { Briefcase, Brush, ChartBar, ChevronRight, Code2, LayoutGrid, Megaphone, Plus, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, ROLE_WEIGHT_PRESETS } from "@/lib/criteria";
import { saveUserRole } from "@/lib/storage";
import type { CriteriaSettings, UserRole } from "@/lib/types";

export type OnboardingStartMode = "ai" | "manual" | "samples";

interface OnboardingModalProps {
  userId?: string;
  onComplete: (role: UserRole, settingsPatch: Partial<CriteriaSettings>, startMode: OnboardingStartMode) => void;
}

const ROLE_CONFIG: { role: UserRole; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { role: "designer", icon: Brush, description: "UX, 프로덕트, 디자인 시스템" },
  { role: "pm", icon: ChartBar, description: "전략, 기획, 로드맵" },
  { role: "frontend", icon: Code2, description: "React, TypeScript, UI" },
  { role: "ux_researcher", icon: Search, description: "리서치, 인터뷰, 인사이트" },
  { role: "marketer", icon: Megaphone, description: "그로스, 콘텐츠, 브랜드" },
  { role: "other", icon: Briefcase, description: "운영, 세일즈, HR, 기타 직군" },
];

const START_OPTIONS: {
  mode: OnboardingStartMode;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge?: string;
}[] = [
  {
    mode: "ai",
    icon: Sparkles,
    title: "AI로 공고 정리하기",
    description: "공고를 붙여넣으면 AI가 신호와 걱정 포인트를 정리해요.",
    badge: "무료 5회",
  },
  {
    mode: "manual",
    icon: Plus,
    title: "회사명만 먼저 저장하기",
    description: "나중에 상세에서 내용을 채울 수 있어요.",
  },
  {
    mode: "samples",
    icon: LayoutGrid,
    title: "예시 데이터로 둘러보기",
    description: "예시 데이터로 앱을 둘러봐요.",
  },
];

export function OnboardingModal({ userId, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<"role" | "start">("role");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  function handleRoleNext() {
    if (!selectedRole) return;
    setStep("start");
  }

  function handleStart(mode: OnboardingStartMode) {
    if (!selectedRole) return;
    saveUserRole(selectedRole, userId);
    onComplete(selectedRole, { weights: ROLE_WEIGHT_PRESETS[selectedRole], userRole: selectedRole }, mode);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        style={{ maxHeight: "calc(100dvh - 32px)" }}
      >
        {step === "role" ? (
          <>
            <div className="shrink-0 p-6 pb-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-sky-600">
                1 / 2 · 직군 선택
              </div>
              <h2 className="text-lg font-semibold text-slate-900">어떤 일을 하고 있나요?</h2>
              <p className="mt-1 text-sm text-slate-500">
                직군에 맞는 평가 기준을 자동으로 적용해요.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ROLE_CONFIG.map(({ role, icon: Icon, description }) => {
                  const isSelected = selectedRole === role;
                  return (
                    <button
                      key={role}
                      className={[
                        "flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                        isSelected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
                      ].join(" ")}
                      onClick={() => setSelectedRole(role)}
                      type="button"
                    >
                      <Icon
                        className={["mt-0.5 h-5 w-5 shrink-0", isSelected ? "text-white" : "text-slate-500"].join(" ")}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-tight">{ROLE_LABELS[role]}</div>
                        <div
                          className={["mt-0.5 text-xs leading-snug", isSelected ? "text-slate-300" : "text-slate-400"].join(" ")}
                        >
                          {description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex shrink-0 justify-end border-t border-slate-100 p-6 pt-4">
              <Button disabled={!selectedRole} onClick={handleRoleNext}>
                다음 <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="shrink-0 p-6 pb-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-sky-600">
                2 / 2 · 시작 방식
              </div>
              <h2 className="text-lg font-semibold text-slate-900">어떻게 시작할까요?</h2>
              <p className="mt-1 text-sm text-slate-500">
                언제든 방식을 바꿀 수 있어요.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">
              <div className="space-y-2">
                {START_OPTIONS.map(({ mode, icon: Icon, title, description, badge }) => (
                  <button
                    key={mode}
                    className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-900 hover:bg-slate-50"
                    onClick={() => handleStart(mode)}
                    type="button"
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{title}</span>
                        {badge ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                            {badge}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs leading-snug text-slate-400">{description}</div>
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-slate-100 p-6 pt-4">
              <button
                className="text-sm text-slate-400 hover:text-slate-600"
                onClick={() => setStep("role")}
                type="button"
              >
                ← 직군 다시 선택
              </button>
              <button
                className="text-sm text-slate-400 hover:text-slate-600"
                onClick={() => handleStart("manual")}
                type="button"
              >
                건너뛰기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
