import { NextResponse } from "next/server";
import { isAllowedAiOperator, requireSupabaseUser } from "@/lib/server-auth";
import { getSupabaseAdminClient } from "@/lib/server-supabase-admin";

const ALLOWED_TABLES = ["support_requests", "refund_requests", "account_deletion_requests"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

const ALLOWED_STATUSES: Record<AllowedTable, string[]> = {
  support_requests: ["open", "in_review", "resolved", "closed"],
  refund_requests: ["requested", "in_review", "approved", "rejected", "canceled"],
  account_deletion_requests: ["requested", "in_review", "completed", "canceled"],
};

export async function POST(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (auth.response || !auth.user) return auth.response;

  if (!isAllowedAiOperator(auth.user)) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "접근 권한이 없습니다." } },
      { status: 403 },
    );
  }

  let body: {
    table?: string;
    id?: string;
    status?: string;
    operatorNote?: string;
    archived?: boolean;
    replyBody?: string;
    markReplied?: boolean;
    deleteUser?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "요청 내용을 확인해 주세요." } },
      { status: 400 },
    );
  }

  const table = body.table as AllowedTable;
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json(
      { error: { code: "invalid_table", message: "유효하지 않은 테이블입니다." } },
      { status: 400 },
    );
  }

  const allowedStatuses = ALLOWED_STATUSES[table];
  if (body.status && !allowedStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: { code: "invalid_status", message: "유효하지 않은 상태값입니다." } },
      { status: 400 },
    );
  }

  if (!body.status && body.archived === undefined && body.replyBody === undefined && !body.markReplied && !body.deleteUser) {
    return NextResponse.json(
      { error: { code: "empty_patch", message: "변경할 내용이 없습니다." } },
      { status: 400 },
    );
  }

  if (!body.id) {
    return NextResponse.json(
      { error: { code: "id_required", message: "ID가 필요합니다." } },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { error: { code: "config_error", message: "서버 설정 오류입니다." } },
      { status: 503 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (body.status) patch.status = body.status;
  if (body.archived !== undefined) patch.archived_at = body.archived ? new Date().toISOString() : null;
  if (body.replyBody !== undefined) patch.reply_body = body.replyBody;
  if (body.markReplied) patch.replied_at = new Date().toISOString();
  if (table === "account_deletion_requests" && body.operatorNote !== undefined) {
    patch.operator_note = body.operatorNote;
  }

  const { error } = await admin.from(table).update(patch).eq("id", body.id);

  if (error) {
    console.error("[admin/update-request-status] update failed", error);
    return NextResponse.json(
      { error: { code: "update_failed", message: "상태 변경에 실패했습니다." } },
      { status: 500 },
    );
  }

  // Auto-delete the Supabase auth user when a deletion request is completed.
  // Look up user_id from the DB record — never trust operator-supplied email.
  let userDeletedId: string | null = null;
  if (body.deleteUser === true && table === "account_deletion_requests" && body.status === "completed") {
    const { data: reqRecord, error: reqErr } = await admin
      .from("account_deletion_requests")
      .select("user_id, email")
      .eq("id", body.id)
      .single<{ user_id: string; email: string }>();

    if (reqErr || !reqRecord) {
      // Revert the status update if we cannot look up the record
      await admin.from(table).update({ status: "in_review" }).eq("id", body.id);
      return NextResponse.json(
        { error: { code: "lookup_failed", message: "탈퇴 요청 기록을 찾을 수 없습니다." } },
        { status: 500 },
      );
    }

    // Block re-registration free credits before deleting
    if (reqRecord.email) {
      await admin
        .from("ai_free_used_emails")
        .upsert({ email: reqRecord.email }, { onConflict: "email", ignoreDuplicates: true });
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(reqRecord.user_id);
    if (delErr) {
      // Revert status to in_review so operator can retry
      await admin.from(table).update({ status: "in_review" }).eq("id", body.id);
      return NextResponse.json(
        { error: { code: "delete_failed", message: "계정 삭제에 실패했습니다. 다시 시도해 주세요." } },
        { status: 500 },
      );
    }
    userDeletedId = reqRecord.user_id;
  }

  return NextResponse.json({ ok: true, userDeletedId });
}
