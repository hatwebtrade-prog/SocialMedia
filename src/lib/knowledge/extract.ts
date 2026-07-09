export type FileKind = "DOCUMENTO" | "IMMAGINE";

/** Classifies an uploaded file by MIME type; null = unsupported. */
export function pickFileKind(mimeType: string): FileKind | null {
  if (mimeType.startsWith("image/")) return "IMMAGINE";
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "DOCUMENTO";
  }
  return null;
}

/** Extracts plain text from a document buffer (PDF/DOCX/TXT/MD). Throws on parser failure. */
export async function extractText(buffer: Buffer, mimeType: string, filename = ""): Promise<string> {
  if (mimeType === "application/pdf") {
    // pdf-parse v2 is class-based (no default export): new PDFParse({data}).getText()
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const res = await parser.getText();
      return (res.text ?? "").trim();
    } finally {
      await parser.destroy();
    }
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    /\.docx?$/i.test(filename)
  ) {
    const mammoth = await import("mammoth");
    const out = await mammoth.extractRawText({ buffer });
    return (out.value ?? "").trim();
  }
  return buffer.toString("utf-8").trim();
}
