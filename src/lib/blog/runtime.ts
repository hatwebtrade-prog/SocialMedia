import { prisma } from "@/lib/prisma";
import { getClaude, BRAINSTORM_MODEL } from "@/lib/claude";
import { buildKbContext } from "@/lib/brain/context";
import { stripFences } from "@/lib/meta/runtime";
import { loadKnowledgeKbItems } from "@/lib/knowledge/items";
import { fetchKeywords } from "@/lib/seozoom/client";
import type { NormalizedKeyword } from "@/lib/seozoom/select";
import { fetchProductsWithMetafields } from "@/lib/shopify/products";
import { buildBlogPrompt, type BlogIdea } from "./prompt";
import { blogArticleSchema } from "./schema";
import { buildProductCards, type ProductRec } from "./product-cards";
import type { BlogDeps, BlogClaudeResult } from "./generate";

/** Maps SEOZoom related keywords to secondary keyword strings, dropping the principal and capping. */
export function deriveSecondaryKeywords(principal: string, related: NormalizedKeyword[], cap = 8): string[] {
  const p = principal.trim().toLowerCase();
  return related
    .map((k) => k.keyword)
    .filter((k) => k.trim().toLowerCase() !== p)
    .slice(0, cap);
}

async function resolveProductCards(ideaId: string) {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, include: { product: true } });
  const main = (idea?.product ?? null) as ProductRec | null;
  const sameCategory = main?.categoria
    ? ((await prisma.product.findMany({ where: { categoria: main.categoria, attivo: true, NOT: { id: main.id } } })) as ProductRec[])
    : [];
  let shopifyByHandle: Record<string, { imageUrl: string | null; url: string }> = {};
  try {
    const prodotti = await fetchProductsWithMetafields();
    shopifyByHandle = Object.fromEntries(prodotti.map((p) => [p.handle, { imageUrl: p.imageUrl, url: p.url }]));
  } catch (err) {
    console.error("Shopify immagini prodotto non disponibili per le card:", err instanceof Error ? err.message : err);
  }
  return buildProductCards({ main, sameCategory, shopifyByHandle });
}

export function buildBlogDeps(): BlogDeps {
  return {
    loadContext: async (ideaId) => {
      const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
      if (!idea) throw new Error("Idea non trovata");
      if (idea.status !== "APPROVATA") throw new Error("Idea non approvata: genera solo da idee APPROVATA");
      const knowledge = await loadKnowledgeKbItems();
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

    persist: async ({ input, payload, claude }) => {
      const productCards = await resolveProductCards(input.ideaId);
      const enrichedPayload = { ...(payload as object), productCards };
      const content = await prisma.generatedContent.create({
        data: {
          ideaId: input.ideaId,
          canale: "BLOG",
          formato: "ARTICOLO",
          status: "BOZZA",
          payload: enrichedPayload as object,
          promptUsato: claude.promptUsato,
          modello: claude.modello,
          inputTokens: claude.inputTokens,
          outputTokens: claude.outputTokens,
          outputGrezzo: (claude.rawOutput ?? {}) as object,
        },
      });
      return { contentId: content.id };
    },
  };
}
