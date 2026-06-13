import { createClient } from "@supabase/supabase-js";

export type AiRequestFeature =
  | "compare-companies"
  | "draft-email"
  | "gen-prep-questions"
  | "parse-job"
  | "research-company"
  | "summarize-company"
  | "weekly-strategy";

interface AiRequestUser {
  id: string;
  accessToken: string;
}

export async function logAiRequest(
  user: AiRequestUser | undefined,
  feature: AiRequestFeature,
  status: "success" | "error",
  errorCode = "",
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!user || !supabaseUrl || !supabaseAnonKey) return;

  try {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${user.accessToken}` } },
    });
    await client.from("ai_requests").insert({
      user_id: user.id,
      feature,
      status,
      error_code: errorCode || null,
    });
  } catch {
    // Usage logging should never block the user-facing AI flow.
  }
}
