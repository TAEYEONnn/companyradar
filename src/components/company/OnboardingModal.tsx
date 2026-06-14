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
  { role: "designer", icon: Brush, description: "UX, 프로덕트, 디자인 시스템" },
  { role: "pm", icon: ChartBar, description: "전략, 기획, 로드맵" },
  { role: "frontend", icon: Code2, description: "React, TypeScript, UI" },
  { role: "ux_researcher", icon: Search, description: "리서치, 인터뷰, 인사이트" },
  { role: "marketer", icon: Megaphone, description: "그로스, 콘텐츠, 브랜드" },
];

const START_STEPS = [
  { title: "회사 추가", description: "공고나 후보 회사를 저장" },
  { title: "점수 확인", description: "회사핏과 리스크 파악" },
  { title: "면접 준비", description: "질문과 할 일을 정리" },
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
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              3단계로 지원 관리를 시작하세요
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              회사 추가부터 면접 준비까지, 처음부터 필요한 흐름만 보여드릴게요.
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

        <div className="grid gap-2 px-6 sm:grid-cols-3">
          {START_STEPS.map((step, index) => (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={step.title}>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {index + 1}
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-800">{step.title}</div>
              <div className="mt-0.5 text-xs leading-snug text-slate-500">{step.description}</div>
            </div>
          ))}
        </div>

        <div className="px-6 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            직군별 평가 기준 선택
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 px-6 pt-2 sm:grid-cols-2">
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
            이 기준으로 시작하기 →
          </Button>
        </div>
      </div>
    </div>
  );
}
