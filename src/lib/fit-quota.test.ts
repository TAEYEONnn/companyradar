import { describe, expect, it } from "vitest";
import {
  evaluateQuotaCounts,
  parseQuotaReservation,
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
});
