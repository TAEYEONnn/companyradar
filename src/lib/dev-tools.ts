"use client";

const DEV_EMAILS = new Set(["dev@example.com"]);
const DEFAULT_DEV_HOSTS = ["localhost", "127.0.0.1"];

function configuredDevHosts() {
  const raw = process.env.NEXT_PUBLIC_DEV_TOOL_ORIGINS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeHost(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return value.split(":")[0] ?? value;
  }
}

export function isDevToolsEnabled({
  origin,
  userEmail,
}: {
  origin?: string;
  userEmail?: string;
}) {
  if (userEmail && DEV_EMAILS.has(userEmail.toLowerCase())) return true;
  if (!origin) return false;

  const host = normalizeHost(origin);
  const allowedHosts = new Set([...DEFAULT_DEV_HOSTS, ...configuredDevHosts()].map(normalizeHost));
  return allowedHosts.has(host);
}
