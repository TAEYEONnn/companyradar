import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import type { Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

export type PublicFetchErrorCode =
  | "url_invalid"
  | "url_blocked"
  | "blocked_private_address"
  | "dns_failed"
  | "remote_timeout"
  | "remote_connection_failed"
  | "remote_tls_failed"
  | "remote_http_forbidden"
  | "remote_http_rate_limited"
  | "remote_http_error"
  | "redirect_limit_exceeded"
  | "redirect_blocked"
  | "response_too_large"
  | "decompression_failed"
  | "url_access_denied"
  | "url_timeout"
  | "url_content_not_found"
  | "fetch_failed";

export class PublicFetchError extends Error {
  constructor(
    public readonly code: PublicFetchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PublicFetchError";
  }
}

interface PublicFetchOptions {
  maxBytes: number;
  maxChars: number;
  timeoutMs: number;
  maxRedirects?: number;
}

interface NodeError extends Error {
  code?: string;
}

function isNodeError(error: unknown): error is NodeError {
  return error instanceof Error && "code" in error;
}

function nodeErrToPublicFetchError(error: unknown): PublicFetchError {
  if (error instanceof PublicFetchError) return error;

  const nodeCode = isNodeError(error) ? (error.code ?? "") : "";

  if (
    nodeCode === "ENOTFOUND" ||
    nodeCode === "EAI_NONAME" ||
    nodeCode === "EAI_AGAIN" ||
    nodeCode === "ERR_INVALID_IP_ADDRESS"
  ) {
    return new PublicFetchError("dns_failed", "공고 페이지의 주소를 찾지 못했습니다. URL을 다시 확인해 주세요.");
  }
  if (nodeCode === "ETIMEDOUT" || nodeCode === "ESOCKETTIMEDOUT") {
    return new PublicFetchError("remote_timeout", "공고 페이지 연결 시간이 초과됐습니다. 공고 원문을 붙여넣어 주세요.");
  }
  if (
    nodeCode === "ECONNREFUSED" ||
    nodeCode === "ECONNRESET" ||
    nodeCode === "EPIPE" ||
    nodeCode === "EHOSTUNREACH" ||
    nodeCode === "ENETUNREACH"
  ) {
    return new PublicFetchError("remote_connection_failed", "공고 페이지에 연결하지 못했습니다. 공고 원문을 붙여넣어 주세요.");
  }
  if (
    nodeCode === "ERR_TLS_CERT_ALTNAME_INVALID" ||
    nodeCode === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    nodeCode === "CERT_HAS_EXPIRED" ||
    nodeCode === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    nodeCode.startsWith("ERR_SSL") ||
    nodeCode.startsWith("ERR_TLS")
  ) {
    return new PublicFetchError("remote_tls_failed", "공고 페이지의 보안 연결에 실패했습니다. 공고 원문을 붙여넣어 주세요.");
  }

  const message = error instanceof Error ? error.message : "";
  if (message.includes("blocked")) {
    return new PublicFetchError("url_blocked", "내부 네트워크 주소는 사용할 수 없습니다.");
  }

  return new PublicFetchError("fetch_failed", "공고 페이지 요청이 실패했습니다. 공고 원문을 직접 붙여넣어 주세요.");
}

function safeHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return "(invalid)";
  }
}

export async function fetchPublicText(
  rawUrl: string,
  options: PublicFetchOptions,
): Promise<string> {
  const traceId = randomUUID().slice(0, 8);
  console.log("[safe-public-fetch]", {
    traceId,
    stage: "request-received",
    hostname: safeHostname(rawUrl),
  });
  return fetchPublicTextHop(rawUrl, options, options.maxRedirects ?? 3, traceId);
}

async function fetchPublicTextHop(
  rawUrl: string,
  options: PublicFetchOptions,
  redirectsLeft: number,
  traceId: string,
): Promise<string> {
  const url = parsePublicUrl(rawUrl);
  console.log("[safe-public-fetch]", { traceId, stage: "url-validated", hostname: url.hostname });

  const makeRequest = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<string>((resolve, reject) => {
    console.log("[safe-public-fetch]", {
      traceId,
      stage: "remote-request-started",
      hostname: url.hostname,
    });

    const baseOpts = {
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
      lookup: makeSafeLookup(traceId),
    };

    // autoSelectFamily (net.TcpSocketConnectOpts, Node.js v20+) is not typed
    // in http.RequestOptions, so we spread then cast back to the base type.
    // Setting it to false disables Happy Eyeballs, which would otherwise call
    // our LookupFunction a second time with { all: true } and expect a
    // LookupAddress[] response instead of the single (address, family) form.
    const req = makeRequest(
      url,
      { ...baseOpts, autoSelectFamily: false } as typeof baseOpts,
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const contentEncoding = (response.headers["content-encoding"] ?? "").toLowerCase();
        const contentType = response.headers["content-type"] ?? "";

        console.log("[safe-public-fetch]", {
          traceId,
          stage: "remote-response-received",
          statusCode,
          contentType,
          contentEncoding,
          locationPresent: Boolean(response.headers.location),
        });

        // ── Redirect ─────────────────────────────────────────────────────────
        const location = response.headers.location;
        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume();
          if (redirectsLeft <= 0) {
            console.warn("[safe-public-fetch]", { traceId, stage: "redirect-limit-exceeded" });
            reject(new PublicFetchError("redirect_limit_exceeded", "공고 페이지의 리디렉션이 너무 많습니다."));
            return;
          }
          const nextUrl = new URL(location, url).toString();
          console.log("[safe-public-fetch]", {
            traceId,
            stage: "redirect-following",
            statusCode,
            redirectsLeft,
            targetHostname: safeHostname(nextUrl),
          });
          void fetchPublicTextHop(nextUrl, options, redirectsLeft - 1, traceId).then(resolve, reject);
          return;
        }

        // ── HTTP error status ─────────────────────────────────────────────────
        if (statusCode === 401) {
          response.resume();
          reject(new PublicFetchError("url_access_denied", "이 페이지는 로그인이 필요해요. 공고 내용을 붙여넣어 주세요."));
          return;
        }
        if (statusCode === 403) {
          response.resume();
          reject(new PublicFetchError("remote_http_forbidden", "이 페이지 접근이 차단됐어요. 공고 내용을 붙여넣어 주세요."));
          return;
        }
        if (statusCode === 429) {
          response.resume();
          reject(new PublicFetchError("remote_http_rate_limited", "요청이 잠깐 차단됐어요. 공고 내용을 붙여넣어 주세요."));
          return;
        }
        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new PublicFetchError(
            "remote_http_error",
            `공고 페이지를 불러오지 못했습니다 (HTTP ${statusCode}). 공고 원문을 직접 붙여넣어 주세요.`,
          ));
          return;
        }

        // ── Size limit (Content-Length pre-check) ─────────────────────────────
        const contentLength = Number(response.headers["content-length"] ?? 0);
        if (contentLength > options.maxBytes) {
          response.resume();
          reject(new PublicFetchError("response_too_large", "페이지가 너무 큽니다. 공고 원문을 직접 붙여넣어 주세요."));
          return;
        }

        // ── Decompression ─────────────────────────────────────────────────────
        let dataStream: Readable;
        if (contentEncoding === "gzip" || contentEncoding === "x-gzip") {
          console.log("[safe-public-fetch]", { traceId, stage: "decompressing", method: "gzip" });
          dataStream = response.pipe(createGunzip());
        } else if (contentEncoding === "deflate") {
          console.log("[safe-public-fetch]", { traceId, stage: "decompressing", method: "deflate" });
          dataStream = response.pipe(createInflate());
        } else if (contentEncoding === "br") {
          console.log("[safe-public-fetch]", { traceId, stage: "decompressing", method: "br" });
          dataStream = response.pipe(createBrotliDecompress());
        } else if (contentEncoding && contentEncoding !== "identity") {
          // Unsupported encoding — reject rather than treating binary as text
          response.resume();
          console.warn("[safe-public-fetch]", { traceId, stage: "unsupported-encoding", contentEncoding });
          reject(new PublicFetchError(
            "decompression_failed",
            `지원하지 않는 압축 방식 (${contentEncoding})입니다. 공고 원문을 붙여넣어 주세요.`,
          ));
          return;
        } else {
          dataStream = response;
        }

        // ── Accumulate decompressed data ──────────────────────────────────────
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        dataStream.on("data", (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > options.maxBytes) {
            response.destroy();
            reject(new PublicFetchError("response_too_large", "페이지가 너무 큽니다. 공고 원문을 직접 붙여넣어 주세요."));
            return;
          }
          chunks.push(chunk);
        });

        dataStream.on("end", () => {
          console.log("[safe-public-fetch]", {
            traceId,
            stage: "response-read-completed",
            decompressedBytes: totalBytes,
          });
          const rawHtml = Buffer.concat(chunks).toString("utf8");
          const text = extractJobText(rawHtml).slice(0, options.maxChars);
          console.log("[safe-public-fetch]", {
            traceId,
            stage: "fetch-completed",
            extractedTextLength: text.length,
          });
          if (text.length < 100) {
            reject(new PublicFetchError("url_content_not_found", "공고 내용을 충분히 읽지 못했습니다. 공고 원문을 직접 붙여넣어 주세요."));
            return;
          }
          resolve(text);
        });

        dataStream.on("error", (error) => {
          response.destroy();
          console.error("[safe-public-fetch]", {
            traceId,
            stage: "decompression-error",
            errorName: error.name,
            errorMessage: error.message,
            errorCode: isNodeError(error) ? error.code : null,
          });
          reject(
            error instanceof PublicFetchError
              ? error
              : new PublicFetchError("decompression_failed", "응답 데이터 처리에 실패했습니다. 공고 원문을 붙여넣어 주세요."),
          );
        });
      },
    );

    req.setTimeout(options.timeoutMs, () => {
      req.destroy(
        new PublicFetchError("url_timeout", "공고 페이지 요청 시간이 초과됐습니다. 공고 원문을 직접 붙여넣어 주세요."),
      );
    });

    req.on("error", (error) => {
      console.error("[safe-public-fetch]", {
        traceId,
        stage: "fetch-failed",
        errorName: error.name,
        errorMessage: error.message,
        errorCode: isNodeError(error) ? error.code : null,
      });
      reject(nodeErrToPublicFetchError(error));
    });

    req.end();
  });
}

function makeSafeLookup(traceId: string): LookupFunction {
  return (hostname, options, callback) => {
    // Node.js v20+ Happy Eyeballs may call the lookup a second time with
    // options.all === true expecting a LookupAddress[] callback. Log it so we
    // can diagnose, then handle both forms.
    const wantsAll = (options as Record<string, unknown>).all === true;
    console.log("[safe-public-fetch]", {
      traceId,
      stage: "dns-lookup-started",
      hostname,
      lookupAll: wantsAll,
    });
    void lookup(hostname, { all: true, verbatim: true })
      .then((addresses) => {
        console.log("[safe-public-fetch]", {
          traceId,
          stage: "dns-lookup-completed",
          hostname,
          addressCount: addresses.length,
          addressFamilies: addresses.map(({ family }) => family),
          lookupAll: wantsAll,
        });
        if (addresses.length === 0) {
          callback(new Error(`DNS returned no addresses for ${hostname}`), "", 4);
          return;
        }
        if (addresses.some(({ address }) => isPrivateAddress(address))) {
          console.warn("[safe-public-fetch]", { traceId, stage: "ssrf-blocked", hostname });
          callback(
            new PublicFetchError("blocked_private_address", "접근이 허용되지 않는 주소로 연결됩니다."),
            "",
            4,
          );
          return;
        }
        console.log("[safe-public-fetch]", { traceId, stage: "ssrf-validation-completed", hostname });

        if (wantsAll) {
          // Happy Eyeballs second call: return all safe addresses as an array.
          // Cast required because LookupFunction types only declare the
          // single-address callback form.
          (callback as unknown as (err: null, addrs: typeof addresses) => void)(
            null,
            addresses,
          );
        } else {
          const selected = addresses.find((a) => a.family === 4) ?? addresses[0];
          callback(null, selected.address, selected.family);
        }
      })
      .catch((err: Error) => {
        console.error("[safe-public-fetch]", {
          traceId,
          stage: "dns-lookup-failed",
          hostname,
          errorName: err.name,
          errorMessage: err.message,
          errorCode: isNodeError(err) ? err.code : null,
        });
        callback(err, "", 4);
      });
  };
}

function parsePublicUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PublicFetchError(
      "url_invalid",
      "유효한 http(s) 공고 URL을 입력해주세요.",
    );
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new PublicFetchError(
      "url_invalid",
      "http(s) 공고 URL만 사용할 수 있습니다.",
    );
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    (isIP(hostname) > 0 && isPrivateAddress(hostname))
  ) {
    throw new PublicFetchError(
      "url_blocked",
      "내부 네트워크 주소는 사용할 수 없습니다.",
    );
  }
  return url;
}

export function isPrivateAddress(rawAddress: string): boolean {
  const address = rawAddress.replace(/^\[|\]$/g, "").toLowerCase();
  if (address.startsWith("::ffff:")) {
    return isPrivateAddress(address.slice(7));
  }
  const version = isIP(address);
  if (version === 4) {
    const octets = address.split(".").map(Number);
    const [a, b] = octets;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    return (
      address === "::" ||
      address === "::1" ||
      address.startsWith("fc") ||
      address.startsWith("fd") ||
      /^fe[89ab]/.test(address) ||
      address.startsWith("ff") ||
      address.startsWith("2001:db8:")
    );
  }
  return true;
}

function extractJobText(html: string): string {
  // 1. Try JobPosting JSON-LD
  const jsonLdText = extractJsonLdJobPosting(html);
  if (jsonLdText && jsonLdText.length >= 200) return jsonLdText;

  // 2. Try page metadata + Next.js __NEXT_DATA__
  const metaText = extractMetaAndNextData(html);

  // 3. Try main content areas
  const mainText = extractMainContent(html);

  // 4. Fall back to general text strip
  const generalText = stripHtml(html);

  // Combine non-empty sources
  const combined = [jsonLdText, metaText, mainText]
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return combined.length >= 100 ? combined : generalText;
}

function extractJsonLdJobPosting(html: string): string {
  const scriptMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const match of scriptMatches) {
    try {
      const data = JSON.parse(match[1]) as unknown;
      const posting = findJobPosting(data);
      if (posting) return jobPostingToText(posting);
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return "";
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  const obj = value as Record<string, unknown>;
  if (obj["@type"] === "JobPosting") return obj;
  if (typeof obj["@graph"] !== "undefined") return findJobPosting(obj["@graph"]);
  return null;
}

function jobPostingToText(posting: Record<string, unknown>): string {
  const parts: string[] = [];
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (str(posting.title)) parts.push(`직무: ${str(posting.title)}`);
  if (str(posting.hiringOrganization)) {
    const org = posting.hiringOrganization as Record<string, unknown>;
    const name = typeof org === "object" ? str(org.name) : str(posting.hiringOrganization);
    if (name) parts.push(`회사: ${name}`);
  }
  if (str(posting.description)) parts.push(stripHtml(str(posting.description)));
  if (str(posting.responsibilities)) parts.push(stripHtml(str(posting.responsibilities)));
  if (str(posting.qualifications)) parts.push(stripHtml(str(posting.qualifications)));
  return parts.join("\n\n");
}

function extractMetaAndNextData(html: string): string {
  const parts: string[] = [];

  // og:title, og:description
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (ogTitle) parts.push(ogTitle);
  if (ogDesc) parts.push(ogDesc);

  // Next.js __NEXT_DATA__
  const nextDataMatch = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]) as unknown;
      const text = flattenTextValues(data, 0);
      if (text) parts.push(text);
    } catch {
      // ignore
    }
  }

  return parts.join("\n\n");
}

function flattenTextValues(value: unknown, depth: number): string {
  if (depth > 5) return "";
  if (typeof value === "string" && value.length > 20) return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => flattenTextValues(item, depth + 1))
      .filter(Boolean)
      .slice(0, 20)
      .join("\n");
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((v) => flattenTextValues(v, depth + 1))
      .filter(Boolean)
      .slice(0, 20)
      .join("\n");
  }
  return "";
}

function extractMainContent(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // Attribute-level patterns for Korean and international job sites.
  // We find the attribute, walk back to the opening tag, then take up to
  // 30000 chars so nested </div> boundaries don't truncate the content.
  const attrPatterns = [
    /class=["'][^"']*\bjd[-_]cont\b[^"']*["']/i,      // Saramin
    /class=["'][^"']*\bjob[-_]cont\b[^"']*["']/i,      // Incruit, others
    /class=["'][^"']*\bjd[-_]content\b[^"']*["']/i,
    /id=["']jd[-_]?content["']/i,
    /class=["'][^"']*\bjob-view\b[^"']*["']/i,         // JobKorea
    /class=["'][^"']*\bjob-description\b[^"']*["']/i,  // LinkedIn, Greenhouse
    /class=["'][^"']*\bposting-content\b[^"']*["']/i,
    /class=["'][^"']*\bdescription[-_]text\b[^"']*["']/i,
    /class=["'][^"']*\brecruit[-_]?content\b[^"']*["']/i,
    /class=["'][^"']*\bjob[-_]detail\b[^"']*["']/i,
  ];

  for (const pattern of attrPatterns) {
    const match = pattern.exec(cleaned);
    if (!match) continue;
    const tagStart = cleaned.lastIndexOf("<", match.index);
    if (tagStart === -1) continue;
    const text = stripHtml(cleaned.slice(tagStart, tagStart + 30000)).slice(0, 8000);
    if (text.length >= 200) return text;
  }

  // Fallback: semantic container tags
  for (const pattern of [/<article[^>]*>/i, /<main[^>]*>/i]) {
    const match = pattern.exec(cleaned);
    if (!match) continue;
    const text = stripHtml(cleaned.slice(match.index, match.index + 30000)).slice(0, 8000);
    if (text.length >= 200) return text;
  }

  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
