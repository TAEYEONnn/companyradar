import { normalizeCompany } from "@/lib/storage";
import type { Company } from "@/lib/types";

/**
 * Supabase 원격 동기화 (선택 기능)
 *
 * localStorage를 즉시 반응하는 1차 저장소로 유지하고,
 * 환경변수가 설정된 경우에만 Supabase에 백그라운드로 동기화합니다.
 *
 * 설정 방법:
 * 1. Supabase 프로젝트 생성 후 supabase/schema.sql 실행
 * 2. .env.local 에 아래 두 값 추가
 *    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *
 * 별도 SDK 없이 Supabase의 PostgREST API를 직접 호출하므로
 * 번들 크기에 영향이 없습니다.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const TABLE = "companies";

export function isRemoteSyncEnabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function headers(): HeadersInit {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

interface CompanyRow {
  id: string;
  data: Company;
  updated_at: string;
}

/** 원격의 모든 회사 데이터를 가져옵니다. 실패 시 null을 반환합니다. */
export async function pullRemoteCompanies(): Promise<Company[] | null> {
  if (!isRemoteSyncEnabled()) return null;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=id,data,updated_at`,
      { headers: headers() },
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as CompanyRow[];
    return rows.map((row) => normalizeCompany(row.data));
  } catch {
    return null;
  }
}

/** 전체 회사 목록을 원격에 upsert 합니다. */
export async function pushRemoteCompanies(companies: Company[]): Promise<boolean> {
  if (!isRemoteSyncEnabled()) return false;
  try {
    const rows: CompanyRow[] = companies.map((company) => ({
      id: company.id,
      data: company,
      updated_at: company.updatedAt,
    }));
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: {
        ...headers(),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** 원격에서 회사 하나를 삭제합니다. */
export async function deleteRemoteCompany(companyId: string): Promise<boolean> {
  if (!isRemoteSyncEnabled()) return false;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(companyId)}`,
      { method: "DELETE", headers: headers() },
    );
    return response.ok;
  } catch {
    return false;
  }
}

/** updatedAt 기준 최신 항목을 유지하며 로컬/원격을 병합합니다. */
export function mergeByUpdatedAt(local: Company[], remote: Company[]): Company[] {
  const map = new Map(local.map((company) => [company.id, company]));
  remote.forEach((company) => {
    const existing = map.get(company.id);
    if (!existing || Date.parse(company.updatedAt) > Date.parse(existing.updatedAt)) {
      map.set(company.id, company);
    }
  });
  return Array.from(map.values());
}

/** 디바운스된 push 헬퍼 */
export function createDebouncedPush(delayMs = 1500) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (companies: Company[]) => {
    if (!isRemoteSyncEnabled()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void pushRemoteCompanies(companies);
    }, delayMs);
  };
}
