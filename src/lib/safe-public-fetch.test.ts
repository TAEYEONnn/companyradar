import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { brotliCompressSync, gzipSync } from "node:zlib";

// ── Hoisted mocks (must be set up before the module under test is imported) ───

const { httpsRequestMock, dnsLookupMock } = vi.hoisted(() => ({
  httpsRequestMock: vi.fn(),
  dnsLookupMock: vi.fn(),
}));

vi.mock("node:https", () => ({ request: httpsRequestMock }));
vi.mock("node:http", () => ({ request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: dnsLookupMock }));

import { fetchPublicText, isPrivateAddress, PublicFetchError } from "./safe-public-fetch";

// ── Test helpers ──────────────────────────────────────────────────────────────

type LookupCallback = (err: Error | null, address: string, family: number) => void;
type LookupFn = (hostname: string, options: unknown, callback: LookupCallback) => void;

function makePassThrough(
  statusCode: number,
  headers: Record<string, string>,
  body: Buffer | string,
) {
  const stream = new PassThrough();
  // Add IncomingMessage-like fields without overriding stream methods,
  // so Node's pipe/resume/destroy work correctly.
  Object.assign(stream, {
    statusCode,
    headers: Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    ),
  });
  setImmediate(() => {
    if (!stream.destroyed) {
      stream.write(Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8"));
      stream.end();
    }
  });
  return stream;
}

function makeMockReq(
  opts: { lookup?: LookupFn },
  callback: (res: PassThrough) => void,
  responseFactory: () => PassThrough,
) {
  const emitter = new EventEmitter();
  const req = Object.assign(emitter, {
    setTimeout: vi.fn(),
    destroy: vi.fn((err?: Error) => { if (err) emitter.emit("error", err); }),
    end: vi.fn(() => {
      if (opts.lookup) {
        // Simulate Node calling our lookup before connecting
        opts.lookup("example.com", {}, (err, _addr, _family) => {
          if (err) {
            setImmediate(() => emitter.emit("error", err));
          } else {
            setImmediate(() => callback(responseFactory()));
          }
        });
      } else {
        setImmediate(() => callback(responseFactory()));
      }
    }),
  });
  return req;
}

function setupFullRequest(
  dnsAddresses: { address: string; family: number }[],
  statusCode: number,
  headers: Record<string, string>,
  body: Buffer | string,
) {
  dnsLookupMock.mockResolvedValueOnce(dnsAddresses);
  httpsRequestMock.mockImplementationOnce(
    (_url: unknown, opts: { lookup?: LookupFn }, callback: (res: PassThrough) => void) =>
      makeMockReq(opts, callback, () => makePassThrough(statusCode, headers, body)),
  );
}

const PUBLIC_DNS = [{ address: "93.184.216.34", family: 4 }];
const JOB_HTML = `<html><body><main>${"공고 내용 ".repeat(100)}</main></body></html>`;
const FETCH_OPTS = { maxBytes: 500_000, maxChars: 20_000, timeoutMs: 10_000 };

// ── isPrivateAddress ──────────────────────────────────────────────────────────

describe("isPrivateAddress", () => {
  it.each([
    ["10.0.0.1", true],
    ["10.255.255.255", true],
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["192.168.0.1", true],
    ["127.0.0.1", true],
    ["127.0.0.254", true],
    ["169.254.1.1", true],
    ["0.0.0.0", true],
    ["::1", true],
    ["fc00::1", true],
    ["fd00::dead:beef", true],
    ["::ffff:127.0.0.1", true],
    ["fe80::1", true],
    ["8.8.8.8", false],
    ["1.1.1.1", false],
    ["93.184.216.34", false],
    ["2606:4700:4700::1111", false],
    ["172.15.0.1", false],
    ["172.32.0.1", false],
    ["11.0.0.1", false],
  ] as [string, boolean][])("isPrivateAddress(%s) === %s", (addr, expected) => {
    expect(isPrivateAddress(addr)).toBe(expected);
  });
});

// ── fetchPublicText ───────────────────────────────────────────────────────────

describe("fetchPublicText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts text from a plain 200 response", async () => {
    setupFullRequest(PUBLIC_DNS, 200, {}, JOB_HTML);
    const text = await fetchPublicText("https://example.com/job", FETCH_OPTS);
    expect(text.length).toBeGreaterThan(100);
  });

  it("decompresses a gzip-encoded response", async () => {
    const compressed = gzipSync(Buffer.from(JOB_HTML));
    setupFullRequest(PUBLIC_DNS, 200, { "content-encoding": "gzip" }, compressed);
    const text = await fetchPublicText("https://example.com/job", FETCH_OPTS);
    expect(text.length).toBeGreaterThan(100);
  });

  it("decompresses a brotli-encoded response", async () => {
    const compressed = brotliCompressSync(Buffer.from(JOB_HTML));
    setupFullRequest(PUBLIC_DNS, 200, { "content-encoding": "br" }, compressed);
    const text = await fetchPublicText("https://example.com/job", FETCH_OPTS);
    expect(text.length).toBeGreaterThan(100);
  });

  it("follows a 302 redirect and fetches the final page", async () => {
    dnsLookupMock.mockResolvedValueOnce(PUBLIC_DNS);
    httpsRequestMock.mockImplementationOnce(
      (_url: unknown, opts: { lookup?: LookupFn }, callback: (res: PassThrough) => void) =>
        makeMockReq(opts, callback, () =>
          makePassThrough(302, { location: "https://example.com/job/final" }, ""),
        ),
    );
    setupFullRequest(PUBLIC_DNS, 200, {}, JOB_HTML);

    const text = await fetchPublicText("https://example.com/job/1", FETCH_OPTS);
    expect(text.length).toBeGreaterThan(100);
    expect(httpsRequestMock).toHaveBeenCalledTimes(2);
  });

  it("throws url_access_denied for 401", async () => {
    setupFullRequest(PUBLIC_DNS, 401, {}, "Unauthorized");
    await expect(
      fetchPublicText("https://example.com/job", FETCH_OPTS),
    ).rejects.toMatchObject({ code: "url_access_denied" });
  });

  it("throws remote_http_forbidden for 403", async () => {
    setupFullRequest(PUBLIC_DNS, 403, {}, "Forbidden");
    await expect(
      fetchPublicText("https://example.com/job", FETCH_OPTS),
    ).rejects.toMatchObject({ code: "remote_http_forbidden" });
  });

  it("throws remote_http_rate_limited for 429", async () => {
    setupFullRequest(PUBLIC_DNS, 429, {}, "Too Many Requests");
    await expect(
      fetchPublicText("https://example.com/job", FETCH_OPTS),
    ).rejects.toMatchObject({ code: "remote_http_rate_limited" });
  });

  it("throws remote_http_error for 500", async () => {
    setupFullRequest(PUBLIC_DNS, 500, {}, "Internal Server Error");
    await expect(
      fetchPublicText("https://example.com/job", FETCH_OPTS),
    ).rejects.toMatchObject({ code: "remote_http_error" });
  });

  it("throws remote_connection_failed for ECONNRESET", async () => {
    dnsLookupMock.mockResolvedValueOnce(PUBLIC_DNS);
    const connError = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    httpsRequestMock.mockImplementationOnce(
      (_url: unknown, opts: { lookup?: LookupFn }, _cb: unknown) => {
        const emitter = new EventEmitter();
        return Object.assign(emitter, {
          setTimeout: vi.fn(),
          destroy: vi.fn((err?: Error) => { if (err) emitter.emit("error", err); }),
          end: vi.fn(() => {
            opts.lookup?.("example.com", {}, (err) => {
              if (!err) setImmediate(() => emitter.emit("error", connError));
              else setImmediate(() => emitter.emit("error", err));
            });
          }),
        });
      },
    );
    await expect(
      fetchPublicText("https://example.com/job", FETCH_OPTS),
    ).rejects.toMatchObject({ code: "remote_connection_failed" });
  });

  it("throws remote_tls_failed for ERR_TLS_CERT_ALTNAME_INVALID", async () => {
    dnsLookupMock.mockResolvedValueOnce(PUBLIC_DNS);
    const tlsError = Object.assign(new Error("Hostname/IP does not match"), {
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
    });
    httpsRequestMock.mockImplementationOnce(
      (_url: unknown, opts: { lookup?: LookupFn }, _cb: unknown) => {
        const emitter = new EventEmitter();
        return Object.assign(emitter, {
          setTimeout: vi.fn(),
          destroy: vi.fn((err?: Error) => { if (err) emitter.emit("error", err); }),
          end: vi.fn(() => {
            opts.lookup?.("example.com", {}, (err) => {
              if (!err) setImmediate(() => emitter.emit("error", tlsError));
              else setImmediate(() => emitter.emit("error", err));
            });
          }),
        });
      },
    );
    await expect(
      fetchPublicText("https://example.com/job", FETCH_OPTS),
    ).rejects.toMatchObject({ code: "remote_tls_failed" });
  });

  it("throws dns_failed when DNS lookup rejects with ENOTFOUND", async () => {
    const dnsErr = Object.assign(new Error("getaddrinfo ENOTFOUND bad.example"), {
      code: "ENOTFOUND",
    });
    dnsLookupMock.mockRejectedValueOnce(dnsErr);
    httpsRequestMock.mockImplementationOnce(
      (_url: unknown, opts: { lookup?: LookupFn }, _cb: unknown) => {
        const emitter = new EventEmitter();
        return Object.assign(emitter, {
          setTimeout: vi.fn(),
          destroy: vi.fn((err?: Error) => { if (err) emitter.emit("error", err); }),
          end: vi.fn(() => {
            opts.lookup?.("bad.example", {}, (err) => {
              setImmediate(() => emitter.emit("error", err ?? new Error("lookup failed")));
            });
          }),
        });
      },
    );
    await expect(
      fetchPublicText("https://bad.example/job", FETCH_OPTS),
    ).rejects.toMatchObject({ code: "dns_failed" });
  });

  it("throws blocked_private_address when DNS resolves to a private IP", async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: "192.168.0.1", family: 4 }]);
    httpsRequestMock.mockImplementationOnce(
      (_url: unknown, opts: { lookup?: LookupFn }, _cb: unknown) => {
        const emitter = new EventEmitter();
        return Object.assign(emitter, {
          setTimeout: vi.fn(),
          destroy: vi.fn((err?: Error) => { if (err) emitter.emit("error", err); }),
          end: vi.fn(() => {
            opts.lookup?.("internal.example.com", {}, (err) => {
              setImmediate(() => emitter.emit("error", err ?? new Error("blocked")));
            });
          }),
        });
      },
    );
    await expect(
      fetchPublicText("https://internal.example.com/job", FETCH_OPTS),
    ).rejects.toMatchObject({ code: "blocked_private_address" });
  });

  it("throws response_too_large when streaming body exceeds maxBytes", async () => {
    const bigHtml = "<html><body><main>" + "a".repeat(150_000) + "</main></body></html>";
    setupFullRequest(PUBLIC_DNS, 200, {}, bigHtml);
    await expect(
      fetchPublicText("https://example.com/job", { ...FETCH_OPTS, maxBytes: 100_000 }),
    ).rejects.toMatchObject({ code: "response_too_large" });
  });

  it("throws url_blocked for private IP literal URLs without making a request", async () => {
    await expect(
      fetchPublicText("http://192.168.0.1/job", FETCH_OPTS),
    ).rejects.toMatchObject({ code: "url_blocked" });
    expect(httpsRequestMock).not.toHaveBeenCalled();
  });

  it("throws url_invalid for non-http(s) URLs without making a request", async () => {
    await expect(
      fetchPublicText("ftp://example.com/job", FETCH_OPTS),
    ).rejects.toMatchObject({ code: "url_invalid" });
    expect(httpsRequestMock).not.toHaveBeenCalled();
  });

  it("throws decompression_failed for unsupported encoding (e.g. zstd)", async () => {
    setupFullRequest(PUBLIC_DNS, 200, { "content-encoding": "zstd" }, "binary");
    await expect(
      fetchPublicText("https://example.com/job", FETCH_OPTS),
    ).rejects.toMatchObject({ code: "decompression_failed" });
  });

  it("throws redirect_limit_exceeded when maxRedirects is exhausted", async () => {
    for (let i = 0; i <= 3; i++) {
      dnsLookupMock.mockResolvedValueOnce(PUBLIC_DNS);
      httpsRequestMock.mockImplementationOnce(
        (_url: unknown, opts: { lookup?: LookupFn }, callback: (res: PassThrough) => void) =>
          makeMockReq(opts, callback, () =>
            makePassThrough(302, { location: "https://example.com/job" }, ""),
          ),
      );
    }
    await expect(
      fetchPublicText("https://example.com/job", { ...FETCH_OPTS, maxRedirects: 3 }),
    ).rejects.toMatchObject({ code: "redirect_limit_exceeded" });
  });

  it("logs per-stage events without writing any job text content", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    setupFullRequest(PUBLIC_DNS, 200, {}, JOB_HTML);
    await fetchPublicText("https://example.com/job", FETCH_OPTS);

    const allLogs = spy.mock.calls.map((args) => JSON.stringify(args)).join(" ");
    expect(allLogs).toContain("dns-lookup-started");
    expect(allLogs).toContain("dns-lookup-completed");
    expect(allLogs).toContain("ssrf-validation-completed");
    expect(allLogs).toContain("remote-request-started");
    expect(allLogs).toContain("remote-response-received");
    expect(allLogs).toContain("fetch-completed");
    expect(allLogs).not.toContain("공고 내용");
    spy.mockRestore();
  });

  it("logs original errorName and errorCode on request error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    dnsLookupMock.mockResolvedValueOnce(PUBLIC_DNS);
    const resetErr = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    httpsRequestMock.mockImplementationOnce(
      (_url: unknown, opts: { lookup?: LookupFn }, _cb: unknown) => {
        const emitter = new EventEmitter();
        return Object.assign(emitter, {
          setTimeout: vi.fn(),
          destroy: vi.fn((err?: Error) => { if (err) emitter.emit("error", err); }),
          end: vi.fn(() => {
            opts.lookup?.("example.com", {}, (err) => {
              if (!err) setImmediate(() => emitter.emit("error", resetErr));
              else setImmediate(() => emitter.emit("error", err));
            });
          }),
        });
      },
    );

    await expect(
      fetchPublicText("https://example.com/job", FETCH_OPTS),
    ).rejects.toBeInstanceOf(PublicFetchError);

    const errLog = spy.mock.calls.find(
      (args) =>
        typeof args[1] === "object" &&
        (args[1] as Record<string, unknown>).stage === "fetch-failed",
    );
    expect(errLog).toBeDefined();
    const entry = errLog![1] as Record<string, unknown>;
    expect(entry.errorCode).toBe("ECONNRESET");
    expect(entry.errorName).toBe("Error");
    spy.mockRestore();
  });
});
