import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

interface AuthErrorBody {
  error: {
    code: "auth_required" | "config_missing" | "forbidden";
    message: string;
  };
}

interface RequireAllowedUserResult {
  response?: NextResponse<AuthErrorBody>;
  user?: {
    id: string;
    email?: string;
    accessToken: string;
    role?: "owner" | "beta_user" | "blocked";
  };
}

type ProfileRole = "owner" | "beta_user" | "blocked";

const AUTH_REQUIRED_MESSAGE = "로그인이 필요합니다.";
const CONFIG_MISSING_MESSAGE = "인증 설정이 누락되었습니다.";
const FORBIDDEN_MESSAGE = "forbidden";

export async function requireAllowedSupabaseUser(
  request: Request,
): Promise<RequireAllowedUserResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      response: authError(500, "config_missing", CONFIG_MISSING_MESSAGE),
    };
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return {
      response: authError(401, "auth_required", AUTH_REQUIRED_MESSAGE),
    };
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return {
      response: authError(401, "auth_required", "유효하지 않은 세션입니다."),
    };
  }

  const allowedEmails = parseAllowlist(process.env.AI_ALLOWED_EMAILS).map((email) =>
    email.toLowerCase(),
  );
  const allowedUserIds = parseAllowlist(process.env.AI_ALLOWED_USER_IDS);
  const userEmail = data.user.email?.toLowerCase();
  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .maybeSingle<{ role: ProfileRole }>();
  const profileRole = profile?.role;
  const userInAllowlist =
    (userEmail ? allowedEmails.includes(userEmail) : false) ||
    allowedUserIds.includes(data.user.id);
  const userAllowed =
    profileRole !== "blocked" &&
    (userInAllowlist || profileRole === "owner" || profileRole === "beta_user");

  if (!userAllowed) {
    return {
      response: authError(403, "forbidden", FORBIDDEN_MESSAGE),
    };
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      accessToken,
      role: profileRole,
    },
  };
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer") return null;
  return token?.trim() || null;
}

function parseAllowlist(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function authError(
  status: number,
  code: AuthErrorBody["error"]["code"],
  message: string,
) {
  return NextResponse.json({ error: { code, message } }, { status });
}
