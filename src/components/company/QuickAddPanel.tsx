"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { createEmptyCompany } from "@/lib/company-factory";
import { STATUS_OPTIONS } from "@/lib/criteria";
import type { ApplicationStatus, Company } from "@/lib/types";

interface QuickAddPanelProps {
  onSave: (company: Company) => void;
  onCancel: () => void;
  onOpenFullForm: (company: Company) => void;
}

export function QuickAddPanel({ onSave, onCancel, onOpenFullForm }: QuickAddPanelProps) {
  const [name, setName] = useState("");
  const [jobPostUrl, setJobPostUrl] = useState("");
  const [status, setStatus] = useState<ApplicationStatus>("interested");

  function buildCompany(): Company {
    return {
      ...createEmptyCompany(),
      name: name.trim(),
      jobPostUrl: jobPostUrl.trim(),
      status,
    };
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave(buildCompany());
  }

  const canSave = name.trim().length > 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white pb-20 sm:pb-0">
      {/* Mobile sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-sm sm:hidden">
        <button
          className="text-sm text-slate-400 underline underline-offset-2 hover:text-slate-600"
          onClick={() => onOpenFullForm(buildCompany())}
          type="button"
        >
          자세히 입력할래요
        </button>
        <div className="flex gap-2">
          <Button onClick={onCancel} size="sm" variant="secondary" type="button">취소</Button>
          <Button disabled={!canSave} onClick={handleSave} size="sm" type="button">저장하기</Button>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">회사명만 먼저 저장하기</h2>
          <p className="mt-0.5 text-sm text-slate-500">자세한 내용은 나중에 추가해도 괜찮아요.</p>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <button
            className="text-sm text-slate-400 underline underline-offset-2 hover:text-slate-600"
            onClick={() => onOpenFullForm(buildCompany())}
            type="button"
          >
            자세히 입력할래요
          </button>
          <Button onClick={onCancel} variant="secondary" type="button">취소</Button>
          <Button disabled={!canSave} onClick={handleSave} type="button">저장하기</Button>
        </div>
      </div>

      {/* Fields */}
      <div className="max-w-sm space-y-4 p-4">
        <Field label="회사명 또는 공고명">
          <Input
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canSave) handleSave(); }}
            placeholder="예: 토스, 카카오 프로덕트 디자이너"
            value={name}
          />
        </Field>
        <Field label="채용공고 URL">
          <Input
            onChange={(e) => setJobPostUrl(e.target.value)}
            placeholder="https://"
            type="url"
            value={jobPostUrl}
          />
        </Field>
        <Field label="지원 상태">
          <Select
            onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
            value={status}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </section>
  );
}
