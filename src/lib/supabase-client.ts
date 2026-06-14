"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // /auth/confirm handles code exchange explicitly
      },
    });
  }
  return client;
}

export function getAuthRedirectUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  // NEXT_PUBLIC_SITE_URL overrides auto-detection (useful for localhost dev or custom domains)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
  return `${base}/auth/callback`;
}
