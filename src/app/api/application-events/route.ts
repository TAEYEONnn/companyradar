import { NextResponse } from "next/server";
import {
  normalizeApplicationEvent,
  type ApplicationEvent,
} from "@/lib/job-tracker";
import {
  createSupabaseUserClient,
  requireSupabaseUser,
} from "@/lib/server-auth";

export async function GET(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (auth.response) return auth.response;
  if (!auth.user) return apiError(401, "auth_required", "로그인이 필요합니다.");

  const url = new URL(request.url);
  const days = clampDays(url.searchParams.get("days"));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const client = createSupabaseUserClient(auth.user);
  const { data, error } = await client
    .from("application_events")
    .select(
      "id,job_posting_id,event_type,from_status,to_status,company_name,job_title,note,occurred_at",
    )
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (error) {
    return apiError(500, "load_failed", "지원 일정을 불러오지 못했습니다.");
  }

  const events: ApplicationEvent[] = (data ?? []).map(normalizeApplicationEvent);
  return NextResponse.json({ ok: true, events });
}

function clampDays(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 90;
  return Math.min(365, Math.max(7, Math.round(parsed)));
}

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
