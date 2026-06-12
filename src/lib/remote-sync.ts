import { normalizeCompany } from "@/lib/storage";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase-client";
import type { Company } from "@/lib/types";

/**
 * Supabase 원격 동기화
 *
 * localStorage를 즉시 반응하는 1차 저장소로 유지하고,
 * 로그인 사용자의 Supabase row에 백그라운드로 동기화합니다.
 *
 * 설정 방법:
 * 1. Supabase 프로젝트 생성 후 supabase/schema.sql 또는 migrations 실행
 * 2. .env.local 에 아래 두 값 추가
 *    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 */

const TABLE = "companies";

export function isRemoteSyncEnabled(): boolean {
  return isSupabaseConfigured();
}

interface CompanyRow {
  id: string;
  user_id: string;
  data: Company;
  updated_at: string;
}

/** 원격의 모든 회사 데이터를 가져옵니다. 실패 시 null을 반환합니다. */
export async function pullRemoteCompanies(userId: string): Promise<Company[] | null> {
  if (!isRemoteSyncEnabled()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id,user_id,data,updated_at")
      .eq("user_id", userId);
    if (error || !data) return null;
    const rows = data as CompanyRow[];
    return rows.map((row) => normalizeCompany(row.data));
  } catch {
    return null;
  }
}

/** 전체 회사 목록을 원격에 upsert 합니다. */
export async function pushRemoteCompanies(
  companies: Company[],
  userId: string,
): Promise<boolean> {
  if (!isRemoteSyncEnabled()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const rows: CompanyRow[] = companies.map((company) => ({
      id: company.id,
      user_id: userId,
      data: company,
      updated_at: company.updatedAt,
    }));
    const { error } = await supabase
      .from(TABLE)
      .upsert(rows, { onConflict: "user_id,id", ignoreDuplicates: false });
    return !error;
  } catch {
    return false;
  }
}

/** 원격에서 회사 하나를 삭제합니다. */
export async function deleteRemoteCompany(
  companyId: string,
  userId: string,
): Promise<boolean> {
  if (!isRemoteSyncEnabled()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", companyId)
      .eq("user_id", userId);
    return !error;
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

export interface SyncStatus {
  state: "idle" | "syncing" | "ok" | "error";
  lastAt: string;
}

/** 디바운스된 push 헬퍼. onResult로 동기화 결과를 알림. */
export function createDebouncedPush(
  delayMs = 1500,
  onResult?: (status: SyncStatus) => void,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (companies: Company[], userId: string) => {
    if (!isRemoteSyncEnabled()) return;
    if (timer) clearTimeout(timer);
    onResult?.({ state: "syncing", lastAt: new Date().toISOString() });
    timer = setTimeout(async () => {
      const ok = await pushRemoteCompanies(companies, userId);
      onResult?.({
        state: ok ? "ok" : "error",
        lastAt: new Date().toISOString(),
      });
    }, delayMs);
  };
}
