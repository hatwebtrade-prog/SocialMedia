import { z } from "zod";

export const blogArticleSchema = z.object({
  keywordPrincipale: z.string().min(1),
  keywordSecondarie: z.array(z.string()),
  intentoRicerca: z.string(),
  titoloSeo: z.string().min(1),
  metaDescription: z.string().min(1),
  puntiChiave: z.array(z.string()),
  corpoHtml: z.string().min(1),
  faq: z.array(z.object({ domanda: z.string().min(1), risposta: z.string().min(1) })),
  cta: z.string(),
  prodotti: z.array(z.object({ handle: z.string(), titolo: z.string(), url: z.string() })),
});

export type BlogArticle = z.infer<typeof blogArticleSchema>;
