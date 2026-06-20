import { NextResponse } from "next/server";
import {
  isJobApplicationStatus,
  isJobDecision,
} from "@/lib/job-tracker";
import {
  createSupabaseUserClient,
  requireSupabaseUser,
} from "@/lib/server-auth";

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

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
