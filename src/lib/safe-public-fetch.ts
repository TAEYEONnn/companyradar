import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";

export type PublicFetchErrorCode =
  | "url_invalid"
  | "url_blocked"
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
          "User-Agent":
            "Mozilla/5.0 (compatible; CompanyRadarBot/1.0; job fit analysis)",
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

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        response.on("data", (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > options.maxBytes) {
            response.destroy(
              new PublicFetchError(
                "fetch_failed",
                "페이지가 너무 큽니다. 공고 원문을 직접 붙여넣어 주세요.",
              ),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          const text = stripHtml(Buffer.concat(chunks).toString("utf8")).slice(
            0,
            options.maxChars,
          );
          if (text.length < 100) {
            reject(
              new PublicFetchError(
                "fetch_failed",
                "공고 내용을 충분히 읽지 못했습니다. 공고 원문을 직접 붙여넣어 주세요.",
              ),
            );
            return;
          }
          resolve(text);
        });
        response.on("error", (error) => {
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
          "fetch_failed",
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
      const selected = addresses[0];
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
