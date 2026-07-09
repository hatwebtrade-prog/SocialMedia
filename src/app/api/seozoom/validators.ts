import { z } from "zod";

export const discoverInputSchema = z
  .object({
    seeds: z.array(z.string().min(1)).optional(),
    productId: z.string().min(1).optional(),
    categoria: z.string().min(1).optional(),
    topN: z.number().int().min(1).max(30).optional(),
  })
  .refine(
    (v) => (v.seeds && v.seeds.length > 0) || !!v.productId || !!v.categoria,
    { message: "Fornisci almeno un seed, oppure un prodotto/categoria" },
  );
