import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/server-auth";
import { getSupabaseAdminClient } from "@/lib/server-supabase-admin";

export async function GET(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (auth.response || !auth.user) return auth.response;

  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("account_deletion_requests")
      .select("id,status,requested_at")
      .eq("user_id", auth.user.id)
      .in("status", ["requested", "in_review"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ ok: true, request: data ?? null });
  } catch {
    return NextResponse.json(
      { error: { code: "load_failed", message: "탈퇴 요청 상태를 불러오지 못했습니다." } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (auth.response || !auth.user) return auth.response;

  let body: { reason?: string; confirmText?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "요청 내용을 확인해 주세요." } },
      { status: 400 },
    );
  }

  if (body.confirmText?.trim() !== "탈퇴") {
    return NextResponse.json(
      { error: { code: "confirm_required", message: "확인 문구를 입력해 주세요." } },
      { status: 400 },
    );
  }

  try {
    const admin = getSupabaseAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("account_deletion_requests")
      .select("id,status,requested_at")
      .eq("user_id", auth.user.id)
      .in("status", ["requested", "in_review"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return NextResponse.json({ ok: true, request: existing });

    const { data, error } = await admin
      .from("account_deletion_requests")
      .insert({
        user_id: auth.user.id,
        email: auth.user.email ?? "",
        reason: body.reason?.trim() || "",
        status: "requested",
        requested_at: new Date().toISOString(),
      })
      .select("id,status,requested_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, request: data });
  } catch {
    return NextResponse.json(
      { error: { code: "save_failed", message: "탈퇴 요청을 보내지 못했어요." } },
      { status: 500 },
    );
  }
}
