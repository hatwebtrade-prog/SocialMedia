import { z } from "zod";
import { CONTENT_FORMATS, CONTENT_STATUSES, META_PLATFORMS } from "@/lib/meta/enums";
import { IMAGE_PROVIDERS } from "@/lib/image/providers";

export const generateInputSchema = z.object({
  ideaId: z.string().min(1),
  formato: z.enum(CONTENT_FORMATS),
  piattaforme: z.array(z.enum(META_PLATFORMS)).min(1),
  numeroSlide: z.number().int().min(3).max(10).optional(),
});

export const updateContentSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  dataPrevista: z.string().datetime().nullable().optional(),
  piattaforme: z.array(z.enum(META_PLATFORMS)).optional(),
});

const briefSchema = z.object({
  soggetto: z.string().optional(),
  ambientazione: z.string().optional(),
  luce: z.string().optional(),
  inquadratura: z.string().optional(),
  mood: z.string().optional(),
  formato: z.enum(["verticale", "quadrato", "orizzontale"]).optional(),
  stile: z.string().optional(),
  tieneProdotto: z.boolean().optional(),
  note: z.string().optional(),
}).optional();

export const imageInputSchema = z.object({
  slideIndex: z.number().int().min(0).nullable().optional(),
  productId: z.string().optional(),
  useMockup: z.boolean().optional(),
  provider: z.enum(IMAGE_PROVIDERS).optional(),
  brief: briefSchema,
  styleId: z.string().optional(),
});
