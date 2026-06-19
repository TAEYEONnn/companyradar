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

  try {
    const response = await fetch(`${redisUrl.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", keys.client],
        ["EXPIRE", keys.client, 90_000, "NX"],
        ["INCR", keys.global],
        ["EXPIRE", keys.global, 90_000, "NX"],
        ["INCR", keys.ip],
        ["EXPIRE", keys.ip, 120, "NX"],
      ]),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      return { allowed: false, reason: "quota_unavailable" };
    }
    const results = (await response.json()) as Array<{ result?: number }>;
    return evaluateQuotaCounts(
      {
        clientDaily: Number(results[0]?.result ?? 0),
        globalDaily: Number(results[2]?.result ?? 0),
        ipMinute: Number(results[4]?.result ?? 0),
      },
      {
        clientDaily: envLimit("FIT_DAILY_CLIENT_LIMIT", 10),
        globalDaily: envLimit("FIT_DAILY_GLOBAL_LIMIT", 200),
        ipMinute: envLimit("FIT_IP_MINUTE_LIMIT", 20),
      },
    );
  } catch {
    return { allowed: false, reason: "quota_unavailable" };
  }
}

function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function envLimit(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
