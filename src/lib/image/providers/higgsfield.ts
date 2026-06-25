const BASE = "https://platform.higgsfield.ai";
const TEXT_MODEL = process.env.HIGGSFIELD_IMAGE_MODEL ?? "higgsfield-ai/soul/standard";
const REF_MODEL = process.env.HIGGSFIELD_REF_MODEL ?? "higgsfield-ai/soul/reference";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 180000;

interface HiggsfieldJob {
  status?: string;
  status_url?: string;
  images?: { url?: string }[];
}

/** Higgsfield image generation (async). Without a mockup → soul/standard (text-to-image).
 *  With a mockup → upload it (presigned S3) and use soul/reference image-to-image guided by the product.
 *  Auth: `Authorization: Key {key}:{secret}` (upload uses `hf-api-key`/`hf-secret`). */
export async function higgsfieldImage(prompt: string, mockup?: Buffer): Promise<Buffer> {
  const key = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET;
  if (!key || !secret) throw new Error("HIGGSFIELD_API_KEY/HIGGSFIELD_API_SECRET mancante");
  const auth = `Key ${key}:${secret}`;

  let model = TEXT_MODEL;
  const body: Record<string, unknown> = {
    prompt,
    aspect_ratio: "1:1",
    resolution: process.env.HIGGSFIELD_RESOLUTION ?? "1080p",
  };
  if (mockup) {
    const publicUrl = await uploadToHiggsfield(mockup, key, secret);
    model = REF_MODEL;
    body.input_images = [{ type: "image_url", image_url: publicUrl }];
  }

  // 1. Enqueue the generation request.
  const res = await fetch(`${BASE}/${model}`, {
    method: "POST",
    headers: { Authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Higgsfield HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  let job: HiggsfieldJob = await res.json().catch(() => ({}));

  const immediate = job.images?.[0]?.url;
  if (job.status === "completed" && immediate) return downloadImage(immediate);

  const statusUrl = job.status_url;
  if (!statusUrl) throw new Error("Higgsfield: risposta senza status_url");

  // 2. Poll until completed / failed / timeout.
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (job.status === "completed") {
      const url = job.images?.[0]?.url;
      if (!url) throw new Error("Higgsfield: completato ma nessuna immagine restituita");
      return downloadImage(url);
    }
    if (job.status === "failed" || job.status === "canceled" || job.status === "error") {
      throw new Error(`Higgsfield: generazione ${job.status}`);
    }
    await sleep(POLL_INTERVAL_MS);
    const st = await fetch(statusUrl, { headers: { Authorization: auth } });
    if (!st.ok) throw new Error(`Higgsfield status HTTP ${st.status}`);
    job = await st.json().catch(() => ({}));
  }
  throw new Error("Higgsfield: timeout — immagine non pronta entro il limite");
}

/** Uploads bytes to Higgsfield via a presigned S3 URL; returns the hosted public URL. */
async function uploadToHiggsfield(bytes: Buffer, key: string, secret: string): Promise<string> {
  const gen = await fetch(`${BASE}/files/generate-upload-url`, {
    method: "POST",
    headers: { "hf-api-key": key, "hf-secret": secret, "content-type": "application/json" },
    body: JSON.stringify({ content_type: "image/png" }),
  });
  if (!gen.ok) throw new Error(`Higgsfield upload-url HTTP ${gen.status}`);
  const data: { upload_url?: string; public_url?: string } = await gen.json().catch(() => ({}));
  if (!data.upload_url || !data.public_url) throw new Error("Higgsfield: risposta upload-url incompleta");
  const put = await fetch(data.upload_url, {
    method: "PUT",
    headers: { "content-type": "image/png" },
    body: new Uint8Array(bytes),
  });
  if (!put.ok) throw new Error(`Higgsfield upload PUT HTTP ${put.status}`);
  return data.public_url;
}

async function downloadImage(url: string): Promise<Buffer> {
  const img = await fetch(url);
  if (!img.ok) throw new Error(`Higgsfield: download immagine fallito (HTTP ${img.status})`);
  return Buffer.from(await img.arrayBuffer());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SoulStyle { id: string; name: string; previewUrl: string | null }

export function normalizeSoulStyles(raw: unknown): SoulStyle[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { items?: unknown })?.items)
      ? (raw as { items: unknown[] }).items
      : [];
  return (arr as Record<string, unknown>[])
    .filter((s) => s && typeof s.id === "string" && typeof s.name === "string")
    .map((s) => ({ id: s.id as string, name: s.name as string, previewUrl: typeof s.preview_url === "string" ? (s.preview_url as string) : null }));
}

let stylesCache: SoulStyle[] | null = null;

export async function listSoulStyles(): Promise<SoulStyle[]> {
  if (stylesCache) return stylesCache;
  const key = process.env.HIGGSFIELD_API_KEY, secret = process.env.HIGGSFIELD_API_SECRET;
  if (!key || !secret) return [];
  try {
    const res = await fetch("https://platform.higgsfield.ai/v1/text2image/soul-styles", { headers: { "hf-api-key": key, "hf-secret": secret } });
    if (!res.ok) return [];
    const styles = normalizeSoulStyles(await res.json());
    if (styles.length) stylesCache = styles;
    return styles;
  } catch {
    return [];
  }
}
