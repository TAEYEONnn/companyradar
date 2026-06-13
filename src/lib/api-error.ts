interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
  entitlement?: unknown;
  product?: unknown;
}

export const AI_FORBIDDEN_MESSAGE = "현재 계정은 AI 기능 사용 권한이 없습니다.";

export const AI_PAYMENT_REQUIRED_MESSAGE =
  "AI 기능은 유료 베타입니다. 계정당 1회 무료로 체험할 수 있고, 이후 10회권을 구매해 계속 사용할 수 있어요.";

export function getApiErrorMessage(response: Response, payload: unknown, fallback: string) {
  const errorPayload = payload as ApiErrorPayload;
  if (response.status === 402 || errorPayload.error?.code === "payment_required") {
    dispatchPaymentRequired(errorPayload);
    return AI_PAYMENT_REQUIRED_MESSAGE;
  }
  if (response.status === 403 || errorPayload.error?.code === "forbidden") {
    return AI_FORBIDDEN_MESSAGE;
  }
  return errorPayload.error?.message ?? fallback;
}

export function dispatchPaymentRequired(payload?: ApiErrorPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("ai-payment-required", {
      detail: {
        entitlement: payload?.entitlement,
        product: payload?.product,
      },
    }),
  );
}
