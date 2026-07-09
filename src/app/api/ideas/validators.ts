import { z } from "zod";
import { IDEA_CATEGORIES, PLATFORMS, IDEA_STATUSES, DESTINAZIONI } from "@/lib/brain/enums";

export const manualIdeaSchema = z.object({
  titolo: z.string().min(1),
  descrizione: z.string().default(""),
  category: z.enum(IDEA_CATEGORIES),
  piattaformeConsigliate: z.array(z.enum(PLATFORMS)).default([]),
  seoScore: z.number().int().min(1).max(5).default(3),
  viralityScore: z.number().int().min(1).max(5).default(3),
  priority: z.number().int().min(1).max(5).default(3),
  status: z.enum(IDEA_STATUSES).default("NUOVA"),
  note: z.string().optional(),
  tags: z.array(z.string()).default([]),
  productId: z.string().optional(),
  destinazioni: z.array(z.enum(DESTINAZIONI)).default([]),
});

export const updateIdeaSchema = manualIdeaSchema.partial();

export const bulkStatusSchema = z.object({
  ids: z.array(z.string()).min(1),
  status: z.enum(IDEA_STATUSES),
});

export const bulkDestinazioniSchema = z.object({
  ids: z.array(z.string()).min(1),
  destinazioni: z.array(z.enum(DESTINAZIONI)),
});

export const bulkIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});
