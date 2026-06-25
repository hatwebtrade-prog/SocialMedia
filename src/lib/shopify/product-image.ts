import sharp from "sharp";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const PRODUCTS_DIR = path.join(process.cwd(), "uploads", "products");

/** Relative uploads path for a product mockup (sanitised handle). */
export function productImageRelPath(handle: string): string {
  const safe = handle.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "prodotto";
  return path.join("uploads", "products", `${safe}.png`);
}

/** Downloads a product image and stores it resized to 2500x2500 (contain, white bg). Returns the rel path or null on any error. */
export async function downloadAndResizeProductImage(url: string, handle: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const out = await sharp(input)
      .resize(2500, 2500, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    mkdirSync(PRODUCTS_DIR, { recursive: true });
    const rel = productImageRelPath(handle);
    writeFileSync(path.join(process.cwd(), rel), out);
    return rel;
  } catch {
    return null;
  }
}
