const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024;
const MIN_RESUME_TEXT_CHARS = 20;
const MAX_RESUME_TEXT_CHARS = 20_000;

export type ResumeFileType = "pdf" | "docx" | "txt";
export type ResumeParseErrorCode =
  | "unsupported_file"
  | "file_too_large"
  | "encrypted_file"
  | "text_not_found"
  | "parse_failed";

export class ResumeParseError extends Error {
  constructor(
    public readonly code: ResumeParseErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "ResumeParseError";
  }
}

export function validateResumeFile(file: {
  name: string;
  size: number;
}): ResumeFileType {
  if (file.size > MAX_RESUME_FILE_BYTES) {
    throw new ResumeParseError("file_too_large");
  }
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "pdf" || extension === "docx" || extension === "txt") {
    return extension;
  }
  throw new ResumeParseError("unsupported_file");
}

export async function extractResumeText(file: File): Promise<string> {
  const type = validateResumeFile(file);
  const buffer = await file.arrayBuffer();
  let text = "";

  try {
    if (type === "txt") {
      text = new TextDecoder("utf-8").decode(buffer).replace(/^\ufeff/, "");
    } else if (type === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(buffer),
      });
      text = result.value;
    } else {
      text = await extractPdfText(new Uint8Array(buffer));
    }
  } catch (error) {
    if (error instanceof ResumeParseError) throw error;
    if (isEncryptedPdfError(error)) {
      throw new ResumeParseError("encrypted_file");
    }
    throw new ResumeParseError(
      "parse_failed",
      error instanceof Error ? error.message : "parse_failed",
    );
  }

  const normalized = normalizeResumeText(text).slice(0, MAX_RESUME_TEXT_CHARS);
  if (normalized.length < MIN_RESUME_TEXT_CHARS) {
    throw new ResumeParseError("text_not_found");
  }
  return normalized;
}

async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    useSystemFonts: true,
    disableFontFace: true,
  });
  const document = await task.promise;
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .filter(Boolean)
          .join(" "),
      );
    }
  } finally {
    await task.destroy();
  }
  return pages.join("\n");
}

function normalizeResumeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isEncryptedPdfError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return name.includes("Password") || /password|encrypted/i.test(message);
}
