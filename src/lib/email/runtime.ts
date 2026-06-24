import { prisma } from "@/lib/prisma";
import { getClaude, BRAINSTORM_MODEL } from "@/lib/claude";
import { buildKbContext } from "@/lib/brain/context";
import { stripFences } from "@/lib/meta/runtime";
import { fetchProductsWithMetafields } from "@/lib/shopify/products";
import { buildEmailPrompt, type EmailIdea } from "./prompt";
import { emailSchema } from "./schema";
import type { EmailDeps, EmailClaudeResult } from "./generate";

export function buildEmailDeps(): EmailDeps {
  return {
    loadContext: async (input) => {
      const idea = await prisma.idea.findUnique({ where: { id: input.ideaId } });
      if (!idea) throw new Error("Idea non trovata");
      if (idea.status !== "APPROVATA") throw new Error("Idea non approvata: genera solo da idee APPROVATA");
      const knowledge = await prisma.knowledgeItem.findMany();
      const product = idea.productId ? await prisma.product.findUnique({ where: { id: idea.productId } }) : null;
      const kbContext = buildKbContext({ products: product ? [product] : [], knowledge });

      let prodotti = [] as Awaited<ReturnType<typeof fetchProductsWithMetafields>>;
      if (input.formato === "PROMO_EMAIL") {
        try {
          prodotti = await fetchProductsWithMetafields();
        } catch (err) {
          console.error("Shopify prodotti non disponibili per email promo, genero senza prodotti:", err instanceof Error ? err.message : err);
        }
      }
      const emailIdea: EmailIdea = { titolo: idea.titolo, descrizione: idea.descrizione, category: String(idea.category) };
      return { idea: emailIdea, kbContext, prodotti };
    },

    callClaude: async ({ idea, kbContext, formato, prodotti }): Promise<EmailClaudeResult> => {
      const prompt = buildEmailPrompt({ kbContext, idea, formato, prodotti });
      const claude = getClaude();
      const response = await claude.messages.create({
        model: BRAINSTORM_MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("Output AI non conforme");
      const payload = emailSchema.parse(JSON.parse(stripFences(textBlock.text)));
      return {
        payload,
        promptUsato: prompt,
        modello: BRAINSTORM_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        rawOutput: response.content,
      };
    },

    persist: async ({ input, result }) => {
      const content = await prisma.generatedContent.create({
        data: {
          ideaId: input.ideaId,
          canale: "EMAIL",
          formato: input.formato as never,
          status: "BOZZA",
          payload: result.payload as object,
          promptUsato: result.promptUsato,
          modello: result.modello,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          outputGrezzo: (result.rawOutput ?? {}) as object,
        },
      });
      return { contentId: content.id };
    },
  };
}
