import { z } from "zod";

export const editorialDirectionSchema = z.object({
  campagna: z.string().nullish(),
  periodo: z.string().nullish(),
  temi: z.string().nullish(),
  tonoVisivo: z.string().nullish(),
  daMostrare: z.string().nullish(),
  daEvitare: z.string().nullish(),
});
export type EditorialDirectionInput = z.infer<typeof editorialDirectionSchema>;
