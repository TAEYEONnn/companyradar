interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

export const AI_FORBIDDEN_MESSAGE =
  "현재 계정은 AI 기능 사용 권한이 없습니다. 관리자에게 접근 권한을 요청해주세요.";

export function getApiErrorMessage(response: Response, payload: unknown, fallback: string) {
  const errorPayload = payload as ApiErrorPayload;
  if (response.status === 403 || errorPayload.error?.code === "forbidden") {
    return AI_FORBIDDEN_MESSAGE;
  }
  return errorPayload.error?.message ?? fallback;
}
