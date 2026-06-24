import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

/** Writes PNG bytes to uploads/<contentId>/<assetId>.png and returns the repo-relative POSIX path. */
export function saveAssetFile(contentId: string, assetId: string, bytes: Buffer): string {
  const dir = path.join(UPLOADS_DIR, contentId);
  mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, `${assetId}.png`);
  writeFileSync(abs, bytes);
  return path.relative(process.cwd(), abs).replace(/\\/g, "/");
}

/** Deletes a stored file given its repo-relative path. Best-effort. No-op for empty/unsafe paths. */
export function deleteAssetFile(relPath: string): void {
  if (!relPath || !relPath.trim()) return;
  const abs = path.resolve(process.cwd(), relPath);
  // Safety: never delete the cwd itself or anything outside the uploads dir
  if (abs === process.cwd() || !abs.startsWith(UPLOADS_DIR)) return;
  if (existsSync(abs)) rmSync(abs, { force: true });
}

/** Reads a stored asset file (by its relative path) and returns base64, or null if missing/outside uploads. */
export function readAssetBase64(relPath: string): string | null {
  if (!relPath || !relPath.trim()) return null;
  const abs = path.resolve(process.cwd(), relPath);
  if (!abs.startsWith(UPLOADS_DIR)) return null;
  try {
    return readFileSync(abs).toString("base64");
  } catch {
    return null;
  }
}
