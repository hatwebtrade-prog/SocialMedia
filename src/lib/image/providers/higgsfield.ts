const MODEL = process.env.HIGGSFIELD_IMAGE_MODEL ?? "higgsfield-ai/soul/standard";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 180000;

interface HiggsfieldJob {
  status?: string;
  status_url?: string;
  images?: { url?: string }[];
}

/** Higgsfield image generation (async): enqueue → poll status_url until completed → download the image.
 *  Auth: `Authorization: Key {key}:{secret}`. Mockup/image-to-image not yet supported. */
export async function higgsfieldImage(prompt: string, _mockup?: Buffer): Promise<Buffer> {
  const key = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET;
  if (!key || !secret) throw new Error("HIGGSFIELD_API_KEY/HIGGSFIELD_API_SECRET mancante");
  const auth = `Key ${key}:${secret}`;

  // 1. Enqueue the generation request.
  const res = await fetch(`https://platform.higgsfield.ai/${MODEL}`, {
    method: "POST",
    headers: { Authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({ prompt, aspect_ratio: "1:1", resolution: process.env.HIGGSFIELD_RESOLUTION ?? "1080p" }),
  });
  if (!res.ok) throw new Error(`Higgsfield HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  let job: HiggsfieldJob = await res.json().catch(() => ({}));

  // Some responses may already carry the image (defensive).
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

async function downloadImage(url: string): Promise<Buffer> {
  const img = await fetch(url);
  if (!img.ok) throw new Error(`Higgsfield: download immagine fallito (HTTP ${img.status})`);
  return Buffer.from(await img.arrayBuffer());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
