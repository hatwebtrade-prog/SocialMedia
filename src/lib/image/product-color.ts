import sharp from "sharp";

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

/** Dominant colour of an image as #rrggbb, via sharp's dominant stat. Null on failure. */
export async function dominantColorHex(imageBuf: Buffer): Promise<string | null> {
  try {
    const { dominant } = await sharp(imageBuf).stats();
    if (!dominant) return null;
    return `#${toHex(dominant.r)}${toHex(dominant.g)}${toHex(dominant.b)}`;
  } catch {
    return null;
  }
}
