import type { Company } from "@/lib/types";
import { parseLocalDate, today as formatToday } from "@/lib/utils";

export const VALIDATION_STALE_DAYS = 30;

export const VALIDATION_REASON_LABELS = {
  staleJobCheck: "공고 확인 30일 초과",
  aiExtracted: "AI 추출 데이터",
  missingDeadline: "마감일 미확인",
  lowEvidence: "근거 레벨 2 이하",
} as const;

function daysSince(dateStr: string, now: string): number {
  if (!dateStr) return Number.POSITIVE_INFINITY;
  const date = parseLocalDate(dateStr.slice(0, 10));
  const current = parseLocalDate(now);
  return Math.floor((current.getTime() - date.getTime()) / 86_400_000);
}

export function getCompanyValidationReasons(
  company: Company,
  now = formatToday(),
  options: { includeDataQualityReasons?: boolean } = {},
): string[] {
  const reasons = new Set<string>(company.validationReason ?? []);
  const includeDataQualityReasons = options.includeDataQualityReasons ?? false;

  if (company.needsRefresh || daysSince(company.lastCheckedAt, now) > VALIDATION_STALE_DAYS) {
    reasons.add(VALIDATION_REASON_LABELS.staleJobCheck);
  }

  if (includeDataQualityReasons) {
    if (company.sourceConfidence <= 2 || company.discoveryReason !== "manual") {
      reasons.add(VALIDATION_REASON_LABELS.aiExtracted);
    }

    if (company.jobStatus === "unknown" || !company.jobDeadline) {
      reasons.add(VALIDATION_REASON_LABELS.missingDeadline);
    }

    if (company.evidenceLevel <= 2) {
      reasons.add(VALIDATION_REASON_LABELS.lowEvidence);
    }
  }

  return Array.from(reasons);
}

export function needsCompanyValidation(company: Company, now = formatToday()): boolean {
  return (
    company.needsRefresh ||
    (company.validationReason?.length ?? 0) > 0 ||
    getCompanyValidationReasons(company, now).length > 0
  );
}

export function getValidationCompletePatch(now = formatToday()): Pick<
  Company,
  "lastCheckedAt" | "lastVerifiedAt" | "needsRefresh" | "validationReason"
> {
  return {
    lastCheckedAt: now,
    lastVerifiedAt: now,
    needsRefresh: false,
    validationReason: [],
  };
}
