import { z } from "zod";

export const emailSchema = z.object({
  oggetto: z.string().min(1),
  preheader: z.string(),
  corpoHtml: z.string().min(1),
  cta: z.string(),
  prodotti: z.array(z.object({ handle: z.string(), titolo: z.string(), url: z.string() })),
  emailBlocks: z.object({
    productImages: z.array(z.string()),
    crossSell: z.array(z.object({ nome: z.string(), url: z.string(), imageUrl: z.string().nullable() })),
  }).optional(),
});

export type EmailPayload = z.infer<typeof emailSchema>;
