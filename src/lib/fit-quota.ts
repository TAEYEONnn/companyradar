import { createHash } from "node:crypto";

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
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    if (process.env.NODE_ENV === "production") {
      return { allowed: false, reason: "quota_unavailable" };
    }
    return { allowed: true, reason: null };
  }

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const minute = now.toISOString().slice(0, 16);
  const salt = process.env.FIT_QUOTA_SALT ?? "companyradar-development";
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "local";
  const ip = forwardedFor.split(",")[0]?.trim() || "local";
  const clientHash = hashIdentifier(`${salt}:${clientId}`);
  const ipHash = hashIdentifier(`${salt}:${ip}`);
  const keys = {
    client: `fit:client:${day}:${clientHash}`,
    global: `fit:global:${day}`,
    ip: `fit:ip:${minute}:${ipHash}`,
  };
  const limits = {
    clientDaily: envLimit("FIT_DAILY_CLIENT_LIMIT", 10),
    globalDaily: envLimit("FIT_DAILY_GLOBAL_LIMIT", 200),
    ipMinute: envLimit("FIT_IP_MINUTE_LIMIT", 20),
  };

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
      return { allowed: false, reason: "quota_unavailable" };
    }
    const result = (await response.json()) as { result?: unknown };
    return parseQuotaReservation(result.result);
  } catch {
    return { allowed: false, reason: "quota_unavailable" };
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
