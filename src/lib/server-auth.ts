import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export type AuthErrorCode =
  | "auth_required"
  | "config_missing"
  | "forbidden"
  | "payment_required";

interface AuthErrorBody {
  error: {
    code: AuthErrorCode;
    message: string;
  };
}

export type ProfileRole = "owner" | "beta_user" | "blocked";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  accessToken: string;
  role?: ProfileRole;
}

interface RequireUserResult {
  response?: NextResponse<AuthErrorBody>;
  user?: AuthenticatedUser;
}

const AUTH_REQUIRED_MESSAGE = "로그인이 필요합니다.";
const CONFIG_MISSING_MESSAGE = "인증 설정이 누락되었습니다.";
const FORBIDDEN_MESSAGE = "forbidden";

export async function requireSupabaseUser(
  request: Request,
): Promise<RequireUserResult> {
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

  let profileRole: ProfileRole | undefined;
  try {
    const { data: profile } = await client
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle<{ role: ProfileRole }>();
    profileRole = profile?.role;
  } catch {
    // profiles table may not exist yet; proceed without role
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

export async function requireAllowedSupabaseUser(
  request: Request,
): Promise<RequireUserResult> {
  const auth = await requireSupabaseUser(request);
  if (auth.response || !auth.user) return auth;

  if (!isAllowedAiOperator(auth.user)) {
    return {
      response: authError(403, "forbidden", FORBIDDEN_MESSAGE),
    };
  }

  return auth;
}

export function isAllowedAiOperator(user: AuthenticatedUser) {
  if (user.role === "blocked") return false;
  if (user.role === "owner") return true;

  const allowedEmails = parseAllowlist(process.env.AI_ALLOWED_EMAILS).map((email) =>
    email.toLowerCase(),
  );
  const allowedUserIds = parseAllowlist(process.env.AI_ALLOWED_USER_IDS);
  const userEmail = user.email?.toLowerCase();

  return (
    (userEmail ? allowedEmails.includes(userEmail) : false) ||
    allowedUserIds.includes(user.id)
  );
}

export function authError(status: number, code: AuthErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
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
    .map((item) => item.trim().replace(/^<+|>+$/g, ""))
    .filter(Boolean);
}
