import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { higgsfieldVideo } from "@/lib/image/providers/higgsfield-video";
import { saveVideoAssetFile, deleteAssetFile } from "@/lib/image/store";
import { scrubCompetitors } from "@/lib/blog/competitors";
import type { VideoDeps } from "./generate";

export function buildVideoDeps(): VideoDeps {
  return {
    loadStartImage: async (contentId, slideIndex) => {
      const asset = await prisma.generatedAsset.findFirst({
        where: { contentId, slideIndex, tipo: "IMMAGINE" },
        orderBy: { createdAt: "desc" },
        select: { path: true },
      });
      if (!asset?.path) return null;
      try {
        return readFileSync(path.join(process.cwd(), asset.path));
      } catch {
        return null;
      }
    },
    loadReel: async (contentId) => {
      const content = await prisma.generatedContent.findUnique({ where: { id: contentId } });
      const p = (content?.payload ?? {}) as { hook?: string; scriptParlato?: string; testoSchermo?: string[]; ideaCreativa?: string };
      const s = (v?: string) => (v ? scrubCompetitors(v) : v);
      return { hook: s(p.hook), scriptParlato: s(p.scriptParlato), testoSchermo: (p.testoSchermo ?? []).map((t) => scrubCompetitors(t)), ideaCreativa: s(p.ideaCreativa) };
    },
    callVideo: (imageBuf, prompt) => higgsfieldVideo(imageBuf, prompt),
    persistVideo: async ({ input, prompt, bytes }) => {
      const existing = await prisma.generatedAsset.findFirst({ where: { contentId: input.contentId, slideIndex: input.slideIndex, tipo: "VIDEO" } });
      if (existing) {
        if (existing.path) deleteAssetFile(existing.path);
        await prisma.generatedAsset.delete({ where: { id: existing.id } });
      }
      const asset = await prisma.generatedAsset.create({
        data: { contentId: input.contentId, slideIndex: input.slideIndex, tipo: "VIDEO", prompt, modello: "higgsfield/dop", path: "" },
      });
      let relPath: string;
      try {
        relPath = saveVideoAssetFile(input.contentId, asset.id, bytes);
      } catch (e) {
        // Don't leave an orphan row with an empty path (would render a broken <video>).
        await prisma.generatedAsset.delete({ where: { id: asset.id } });
        throw e;
      }
      await prisma.generatedAsset.update({ where: { id: asset.id }, data: { path: relPath } });
      return { assetId: asset.id };
    },
  };
}
