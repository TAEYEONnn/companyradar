import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const MAX_RESUME_FILE_BYTES = 4 * 1024 * 1024;
const MIN_RESUME_TEXT_CHARS = 20;
const MAX_RESUME_TEXT_CHARS = 20_000;

export type ResumeFileType = "pdf" | "docx" | "txt";
export type ResumeParseErrorCode =
  | "unsupported_file"
  | "file_too_large"
  | "encrypted_file"
  | "text_not_found"
  | "parse_failed"
  | "pdf_invalid"       // InvalidPDFException / MissingPDFException / FormatError
  | "pdf_worker_failed"; // Worker initialisation failure in serverless

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
      text = new TextDecoder("utf-8").decode(buffer).replace(/^﻿/, "");
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

    console.error("[parse-resume]", {
      stage: "pdf-parse-failed",
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    if (isEncryptedPdfError(error)) throw new ResumeParseError("encrypted_file");
    if (isPdfWorkerError(error)) throw new ResumeParseError("pdf_worker_failed", error instanceof Error ? error.message : "pdf_worker_failed");
    if (isPdfInvalidError(error)) throw new ResumeParseError("pdf_invalid", error instanceof Error ? error.message : "pdf_invalid");

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

async function resolveWorkerSrc(): Promise<string> {
  // Default workerSrc is "./pdf.worker.mjs" (relative).
  // In Vercel Node.js serverless CWD != pdfjs-dist directory, so the relative
  // path fails and causes "Setting up fake worker failed". Resolve to file://.
  try {
    const req = createRequire(import.meta.url);
    const workerPath = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    return pathToFileURL(workerPath).href;
  } catch (e) {
    console.warn("[parse-resume]", {
      stage: "worker-src-resolve-failed",
      errorName: e instanceof Error ? e.name : "UnknownError",
      errorMessage: e instanceof Error ? e.message : String(e),
    });
    return "";
  }
}

async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Resolve absolute worker path once; skip if already set to a non-relative URL.
  const current = pdfjs.GlobalWorkerOptions.workerSrc ?? "";
  if (!current || current.startsWith(".")) {
    const resolved = await resolveWorkerSrc();
    pdfjs.GlobalWorkerOptions.workerSrc = resolved;
    console.log("[parse-resume]", { stage: "worker-src-set", workerSrc: resolved || "(empty)" });
  }

  console.log("[parse-resume]", {
    stage: "buffer-created",
    byteLength: data.byteLength,
    magicBytes: new TextDecoder().decode(data.slice(0, 5)),
  });

  console.log("[parse-resume]", { stage: "pdf-loading-started" });

  const task = pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const document = await task.promise;

  console.log("[parse-resume]", {
    stage: "pdf-loaded",
    totalPages: document.numPages,
  });

  const pages: string[] = [];
  let successfulPages = 0;
  let failedPages = 0;

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      try {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .filter(Boolean)
          .join(" ");

        console.log("[parse-resume]", {
          stage: "page-extracted",
          pageNumber,
          itemCount: content.items.length,
          textLength: pageText.length,
        });

        if (pageText) pages.push(pageText);
        successfulPages++;
      } catch (e) {
        console.warn("[parse-resume]", {
          stage: "page-extraction-failed",
          pageNumber,
          errorName: e instanceof Error ? e.name : "UnknownError",
          errorMessage: e instanceof Error ? e.message : String(e),
        });
        failedPages++;
      }
    }
  } finally {
    await task.destroy();
  }

  const fullText = pages.join("\n");
  console.log("[parse-resume]", {
    stage: "text-extraction-completed",
    totalPages: document.numPages,
    successfulPages,
    failedPages,
    extractedTextLength: fullText.length,
  });

  return fullText;
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
  return name === "PasswordException" || name.includes("Password") || /password|encrypted/i.test(message);
}

function isPdfWorkerError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message) : "";
  return message.includes("GlobalWorkerOptions.workerSrc") || message.includes("Setting up fake worker");
}

function isPdfInvalidError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  return ["InvalidPDFException", "MissingPDFException", "FormatError", "UnknownErrorException"].includes(name);
}
