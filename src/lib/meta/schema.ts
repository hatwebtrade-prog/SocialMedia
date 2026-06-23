import { z } from "zod";
import type { ContentFormatValue } from "./enums";

export const postPayloadSchema = z.object({
  caption: z.string().min(1),
  ideaCreativa: z.string().min(1),
  hashtags: z.array(z.string()),
  cta: z.string(),
});

export const caroselloPayloadSchema = postPayloadSchema.extend({
  slides: z.array(z.object({ testo: z.string().min(1) })).min(3).max(10),
});

export function payloadSchemaFor(formato: "CAROSELLO"): typeof caroselloPayloadSchema;
export function payloadSchemaFor(formato: "POST"): typeof postPayloadSchema;
export function payloadSchemaFor(formato: ContentFormatValue) {
  return formato === "CAROSELLO" ? caroselloPayloadSchema : postPayloadSchema;
}

export type PostPayload = z.infer<typeof postPayloadSchema>;
export type CaroselloPayload = z.infer<typeof caroselloPayloadSchema>;
