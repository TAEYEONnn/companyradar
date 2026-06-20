export const USER_COPY = {
  ai: {
    unavailable:
      "분석 연결이 잠깐 불안정해요. 입력한 내용은 그대로 두었어요.",
    failed: "분석을 마치지 못했어요. 잠시 후 다시 해주세요.",
    timeout: "분석이 조금 오래 걸리고 있어요. 잠시 후 다시 해주세요.",
    quotaExceeded: "오늘 무료 분석을 모두 사용했어요.",
  },
  resume: {
    unsupported: "PDF, DOCX, TXT 파일만 올릴 수 있어요.",
    tooLarge: "파일은 4MB까지 올릴 수 있어요. 더 큰 파일은 내용을 직접 붙여넣어 주세요.",
    payloadTooLarge: "파일이 너무 커요. 4MB 이하 파일이나 텍스트 붙여넣기를 사용해주세요.",
    encrypted: "잠긴 파일은 읽을 수 없어요. 잠금을 해제한 뒤 다시 올려주세요.",
    textNotFound:
      "파일에서 읽을 수 있는 글자를 찾지 못했어요. 스캔본이라면 TXT나 DOCX로 올려주세요.",
    parseFailed: "이력서를 읽지 못했어요. 다른 파일로 다시 시도해주세요.",
    quotaExceeded: "오늘 이력서 정리 3회를 모두 사용했어요.",
  },
  job: {
    urlCheckAddress: "주소를 다시 확인해주세요.",
    urlPasteText: "공고 내용을 직접 붙여넣어 주세요.",
    urlRetry: "다시 시도해주세요.",
    fetchBlocked: "이 페이지는 직접 가져올 수 없어요. 공고 내용을 붙여넣어 주세요.",
    fetchTimeout: "페이지를 가져오는 데 시간이 너무 걸렸어요. 공고 내용을 붙여넣어 주세요.",
    fetchAccessDenied: "이 페이지는 로그인이 필요하거나 접근이 제한돼 있어요. 공고 내용을 붙여넣어 주세요.",
    fetchContentNotFound: "공고 내용을 충분히 읽지 못했어요. 공고 원문을 직접 붙여넣어 주세요.",
    fetchFailed: "공고 페이지를 불러오지 못했어요. 공고 내용을 붙여넣어 주세요.",
  },
  auth: {
    required: "로그인하면 이어서 저장할 수 있어요.",
    invalidCredentials: "이메일이나 비밀번호를 다시 확인해주세요.",
    rateLimited: "요청이 잠깐 몰렸어요. 조금 뒤에 다시 해주세요.",
  },
  save: {
    failed: "저장하지 못했어요. 입력한 내용은 그대로 두었어요.",
    loadedFailed: "목록을 불러오지 못했어요. 잠시 후 다시 해주세요.",
  },
} as const;
