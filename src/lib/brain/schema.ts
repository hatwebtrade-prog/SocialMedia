import { z } from "zod";
import { IDEA_CATEGORIES, PLATFORMS } from "./enums";

export const ideaDraftSchema = z.object({
  titolo: z.string().min(1),
  descrizione: z.string(),
  // Tolerant: if the model returns a category/platform outside the allowed set, coerce instead of
  // failing the whole batch. Unknown category → EDUCATIONAL; unknown platforms are dropped (min 1
  // enforced with a BLOG fallback).
  category: z.enum(IDEA_CATEGORIES).catch("EDUCATIONAL"),
  piattaformeConsigliate: z.preprocess(
    (v) => {
      const arr = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && (PLATFORMS as readonly string[]).includes(x)) : [];
      return arr.length ? arr : ["BLOG"];
    },
    z.array(z.enum(PLATFORMS)).min(1),
  ),
  seoScore: z.number().int().min(1).max(5),
  viralityScore: z.number().int().min(1).max(5),
  priority: z.number().int().min(1).max(5),
  prodottoCollegato: z.string().nullable(),
  motivazione: z.string(),
});

export const brainstormOutputSchema = z.object({
  ideas: z.array(ideaDraftSchema),
});

export type IdeaDraftOutput = z.infer<typeof ideaDraftSchema>;
export type BrainstormOutput = z.infer<typeof brainstormOutputSchema>;
