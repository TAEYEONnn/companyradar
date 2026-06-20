import { NextResponse } from "next/server";
import type { FitAnalysis } from "@/lib/fit-analysis";
import {
  canonicalizeJobUrl,
  isJobDecision,
  type SaveFitResultResponse,
  type StructuredJobPosting,
} from "@/lib/job-tracker";
import {
  createSupabaseUserClient,
  requireSupabaseUser,
} from "@/lib/server-auth";

export async function POST(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (auth.response) return auth.response;
  if (!auth.user) return apiError(401, "auth_required", "로그인이 필요합니다.");

  let body: {
    analysis?: FitAnalysis;
    jobPosting?: StructuredJobPosting;
    sourceUrl?: string;
    decision?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "invalid_request", "저장할 분석 결과가 필요합니다.");
  }

  if (!body.analysis?.analysisId || !body.jobPosting || !isJobDecision(body.decision)) {
    return apiError(400, "invalid_request", "분석 결과 또는 결정이 올바르지 않습니다.");
  }

  const canonicalUrl = canonicalizeJobUrl(body.sourceUrl ?? "");
  const client = createSupabaseUserClient(auth.user);
  const { data, error } = await client.rpc("save_fit_result", {
    p_job_posting: {
      title: body.jobPosting.title,
      companyName: body.jobPosting.companyName,
      canonicalUrl,
      source: body.jobPosting.source,
      deadline: body.jobPosting.deadline,
      lastCheckedAt: new Date().toISOString(),
      structuredData: {
        responsibilities: body.jobPosting.responsibilities,
        requiredQualifications: body.jobPosting.requiredQualifications,
        preferredQualifications: body.jobPosting.preferredQualifications,
      },
    },
    p_analysis: {
      analysisId: body.analysis.analysisId,
      summary: body.analysis.summary,
      recommendation: body.analysis.recommendation,
      score: body.analysis.score,
      evidenceCoverage: body.analysis.evidenceCoverage,
      nextAction: body.analysis.nextAction,
    },
    p_requirements: body.analysis.requirements,
    p_decision: body.decision,
  });

  if (error || !isSaveResponse(data)) {
    console.error("[fit-results] save failed", { code: error?.code });
    return apiError(500, "save_failed", "분석 결과를 저장하지 못했습니다.");
  }

  return NextResponse.json({ ok: true, ...data });
}

function isSaveResponse(value: unknown): value is SaveFitResultResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as SaveFitResultResponse).jobPostingId === "string",
  );
}

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
