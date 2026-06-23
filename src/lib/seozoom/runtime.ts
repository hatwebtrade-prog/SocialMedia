import { prisma } from "@/lib/prisma";
import { getClaude, BRAINSTORM_MODEL } from "@/lib/claude";
import { buildKbContext } from "@/lib/brain/context";
import { dedupeIdeas } from "@/lib/brain/dedupe";
import { fetchKeywords } from "./client";
import { buildShapingPrompt } from "./prompt";
import { shapingOutputSchema } from "./schema";
import { metricsToSeoScore } from "./score";
import type { NormalizedKeyword } from "./select";
import type { SeozoomDeps, ShapingResult } from "./discover";

export function matchCandidate(keyword: string, candidates: NormalizedKeyword[]): NormalizedKeyword | null {
  const target = keyword.trim().toLowerCase();
  return candidates.find((c) => c.keyword.trim().toLowerCase() === target) ?? null;
}

function stripFences(text: string): string {
  return text.replace(/^```\w*\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

export function buildSeozoomDeps(): SeozoomDeps {
  return {
    loadContext: async (input) => {
      const knowledge = await prisma.knowledgeItem.findMany();
      let seeds = (input.seeds ?? []).map((s) => s.trim()).filter(Boolean);
      let prodottoNome: string | undefined;
      let products: Awaited<ReturnType<typeof prisma.product.findMany>> = [];

      if (input.productId) {
        const product = await prisma.product.findUnique({ where: { id: input.productId } });
        if (product) {
          products = [product];
          prodottoNome = product.nome;
          if (seeds.length === 0) {
            seeds = [product.nome, product.categoria].filter((x): x is string => !!x);
          }
        }
      } else if (input.categoria && seeds.length === 0) {
        seeds = [input.categoria];
      }

      if (seeds.length === 0) throw new Error("Nessun seed: fornisci termini o un prodotto/categoria");
      const kbContext = buildKbContext({ products, knowledge });
      return { seeds, kbContext, prodottoNome };
    },

    fetchKeywords,

    callClaude: async ({ kbContext, prodottoNome, candidates }): Promise<ShapingResult> => {
      const prompt = buildShapingPrompt({ kbContext, prodottoNome, candidates });
      const claude = getClaude();
      const response = await claude.messages.create({
        model: BRAINSTORM_MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("Output AI non conforme");
      const parsed = shapingOutputSchema.parse(JSON.parse(stripFences(textBlock.text)));
      return {
        ideas: parsed.ideas,
        promptUsato: prompt,
        modello: BRAINSTORM_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        rawOutput: response.content,
      };
    },

    persist: async ({ input, candidates, claudeResult }) => {
      const source = await prisma.signalSource.findUniqueOrThrow({ where: { key: "seozoom" } });
      const existing = (await prisma.idea.findMany({ select: { titolo: true } })).map((i) => i.titolo);
      const fresh = dedupeIdeas(claudeResult.ideas, existing);

      return await prisma.$transaction(async (tx) => {
        const run = await tx.generationRun.create({
          data: {
            sourceId: source.id,
            input: input as object,
            promptUsato: claudeResult.promptUsato,
            modello: claudeResult.modello,
            inputTokens: claudeResult.inputTokens,
            outputTokens: claudeResult.outputTokens,
            outputGrezzo: (claudeResult.rawOutput ?? {}) as object,
            status: "DONE",
          },
        });
        if (fresh.length > 0) {
          await tx.idea.createMany({
            data: fresh.map((idea) => {
              const m = matchCandidate(idea.keyword, candidates);
              return {
                titolo: idea.titolo,
                descrizione: idea.descrizione,
                category: idea.category,
                piattaformeConsigliate: idea.piattaformeConsigliate,
                seoScore: m ? metricsToSeoScore({ volume: m.volume, difficolta: m.difficolta }) : 3,
                keyword: idea.keyword,
                volumeRicerca: m?.volume ?? null,
                difficolta: m?.difficolta ?? null,
                trendKeyword: m?.trend ?? null,
                sourceId: source.id,
                generationRunId: run.id,
              };
            }),
          });
        }
        return { runId: run.id, created: fresh.length };
      });
    },

    recordError: async (input, message) => {
      const source = await prisma.signalSource.findUniqueOrThrow({ where: { key: "seozoom" } });
      await prisma.generationRun.create({
        data: { sourceId: source.id, input: input as object, status: "ERROR", errore: message },
      });
    },
  };
}
