import sharp from "sharp";
import path from "node:path";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { IMAGE_MODEL } from "./openai";
import { generateWithProvider } from "./providers";
import { saveAssetFile, deleteAssetFile } from "./store";
import type { ImageDeps } from "./generate";
import { readLogo } from "./logo-store";
import { overlayLogo } from "./logo-overlay";
import { dominantColorHex } from "./product-color";
import { socialCopySchema, buildSocialCopyPrompt } from "./social-copy";
import { getClaude, BRAINSTORM_MODEL } from "@/lib/claude";
import { stripFences } from "@/lib/meta/runtime";
import { scrubCompetitors } from "@/lib/blog/competitors";

interface MetaPayloadShape {
  ideaCreativa?: string;
  slides?: Array<{ testo?: string }>;
}

function sharedImageDeps(): Pick<
  ImageDeps,
  | "loadMockup"
  | "loadProduct"
  | "callOpenAI"
  | "persistAsset"
  | "ensureHiggsfieldRef"
  | "loadBrandVisual"
  | "loadLogo"
  | "overlayLogo"
  | "dominantColor"
  | "resolveSocialCopy"
> {
  return {
    loadProduct: async (productId) => {
      return prisma.product.findUnique({
        where: { id: productId },
        select: { nome: true, descrizione: true, benefici: true, ingredienti: true, categoria: true },
      });
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

    loadLogo: () => readLogo(),
    overlayLogo: (imageBuf, logoBuf) => overlayLogo(imageBuf, logoBuf),
    dominantColor: (imageBuf) => dominantColorHex(imageBuf),
    resolveSocialCopy: async (contentId, slideIndex, productName) => {
      const content = await prisma.generatedContent.findUnique({ where: { id: contentId }, include: { idea: true } });
      if (!content) return null;
      const payload = (content.payload ?? {}) as { slides?: { testo: string }[]; caption?: string; ideaCreativa?: string };
      const testo = slideIndex != null ? (payload.slides?.[slideIndex]?.testo ?? "") : (payload.caption ?? payload.ideaCreativa ?? "");
      try {
        const claude = getClaude();
        const res = await claude.messages.create({
          model: BRAINSTORM_MODEL,
          max_tokens: 500,
          messages: [{ role: "user", content: buildSocialCopyPrompt({ titoloIdea: content.idea?.titolo ?? "", testo, productName }) }],
        });
        const block = res.content.find((b) => b.type === "text");
        if (!block || block.type !== "text") return null;
        const parsed = socialCopySchema.parse(JSON.parse(stripFences(block.text)));
        return { titolo: scrubCompetitors(parsed.titolo), bullets: parsed.bullets.map((b) => scrubCompetitors(b)) };
      } catch {
        return null;
      }
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
