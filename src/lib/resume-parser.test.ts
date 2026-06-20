import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  extractResumeText,
  ResumeParseError,
  validateResumeFile,
} from "./resume-parser";

describe("resume file validation", () => {
  it("accepts PDF, DOCX, and TXT files up to 5 MB", () => {
    expect(validateResumeFile({ name: "resume.pdf", size: 1024 })).toBe("pdf");
    expect(validateResumeFile({ name: "resume.docx", size: 1024 })).toBe("docx");
    expect(validateResumeFile({ name: "resume.txt", size: 1024 })).toBe("txt");
  });

  it("rejects unsupported and oversized files with distinct errors", () => {
    expect(() =>
      validateResumeFile({ name: "resume.hwp", size: 1024 }),
    ).toThrowError(new ResumeParseError("unsupported_file"));
    expect(() =>
      validateResumeFile({ name: "resume.pdf", size: 5 * 1024 * 1024 + 1 }),
    ).toThrowError(new ResumeParseError("file_too_large"));
  });
});

describe("resume text extraction", () => {
  it("extracts and normalizes TXT content", async () => {
    const file = new File(
      [
        "\ufeff프로덕트 디자이너\r\n\r\nReact 기반 디자인 시스템 구축\r\n전환율 18% 개선",
      ],
      "resume.txt",
      { type: "text/plain" },
    );

    await expect(extractResumeText(file)).resolves.toBe(
      "프로덕트 디자이너\nReact 기반 디자인 시스템 구축\n전환율 18% 개선",
    );
  });

  it("rejects a text file without meaningful content", async () => {
    const file = new File([" \r\n\t "], "resume.txt", { type: "text/plain" });

    await expect(extractResumeText(file)).rejects.toMatchObject({
      code: "text_not_found",
    });
  });

  it("extracts text from a DOCX document", async () => {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>`,
    );
    zip.folder("_rels")?.file(
      ".rels",
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>`,
    );
    zip.folder("word")?.file(
      "document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Product designer with seven years of experience</w:t></w:r></w:p>
          <w:p><w:r><w:t>Improved conversion by 18 percent</w:t></w:r></w:p>
        </w:body>
      </w:document>`,
    );
    const buffer = await zip.generateAsync({ type: "uint8array" });
    const file = new File([Uint8Array.from(buffer).buffer], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await expect(extractResumeText(file)).resolves.toContain(
      "Improved conversion by 18 percent",
    );
  });

  it(
    "extracts text from a text-based PDF",
    async () => {
      const file = new File(
        [
          createSimplePdf("Frontend engineer with React experience")
            .buffer as ArrayBuffer,
        ],
        "resume.pdf",
        {
          type: "application/pdf",
        },
      );

      await expect(extractResumeText(file)).resolves.toContain(
        "Frontend engineer with React experience",
      );
    },
    15_000,
  );
});

function createSimplePdf(text: string): Uint8Array {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length + 31} >>\nstream\nBT /F1 12 Tf 72 720 Td (${text}) Tj ET\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
