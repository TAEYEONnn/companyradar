import { NextResponse } from "next/server";
import type { FitRequirement } from "@/lib/fit-analysis";
import {
  normalizeTrackedJobPosting,
  type TrackedJobPosting,
} from "@/lib/job-tracker";
import {
  createSupabaseUserClient,
  requireSupabaseUser,
} from "@/lib/server-auth";

export async function GET(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (auth.response) return auth.response;
  if (!auth.user) return apiError(401, "auth_required", "로그인이 필요합니다.");
  const client = createSupabaseUserClient(auth.user);

  const [postingsRes, companiesRes, analysesRes, decisionsRes, applicationsRes] =
    await Promise.all([
      client
        .from("job_postings")
        .select(
          "id,company_id,title,canonical_url,source,structured_data,deadline,last_checked_at,created_at,updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(200),
      client.from("job_companies").select("id,name").limit(200),
      client
        .from("fit_analyses")
        .select(
          "id,job_posting_id,analysis_id,summary,recommendation,score,evidence_coverage,next_action,company_overview,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(400),
      client.from("job_decisions").select("job_posting_id,decision"),
      client.from("applications").select("job_posting_id,status"),
    ]);

  const error =
    postingsRes.error ||
    companiesRes.error ||
    analysesRes.error ||
    decisionsRes.error ||
    applicationsRes.error;
  if (error) return apiError(500, "load_failed", "공고 목록을 불러오지 못했습니다.");

  const analyses = analysesRes.data ?? [];
  const latestByJob = new Map<string, (typeof analyses)[number]>();
  for (const analysis of analyses) {
    if (!latestByJob.has(analysis.job_posting_id)) {
      latestByJob.set(analysis.job_posting_id, analysis);
    }
  }
  const analysisIds = [...latestByJob.values()].map((item) => item.id);
  const requirementsRes =
    analysisIds.length > 0
      ? await client
          .from("fit_requirements")
          .select(
            "fit_analysis_id,requirement_key,text,importance,match,confidence,job_evidence,profile_evidence,position",
          )
          .in("fit_analysis_id", analysisIds)
          .order("position", { ascending: true })
      : { data: [], error: null };
  if (requirementsRes.error) {
    return apiError(500, "load_failed", "분석 근거를 불러오지 못했습니다.");
  }

  const companyMap = new Map(
    (companiesRes.data ?? []).map((item) => [item.id, item.name]),
  );
  const decisionMap = new Map(
    (decisionsRes.data ?? []).map((item) => [
      item.job_posting_id,
      item.decision,
    ]),
  );
  const applicationMap = new Map(
    (applicationsRes.data ?? []).map((item) => [
      item.job_posting_id,
      item.status,
    ]),
  );
  const requirementsByAnalysis = new Map<string, FitRequirement[]>();
  for (const row of requirementsRes.data ?? []) {
    const current = requirementsByAnalysis.get(row.fit_analysis_id) ?? [];
    current.push({
      id: row.requirement_key,
      text: row.text,
      importance: row.importance,
      match: row.match,
      confidence: row.confidence,
      jobEvidence: row.job_evidence,
      profileEvidence: row.profile_evidence,
    } as FitRequirement);
    requirementsByAnalysis.set(row.fit_analysis_id, current);
  }

  const jobs: TrackedJobPosting[] = (postingsRes.data ?? [])
    .map((posting) => {
      const analysis = latestByJob.get(posting.id);
      const decision = decisionMap.get(posting.id);
      if (!analysis || !decision) return null;
      const structuredData = isStructuredData(posting.structured_data)
        ? posting.structured_data
        : null;
      return normalizeTrackedJobPosting({
        id: posting.id,
        companyName: companyMap.get(posting.company_id) ?? "회사명 확인 필요",
        title: posting.title,
        canonicalUrl: posting.canonical_url ?? "",
        source: posting.source,
        deadline: posting.deadline ?? "",
        lastCheckedAt: posting.last_checked_at ?? "",
        decision,
        applicationStatus: applicationMap.get(posting.id) ?? null,
        analysisId: analysis.analysis_id,
        recommendation: analysis.recommendation,
        score: analysis.score,
        evidenceCoverage: analysis.evidence_coverage ?? 0,
        summary: analysis.summary,
        nextAction: analysis.next_action,
        requirements: requirementsByAnalysis.get(analysis.id) ?? [],
        companyOverview: analysis.company_overview ?? null,
        structuredData,
        createdAt: posting.created_at,
        updatedAt: posting.updated_at,
      } as TrackedJobPosting);
    })
    .filter((item): item is TrackedJobPosting => Boolean(item));

  return NextResponse.json({ ok: true, jobs });
}

function isStructuredData(
  value: unknown,
): value is TrackedJobPosting["structuredData"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return (
    Array.isArray(data.responsibilities) &&
    Array.isArray(data.requiredQualifications) &&
    Array.isArray(data.preferredQualifications)
  );
}

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
