import { NextResponse } from "next/server";

// Supabase PKCE magic link callback handler.
// Supabase redirects here after the user clicks the magic link:
//   https://yourapp.com/auth/callback?code=xxxx
// We forward to /auth/confirm which exchanges the code client-side,
// then redirects to / — this avoids the detectSessionInUrl double-exchange
// loop that caused infinite reloading in production.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const confirmUrl = new URL("/auth/confirm", origin);
    confirmUrl.searchParams.set("code", code);
    return NextResponse.redirect(confirmUrl.toString());
  }

  // No code → show a friendly error page
  return NextResponse.redirect(new URL("/auth/error", origin));
}
