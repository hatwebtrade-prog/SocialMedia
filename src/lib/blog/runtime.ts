import { prisma } from "@/lib/prisma";
import { getClaude, BRAINSTORM_MODEL } from "@/lib/claude";
import { buildKbContext } from "@/lib/brain/context";
import { stripFences } from "@/lib/meta/runtime";
import { getOpenAI, IMAGE_MODEL } from "@/lib/image/openai";
import { saveAssetFile } from "@/lib/image/store";
import { buildImagePrompt } from "@/lib/image/prompt";
import { fetchKeywords } from "@/lib/seozoom/client";
import type { NormalizedKeyword } from "@/lib/seozoom/select";
import { fetchProductsWithMetafields } from "@/lib/shopify/products";
import { buildBlogPrompt, type BlogIdea } from "./prompt";
import { blogArticleSchema } from "./schema";
import type { BlogDeps, BlogClaudeResult } from "./generate";

/** Maps SEOZoom related keywords to secondary keyword strings, dropping the principal and capping. */
export function deriveSecondaryKeywords(principal: string, related: NormalizedKeyword[], cap = 8): string[] {
  const p = principal.trim().toLowerCase();
  return related
    .map((k) => k.keyword)
    .filter((k) => k.trim().toLowerCase() !== p)
    .slice(0, cap);
}

export function buildBlogDeps(): BlogDeps {
  return {
    loadContext: async (ideaId) => {
      const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
      if (!idea) throw new Error("Idea non trovata");
      if (idea.status !== "APPROVATA") throw new Error("Idea non approvata: genera solo da idee APPROVATA");
      const knowledge = await prisma.knowledgeItem.findMany();
      const product = idea.productId ? await prisma.product.findUnique({ where: { id: idea.productId } }) : null;
      const kbContext = buildKbContext({ products: product ? [product] : [], knowledge });
      let prodotti = [] as Awaited<ReturnType<typeof fetchProductsWithMetafields>>;
      try {
        prodotti = await fetchProductsWithMetafields();
      } catch (err) {
        console.error("Shopify prodotti non disponibili, genero senza riferimenti prodotto:", err instanceof Error ? err.message : err);
      }
      const blogIdea: BlogIdea = {
        keyword: idea.keyword, volumeRicerca: idea.volumeRicerca, difficolta: idea.difficolta,
        titolo: idea.titolo, descrizione: idea.descrizione, category: String(idea.category),
      };
      return { idea: blogIdea, kbContext, prodotti };
    },

    loadSeoData: async (idea) => {
      const keywordPrincipale = idea.keyword ?? idea.titolo;
      let keywordSecondarie: string[] = [];
      if (idea.keyword) {
        try {
          const related = await fetchKeywords(idea.keyword);
          keywordSecondarie = deriveSecondaryKeywords(keywordPrincipale, related);
        } catch (err) {
          console.error("SEOZoom correlate non disponibili, Claude proporrà le secondarie:", err instanceof Error ? err.message : err);
        }
      }
      return { keywordPrincipale, keywordSecondarie };
    },

    callClaude: async ({ idea, kbContext, prodotti, seo }): Promise<BlogClaudeResult> => {
      const prompt = buildBlogPrompt({ kbContext, idea, prodotti, seo });
      const claude = getClaude();
      const response = await claude.messages.create({
        model: BRAINSTORM_MODEL,
        max_tokens: 16000,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("Output AI non conforme");
      const payload = blogArticleSchema.parse(JSON.parse(stripFences(textBlock.text)));
      return {
        payload,
        promptUsato: prompt,
        modello: BRAINSTORM_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        rawOutput: response.content,
      };
    },

    generateImage: async ({ titoloSeo }) => {
      const prompt = buildImagePrompt({ ideaCreativa: titoloSeo, slideText: null });
      const client = getOpenAI();
      const res = await client.images.generate({ model: IMAGE_MODEL, prompt, size: "1024x1024" });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error("OpenAI non ha restituito un'immagine");
      return { bytes: Buffer.from(b64, "base64"), prompt };
    },

    persist: async ({ input, payload, claude, image }) => {
      const content = await prisma.generatedContent.create({
        data: {
          ideaId: input.ideaId,
          canale: "BLOG",
          formato: "ARTICOLO",
          status: "BOZZA",
          payload: payload as object,
          promptUsato: claude.promptUsato,
          modello: claude.modello,
          inputTokens: claude.inputTokens,
          outputTokens: claude.outputTokens,
          outputGrezzo: (claude.rawOutput ?? {}) as object,
        },
      });
      const asset = await prisma.generatedAsset.create({
        data: { contentId: content.id, slideIndex: null, tipo: "IMMAGINE", prompt: image.prompt, modello: IMAGE_MODEL, path: "" },
      });
      try {
        const relPath = saveAssetFile(content.id, asset.id, image.bytes);
        await prisma.generatedAsset.update({ where: { id: asset.id }, data: { path: relPath } });
      } catch (err) {
        await prisma.generatedAsset.delete({ where: { id: asset.id } }).catch(() => {});
        throw err;
      }
      return { contentId: content.id };
    },
  };
}
