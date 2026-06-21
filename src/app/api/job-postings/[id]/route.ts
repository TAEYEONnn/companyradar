import { NextResponse } from "next/server";
import type { FitRequirement } from "@/lib/fit-analysis";
import {
  isJobApplicationStatus,
  isJobDecision,
  normalizeTrackedJobPosting,
  type TrackedJobPosting,
} from "@/lib/job-tracker";
import {
  createSupabaseUserClient,
  requireSupabaseUser,
} from "@/lib/server-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupabaseUser(request);
  if (auth.response) return auth.response;
  if (!auth.user) return apiError(401, "auth_required", "로그인이 필요합니다.");
  const { id } = await context.params;
  const client = createSupabaseUserClient(auth.user);

  const postingRes = await client
    .from("job_postings")
    .select(
      "id,company_id,title,canonical_url,source,structured_data,deadline,last_checked_at,created_at,updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (postingRes.error) {
    return apiError(500, "load_failed", "공고를 불러오지 못했습니다.");
  }
  if (!postingRes.data) {
    return apiError(404, "not_found", "저장한 공고를 찾지 못했습니다.");
  }

  const [companyRes, analysisRes, decisionRes, applicationRes] =
    await Promise.all([
      client
        .from("job_companies")
        .select("name")
        .eq("id", postingRes.data.company_id)
        .maybeSingle(),
      client
        .from("fit_analyses")
        .select(
          "id,analysis_id,summary,recommendation,score,evidence_coverage,next_action,company_overview,created_at",
        )
        .eq("job_posting_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from("job_decisions")
        .select("decision")
        .eq("job_posting_id", id)
        .maybeSingle(),
      client
        .from("applications")
        .select("status")
        .eq("job_posting_id", id)
        .maybeSingle(),
    ]);

  const error =
    companyRes.error ||
    analysisRes.error ||
    decisionRes.error ||
    applicationRes.error;
  if (error || !analysisRes.data || !decisionRes.data) {
    return apiError(500, "load_failed", "저장한 분석을 불러오지 못했습니다.");
  }

  const requirementsRes = await client
    .from("fit_requirements")
    .select(
      "requirement_key,text,importance,match,confidence,job_evidence,profile_evidence,position",
    )
    .eq("fit_analysis_id", analysisRes.data.id)
    .order("position", { ascending: true });
  if (requirementsRes.error) {
    return apiError(500, "load_failed", "분석 근거를 불러오지 못했습니다.");
  }

  const requirements = (requirementsRes.data ?? []).map(
    (row) =>
      ({
        id: row.requirement_key,
        text: row.text,
        importance: row.importance,
        match: row.match,
        confidence: row.confidence,
        jobEvidence: row.job_evidence,
        profileEvidence: row.profile_evidence,
      }) as FitRequirement,
  );
  const structuredData = isStructuredData(postingRes.data.structured_data)
    ? postingRes.data.structured_data
    : null;
  const job = normalizeTrackedJobPosting({
    id: postingRes.data.id,
    companyName: companyRes.data?.name ?? "회사명 확인 필요",
    title: postingRes.data.title,
    canonicalUrl: postingRes.data.canonical_url ?? "",
    source: postingRes.data.source,
    deadline: postingRes.data.deadline ?? "",
    lastCheckedAt: postingRes.data.last_checked_at ?? "",
    decision: decisionRes.data.decision,
    applicationStatus: applicationRes.data?.status ?? null,
    analysisId: analysisRes.data.analysis_id,
    recommendation: analysisRes.data.recommendation,
    score: analysisRes.data.score,
    evidenceCoverage: analysisRes.data.evidence_coverage ?? 0,
    summary: analysisRes.data.summary,
    nextAction: analysisRes.data.next_action,
    requirements,
    companyOverview: analysisRes.data.company_overview ?? null,
    structuredData,
    createdAt: postingRes.data.created_at,
    updatedAt: postingRes.data.updated_at,
  } as TrackedJobPosting);

  return NextResponse.json({ ok: true, job });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupabaseUser(request);
  if (auth.response) return auth.response;
  if (!auth.user) return apiError(401, "auth_required", "로그인이 필요합니다.");
  const { id } = await context.params;

  let body: { decision?: unknown; applicationStatus?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "invalid_request", "변경할 상태가 필요합니다.");
  }
  if (
    body.decision === undefined &&
    body.applicationStatus === undefined
  ) {
    return apiError(400, "invalid_request", "변경할 상태가 필요합니다.");
  }
  if (body.decision !== undefined && !isJobDecision(body.decision)) {
    return apiError(400, "invalid_decision", "결정 상태가 올바르지 않습니다.");
  }
  if (
    body.applicationStatus !== undefined &&
    !isJobApplicationStatus(body.applicationStatus)
  ) {
    return apiError(400, "invalid_status", "지원 상태가 올바르지 않습니다.");
  }

  const client = createSupabaseUserClient(auth.user);
  if (body.decision !== undefined) {
    const { error } = await client.from("job_decisions").upsert(
      {
        user_id: auth.user.id,
        job_posting_id: id,
        decision: body.decision,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,job_posting_id" },
    );
    if (error) return apiError(500, "update_failed", "결정을 변경하지 못했습니다.");
  }
  if (body.applicationStatus !== undefined) {
    const { error } = await client.from("applications").upsert(
      {
        user_id: auth.user.id,
        job_posting_id: id,
        status: body.applicationStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,job_posting_id" },
    );
    if (error) return apiError(500, "update_failed", "지원 상태를 변경하지 못했습니다.");
  }

  return NextResponse.json({ ok: true });
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
