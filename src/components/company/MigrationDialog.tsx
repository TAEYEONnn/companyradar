"use client";

import { AlertTriangle, Database, DownloadCloud, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Company } from "@/lib/types";
import type { MigrationDuplicate, MigrationPlan } from "@/lib/migration";

const REASON_LABELS: Record<MigrationDuplicate["reason"], string> = {
  name: "회사명",
  domain: "홈페이지 도메인",
  jobPostUrl: "채용공고 URL",
};

interface MigrationDialogProps {
  localCompanies: Company[];
  remoteCompanies: Company[];
  migrationPlan: MigrationPlan;
  onBackupLater: () => void;
  onUseRemoteOnly: () => void;
  onUploadLocal: () => void;
}

export function MigrationDialog({
  localCompanies,
  remoteCompanies,
  migrationPlan,
  onBackupLater,
  onUseRemoteOnly,
  onUploadLocal,
}: MigrationDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
      <section className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              localStorage 데이터 발견
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Supabase로 가져올지 선택하세요
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              v0.3.2부터 로그인 후 로컬 데이터를 자동 업로드하지 않습니다. 먼저
              백업하거나, 검토한 뒤 사용자 소유 row로 가져옵니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Badge tone="amber">로컬 {localCompanies.length}</Badge>
            <Badge tone="blue">Supabase {remoteCompanies.length}</Badge>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border border-slate-200 p-3">
            <div className="font-semibold">업로드 대상</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">
              {migrationPlan.uniqueLocalCompanies.length}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              중복이 아닌 로컬 회사만 Supabase에 추가합니다.
            </p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <div className="font-semibold">병합 후보</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">
              {migrationPlan.duplicates.length}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              같은 회사로 보이는 항목은 새 row를 만들지 않습니다.
            </p>
          </div>
        </div>

        {migrationPlan.duplicates.length > 0 ? (
          <div className="mt-4 max-h-40 overflow-y-auto rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="text-sm font-semibold text-amber-900">병합 후보</div>
            <div className="mt-2 space-y-2">
              {migrationPlan.duplicates.slice(0, 6).map((duplicate) => (
                <div className="text-xs text-amber-900" key={duplicate.local.id}>
                  {duplicate.local.name} → {duplicate.remote.name} · 기준:{" "}
                  {REASON_LABELS[duplicate.reason]}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Button onClick={onUploadLocal}>
            <UploadCloud className="h-4 w-4" />
            로컬 업로드
          </Button>
          <Button onClick={onUseRemoteOnly} variant="secondary">
            <Database className="h-4 w-4" />
            Supabase만 사용
          </Button>
          <Button onClick={onBackupLater} variant="ghost">
            <DownloadCloud className="h-4 w-4" />
            백업 후 나중에
          </Button>
        </div>
      </section>
    </div>
  );
}
