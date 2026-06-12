import { SCORE_CATEGORIES } from "@/lib/criteria";
import { makeDefaultScoreEvidence } from "@/lib/storage";
import type { Company } from "@/lib/types";
import { createId } from "@/lib/utils";

export function createEmptyCompany(): Company {
  const now = new Date().toISOString();

  return {
    id: createId("company"),
    name: "",
    homepageUrl: "",
    jobPostUrl: "",
    sourceUrls: [],
    industry: "",
    size: "unknown",
    growthInfo: "",
    productDescription: "",
    interestLevel: 3,
    status: "interested",
    applicationPriority: "watch",
    priorityReason: "포지션 적합도와 채용 상태를 확인한 뒤 우선순위를 조정하세요.",
    evidenceLevel: 1,
    sourceConfidence: 1,
    discoveryReason: "manual",
    firstImpressionNote: "",
    candidateReason: "",
    jobDeadline: "",
    jobStatus: "unknown",
    lastCheckedAt: "",
    lastVerifiedAt: "",
    lastResearchedAt: "",
    isSampleData: false,
    needsRefresh: false,
    memo: "",
    privateSensitiveNote: "",
    scores: SCORE_CATEGORIES.reduce((scores, category) => {
      scores[category.key] = category.items.reduce(
        (items, item) => {
          items[item.id] = 3;
          return items;
        },
        {} as Record<string, number>,
      );
      return scores;
    }, {} as Company["scores"]),
    scoreEvidence: makeDefaultScoreEvidence(1),
    signals: {
      greenFlags: [],
      redFlags: [],
      unknowns: [],
    },
    designerFit: {
      hasDesignSystemOpportunity: false,
      hasDesignOpsOpportunity: false,
      hasComponentOwnership: false,
      hasDocumentationCulture: false,
      canImproveProcess: false,
      isOnlyVisualProductionRole: false,
    },
    applicationChecklist: {
      resumeReady: false,
      portfolioReady: false,
      coverLetterReady: false,
      referralChecked: false,
      submitted: false,
    },
    interviewRounds: [],
    followUpTasks: [],
    researchLogs: [],
    riskFlags: [],
    interviewNotes: [],
    createdAt: now,
    updatedAt: now,
  };
}
