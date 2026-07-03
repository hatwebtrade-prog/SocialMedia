import { uploadHiggsfieldImage } from "./higgsfield";

const V1_DOP = "https://platform.higgsfield.ai/v1/image2video/dop";
const HF_STATUS = (id: string) => `https://platform.higgsfield.ai/requests/${id}/status`;

interface JobResult {
  status?: string;
  video?: { url?: string };
  results?: { raw?: { url?: string }; min?: { url?: string } };
}
interface VideoJob extends JobResult {
  id?: string;
  status_url?: string;
  jobs?: JobResult[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Status can be top-level or nested in jobs[0] depending on the endpoint. */
function jobStatus(j: VideoJob): string | undefined {
  return j.status ?? j.jobs?.[0]?.status;
}
/** The finished video URL, from any of the shapes Higgsfield returns. */
function jobVideoUrl(j: VideoJob): string | undefined {
  const from = (r?: JobResult) => r?.video?.url ?? r?.results?.raw?.url ?? r?.results?.min?.url;
  return from(j) ?? from(j.jobs?.[0]);
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

  if (jobStatus(job) === "completed") {
    const u = jobVideoUrl(job);
    if (u) return downloadVideo(u);
  }

  const statusUrl = job.status_url ?? (job.id ? HF_STATUS(job.id) : null);
  if (!statusUrl) throw new Error(`Higgsfield video: risposta senza id/status_url: ${JSON.stringify(job).slice(0, 400)}`);

  const deadline = Date.now() + (opts?.deadlineMs ?? 300000);
  while (Date.now() < deadline) {
    const status = jobStatus(job);
    if (status === "completed") {
      const u = jobVideoUrl(job);
      if (!u) throw new Error(`Higgsfield video: completato ma nessun url video: ${JSON.stringify(job).slice(0, 400)}`);
      return downloadVideo(u);
    }
    if (["failed", "canceled", "error", "nsfw"].includes(status ?? "")) {
      throw new Error(`Higgsfield video: generazione ${status}`);
    }
    await sleep(3000);
    const st = await fetch(statusUrl, { headers: { Authorization: auth } });
    if (!st.ok) throw new Error(`Higgsfield video status HTTP ${st.status}`);
    job = await st.json().catch(() => ({}));
  }
  throw new Error(`Higgsfield video: timeout (ultimo stato: ${JSON.stringify(job).slice(0, 400)})`);
}

async function downloadVideo(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Higgsfield video: download fallito (HTTP ${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}
