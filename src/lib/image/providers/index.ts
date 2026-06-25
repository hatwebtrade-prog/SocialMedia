import { openaiImage } from "./openai";
import { geminiImage } from "./gemini";
import { higgsfieldImage } from "./higgsfield";

export const IMAGE_PROVIDERS = ["GPT", "GEMINI", "HIGGSFIELD"] as const;
export type ImageProvider = (typeof IMAGE_PROVIDERS)[number];

export interface ProviderOpts { styleId?: string; soulSize?: string }

export function isImageProvider(v: string): v is ImageProvider {
  return (IMAGE_PROVIDERS as readonly string[]).includes(v);
}

export async function generateWithProvider(provider: ImageProvider, prompt: string, mockup?: Buffer, opts?: ProviderOpts): Promise<Buffer> {
  switch (provider) {
    case "GEMINI": return geminiImage(prompt, mockup);
    case "HIGGSFIELD": return higgsfieldImage(prompt, mockup, opts);
    default: return openaiImage(prompt, mockup);
  }
}
