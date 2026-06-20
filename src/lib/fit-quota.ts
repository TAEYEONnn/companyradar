import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/server-supabase-admin";

export type QuotaReason =
  | "client_daily"
  | "global_daily"
  | "ip_minute"
  | "quota_unavailable";

interface QuotaCounts {
  clientDaily: number;
  globalDaily: number;
  ipMinute: number;
}

interface QuotaLimits {
  clientDaily: number;
  globalDaily: number;
  ipMinute: number;
}

export interface QuotaResult {
  allowed: boolean;
  reason: QuotaReason | null;
  backend?: "upstash" | "supabase" | "development";
}

interface QuotaOptions {
  feature: string;
  clientDaily: number;
  globalDaily: number;
  ipMinute: number;
}

const RESERVE_QUOTA_LUA = `
local client = tonumber(redis.call("GET", KEYS[1]) or "0")
local global = tonumber(redis.call("GET", KEYS[2]) or "0")
local ip = tonumber(redis.call("GET", KEYS[3]) or "0")
local client_limit = tonumber(ARGV[1])
local global_limit = tonumber(ARGV[2])
local ip_limit = tonumber(ARGV[3])
if client >= client_limit then return {0, client, global, ip, 1} end
if global >= global_limit then return {0, client, global, ip, 2} end
if ip >= ip_limit then return {0, client, global, ip, 3} end
client = redis.call("INCR", KEYS[1])
global = redis.call("INCR", KEYS[2])
ip = redis.call("INCR", KEYS[3])
if client == 1 then redis.call("EXPIRE", KEYS[1], 90000) end
if global == 1 then redis.call("EXPIRE", KEYS[2], 90000) end
if ip == 1 then redis.call("EXPIRE", KEYS[3], 120) end
return {1, client, global, ip, 0}
`;

export function evaluateQuotaCounts(
  counts: QuotaCounts,
  limits: QuotaLimits,
): QuotaResult {
  if (counts.clientDaily > limits.clientDaily) {
    return { allowed: false, reason: "client_daily" };
  }
  if (counts.globalDaily > limits.globalDaily) {
    return { allowed: false, reason: "global_daily" };
  }
  if (counts.ipMinute > limits.ipMinute) {
    return { allowed: false, reason: "ip_minute" };
  }
  return { allowed: true, reason: null };
}

export async function reserveFitQuota(
  request: Request,
  clientId: string,
): Promise<QuotaResult> {
  return reserveAiQuota(request, clientId, {
    feature: "analyze-fit",
    clientDaily: envLimit("FIT_DAILY_CLIENT_LIMIT", 10),
    globalDaily: envLimit("FIT_DAILY_GLOBAL_LIMIT", 200),
    ipMinute: envLimit("FIT_IP_MINUTE_LIMIT", 20),
  });
}

export async function reserveResumeQuota(
  request: Request,
  clientId: string,
): Promise<QuotaResult> {
  return reserveAiQuota(request, clientId, {
    feature: "parse-resume",
    clientDaily: envLimit("RESUME_DAILY_CLIENT_LIMIT", 3),
    globalDaily: envLimit("RESUME_DAILY_GLOBAL_LIMIT", 300),
    ipMinute: envLimit("RESUME_IP_MINUTE_LIMIT", 10),
  });
}

export async function reserveWithFallback(
  primary: () => Promise<QuotaResult>,
  fallback: () => Promise<QuotaResult>,
): Promise<QuotaResult> {
  const primaryResult = await primary();
  if (primaryResult.reason !== "quota_unavailable") return primaryResult;
  return fallback();
}

async function reserveAiQuota(
  request: Request,
  clientId: string,
  options: QuotaOptions,
): Promise<QuotaResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const minute = now.toISOString().slice(0, 16);
  const salt =
    process.env.FIT_QUOTA_SALT ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "companyradar-development";
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "local";
  const ip = forwardedFor.split(",")[0]?.trim() || "local";
  const clientHash = hashIdentifier(`${salt}:${clientId}`);
  const ipHash = hashIdentifier(`${salt}:${ip}`);
  const keys = {
    client: hashIdentifier(`${salt}:${options.feature}:client:${day}:${clientHash}`),
    global: hashIdentifier(`${salt}:${options.feature}:global:${day}`),
    ip: hashIdentifier(`${salt}:${options.feature}:ip:${minute}:${ipHash}`),
  };
  const limits = {
    clientDaily: options.clientDaily,
    globalDaily: options.globalDaily,
    ipMinute: options.ipMinute,
  };

  if (!redisUrl || !redisToken) {
    if (process.env.NODE_ENV !== "production") {
      return { allowed: true, reason: null, backend: "development" };
    }
    return reserveSupabaseQuota(options.feature, keys, limits, now);
  }

  return reserveWithFallback(
    () => reserveUpstashQuota(redisUrl, redisToken, keys, limits),
    () => reserveSupabaseQuota(options.feature, keys, limits, now),
  );
}

async function reserveUpstashQuota(
  redisUrl: string,
  redisToken: string,
  keys: { client: string; global: string; ip: string },
  limits: QuotaLimits,
): Promise<QuotaResult> {
  try {
    const response = await fetch(`${redisUrl.replace(/\/$/, "")}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        RESERVE_QUOTA_LUA,
        3,
        keys.client,
        keys.global,
        keys.ip,
        limits.clientDaily,
        limits.globalDaily,
        limits.ipMinute,
      ]),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      return {
        allowed: false,
        reason: "quota_unavailable",
        backend: "upstash",
      };
    }
    const result = (await response.json()) as { result?: unknown };
    return { ...parseQuotaReservation(result.result), backend: "upstash" };
  } catch {
    return {
      allowed: false,
      reason: "quota_unavailable",
      backend: "upstash",
    };
  }
}

async function reserveSupabaseQuota(
  feature: string,
  keys: { client: string; global: string; ip: string },
  limits: QuotaLimits,
  now: Date,
): Promise<QuotaResult> {
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("reserve_ai_quota", {
      p_feature: feature,
      p_client_key: keys.client,
      p_global_key: keys.global,
      p_ip_key: keys.ip,
      p_client_limit: limits.clientDaily,
      p_global_limit: limits.globalDaily,
      p_ip_limit: limits.ipMinute,
      p_daily_expires_at: new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
          1,
        ),
      ).toISOString(),
      p_minute_expires_at: new Date(now.getTime() + 2 * 60_000).toISOString(),
    });
    if (error || !data || typeof data !== "object") {
      return {
        allowed: false,
        reason: "quota_unavailable",
        backend: "supabase",
      };
    }
    const result = data as { allowed?: unknown; reason?: unknown };
    return {
      allowed: result.allowed === true,
      reason: parseSupabaseReason(result.reason),
      backend: "supabase",
    };
  } catch {
    return {
      allowed: false,
      reason: "quota_unavailable",
      backend: "supabase",
    };
  }
}

export function parseQuotaReservation(value: unknown): QuotaResult {
  if (!Array.isArray(value) || value.length < 5) {
    return { allowed: false, reason: "quota_unavailable" };
  }
  if (Number(value[0]) === 1) {
    return { allowed: true, reason: null };
  }
  const reasonCode = Number(value[4]);
  const reason =
    reasonCode === 1
      ? "client_daily"
      : reasonCode === 2
        ? "global_daily"
        : reasonCode === 3
          ? "ip_minute"
          : "quota_unavailable";
  return { allowed: false, reason };
}

function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function envLimit(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function parseSupabaseReason(value: unknown): QuotaReason | null {
  if (value === "client_daily") return "client_daily";
  if (value === "global_daily") return "global_daily";
  if (value === "ip_minute") return "ip_minute";
  if (value === null || value === undefined || value === "") return null;
  return "quota_unavailable";
}
