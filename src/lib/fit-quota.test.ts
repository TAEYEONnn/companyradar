import { describe, expect, it } from "vitest";
import {
  evaluateQuotaCounts,
  parseQuotaReservation,
  reserveWithFallback,
} from "./fit-quota";

describe("evaluateQuotaCounts", () => {
  it("allows requests within every configured limit", () => {
    expect(
      evaluateQuotaCounts(
        { clientDaily: 4, globalDaily: 20, ipMinute: 2 },
        { clientDaily: 10, globalDaily: 200, ipMinute: 20 },
      ),
    ).toEqual({ allowed: true, reason: null });
  });

  it("returns the narrowest exceeded quota reason", () => {
    expect(
      evaluateQuotaCounts(
        { clientDaily: 11, globalDaily: 20, ipMinute: 2 },
        { clientDaily: 10, globalDaily: 200, ipMinute: 20 },
      ),
    ).toEqual({ allowed: false, reason: "client_daily" });
  });

  it("parses an atomic reservation result without charging rejected requests", () => {
    expect(parseQuotaReservation([1, 5, 30, 2, 0])).toEqual({
      allowed: true,
      reason: null,
    });
    expect(parseQuotaReservation([0, 10, 30, 2, 1])).toEqual({
      allowed: false,
      reason: "client_daily",
    });
  });

  it("uses the Supabase fallback when Upstash is unavailable", async () => {
    const result = await reserveWithFallback(
      async () => ({ allowed: false, reason: "quota_unavailable", backend: "upstash" }),
      async () => ({ allowed: true, reason: null, backend: "supabase" }),
    );

    expect(result).toEqual({
      allowed: true,
      reason: null,
      backend: "supabase",
    });
  });

  it("returns quota unavailable only when both quota stores fail", async () => {
    const result = await reserveWithFallback(
      async () => ({ allowed: false, reason: "quota_unavailable", backend: "upstash" }),
      async () => ({ allowed: false, reason: "quota_unavailable", backend: "supabase" }),
    );

    expect(result).toEqual({
      allowed: false,
      reason: "quota_unavailable",
      backend: "supabase",
    });
  });
});
