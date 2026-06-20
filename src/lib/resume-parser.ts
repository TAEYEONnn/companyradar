import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Type-only: zero runtime cost, used to type the module singleton below
import type * as PdfJsModule from "pdfjs-dist/legacy/build/pdf.mjs";

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
  | "pdf_invalid"              // InvalidPDFException / MissingPDFException / FormatError
  | "pdf_worker_failed"        // Worker initialisation failure
  | "pdf_runtime_unsupported"; // DOMMatrix / canvas globals missing in serverless

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

// ── Node.js global polyfill ───────────────────────────────────────────────────
// pdfjs-dist 6.x requires DOMMatrix (and optionally ImageData / Path2D) as
// browser globals. They don't exist in Node.js/Vercel serverless. @napi-rs/canvas
// ships native Node.js implementations of all three.
// We use `key in globalThis` instead of `typeof globalThis.X` to avoid TypeScript
// lib.dom.d.ts telling us the globals always exist.

async function ensurePdfJsNodeGlobals(): Promise<void> {
  console.log("[parse-resume]", {
    stage: "pdf-globals-check",
    hasDOMMatrix: "DOMMatrix" in globalThis,
    hasImageData: "ImageData" in globalThis,
    hasPath2D: "Path2D" in globalThis,
  });

  if (
    "DOMMatrix" in globalThis &&
    "ImageData" in globalThis &&
    "Path2D" in globalThis
  ) {
    return;
  }

  const canvas = await import("@napi-rs/canvas");

  if (!("DOMMatrix" in globalThis)) {
    Object.defineProperty(globalThis, "DOMMatrix", {
      value: canvas.DOMMatrix,
      configurable: true,
      writable: true,
    });
  }
  if (!("ImageData" in globalThis)) {
    Object.defineProperty(globalThis, "ImageData", {
      value: canvas.ImageData,
      configurable: true,
      writable: true,
    });
  }
  if (!("Path2D" in globalThis) && canvas.Path2D) {
    Object.defineProperty(globalThis, "Path2D", {
      value: canvas.Path2D,
      configurable: true,
      writable: true,
    });
  }

  console.log("[parse-resume]", {
    stage: "pdf-globals-polyfilled",
    hasDOMMatrix: "DOMMatrix" in globalThis,
    hasImageData: "ImageData" in globalThis,
    hasPath2D: "Path2D" in globalThis,
  });
}

// ── pdfjs-dist singleton ──────────────────────────────────────────────────────
// Module-level cache so polyfill + dynamic import runs once per cold start.
// On load failure the cache is cleared so the next request retries.

let pdfJsLoadPromise: Promise<typeof PdfJsModule> | null = null;

export async function loadPdfJs(): Promise<typeof PdfJsModule> {
  if (!pdfJsLoadPromise) {
    const p = (async (): Promise<typeof PdfJsModule> => {
      await ensurePdfJsNodeGlobals();

      console.log("[parse-resume]", { stage: "pdfjs-import-started" });
      const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");

      // Default workerSrc is "./pdf.worker.mjs" (relative path). When pdfjs-dist
      // is listed in serverExternalPackages it is NOT webpack-bundled, so pdfjs
      // runs from its real node_modules path and import.meta.url inside pdfjs
      // resolves "./pdf.worker.mjs" to the correct sibling file automatically.
      //
      // If for some reason the path is still relative AND import.meta.url in
      // this (bundled) module is a real string URL, try to resolve it explicitly.
      const current = mod.GlobalWorkerOptions.workerSrc ?? "";
      const metaUrl = import.meta.url;
      if ((!current || current.startsWith(".")) && typeof metaUrl === "string") {
        try {
          const req = createRequire(metaUrl);
          const workerPath = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
          mod.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
          console.log("[parse-resume]", { stage: "worker-src-resolved" });
        } catch (e) {
          console.warn("[parse-resume]", {
            stage: "worker-src-resolve-failed",
            errorName: e instanceof Error ? e.name : "UnknownError",
            errorMessage: e instanceof Error ? e.message : String(e),
          });
        }
      }
      // else: pdfjs is external — its own import.meta.url resolves the relative
      // workerSrc correctly without help from this bundled module.

      console.log("[parse-resume]", { stage: "pdfjs-import-completed" });
      return mod;
    })();

    pdfJsLoadPromise = p;
    // Clear on failure so next request retries instead of getting a stale rejection
    p.catch(() => {
      pdfJsLoadPromise = null;
    });
  }
  return pdfJsLoadPromise;
}

// ── PDF text extraction ───────────────────────────────────────────────────────

async function extractPdfText(data: Uint8Array): Promise<string> {
  let pdfjs: typeof PdfJsModule;
  try {
    pdfjs = await loadPdfJs();
  } catch (e) {
    console.error("[parse-resume]", {
      stage: "pdfjs-init-failed",
      errorName: e instanceof Error ? e.name : "UnknownError",
      errorMessage: e instanceof Error ? e.message : String(e),
    });
    throw new ResumeParseError(
      "pdf_runtime_unsupported",
      e instanceof Error ? e.message : "pdf_runtime_unsupported",
    );
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

// ── Text normalisation ────────────────────────────────────────────────────────

function normalizeResumeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// ── pdfjs error classifiers ───────────────────────────────────────────────────

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
