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

function sharedImageDeps(): Pick<ImageDeps, "loadMockup" | "callOpenAI" | "persistAsset" | "ensureHiggsfieldRef" | "loadBrandVisual" | "loadEditorial"> {
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

    callOpenAI: async (prompt, mockup, provider, opts) => {
      return generateWithProvider(provider ?? "GPT", prompt, mockup, opts);
    },

    // Returns a previously-cached SoulId only (no slow synchronous creation in the request path).
    // The product mockup is applied directly via image_reference in the Higgsfield provider.
    ensureHiggsfieldRef: async (productId) => {
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { higgsfieldSoulId: true } });
      return product?.higgsfieldSoulId ?? null;
    },

    loadBrandVisual: async () => {
      const p = await prisma.brandVisualProfile.findUnique({ where: { id: "default" } });
      if (!p) return null;
      return { palette: p.palette, stileFotografico: p.stileFotografico, mood: p.mood, elementiRicorrenti: p.elementiRicorrenti, daEvitare: p.daEvitare };
    },

    loadEditorial: async () => {
      const [direction, items, files] = await Promise.all([
        prisma.editorialDirection.findUnique({ where: { id: "default" } }),
        prisma.knowledgeItem.findMany({ where: { tipo: "PIANO_EDITORIALE" }, orderBy: { createdAt: "desc" } }),
        prisma.knowledgeFile.findMany({ where: { stato: "PRONTO", kind: "DOCUMENTO", knowledgeType: "PIANO_EDITORIALE", NOT: { testo: null } }, orderBy: { createdAt: "desc" } }),
      ]);
      const planTexts = [
        ...items.map((i) => (i.contenuto ?? "").slice(0, 800)),
        ...files.map((f) => (f.testo ?? "").slice(0, 800)),
      ].filter((t) => t.trim()).join("\n").slice(0, 1500);
      return {
        direction: {
          campagna: direction?.campagna ?? null,
          periodo: direction?.periodo ?? null,
          temi: direction?.temi ?? null,
          tonoVisivo: direction?.tonoVisivo ?? null,
          daMostrare: direction?.daMostrare ?? null,
          daEvitare: direction?.daEvitare ?? null,
        },
        planTexts,
      };
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
