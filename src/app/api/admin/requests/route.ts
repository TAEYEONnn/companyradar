import { NextResponse } from "next/server";
import { isAllowedAiOperator, requireSupabaseUser } from "@/lib/server-auth";
import { getSupabaseAdminClient } from "@/lib/server-supabase-admin";

export async function GET(request: Request) {
  const { response, user } = await requireSupabaseUser(request);
  if (response) return response;
  if (!user || !isAllowedAiOperator(user)) {
    return NextResponse.json({ error: { code: "forbidden", message: "접근 권한이 없습니다." } }, { status: 403 });
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: { code: "config_error", message: "서비스 설정 오류입니다." } }, { status: 503 });
  }

  const [supportRes, refundRes, deletionRes] = await Promise.all([
    admin
      .from("support_requests")
      .select("id,email,request_type,subject,message,status,created_at,archived_at,reply_body,replied_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("refund_requests")
      .select("id,email,order_id,payment_key,reason,status,created_at,archived_at,reply_body,replied_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("account_deletion_requests")
      .select("id,email,reason,status,operator_note,created_at:requested_at,archived_at,reply_body,replied_at")
      .order("requested_at", { ascending: false })
      .limit(200),
  ]);

  return NextResponse.json({
    support: supportRes.data ?? [],
    refunds: refundRes.data ?? [],
    deletions: deletionRes.data ?? [],
  });
}
