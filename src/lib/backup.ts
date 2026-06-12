import { normalizeCompany } from "@/lib/storage";
import type { Company, CriteriaSettings } from "@/lib/types";

export interface BackupPayload {
  app: "company-career-tracker";
  version: 1;
  exportedAt: string;
  companies: Company[];
  settings: CriteriaSettings;
}

export function exportBackup(companies: Company[], settings: CriteriaSettings) {
  const payload: BackupPayload = {
    app: "company-career-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    companies,
    settings,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `career-tracker-backup-${payload.exportedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function parseBackupFile(
  file: File,
): Promise<{ companies: Company[]; settings: CriteriaSettings | null }> {
  const text = await file.text();
  const raw = JSON.parse(text) as Partial<BackupPayload> | Company[];

  // 배열만 들어와도 (companies만 추출한 백업) 허용
  if (Array.isArray(raw)) {
    return { companies: raw.map(normalizeCompany), settings: null };
  }

  if (!raw || !Array.isArray(raw.companies)) {
    throw new Error("백업 파일 형식이 올바르지 않습니다.");
  }

  return {
    companies: raw.companies.map(normalizeCompany),
    settings: raw.settings ?? null,
  };
}

/** 같은 id가 있으면 updatedAt이 최신인 쪽을 유지하며 병합 */
export function mergeCompanies(current: Company[], incoming: Company[]): Company[] {
  const map = new Map(current.map((company) => [company.id, company]));
  incoming.forEach((company) => {
    const existing = map.get(company.id);
    if (!existing || Date.parse(company.updatedAt) >= Date.parse(existing.updatedAt)) {
      map.set(company.id, company);
    }
  });
  return Array.from(map.values());
}
