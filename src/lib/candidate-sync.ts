import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase-client";
import type { CandidateInboxItem } from "@/lib/types";

const TABLE = "candidate_inbox_items";

interface CandidateInboxRow {
  id: string;
  user_id: string;
  source_url: string;
  raw_text: string;
  company_name: string;
  job_title: string;
  discovery_reason: CandidateInboxItem["discoveryReason"];
  first_impression_note: string;
  parsed_company: CandidateInboxItem["parsedCompany"];
  parse_status: CandidateInboxItem["parseStatus"];
  needs_review: boolean;
  promoted_company_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function pullCandidateInboxItems(
  userId: string,
): Promise<CandidateInboxItem[] | null> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error || !data) return null;
    return (data as CandidateInboxRow[]).map(rowToCandidate);
  } catch {
    return null;
  }
}

export async function upsertCandidateInboxItem(
  item: CandidateInboxItem,
  userId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(candidateToRow(item, userId), {
        onConflict: "user_id,id",
        ignoreDuplicates: false,
      });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteCandidateInboxItem(
  candidateId: string,
  userId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", candidateId)
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

function rowToCandidate(row: CandidateInboxRow): CandidateInboxItem {
  return {
    id: row.id,
    sourceUrl: row.source_url ?? "",
    rawText: row.raw_text ?? "",
    companyName: row.company_name ?? "",
    jobTitle: row.job_title ?? "",
    discoveryReason: row.discovery_reason ?? "manual",
    firstImpressionNote: row.first_impression_note ?? "",
    parsedCompany: row.parsed_company ?? null,
    parseStatus: row.parse_status ?? "idle",
    needsReview: row.needs_review ?? true,
    promotedCompanyId: row.promoted_company_id ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function candidateToRow(
  item: CandidateInboxItem,
  userId: string,
): CandidateInboxRow {
  return {
    id: item.id,
    user_id: userId,
    source_url: item.sourceUrl,
    raw_text: item.rawText,
    company_name: item.companyName ?? "",
    job_title: item.jobTitle ?? "",
    discovery_reason: item.discoveryReason,
    first_impression_note: item.firstImpressionNote,
    parsed_company: item.parsedCompany,
    parse_status: item.parseStatus,
    needs_review: item.needsReview,
    promoted_company_id: item.promotedCompanyId || null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}
