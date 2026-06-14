import { NextResponse } from "next/server";

// Supabase PKCE callback handler for email confirmation and password recovery.
// We exchange the code client-side in /auth/confirm because the browser client
// owns the persisted session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  if (code) {
    const confirmUrl = new URL("/auth/confirm", origin);
    confirmUrl.searchParams.set("code", code);
    if (type === "recovery") {
      confirmUrl.searchParams.set("next", "/auth/reset-password");
    }
    return NextResponse.redirect(confirmUrl.toString());
  }

  // No code → show a friendly error page
  return NextResponse.redirect(new URL("/auth/error", origin));
}
