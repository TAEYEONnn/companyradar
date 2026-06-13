import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/server-supabase-admin";
import { isAllowedAiOperator } from "@/lib/server-auth";
import type { AuthenticatedUser, ProfileRole } from "@/lib/server-auth";
import { AdminDashboard } from "./AdminDashboard";

async function getSessionUser(): Promise<AuthenticatedUser | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const headersList = await headers();
  const cookieStore = await cookies();

  const authCookie =
    cookieStore.get("sb-access-token")?.value ??
    cookieStore.get(`sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`)?.value;

  const accessToken =
    (headersList.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || authCookie;

  if (!accessToken) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .maybeSingle<{ role: ProfileRole }>();

  return {
    id: data.user.id,
    email: data.user.email,
    accessToken,
    role: profile?.role,
  };
}

export default async function AdminPage() {
  const user = await getSessionUser();

  if (!user || !isAllowedAiOperator(user)) {
    redirect("/");
  }

  let supportRequests: object[] = [];
  let refundRequests: object[] = [];
  let deletionRequests: object[] = [];

  try {
    const admin = getSupabaseAdminClient();

    const [supportRes, refundRes, deletionRes] = await Promise.all([
      admin
        .from("support_requests")
        .select("id,email,request_type,subject,message,status,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("refund_requests")
        .select("id,email,order_id,payment_key,reason,status,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("account_deletion_requests")
        .select("id,email,reason,status,operator_note,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    supportRequests = supportRes.data ?? [];
    refundRequests = refundRes.data ?? [];
    deletionRequests = deletionRes.data ?? [];
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY 미설정 등 — 빈 목록으로 진입
  }

  return (
    <AdminDashboard
      initialDeletions={deletionRequests as Parameters<typeof AdminDashboard>[0]["initialDeletions"]}
      initialRefunds={refundRequests as Parameters<typeof AdminDashboard>[0]["initialRefunds"]}
      initialSupport={supportRequests as Parameters<typeof AdminDashboard>[0]["initialSupport"]}
    />
  );
}
