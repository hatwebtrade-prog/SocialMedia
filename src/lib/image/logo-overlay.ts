import sharp from "sharp";

/** Top-right placement of a logo over an image. logoRatio = logoWidth / logoHeight. Pure. */
export function logoPlacement(
  imgW: number,
  imgH: number,
  logoRatio: number,
  opts?: { widthPct?: number; marginPct?: number },
): { left: number; top: number; width: number; height: number } {
  const widthPct = opts?.widthPct ?? 0.16;
  const marginPct = opts?.marginPct ?? 0.04;
  const width = Math.max(1, Math.round(imgW * widthPct));
  const height = Math.max(1, Math.round(width / (logoRatio || 1)));
  const margin = Math.round(imgW * marginPct);
  const left = Math.max(0, imgW - width - margin);
  const top = Math.max(0, margin);
  return { left, top, width, height };
}

/** Composites the logo onto the image (top-right). On any failure (e.g. a corrupt logo) it returns
 *  the original image unchanged, so a bad logo never fails the whole image generation. */
export async function overlayLogo(imageBuf: Buffer, logoBuf: Buffer): Promise<Buffer> {
  try {
    const img = sharp(imageBuf);
    const meta = await img.metadata();
    const imgW = meta.width ?? 1024;
    const imgH = meta.height ?? 1024;
    const logoMeta = await sharp(logoBuf).metadata();
    const ratio = (logoMeta.width ?? 4) / (logoMeta.height ?? 1);
    const p = logoPlacement(imgW, imgH, ratio);
    const resizedLogo = await sharp(logoBuf).resize(p.width, p.height, { fit: "inside" }).png().toBuffer();
    return await img.composite([{ input: resizedLogo, left: p.left, top: p.top }]).png().toBuffer();
  } catch {
    return imageBuf;
  }
}
