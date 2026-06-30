import { NextResponse } from "next/server";
import { cancelResumeQuota, reserveResumeQuota, type QuotaReason } from "@/lib/fit-quota";
import type { CandidateProfile } from "@/lib/fit-analysis";
import {
  extractResumeText,
  ResumeParseError,
  type ResumeParseErrorCode,
  validateResumeFile,
} from "@/lib/resume-parser";
import { isAllowedAiOperator, requireSupabaseUser } from "@/lib/server-auth";
import { USER_COPY } from "@/lib/user-copy";
import { AiProviderError, createJsonCompletion, getAiProviderConfig } from "@/lib/ai-provider";

export const runtime = "nodejs";

// file_missing / file_empty are client errors not in ResumeParseErrorCode.
// pdf_invalid / pdf_worker_failed are server-side 422s distinct from parse_failed.
type ErrorCode =
  | "file_missing"
  | "file_empty"
  | ResumeParseErrorCode
  | "quota_exceeded"
  | "quota_unavailable"
  | "ai_failed";

interface ModelProfile {
  targetRole?: unknown;
  yearsExperience?: unknown;
  skills?: unknown;
  domains?: unknown;
  achievements?: unknown;
}

export async function POST(request: Request) {
  // ── 1. Parse multipart body ──────────────────────────────────────────────
  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    console.error("[parse-resume]", {
      stage: "form-parse-failed",
      reason: err instanceof Error ? err.message : String(err),
    });
    return apiError(400, "unsupported_file", USER_COPY.resume.unsupported);
  }

  // ── 2. Extract file field ────────────────────────────────────────────────
  const file = form.get("file");
  console.log("[parse-resume]", {
    stage: "file-received",
    isFile: file instanceof File,
    size: file instanceof File ? file.size : null,
  });

  if (!(file instanceof File)) {
    return apiError(400, "file_missing", USER_COPY.resume.unsupported);
  }
  if (file.size === 0) {
    return apiError(400, "file_empty", USER_COPY.resume.unsupported);
  }

  // ── 3. Validate extension + size ────────────────────────────────────────
  try {
    validateResumeFile(file);
  } catch (error) {
    return resumeError(error);
  }

  // ── 4. PDF magic-bytes check ─────────────────────────────────────────────
  // Accept even when MIME is application/octet-stream if extension + bytes say PDF.
  if (file.name.toLowerCase().endsWith(".pdf")) {
    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const isPdf =
      header[0] === 0x25 && // %
      header[1] === 0x50 && // P
      header[2] === 0x44 && // D
      header[3] === 0x46 && // F
      header[4] === 0x2d;   // -
    if (!isPdf) {
      console.warn("[parse-resume]", {
        stage: "magic-bytes-fail",
        size: file.size,
      });
      return apiError(400, "unsupported_file", USER_COPY.resume.unsupported);
    }
  }

  // ── 5. Auth + clientId ───────────────────────────────────────────────────
  // Operators (AI_ALLOWED_EMAILS / AI_ALLOWED_USER_IDS / role=owner) bypass
  // the per-client daily quota so they can test the full service without limit.
  // This mirrors the bypass in analyze-fit and every other AI route.
  const clientId = await resolveQuotaClientId(request);
  const isOperator = await checkIsOperator(request);

  // ── 6. Text extraction ───────────────────────────────────────────────────
  let resumeText: string;
  try {
    resumeText = await extractResumeText(file);
    console.log("[parse-resume]", {
      stage: "text-extracted",
      textLength: resumeText.length,
    });
  } catch (error) {
    const code =
      error instanceof ResumeParseError ? error.code : "parse_failed";
    console.error("[parse-resume]", {
      stage: "text-extraction-failed",
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return resumeError(error);
  }

  // ── 7. AI extraction ─────────────────────────────────────────────────────
  // Quota is reserved here (after text extraction) so corrupt/unsupported files
  // never consume the user's daily allowance.
  try {
    getAiProviderConfig();
  } catch {
    return apiError(503, "ai_failed", USER_COPY.ai.unavailable);
  }

  if (!isOperator) {
    const quota = await reserveResumeQuota(request, clientId);
    logQuota("parse-resume", quota.backend ?? "unknown", quota.reason);
    if (!quota.allowed) return quotaError(quota.reason);
  } else {
    console.log("[parse-resume]", { stage: "quota-bypassed", clientId });
  }

  let content: string;
  try {
    console.log("[parse-resume]", { stage: "ai-call-start" });
    content = await createJsonCompletion({
      systemPrompt:
        "Extract only career information from the supplied resume. Ignore names, contact details, addresses, photos, and other personal identifiers. Return one valid JSON object without markdown.",
      userPrompt: `이력서에서 커리어 정보만 정리해주세요.

규칙:
- 이름, 이메일, 전화번호, 주소, 생년월일 등 인적정보는 결과에 포함하지 않습니다.
- 확인되지 않은 내용은 만들지 않습니다.
- skills, domains, achievements는 각각 최대 20개입니다.
- achievements는 사용자가 검토하기 쉬운 짧은 문장으로 씁니다.

형식:
{
  "targetRole": "가장 가까운 목표 직무",
  "yearsExperience": 0,
  "skills": ["역량"],
  "domains": ["도메인"],
  "achievements": ["성과"]
}

--- 이력서 ---
${resumeText}`,
      temperature: 0.1,
      timeoutMs: 45_000,
    });
  } catch (err) {
    const httpStatus = err instanceof AiProviderError ? err.status : undefined;
    console.error("[parse-resume]", {
      stage: "ai-call-failed",
      status: httpStatus,
    });
    if (!isOperator) void cancelResumeQuota(request, clientId);
    const message = httpStatus ? USER_COPY.ai.failed : USER_COPY.ai.timeout;
    return apiError(502, "ai_failed", message);
  }

  let parsed: ModelProfile;
  try {
    parsed = JSON.parse(content.replace(/```json|```/g, "").trim()) as ModelProfile;
  } catch {
    console.error("[parse-resume]", { stage: "ai-json-parse-failed" });
    if (!isOperator) void cancelResumeQuota(request, clientId);
    return apiError(502, "ai_failed", USER_COPY.ai.failed);
  }

  console.log("[parse-resume]", { stage: "ai-call-success" });
  const profile = normalizeProfile(parsed, resumeText);
  return NextResponse.json({
    ok: true,
    profile,
    warnings: profileWarnings(profile),
  });
}

async function checkIsOperator(request: Request): Promise<boolean> {
  const bearer = /^Bearer\s+\S+/i.test(request.headers.get("authorization") ?? "");
  if (!bearer) return false;
  const auth = await requireSupabaseUser(request);
  return auth.user ? isAllowedAiOperator(auth.user) : false;
}

async function resolveQuotaClientId(request: Request): Promise<string> {
  const bearer = /^Bearer\s+\S+/i.test(
    request.headers.get("authorization") ?? "",
  );
  if (bearer) {
    const auth = await requireSupabaseUser(request);
    if (auth.user) return `user:${auth.user.id}`;
  }
  return (
    request.headers.get("x-companyradar-client")?.slice(0, 100) ||
    "anonymous"
  );
}

function normalizeProfile(
  value: ModelProfile,
  resumeText: string,
): CandidateProfile {
  return {
    targetRole: stringValue(value.targetRole).slice(0, 200),
    yearsExperience:
      typeof value.yearsExperience === "number" &&
      Number.isFinite(value.yearsExperience)
        ? Math.max(0, value.yearsExperience)
        : null,
    skills: evidenceArray(value.skills, resumeText),
    domains: evidenceArray(value.domains, resumeText),
    achievements: evidenceArray(value.achievements, resumeText),
    updatedAt: new Date().toISOString(),
  };
}

function profileWarnings(profile: CandidateProfile): string[] {
  const warnings: string[] = [];
  if (!profile.targetRole) warnings.push("목표 직무를 확인해주세요.");
  if (profile.yearsExperience === null) warnings.push("경력 연차를 확인해주세요.");
  if (profile.achievements.length === 0) {
    warnings.push("성과가 빠져 있다면 직접 추가해주세요.");
  }
  return warnings;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, 20);
}

function evidenceArray(value: unknown, source: string): string[] {
  const normalizedSource = normalizeEvidence(source);
  return stringArray(value).filter((item) => {
    const normalized = normalizeEvidence(item);
    if (normalizedSource.includes(normalized)) return true;
    // Word-level fallback: split item on whitespace and require every significant
    // word to appear in the source. This handles Korean josa/particle variations
    // where the AI's phrasing differs slightly from the resume text.
    const words = item
      .split(/\s+/)
      .map((w) => normalizeEvidence(w))
      .filter((w) => w.length >= 2);
    return words.length >= 2 && words.every((w) => normalizedSource.includes(w));
  });
}

function normalizeEvidence(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function resumeError(error: unknown) {
  const code: ResumeParseErrorCode =
    error instanceof ResumeParseError ? error.code : "parse_failed";
  const messages: Record<ResumeParseErrorCode, string> = {
    unsupported_file: USER_COPY.resume.unsupported,
    file_too_large: USER_COPY.resume.tooLarge,
    encrypted_file: USER_COPY.resume.encrypted,
    text_not_found: USER_COPY.resume.textNotFound,
    parse_failed: USER_COPY.resume.parseFailed,
    pdf_invalid: USER_COPY.resume.pdfInvalid,
    pdf_worker_failed: USER_COPY.resume.pdfWorkerFailed,
    pdf_runtime_unsupported: USER_COPY.resume.pdfRuntimeUnsupported,
  };
  // 400 = bad user input (wrong type, too large)
  // 422 = valid file the server cannot process (scanned PDF, corrupt, encrypted)
  const status =
    code === "unsupported_file" || code === "file_too_large" ? 400 : 422;
  return apiError(status, code, messages[code]);
}

function quotaError(reason: QuotaReason | null) {
  if (reason === "quota_unavailable") {
    return apiError(503, "quota_unavailable", USER_COPY.ai.unavailable);
  }
  return apiError(429, "quota_exceeded", USER_COPY.resume.quotaExceeded);
}

function logQuota(feature: string, backend: string, reason: QuotaReason | null) {
  console.info("[ai-quota]", {
    feature,
    backend,
    status: reason ? "rejected" : "reserved",
    errorCode: reason,
  });
}

function apiError(status: number, errorCode: ErrorCode, error: string) {
  return NextResponse.json({ ok: false, errorCode, error }, { status });
}
