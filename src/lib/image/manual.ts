import { prisma } from "@/lib/prisma";
import { saveAssetFile, deleteAssetFile } from "./store";

/** Parses a `data:image/...;base64,...` URL into a Buffer (null if not an image data URL). */
export function parseDataUrl(dataUrl: string): Buffer | null {
  const m = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(dataUrl ?? "");
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}

/** Persists a manually-uploaded image as the content's asset (replaces existing for that slide). */
export async function saveManualImage(contentId: string, slideIndex: number | null, bytes: Buffer): Promise<{ assetId: string }> {
  const existing = await prisma.generatedAsset.findFirst({ where: { contentId, slideIndex, tipo: "IMMAGINE" } });
  if (existing) {
    if (existing.path) deleteAssetFile(existing.path);
    await prisma.generatedAsset.delete({ where: { id: existing.id } });
  }
  const asset = await prisma.generatedAsset.create({
    data: { contentId, slideIndex, tipo: "IMMAGINE", prompt: "(caricamento manuale)", modello: "manuale", path: "" },
  });
  try {
    const relPath = saveAssetFile(contentId, asset.id, bytes);
    await prisma.generatedAsset.update({ where: { id: asset.id }, data: { path: relPath } });
  } catch (err) {
    await prisma.generatedAsset.delete({ where: { id: asset.id } }).catch(() => {});
    throw err;
  }
  return { assetId: asset.id };
}
