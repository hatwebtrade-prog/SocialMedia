import { z } from "zod";
import { IDEA_CATEGORIES, PLATFORMS } from "@/lib/brain/enums";

export const shapedIdeaSchema = z.object({
  keyword: z.string().min(1),
  titolo: z.string().min(1),
  descrizione: z.string(),
  category: z.enum(IDEA_CATEGORIES),
  piattaformeConsigliate: z.array(z.enum(PLATFORMS)).min(1),
  motivazione: z.string(),
});

export const shapingOutputSchema = z.object({
  ideas: z.array(shapedIdeaSchema),
});

export type ShapedIdea = z.infer<typeof shapedIdeaSchema>;
export type ShapingOutput = z.infer<typeof shapingOutputSchema>;
