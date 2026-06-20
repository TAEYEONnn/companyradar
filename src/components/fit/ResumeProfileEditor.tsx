"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import type { CandidateProfile } from "@/lib/fit-analysis";

export function ResumeProfileEditor({
  profile,
  warnings,
  onChange,
  onConfirm,
  onCancel,
}: {
  profile: CandidateProfile;
  warnings: string[];
  onChange: (profile: CandidateProfile) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-lg bg-emerald-50 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-950">
          커리어 정보만 정리했어요
        </p>
        <p className="mt-1 text-xs leading-5 text-emerald-800">
          내 정보와 다른 부분은 바로 고쳐주세요. 확정하기 전에는 저장되지 않아요.
        </p>
      </div>

      {warnings.length > 0 ? (
        <ul className="space-y-1 rounded-lg bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div>
          <Label htmlFor="profile-target-role">목표 직무</Label>
          <Input
            className="mt-2"
            id="profile-target-role"
            onChange={(event) =>
              onChange({ ...profile, targetRole: event.target.value })
            }
            placeholder="예: 프로덕트 디자이너"
            value={profile.targetRole}
          />
        </div>
        <div>
          <Label htmlFor="profile-years">경력 연차</Label>
          <Input
            className="mt-2"
            id="profile-years"
            min="0"
            onChange={(event) =>
              onChange({
                ...profile,
                yearsExperience:
                  event.target.value === ""
                    ? null
                    : Math.max(0, Number(event.target.value)),
              })
            }
            placeholder="0"
            step="0.5"
            type="number"
            value={profile.yearsExperience ?? ""}
          />
        </div>
      </div>

      <ListField
        id="profile-skills"
        label="역량"
        onChange={(skills) => onChange({ ...profile, skills })}
        placeholder="Figma, 사용자 리서치, 디자인 시스템"
        value={profile.skills}
      />
      <ListField
        id="profile-domains"
        label="경험 도메인"
        onChange={(domains) => onChange({ ...profile, domains })}
        placeholder="B2B SaaS, 커머스"
        value={profile.domains}
      />

      <div>
        <Label htmlFor="profile-achievements">주요 성과</Label>
        <Textarea
          className="mt-2 min-h-28"
          id="profile-achievements"
          onChange={(event) =>
            onChange({
              ...profile,
              achievements: splitLines(event.target.value),
            })
          }
          placeholder={"성과를 한 줄씩 적어주세요.\n예: 가입 전환율 18% 개선"}
          value={profile.achievements.join("\n")}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onCancel} variant="ghost">
          <X className="h-4 w-4" />
          취소
        </Button>
        <Button onClick={onConfirm}>
          <Check className="h-4 w-4" />
          이 내용으로 분석하기
        </Button>
      </div>
    </div>
  );
}

function ListField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string[];
  placeholder: string;
  onChange: (value: string[]) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        className="mt-2 min-h-20"
        id={id}
        onChange={(event) => onChange(splitList(event.target.value))}
        placeholder={placeholder}
        value={value.join(", ")}
      />
      <p className="mt-1 text-xs text-slate-400">쉼표나 줄바꿈으로 나눠주세요.</p>
    </div>
  );
}

function splitList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}
