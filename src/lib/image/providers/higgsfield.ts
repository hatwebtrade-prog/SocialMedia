const V1_SOUL = "https://platform.higgsfield.ai/v1/text2image/soul";
const DEFAULT_STYLE = process.env.HIGGSFIELD_DEFAULT_STYLE ?? "1cb4b936-77bf-4f9a-9039-f3d349a4cdbe"; // "Realistic"

interface HiggsfieldJob {
  status?: string;
  status_url?: string;
  images?: { url?: string }[];
}

export async function higgsfieldImage(prompt: string, mockup?: Buffer, opts?: { styleId?: string; soulSize?: string; customReferenceId?: string }): Promise<Buffer> {
  const key = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET;
  if (!key || !secret) throw new Error("HIGGSFIELD_API_KEY/HIGGSFIELD_API_SECRET mancante");
  const auth = `Key ${key}:${secret}`;

  const params: Record<string, unknown> = {
    prompt,
    width_and_height: opts?.soulSize ?? "1536x1536",
    style_id: opts?.styleId ?? DEFAULT_STYLE,
    quality: "1080p",
  };
  if (opts?.customReferenceId) {
    params.custom_reference_id = opts.customReferenceId;
    params.custom_reference_strength = 1;
  } else if (mockup) {
    const publicUrl = await uploadToHiggsfield(mockup, key, secret);
    params.input_images = [{ type: "image_url", image_url: publicUrl }];
  }

  const res = await fetch(V1_SOUL, {
    method: "POST",
    headers: { Authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({ params }),
  });
  if (!res.ok) throw new Error(`Higgsfield HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  let job: HiggsfieldJob = await res.json().catch(() => ({}));

  const immediate = job.images?.[0]?.url;
  if (job.status === "completed" && immediate) return downloadImage(immediate);
  const statusUrl = job.status_url;
  if (!statusUrl) throw new Error("Higgsfield: risposta senza status_url");

  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (job.status === "completed") {
      const u = job.images?.[0]?.url;
      if (!u) throw new Error("Higgsfield: completato ma nessuna immagine restituita");
      return downloadImage(u);
    }
    if (job.status === "failed" || job.status === "canceled" || job.status === "error" || job.status === "nsfw") {
      throw new Error(`Higgsfield: generazione ${job.status}`);
    }
    await sleep(3000);
    const st = await fetch(statusUrl, { headers: { Authorization: auth } });
    if (!st.ok) throw new Error(`Higgsfield status HTTP ${st.status}`);
    job = await st.json().catch(() => ({}));
  }
  throw new Error("Higgsfield: timeout — immagine non pronta entro il limite");
}

/** Uploads bytes to Higgsfield and returns the hosted public URL (exported for reuse). */
export async function uploadHiggsfieldImage(bytes: Buffer, key: string, secret: string): Promise<string> {
  return uploadToHiggsfield(bytes, key, secret);
}

/**
 * Creates a Higgsfield SoulId (custom reference) from a hosted image URL; polls until completed.
 * Returns id or null.
 */
export async function createSoulId(name: string, imageUrl: string, key: string, secret: string): Promise<string | null> {
  try {
    const res = await fetch("https://platform.higgsfield.ai/v1/custom-references", {
      method: "POST",
      headers: { "hf-api-key": key, "hf-secret": secret, "content-type": "application/json" },
      body: JSON.stringify({ name, input_images: [{ type: "image_url", image_url: imageUrl }] }),
    });
    if (!res.ok) return null;
    let data: { id?: string; status?: string } = await res.json().catch(() => ({}));
    const id = data.id;
    if (!id) return null;
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline && data.status !== "completed") {
      if (data.status === "failed") return null;
      await sleep(3000);
      const st = await fetch(`https://platform.higgsfield.ai/v1/custom-references/${id}`, { headers: { "hf-api-key": key, "hf-secret": secret } });
      if (!st.ok) break;
      data = await st.json().catch(() => ({}));
    }
    return data.status === "completed" ? id : null;
  } catch { return null; }
}

/** Uploads bytes to Higgsfield via a presigned S3 URL; returns the hosted public URL. */
async function uploadToHiggsfield(bytes: Buffer, key: string, secret: string): Promise<string> {
  const gen = await fetch("https://platform.higgsfield.ai/files/generate-upload-url", {
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
