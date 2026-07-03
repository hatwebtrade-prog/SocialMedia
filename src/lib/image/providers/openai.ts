import { toFile } from "openai";
import { getOpenAI, IMAGE_MODEL } from "../openai";

// Steers gpt-image away from false-positive [sexual] safety rejections (e.g. tanning/beach + people).
const SAFETY_SUFFIX =
  " The image must be tasteful, professional and family-friendly: no sexual, suggestive or explicit content, " +
  "no nudity, appropriate modest clothing, wholesome wellness context.";

export async function openaiImage(prompt: string, mockup?: Buffer, opts?: { openaiSize?: string }): Promise<Buffer> {
  const client = getOpenAI();
  const size = (opts?.openaiSize ?? "1024x1024") as "1024x1024" | "1024x1536" | "1536x1024";
  const safePrompt = `${prompt}${SAFETY_SUFFIX}`;
  // moderation: "low" reduces gpt-image false-positive refusals; cast because SDK types may lag.
  const extra = { moderation: "low" } as Record<string, unknown>;
  if (mockup) {
    const file = await toFile(mockup, "mockup.png", { type: "image/png" });
    const res = await client.images.edit({ model: IMAGE_MODEL, image: file, prompt: safePrompt, size, quality: "high", ...extra });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI non ha restituito un'immagine (edit)");
    return Buffer.from(b64, "base64");
  }
  const res = await client.images.generate({ model: IMAGE_MODEL, prompt: safePrompt, size, quality: "high", ...extra });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI non ha restituito un'immagine");
  return Buffer.from(b64, "base64");
}
