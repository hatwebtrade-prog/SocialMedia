const MODEL = process.env.HIGGSFIELD_IMAGE_MODEL ?? "higgsfield-ai/soul/standard";

export async function higgsfieldImage(prompt: string, _mockup?: Buffer): Promise<Buffer> {
  const key = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET;
  if (!key || !secret) throw new Error("HIGGSFIELD_API_KEY/HIGGSFIELD_API_SECRET mancante");
  const res = await fetch(`https://platform.higgsfield.ai/${MODEL}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}:${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt, aspect_ratio: "1:1", resolution: process.env.HIGGSFIELD_RESOLUTION ?? "1080p" }),
  });
  if (!res.ok) throw new Error(`Higgsfield HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const json: Record<string, unknown> = await res.json().catch(() => ({}));
  const url = pickUrl(json);
  if (url) {
    const img = await fetch(url);
    if (!img.ok) throw new Error(`Higgsfield: download immagine fallito (HTTP ${img.status})`);
    return Buffer.from(await img.arrayBuffer());
  }
  const b64 = pickB64(json);
  if (b64) return Buffer.from(b64, "base64");
  throw new Error("Higgsfield: risposta non riconosciuta (probabile job asincrono — integrazione da finalizzare con credito)");
}

function pickUrl(j: Record<string, unknown>): string | null {
  const cands = [j.url, j.image_url, (j.data as Record<string, unknown>[] | undefined)?.[0]?.url, (j.images as Record<string, unknown>[] | undefined)?.[0]?.url];
  return cands.find((c): c is string => typeof c === "string") ?? null;
}
function pickB64(j: Record<string, unknown>): string | null {
  const cands = [j.b64_json, j.image_base64, (j.data as Record<string, unknown>[] | undefined)?.[0]?.b64_json];
  return cands.find((c): c is string => typeof c === "string") ?? null;
}
