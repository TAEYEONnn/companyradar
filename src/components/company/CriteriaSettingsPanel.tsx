"use client";

import { Check, PanelRightOpen, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { DEFAULT_CRITERIA_SETTINGS, SCORE_CATEGORIES } from "@/lib/criteria";
import type { CriteriaSettings } from "@/lib/types";

interface CriteriaSettingsPanelProps {
  settings: CriteriaSettings;
  onBack: () => void;
  onChange: (settings: CriteriaSettings) => void;
}

export function CriteriaSettingsPanel({
  settings,
  onBack,
  onChange,
}: CriteriaSettingsPanelProps) {
  const weightSum = Object.values(settings.weights).reduce(
    (sum, weight) => sum + weight,
    0,
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h2 className="text-lg font-semibold">평가 기준 설정</h2>
          <p className="mt-1 text-sm text-slate-500">
            기본 가중치: 사업 20%, 조직 25%, 디자인 성장 30%, 조건 15%, 적합도 10%
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onChange(DEFAULT_CRITERIA_SETTINGS)} variant="secondary">
            <RotateCcw className="h-4 w-4" />
            기본값
          </Button>
          <Button onClick={onBack}>
            <Check className="h-4 w-4" />
            완료
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-[520px_1fr]">
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
