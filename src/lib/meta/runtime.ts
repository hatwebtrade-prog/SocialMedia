import { prisma } from "@/lib/prisma";
import { getClaude, BRAINSTORM_MODEL } from "@/lib/claude";
import { buildKbContext } from "@/lib/brain/context";
import { buildMetaPrompt } from "./prompt";
import { payloadSchemaFor } from "./schema";
import type { MetaDeps, MetaClaudeResult } from "./generate";

export function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

export function buildMetaDeps(): MetaDeps {
  return {
    loadContext: async (ideaId: string) => {
      const idea = await prisma.idea.findUnique({
        where: { id: ideaId },
        include: { product: true },
      });
      if (!idea) throw new Error("Idea non trovata");
      if (idea.status !== "APPROVATA") throw new Error("Idea non approvata: genera solo da idee APPROVATA");

      const knowledge = await prisma.knowledgeItem.findMany();
      const products = idea.product ? [idea.product] : [];
      const kbContext = buildKbContext({ products, knowledge });
      return {
        idea: { titolo: idea.titolo, descrizione: idea.descrizione, category: String(idea.category) },
        kbContext,
      };
    },

    callClaude: async ({ idea, kbContext, input }): Promise<MetaClaudeResult> => {
      const prompt = buildMetaPrompt({
        kbContext,
        idea,
        formato: input.formato,
        piattaforme: input.piattaforme,
        numeroSlide: input.numeroSlide,
      });
      const claude = getClaude();
      const response = await claude.messages.create({
        model: BRAINSTORM_MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Output AI non conforme");
      }
      const raw = JSON.parse(stripFences(textBlock.text));
      // Cast to "POST" to satisfy overload union; schema chosen at runtime by the function body
      const schema =
        input.formato === "CAROSELLO"
          ? payloadSchemaFor("CAROSELLO")
          : payloadSchemaFor("POST");
      const payload = schema.parse(raw) as object;
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
          canale: "META",
          formato: input.formato,
          piattaforme: input.piattaforme,
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
