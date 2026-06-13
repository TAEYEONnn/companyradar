export const AI_CREDIT_PRODUCT = {
  code: "ai_credits_10",
  name: "AI 10회 이용권",
  amountKrw: 4900,
  credits: 10,
} as const;

export interface AiEntitlement {
  unlimited: boolean;
  freeUsesRemaining: number;
  paidCreditsRemaining: number;
  totalRemaining: number;
}

export function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}
