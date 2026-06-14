import { NextResponse } from "next/server";

// Supabase PKCE callback handler for email confirmation and password recovery.
// We exchange the code client-side in /auth/confirm because the browser client
// owns the persisted session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const tokenHash = searchParams.get("token_hash");
  const error = searchParams.get("error");

  if (code) {
    if (!type || type === "recovery") {
      const resetUrl = new URL("/auth/reset-password", origin);
      resetUrl.searchParams.set("code", code);
      return NextResponse.redirect(resetUrl.toString());
    }
    const confirmUrl = new URL("/auth/confirm", origin);
    confirmUrl.searchParams.set("code", code);
    return NextResponse.redirect(confirmUrl.toString());
  }

  if (tokenHash && type === "recovery") {
    const resetUrl = new URL("/auth/reset-password", origin);
    resetUrl.searchParams.set("token_hash", tokenHash);
    resetUrl.searchParams.set("type", type);
    return NextResponse.redirect(resetUrl.toString());
  }

  if (!error) {
    return NextResponse.redirect(new URL("/auth/reset-password", origin));
  }

  // No code → show a friendly error page
  return NextResponse.redirect(new URL("/auth/error", origin));
}
