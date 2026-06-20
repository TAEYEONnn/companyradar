import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import type { Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

export type PublicFetchErrorCode =
  | "url_invalid"
  | "url_blocked"
  | "url_timeout"
  | "url_access_denied"
  | "url_content_not_found"
  | "fetch_failed";

export class PublicFetchError extends Error {
  constructor(
    public readonly code: PublicFetchErrorCode,
    message: string,
  ) {
    super(message);
  }
}

interface PublicFetchOptions {
  maxBytes: number;
  maxChars: number;
  timeoutMs: number;
  maxRedirects?: number;
}

export async function fetchPublicText(
  rawUrl: string,
  options: PublicFetchOptions,
): Promise<string> {
  return fetchPublicTextHop(rawUrl, options, options.maxRedirects ?? 3);
}

async function fetchPublicTextHop(
  rawUrl: string,
  options: PublicFetchOptions,
  redirectsLeft: number,
): Promise<string> {
  const url = parsePublicUrl(rawUrl);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<string>((resolve, reject) => {
    const req = request(
      url,
      {
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
          "Accept-Encoding": "gzip, deflate, br",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        },
        lookup: safeLookup,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location) {
          response.resume();
          if (redirectsLeft <= 0) {
            reject(
              new PublicFetchError(
                "fetch_failed",
                "공고 페이지의 리디렉션이 너무 많습니다.",
              ),
            );
            return;
          }
          const nextUrl = new URL(location, url).toString();
          void fetchPublicTextHop(nextUrl, options, redirectsLeft - 1).then(
            resolve,
            reject,
          );
          return;
        }
        if (status === 401 || status === 403) {
          response.resume();
          reject(
            new PublicFetchError(
              "url_access_denied",
              "이 페이지는 로그인이 필요하거나 접근이 제한돼 있어요. 공고 내용을 붙여넣어 주세요.",
            ),
          );
          return;
        }
        if (status === 429) {
          response.resume();
          reject(
            new PublicFetchError(
              "url_access_denied",
              "요청이 잠깐 차단됐어요. 공고 내용을 붙여넣어 주세요.",
            ),
          );
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(
            new PublicFetchError(
              "fetch_failed",
              "공고 페이지를 불러오지 못했습니다. 공고 원문을 직접 붙여넣어 주세요.",
            ),
          );
          return;
        }

        const contentLength = Number(response.headers["content-length"] ?? 0);
        if (contentLength > options.maxBytes) {
          response.resume();
          reject(
            new PublicFetchError(
              "fetch_failed",
              "페이지가 너무 큽니다. 공고 원문을 직접 붙여넣어 주세요.",
            ),
          );
          return;
        }

        const encoding = (response.headers["content-encoding"] ?? "").toLowerCase();
        let dataStream: Readable;
        if (encoding === "gzip" || encoding === "x-gzip") {
          dataStream = response.pipe(createGunzip());
        } else if (encoding === "deflate") {
          dataStream = response.pipe(createInflate());
        } else if (encoding === "br") {
          dataStream = response.pipe(createBrotliDecompress());
        } else {
          dataStream = response;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        dataStream.on("data", (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > options.maxBytes) {
            response.destroy();
            reject(
              new PublicFetchError(
                "fetch_failed",
                "페이지가 너무 큽니다. 공고 원문을 직접 붙여넣어 주세요.",
              ),
            );
            return;
          }
          chunks.push(chunk);
        });
        dataStream.on("end", () => {
          const rawHtml = Buffer.concat(chunks).toString("utf8");
          const text = extractJobText(rawHtml).slice(0, options.maxChars);
          if (text.length < 100) {
            reject(
              new PublicFetchError(
                "url_content_not_found",
                "공고 내용을 충분히 읽지 못했습니다. 공고 원문을 직접 붙여넣어 주세요.",
              ),
            );
            return;
          }
          resolve(text);
        });
        dataStream.on("error", (error) => {
          response.destroy();
          reject(
            error instanceof PublicFetchError
              ? error
              : new PublicFetchError(
                  "fetch_failed",
                  "공고 페이지 요청이 실패했습니다. 공고 원문을 직접 붙여넣어 주세요.",
                ),
          );
        });
      },
    );
    req.setTimeout(options.timeoutMs, () => {
      req.destroy(
        new PublicFetchError(
          "url_timeout",
          "공고 페이지 요청 시간이 초과됐습니다. 공고 원문을 직접 붙여넣어 주세요.",
        ),
      );
    });
    req.on("error", (error) => {
      reject(
        error instanceof PublicFetchError
          ? error
          : new PublicFetchError(
              error.message.includes("blocked")
                ? "url_blocked"
                : "fetch_failed",
              error.message.includes("blocked")
                ? "내부 네트워크 주소는 사용할 수 없습니다."
                : "공고 페이지 요청이 실패했습니다. 공고 원문을 직접 붙여넣어 주세요.",
            ),
      );
    });
    req.end();
  });
}

const safeLookup: LookupFunction = (hostname, _options, callback) => {
  void lookup(hostname, { all: true, verbatim: true })
    .then((addresses) => {
      if (
        addresses.length === 0 ||
        addresses.some(({ address }) => isPrivateAddress(address))
      ) {
        callback(new Error("blocked private address"), "", 4);
        return;
      }
      const selected = addresses.find((a) => a.family === 4) ?? addresses[0];
      callback(null, selected.address, selected.family);
    })
    .catch((error: Error) => callback(error, "", 4));
};

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
