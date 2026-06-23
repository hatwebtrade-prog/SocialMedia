import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
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

/** Deletes a stored file given its repo-relative path. Best-effort. */
export function deleteAssetFile(relPath: string): void {
  const abs = path.join(process.cwd(), relPath);
  if (existsSync(abs)) rmSync(abs, { force: true });
}
