import path from "node:path";
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";

const DIR = path.join(process.cwd(), "uploads", "knowledge");

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};

export function extFromMime(mimeType: string, nome: string): string {
  if (EXT_BY_MIME[mimeType]) return EXT_BY_MIME[mimeType];
  const dot = nome.lastIndexOf(".");
  return dot >= 0 ? nome.slice(dot + 1).toLowerCase() : "bin";
}

export function saveKnowledgeFile(id: string, ext: string, bytes: Buffer): string {
  mkdirSync(DIR, { recursive: true });
  const rel = path.join("uploads", "knowledge", `${id}.${ext}`);
  writeFileSync(path.join(process.cwd(), rel), bytes);
  return rel;
}

export function readKnowledgeFile(relPath: string): Buffer {
  return readFileSync(path.join(process.cwd(), relPath));
}

export function deleteKnowledgeFile(relPath: string): void {
  try {
    const abs = path.join(process.cwd(), relPath);
    if (existsSync(abs)) unlinkSync(abs);
  } catch {
    /* ignore */
  }
}
