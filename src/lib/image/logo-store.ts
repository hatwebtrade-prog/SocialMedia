import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { UPLOADS_DIR } from "./store";

const BRAND_DIR = path.join(UPLOADS_DIR, "brand");
const LOGO_ABS = path.join(BRAND_DIR, "logo.png");

/** Persists the brand logo PNG at a fixed path. Returns the repo-relative POSIX path. */
export function saveLogo(bytes: Buffer): string {
  mkdirSync(BRAND_DIR, { recursive: true });
  writeFileSync(LOGO_ABS, bytes);
  return path.relative(process.cwd(), LOGO_ABS).replace(/\\/g, "/");
}

export function hasLogo(): boolean {
  return existsSync(LOGO_ABS);
}

export function readLogo(): Buffer | null {
  try {
    return existsSync(LOGO_ABS) ? readFileSync(LOGO_ABS) : null;
  } catch {
    return null;
  }
}
