"use client";

import { useState } from "react";
import { Brush, ChartBar, Code2, Megaphone, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, ROLE_WEIGHT_PRESETS } from "@/lib/criteria";
import { saveUserRole } from "@/lib/storage";
import type { CriteriaSettings, UserRole } from "@/lib/types";

interface OnboardingModalProps {
  allowSkip?: boolean;
  userId?: string;
  onComplete: (role: UserRole, settingsPatch: Partial<CriteriaSettings>) => void;
  onSkip?: () => void;
}

const ROLE_CONFIG: {
  role: UserRole;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  { role: "designer", icon: Brush, description: "프로덕트/UX 디자인, 디자인 시스템" },
  { role: "pm", icon: ChartBar, description: "프로덕트 전략, 기획, 로드맵" },
  { role: "frontend", icon: Code2, description: "React, TypeScript, UI 개발" },
  { role: "ux_researcher", icon: Search, description: "사용자 리서치, 인사이트" },
  { role: "marketer", icon: Megaphone, description: "그로스, 콘텐츠, 브랜드 마케팅" },
];

export function OnboardingModal({
  allowSkip = false,
  userId,
  onComplete,
  onSkip,
}: OnboardingModalProps) {
  const [selected, setSelected] = useState<UserRole | null>(null);

  function handleStart() {
    if (!selected) return;
    saveUserRole(selected, userId);
    onComplete(selected, {
      weights: ROLE_WEIGHT_PRESETS[selected],
      userRole: selected,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              어떤 직군으로 이직을 준비 중인가요?
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              평가 기준이 직군에 맞게 자동 설정됩니다
            </p>
          </div>
          {allowSkip ? (
          <button
            aria-label="닫기"
            className="ml-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={onSkip}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 px-6 sm:grid-cols-2">
          {ROLE_CONFIG.map(({ role, icon: Icon, description }) => {
            const isSelected = selected === role;
            return (
              <button
                key={role}
                className={[
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
                ].join(" ")}
                onClick={() => setSelected(role)}
                type="button"
              >
                <Icon
                  className={[
                    "mt-0.5 h-5 w-5 shrink-0",
                    isSelected ? "text-white" : "text-slate-500",
                  ].join(" ")}
                />
                <div className="min-w-0">
                  <div className="font-medium text-sm leading-tight">
                    {ROLE_LABELS[role]}
                  </div>
                  <div
                    className={[
                      "mt-0.5 text-xs leading-snug",
                      isSelected ? "text-slate-300" : "text-slate-400",
                    ].join(" ")}
                  >
                    {description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between p-6 pt-4">
          {allowSkip ? (
          <button
            className="text-sm text-slate-400 hover:text-slate-600"
            onClick={onSkip}
            type="button"
          >
            나중에 설정
          </button>
          ) : (
            <span className="text-sm text-slate-400" />
          )}
          <Button disabled={!selected} onClick={handleStart}>
            시작하기 →
          </Button>
        </div>
      </div>
    </div>
  );
}
