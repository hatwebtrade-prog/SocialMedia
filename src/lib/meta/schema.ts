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

export const reelPayloadSchema = postPayloadSchema.extend({
  hook: z.string().min(1),
  scriptParlato: z.string().min(1),
  testoSchermo: z.array(z.string()),
});

export const storyPayloadSchema = z.object({
  ideaCreativa: z.string().min(1),
  testo: z.string().min(1),
  cta: z.string(),
});

export function payloadSchemaFor(formato: "CAROSELLO"): typeof caroselloPayloadSchema;
export function payloadSchemaFor(formato: "REEL"): typeof reelPayloadSchema;
export function payloadSchemaFor(formato: "STORY"): typeof storyPayloadSchema;
export function payloadSchemaFor(formato: "POST"): typeof postPayloadSchema;
export function payloadSchemaFor(formato: ContentFormatValue): z.ZodTypeAny;
export function payloadSchemaFor(formato: ContentFormatValue): z.ZodTypeAny {
  switch (formato) {
    case "CAROSELLO": return caroselloPayloadSchema;
    case "REEL": return reelPayloadSchema;
    case "STORY": return storyPayloadSchema;
    default: return postPayloadSchema;
  }
}

export type PostPayload = z.infer<typeof postPayloadSchema>;
export type CaroselloPayload = z.infer<typeof caroselloPayloadSchema>;
export type ReelPayload = z.infer<typeof reelPayloadSchema>;
export type StoryPayload = z.infer<typeof storyPayloadSchema>;
