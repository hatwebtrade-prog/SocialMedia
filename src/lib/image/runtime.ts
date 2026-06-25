import sharp from "sharp";
import path from "node:path";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { IMAGE_MODEL } from "./openai";
import { generateWithProvider } from "./providers";
import { saveAssetFile, deleteAssetFile } from "./store";
import type { ImageDeps } from "./generate";

interface MetaPayloadShape {
  ideaCreativa?: string;
  slides?: Array<{ testo?: string }>;
}

function sharedImageDeps(): Pick<ImageDeps, "loadMockup" | "callOpenAI" | "persistAsset"> {
  return {
    loadMockup: async (productId) => {
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { imagePath: true } });
      if (!product?.imagePath) return null;
      try {
        const abs = path.join(process.cwd(), product.imagePath);
        const buf = readFileSync(abs);
        return await sharp(buf).resize(1024, 1024, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
      } catch {
        return null;
      }
    },

    callOpenAI: async (prompt, mockup, provider) => {
      return generateWithProvider(provider ?? "GPT", prompt, mockup);
    },

    persistAsset: async ({ input, prompt, bytes }) => {
      const existing = await prisma.generatedAsset.findFirst({
        where: { contentId: input.contentId, slideIndex: input.slideIndex, tipo: "IMMAGINE" },
      });
      if (existing) {
        if (existing.path) deleteAssetFile(existing.path);
        await prisma.generatedAsset.delete({ where: { id: existing.id } });
      }
      const asset = await prisma.generatedAsset.create({
        data: {
          contentId: input.contentId,
          slideIndex: input.slideIndex,
          tipo: "IMMAGINE",
          prompt,
          modello: IMAGE_MODEL,
          path: "",
        },
      });
      try {
        const relPath = saveAssetFile(input.contentId, asset.id, bytes);
        await prisma.generatedAsset.update({ where: { id: asset.id }, data: { path: relPath } });
      } catch (err) {
        await prisma.generatedAsset.delete({ where: { id: asset.id } }).catch(() => {});
        throw err;
      }
      return { assetId: asset.id };
    },
  };
}

export function buildImageRuntimeDeps(): ImageDeps {
  return {
    loadContent: async (contentId, slideIndex) => {
      const content = await prisma.generatedContent.findUniqueOrThrow({ where: { id: contentId } });
      const payload = (content.payload ?? {}) as MetaPayloadShape;
      const ideaCreativa = payload.ideaCreativa ?? "";
      const slideText =
        slideIndex != null && payload.slides?.[slideIndex]?.testo
          ? payload.slides[slideIndex]!.testo!
          : null;
      return { ideaCreativa, slideText };
    },
    ...sharedImageDeps(),
  };
}

export function buildBlogImageDeps(): ImageDeps {
  return {
    loadContent: async (contentId) => {
      const content = await prisma.generatedContent.findUniqueOrThrow({ where: { id: contentId } });
      const payload = (content.payload ?? {}) as { titoloSeo?: string };
      return { ideaCreativa: payload.titoloSeo ?? "", slideText: null };
    },
    ...sharedImageDeps(),
  };
}
