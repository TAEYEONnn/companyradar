import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "./safe-public-fetch";

describe("isPrivateAddress", () => {
  it("blocks private, loopback, link-local, and unique-local addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.0.1",
      "192.168.0.1",
      "169.254.1.1",
      "::1",
      "fc00::1",
      "fd12::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it("allows ordinary public addresses", () => {
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });
});
