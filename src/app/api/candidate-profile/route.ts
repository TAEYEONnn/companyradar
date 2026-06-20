import { NextResponse } from "next/server";
import {
  createSupabaseUserClient,
  requireSupabaseUser,
} from "@/lib/server-auth";
import type { CandidateProfile } from "@/lib/fit-analysis";

export async function GET(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (auth.response) return auth.response;
  if (!auth.user) return apiError(401, "auth_required", "로그인이 필요합니다.");
  const client = createSupabaseUserClient(auth.user);
  const { data, error } = await client
    .from("candidate_profiles")
    .select(
      "target_role,years_experience,skills,domains,achievements,updated_at",
    )
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) return apiError(500, "load_failed", "프로필을 불러오지 못했습니다.");
  if (!data) return NextResponse.json({ ok: true, profile: null });

  return NextResponse.json({
    ok: true,
    profile: {
      targetRole: data.target_role,
      yearsExperience: data.years_experience,
      skills: data.skills,
      domains: data.domains,
      achievements: data.achievements,
      updatedAt: data.updated_at,
    } satisfies CandidateProfile,
  });
}

export async function PUT(request: Request) {
  const auth = await requireSupabaseUser(request);
  if (auth.response) return auth.response;
  if (!auth.user) return apiError(401, "auth_required", "로그인이 필요합니다.");

  let profile: CandidateProfile;
  try {
    profile = parseProfile(await request.json());
  } catch (error) {
    return apiError(
      400,
      "invalid_profile",
      error instanceof Error ? error.message : "프로필 형식이 올바르지 않습니다.",
    );
  }

  const client = createSupabaseUserClient(auth.user);
  const updatedAt = new Date().toISOString();
  const { error } = await client.from("candidate_profiles").upsert(
    {
      user_id: auth.user.id,
      target_role: profile.targetRole,
      years_experience: profile.yearsExperience,
      skills: profile.skills,
      domains: profile.domains,
      achievements: profile.achievements,
      updated_at: updatedAt,
    },
    { onConflict: "user_id" },
  );

  if (error) return apiError(500, "save_failed", "프로필을 저장하지 못했습니다.");
  return NextResponse.json({
    ok: true,
    profile: { ...profile, updatedAt },
  });
}

function parseProfile(value: unknown): CandidateProfile {
  if (!value || typeof value !== "object") throw new Error("프로필이 필요합니다.");
  const body = value as Record<string, unknown>;
  const targetRole =
    typeof body.targetRole === "string" ? body.targetRole.trim().slice(0, 200) : "";
  const yearsExperience =
    typeof body.yearsExperience === "number" &&
    Number.isFinite(body.yearsExperience)
      ? Math.max(0, body.yearsExperience)
      : null;
  return {
    targetRole,
    yearsExperience,
    skills: stringArray(body.skills),
    domains: stringArray(body.domains),
    achievements: stringArray(body.achievements),
    updatedAt:
      typeof body.updatedAt === "string"
        ? body.updatedAt
        : new Date(0).toISOString(),
  };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, 30);
}

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
