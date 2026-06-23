import { z } from "zod";
import { IDEA_CATEGORIES, PLATFORMS } from "./enums";

export const ideaDraftSchema = z.object({
  titolo: z.string().min(1),
  descrizione: z.string(),
  category: z.enum(IDEA_CATEGORIES),
  piattaformeConsigliate: z.array(z.enum(PLATFORMS)).min(1),
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
