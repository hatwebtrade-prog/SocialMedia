import { describe, it, expect } from "vitest";
import { pickFileKind, extractText } from "@/lib/knowledge/extract";

describe("pickFileKind", () => {
  it("classifies images vs documents vs unsupported", () => {
    expect(pickFileKind("image/png")).toBe("IMMAGINE");
    expect(pickFileKind("image/jpeg")).toBe("IMMAGINE");
    expect(pickFileKind("application/pdf")).toBe("DOCUMENTO");
    expect(pickFileKind("text/plain")).toBe("DOCUMENTO");
    expect(pickFileKind("text/markdown")).toBe("DOCUMENTO");
    expect(pickFileKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("DOCUMENTO");
    expect(pickFileKind("application/zip")).toBeNull();
  });
});

describe("extractText (text formats)", () => {
  it("decodes utf-8 for text/plain and markdown", async () => {
    const buf = Buffer.from("# Titolo\nContenuto àèì", "utf-8");
    expect(await extractText(buf, "text/plain", "a.txt")).toContain("Contenuto àèì");
    expect(await extractText(buf, "text/markdown", "a.md")).toContain("Titolo");
  });
});

/** Builds a minimal single-page PDF with `text`, with a correct xref table. */
function makePdf(text: string): Buffer {
  const objs: Record<number, string> = {
    1: "<</Type/Catalog/Pages 2 0 R>>",
    2: "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    3: "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    4: (() => {
      const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`;
      return `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`;
    })(),
    5: "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  };
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i <= 5; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefStart = pdf.length;
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  pdf += `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

describe("extractText (pdf, pdf-parse v2)", () => {
  it("extracts text from a PDF buffer", async () => {
    const out = await extractText(makePdf("Ciao Agocap PDF"), "application/pdf", "a.pdf");
    expect(out).toContain("Ciao Agocap PDF");
  });
});
