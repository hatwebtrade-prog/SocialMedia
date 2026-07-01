import { toFile } from "openai";
import { getOpenAI, IMAGE_MODEL } from "../openai";

export async function openaiImage(prompt: string, mockup?: Buffer, opts?: { openaiSize?: string }): Promise<Buffer> {
  const client = getOpenAI();
  const size = (opts?.openaiSize ?? "1024x1024") as "1024x1024" | "1024x1536" | "1536x1024";
  if (mockup) {
    const file = await toFile(mockup, "mockup.png", { type: "image/png" });
    const res = await client.images.edit({ model: IMAGE_MODEL, image: file, prompt, size, quality: "high" });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI non ha restituito un'immagine (edit)");
    return Buffer.from(b64, "base64");
  }
  const res = await client.images.generate({ model: IMAGE_MODEL, prompt, size, quality: "high" });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI non ha restituito un'immagine");
  return Buffer.from(b64, "base64");
}
