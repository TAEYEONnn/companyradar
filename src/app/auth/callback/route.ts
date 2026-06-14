import { NextResponse } from "next/server";

// Supabase PKCE magic link callback handler.
// Supabase redirects here after the user clicks the magic link:
//   https://yourapp.com/auth/callback?code=xxxx
// We forward to the root with the code still in the query string so
// the client-side Supabase JS (detectSessionInUrl: true) can exchange it.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    // Redirect to root with the code — supabase-js client picks it up
    const redirectUrl = new URL(next, origin);
    redirectUrl.searchParams.set("code", code);
    return NextResponse.redirect(redirectUrl.toString());
  }

  // No code → show a friendly error page
  return NextResponse.redirect(new URL("/auth/error", origin));
}
