import { uploadHiggsfieldImage } from "./higgsfield";

const V1_DOP = "https://platform.higgsfield.ai/v1/image2video/dop";
const HF_STATUS = (id: string) => `https://platform.higgsfield.ai/requests/${id}/status`;

interface VideoJob {
  id?: string;
  status?: string;
  status_url?: string;
  video?: { url?: string };
  results?: { raw?: { url?: string }; min?: { url?: string } };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Higgsfield Image→Video (DoP). Animates a still image into an mp4 driven by `prompt`. */
export async function higgsfieldVideo(
  imageBuf: Buffer,
  prompt: string,
  opts?: { model?: string; deadlineMs?: number },
): Promise<Buffer> {
  const key = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET;
  if (!key || !secret) throw new Error("HIGGSFIELD_API_KEY/HIGGSFIELD_API_SECRET mancante");
  const auth = `Key ${key}:${secret}`;

  const imageUrl = await uploadHiggsfieldImage(imageBuf, key, secret);

  // `{ params: {...} }` envelope confirmed live (422 validated body.params.*). model enum:
  // dop-lite | dop-preview | dop-turbo.
  const body = {
    params: {
      model: opts?.model ?? "dop-turbo", // valid: dop-lite | dop-preview | dop-turbo
      prompt,
      input_images: [{ type: "image_url", image_url: imageUrl }],
    },
  };
  const res = await fetch(V1_DOP, {
    method: "POST",
    headers: { Authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Higgsfield video HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  let job: VideoJob = await res.json().catch(() => ({}));

  const url0 = job.video?.url ?? job.results?.raw?.url ?? job.results?.min?.url;
  if (job.status === "completed" && url0) return downloadVideo(url0);

  const statusUrl = job.status_url ?? (job.id ? HF_STATUS(job.id) : null);
  if (!statusUrl) throw new Error("Higgsfield video: risposta senza id/status_url");

  const deadline = Date.now() + (opts?.deadlineMs ?? 300000);
  while (Date.now() < deadline) {
    if (job.status === "completed") {
      const u = job.video?.url ?? job.results?.raw?.url ?? job.results?.min?.url;
      if (!u) throw new Error("Higgsfield video: completato ma nessun video restituito");
      return downloadVideo(u);
    }
    if (["failed", "canceled", "error", "nsfw"].includes(job.status ?? "")) {
      throw new Error(`Higgsfield video: generazione ${job.status}`);
    }
    await sleep(3000);
    const st = await fetch(statusUrl, { headers: { Authorization: auth } });
    if (!st.ok) throw new Error(`Higgsfield video status HTTP ${st.status}`);
    job = await st.json().catch(() => ({}));
  }
  throw new Error("Higgsfield video: timeout");
}

async function downloadVideo(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Higgsfield video: download fallito (HTTP ${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}
