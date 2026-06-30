import type { ProviderOpts } from "./index";

const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

interface Part { text?: string; inlineData?: { mimeType: string; data: string } }

export function aspectNote(openaiSize?: string): string {
  if (openaiSize === "1024x1536") return "Formato verticale 9:16.";
  if (openaiSize === "1536x1024") return "Formato orizzontale 16:9.";
  return "Formato quadrato 1:1.";
}

export async function geminiImage(prompt: string, mockup?: Buffer, opts?: ProviderOpts): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY mancante");
  const parts: Part[] = [{ text: `${aspectNote(opts?.openaiSize)} ${prompt}` }];
  if (mockup) parts.push({ inlineData: { mimeType: "image/png", data: mockup.toString("base64") } });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const json = await res.json();
  const outParts: Part[] = json?.candidates?.[0]?.content?.parts ?? [];
  const img = outParts.find((p) => p?.inlineData?.data);
  if (!img?.inlineData?.data) throw new Error("Gemini non ha restituito un'immagine");
  return Buffer.from(img.inlineData.data, "base64");
}
