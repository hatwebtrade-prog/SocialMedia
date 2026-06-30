import { prisma } from "@/lib/prisma";
import { getClaude, BRAINSTORM_MODEL } from "@/lib/claude";
import { buildKbContext } from "./context";
import { loadKnowledgeKbItems } from "@/lib/knowledge/items";
import { buildBrainstormPrompt, type BrainstormInput } from "./prompt";
import { brainstormOutputSchema } from "./schema";
import type { BrainstormDeps, ClaudeResult, PersistArgs } from "./generate";


export function linkProductId(
  nome: string | null,
  products: Array<{ id: string; nome: string }>,
): string | null {
  if (!nome) return null;
  const target = nome.trim().toLowerCase();
  const match = products.find((p) => p.nome?.trim().toLowerCase() === target);
  return match ? match.id : null;
}

export function buildRuntimeDeps(): BrainstormDeps {
  return {
    sourceKey: "ai-brainstorming",

    loadKb: async () => {
      const [products, knowledge] = await Promise.all([
        prisma.product.findMany({ where: { attivo: true } }),
        loadKnowledgeKbItems(),
      ]);
      return { products, knowledge };
    },

    loadExistingTitles: async () => {
      const ideas = await prisma.idea.findMany({ select: { titolo: true } });
      return ideas.map((i) => i.titolo);
    },

    callClaude: async ({ kb, input }): Promise<ClaudeResult> => {
      const kbContext = buildKbContext({
        products: kb.products,
        knowledge: kb.knowledge,
      });
      const basePrompt = buildBrainstormPrompt({ kbContext, input });
      const prompt =
        basePrompt +
        '\n\nRispondi esclusivamente con un oggetto JSON valido della forma {"ideas":[...]}, senza testo prima o dopo, senza markdown.';
      const claude = getClaude();
      const response = await claude.messages.create({
        model: BRAINSTORM_MODEL,
        max_tokens: 16000,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Output AI non conforme allo schema");
      }
      // Strip any markdown code fences the model may have added despite instructions
      const rawText = textBlock.text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      const raw = JSON.parse(rawText);
      const parsed = brainstormOutputSchema.parse(raw);
      return {
        parsed: parsed as ClaudeResult["parsed"],
        promptUsato: prompt,
        modello: BRAINSTORM_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        rawOutput: response.content,
      };
    },

    persist: async (args: PersistArgs) => {
      const [source, products] = await Promise.all([
        prisma.signalSource.findUniqueOrThrow({ where: { key: args.sourceKey } }),
        prisma.product.findMany({
          where: { attivo: true },
          select: { id: true, nome: true },
        }),
      ]);

      const runId = await prisma.$transaction(async (tx) => {
        const run = await tx.generationRun.create({
          data: {
            sourceId: source.id,
            input: args.input as object,
            promptUsato: args.promptUsato,
            modello: args.modello,
            inputTokens: args.inputTokens,
            outputTokens: args.outputTokens,
            outputGrezzo: (args.rawOutput ?? {}) as object,
            status: args.status,
            errore: args.errore,
          },
        });

        if (args.ideas.length > 0) {
          await tx.idea.createMany({
            data: args.ideas.map((d) => ({
              titolo: d.titolo,
              descrizione: d.descrizione,
              category: d.category,
              piattaformeConsigliate: d.piattaformeConsigliate,
              seoScore: d.seoScore,
              viralityScore: d.viralityScore,
              priority: d.priority,
              destinazioni: args.input.destinazioni ?? [],
              productId: linkProductId(d.prodottoCollegato, products),
              sourceId: source.id,
              generationRunId: run.id,
            })),
          });
        }

        return run.id;
      });

      return { runId, ideas: args.ideas };
    },
  };
}
