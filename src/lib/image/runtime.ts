import sharp from "sharp";
import path from "node:path";
import { readFileSync } from "node:fs";
import { toFile } from "openai";
import { prisma } from "@/lib/prisma";
import { getOpenAI, IMAGE_MODEL } from "./openai";
import { saveAssetFile, deleteAssetFile } from "./store";
import type { ImageDeps } from "./generate";

interface MetaPayloadShape {
  ideaCreativa?: string;
  slides?: Array<{ testo?: string }>;
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

    callOpenAI: async (prompt, mockup) => {
      const client = getOpenAI();
      if (mockup) {
        const file = await toFile(mockup, "mockup.png", { type: "image/png" });
        const res = await client.images.edit({ model: IMAGE_MODEL, image: file, prompt, size: "1024x1024" });
        const b64 = res.data?.[0]?.b64_json;
        if (!b64) throw new Error("OpenAI non ha restituito un'immagine (edit)");
        return Buffer.from(b64, "base64");
      }
      const res = await client.images.generate({ model: IMAGE_MODEL, prompt, size: "1024x1024" });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error("OpenAI non ha restituito un'immagine");
      return Buffer.from(b64, "base64");
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
