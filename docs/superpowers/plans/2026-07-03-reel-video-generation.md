# Generazione Video Reel (Image→Video) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Generare un video Reel animando l'immagine del contenuto via Higgsfield Image→Video (`/v1/image2video/dop`), con salvataggio mp4, serving corretto e UI "Genera video".

**Architecture:** Provider Higgsfield video (upload immagine → submit dop → poll → download mp4) + orchestratore puro con deps + runtime Prisma/store + rotta Meta + fix content-type serving + UI player/pulsante. Sincrono con polling (come la generazione immagine attuale).

**Tech Stack:** Next.js 15, TypeScript, Prisma, sharp, Vitest (solo funzioni pure/orchestratore con deps mock).

## Global Constraints
- Solo canale Meta; v1 = **solo generazione + salvataggio + player** (nessuna pubblicazione Reel).
- Provider = Higgsfield `/v1/image2video/dop`, auth generate `Authorization: Key KEY:SECRET`, upload
  con header `hf-api-key`/`hf-secret`, poll `https://platform.higgsfield.ai/requests/{id}/status`.
- Il video anima l'**immagine già generata** del contenuto; se manca → errore "genera prima l'immagine".
- Asset video: `tipo = VIDEO`, file `.mp4` sotto `uploads/<contentId>/<assetId>.mp4`.
- `path` di `GeneratedAsset` è NON nullable: salva il file prima, poi crea l'asset con il path.
- Nessun unit test su network/route/componenti (convenzione progetto): `npx tsc --noEmit` + `npm run build`.
- NON eseguire `npm run build` mentre `next dev` è attivo (corrompe `.next`).

---

### Task 1: Prompt di movimento video (puro)

**Files:** Create `src/lib/video/video-prompt.ts`, `src/lib/video/video-prompt.test.ts`

**Interfaces:** Produces `buildVideoPrompt(input: { hook?: string|null; scriptParlato?: string|null; testoSchermo?: string[]|null; ideaCreativa?: string|null }): string`

- [ ] **Step 1: Failing test** `src/lib/video/video-prompt.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { buildVideoPrompt } from "@/lib/video/video-prompt";

describe("buildVideoPrompt", () => {
  it("combines reel fields and adds a soft cinematic motion note", () => {
    const p = buildVideoPrompt({ hook: "Capelli più forti", scriptParlato: "Scopri la biotina", testoSchermo: ["3 benefici"] });
    expect(p).toContain("Capelli più forti");
    expect(p).toContain("Scopri la biotina");
    expect(p).toContain("3 benefici");
    expect(p.toLowerCase()).toContain("movimento di camera");
  });
  it("falls back to ideaCreativa and is never empty", () => {
    const p = buildVideoPrompt({ ideaCreativa: "prodotto in scena naturale" });
    expect(p).toContain("prodotto in scena naturale");
    expect(p.trim().length).toBeGreaterThan(0);
  });
});
```
- [ ] **Step 2: Run → fails** `npx vitest run src/lib/video/video-prompt.test.ts`
- [ ] **Step 3: Implement** `src/lib/video/video-prompt.ts`
```ts
export interface VideoPromptInput {
  hook?: string | null;
  scriptParlato?: string | null;
  testoSchermo?: string[] | null;
  ideaCreativa?: string | null;
}

/** Builds an image→video MOTION prompt from a reel's script; the still image drives the content. */
export function buildVideoPrompt(input: VideoPromptInput): string {
  const parts = [
    input.hook?.trim(),
    input.scriptParlato?.trim(),
    (input.testoSchermo ?? []).map((t) => t.trim()).filter(Boolean).join(". "),
  ].filter((s): s is string => !!s && s.length > 0);
  const base = parts.length ? parts.join(". ") : (input.ideaCreativa ?? "").trim();
  const motion =
    "Movimento di camera fluido, naturale e premium; leggero parallasse e vita nella scena. " +
    "Il prodotto resta fedele e riconoscibile. Nessun testo o logo aggiuntivo generato nel video.";
  return `${base ? `${base}. ` : ""}${motion}`.trim();
}
```
- [ ] **Step 4: Run → passes** `npx vitest run src/lib/video/video-prompt.test.ts` ; then `npx tsc --noEmit`
- [ ] **Step 5: Commit** `git add src/lib/video/video-prompt.ts src/lib/video/video-prompt.test.ts && git commit -m "feat(video): reel motion prompt builder"`

---

### Task 2: Store video + serving content-type

**Files:** Modify `src/lib/image/store.ts` ; Modify `src/app/api/assets/[id]/route.ts`

**Interfaces:** Produces `saveVideoAssetFile(contentId: string, assetId: string, bytes: Buffer): string` (repo-relative POSIX path to the `.mp4`).

- [ ] **Step 1: Add `saveVideoAssetFile`** to `src/lib/image/store.ts` (mirror `saveAssetFile`, `.mp4` extension). Append after `saveAssetFile`:
```ts
/** Writes MP4 bytes to uploads/<contentId>/<assetId>.mp4 and returns the repo-relative POSIX path. */
export function saveVideoAssetFile(contentId: string, assetId: string, bytes: Buffer): string {
  const dir = path.join(UPLOADS_DIR, contentId);
  mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, `${assetId}.mp4`);
  writeFileSync(abs, bytes);
  return path.relative(process.cwd(), abs).replace(/\\/g, "/");
}
```
- [ ] **Step 2: Fix content-type** in `src/app/api/assets/[id]/route.ts`. Replace the final `return new NextResponse(...)` block so the content-type derives from the path extension:
```ts
  const lower = asset.path.toLowerCase();
  const contentType = lower.endsWith(".mp4")
    ? "video/mp4"
    : lower.endsWith(".webm")
      ? "video/webm"
      : "image/png";
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: { "content-type": contentType, "cache-control": "private, max-age=60" },
  });
```
- [ ] **Step 3: Verify** `npx tsc --noEmit` (exit 0).
- [ ] **Step 4: Commit** `git add src/lib/image/store.ts "src/app/api/assets/[id]/route.ts" && git commit -m "feat(video): store mp4 assets + serve correct content-type by extension"`

---

### Task 3: Provider Higgsfield Image→Video

**Files:** Create `src/lib/image/providers/higgsfield-video.ts`

**Interfaces:** Consumes `uploadHiggsfieldImage(bytes, key, secret)` (exported from `./higgsfield`). Produces `higgsfieldVideo(imageBuf: Buffer, prompt: string, opts?: { model?: string; deadlineMs?: number }): Promise<Buffer>` (mp4 bytes).

**Note (live-verify):** the exact DoP request body wrapper (`{ params: {...} }` vs flat) and the `model`
value ("turbo" vs a full model id) must be confirmed against the live API on first real generation —
the image endpoint uses `{ params: {...} }`, mirror that; if the API rejects it, try a flat body. Leave
a comment saying so. This provider has NO unit test (network).

- [ ] **Step 1: Implement** `src/lib/image/providers/higgsfield-video.ts`
```ts
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

  // Mirror the image endpoint's `{ params: {...} }` envelope. If the DoP API rejects it, a flat body
  // (the params object at the top level) is the fallback to try during live verification.
  const body = {
    params: {
      model: opts?.model ?? "turbo",
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
    job = await st.json().catch(() => ({}));
  }
  throw new Error("Higgsfield video: timeout");
}

async function downloadVideo(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Higgsfield video: download fallito (HTTP ${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}
```
- [ ] **Step 2: Verify** `npx tsc --noEmit` (exit 0).
- [ ] **Step 3: Commit** `git add src/lib/image/providers/higgsfield-video.ts && git commit -m "feat(video): Higgsfield image2video (DoP) provider"`

---

### Task 4: Orchestratore generateVideoAsset (puro + test)

**Files:** Create `src/lib/video/generate.ts`, `src/lib/video/generate.test.ts`

**Interfaces:** Consumes `buildVideoPrompt` (T1). Produces:
`generateVideoAsset(input: VideoGenInput, deps: VideoDeps): Promise<VideoGenResult>` with
`VideoGenInput = { contentId: string; slideIndex: number|null; prompt?: string }`,
`VideoDeps = { loadStartImage: (c,s)=>Promise<Buffer|null>; loadReel: (c)=>Promise<VideoPromptInput>; callVideo: (img,prompt)=>Promise<Buffer>; persistVideo: (a:{input:VideoGenInput;prompt:string;bytes:Buffer})=>Promise<{assetId:string}> }`,
`VideoGenResult = { status: "DONE"|"ERROR"; assetId?: string; error?: string }`.

- [ ] **Step 1: Failing test** `src/lib/video/generate.test.ts`
```ts
import { describe, it, expect, vi } from "vitest";
import { generateVideoAsset } from "@/lib/video/generate";

function makeDeps(over = {}) {
  return {
    loadStartImage: vi.fn().mockResolvedValue(Buffer.from("img")),
    loadReel: vi.fn().mockResolvedValue({ hook: "H", scriptParlato: "S" }),
    callVideo: vi.fn().mockResolvedValue(Buffer.from("mp4")),
    persistVideo: vi.fn().mockResolvedValue({ assetId: "v1" }),
    ...over,
  };
}

describe("generateVideoAsset", () => {
  it("returns DONE and persists when the start image exists", async () => {
    const deps = makeDeps();
    const res = await generateVideoAsset({ contentId: "c1", slideIndex: null }, deps as any);
    expect(res).toEqual({ status: "DONE", assetId: "v1" });
    const promptArg = (deps.callVideo as any).mock.calls[0][1] as string;
    expect(promptArg).toContain("H");
  });
  it("returns ERROR and persists nothing when there is no start image", async () => {
    const deps = makeDeps({ loadStartImage: vi.fn().mockResolvedValue(null) });
    const res = await generateVideoAsset({ contentId: "c1", slideIndex: null }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(deps.persistVideo).not.toHaveBeenCalled();
  });
  it("returns ERROR when the provider throws", async () => {
    const deps = makeDeps({ callVideo: vi.fn().mockRejectedValue(new Error("hf down")) });
    const res = await generateVideoAsset({ contentId: "c1", slideIndex: null }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("hf down");
    expect(deps.persistVideo).not.toHaveBeenCalled();
  });
  it("uses the client-provided prompt when present", async () => {
    const deps = makeDeps();
    await generateVideoAsset({ contentId: "c1", slideIndex: null, prompt: "CUSTOM" }, deps as any);
    expect((deps.callVideo as any).mock.calls[0][1]).toBe("CUSTOM");
    expect(deps.loadReel).not.toHaveBeenCalled();
  });
});
```
- [ ] **Step 2: Run → fails** `npx vitest run src/lib/video/generate.test.ts`
- [ ] **Step 3: Implement** `src/lib/video/generate.ts`
```ts
import { buildVideoPrompt, type VideoPromptInput } from "./video-prompt";

export interface VideoGenInput {
  contentId: string;
  slideIndex: number | null;
  prompt?: string;
}
export interface VideoDeps {
  loadStartImage: (contentId: string, slideIndex: number | null) => Promise<Buffer | null>;
  loadReel: (contentId: string) => Promise<VideoPromptInput>;
  callVideo: (imageBuf: Buffer, prompt: string) => Promise<Buffer>;
  persistVideo: (args: { input: VideoGenInput; prompt: string; bytes: Buffer }) => Promise<{ assetId: string }>;
}
export interface VideoGenResult {
  status: "DONE" | "ERROR";
  assetId?: string;
  error?: string;
}

export async function generateVideoAsset(input: VideoGenInput, deps: VideoDeps): Promise<VideoGenResult> {
  try {
    const startImage = await deps.loadStartImage(input.contentId, input.slideIndex);
    if (!startImage) return { status: "ERROR", error: "Genera prima l'immagine di questo contenuto." };
    const prompt = input.prompt?.trim() ? input.prompt.trim() : buildVideoPrompt(await deps.loadReel(input.contentId));
    const bytes = await deps.callVideo(startImage, prompt);
    const { assetId } = await deps.persistVideo({ input, prompt, bytes });
    return { status: "DONE", assetId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}
```
- [ ] **Step 4: Run → passes** `npx vitest run src/lib/video/generate.test.ts` ; `npx tsc --noEmit`
- [ ] **Step 5: Commit** `git add src/lib/video/generate.ts src/lib/video/generate.test.ts && git commit -m "feat(video): generateVideoAsset orchestrator"`

---

### Task 5: Runtime deps + rotta

**Files:** Create `src/lib/video/runtime.ts`, `src/app/api/meta/contents/[id]/video/route.ts`, `src/app/api/meta/contents/[id]/video/deps-registry.ts`

**Interfaces:** Consumes `generateVideoAsset`/`VideoDeps` (T4), `higgsfieldVideo` (T3), `saveVideoAssetFile` (T2). Produces `POST /api/meta/contents/[id]/video` body `{ slideIndex?: number|null; prompt?: string }` → `{ assetId }` (200) / `{ error }` (502).

- [ ] **Step 1: Implement** `src/lib/video/runtime.ts`
```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { higgsfieldVideo } from "@/lib/image/providers/higgsfield-video";
import { saveVideoAssetFile } from "@/lib/image/store";
import type { VideoDeps } from "./generate";

export function buildVideoDeps(): VideoDeps {
  return {
    loadStartImage: async (contentId, slideIndex) => {
      const asset = await prisma.generatedAsset.findFirst({
        where: { contentId, slideIndex, tipo: "IMMAGINE" },
        orderBy: { createdAt: "desc" },
        select: { path: true },
      });
      if (!asset?.path) return null;
      try {
        return readFileSync(path.join(process.cwd(), asset.path));
      } catch {
        return null;
      }
    },
    loadReel: async (contentId) => {
      const content = await prisma.generatedContent.findUnique({ where: { id: contentId } });
      const p = (content?.payload ?? {}) as { hook?: string; scriptParlato?: string; testoSchermo?: string[]; ideaCreativa?: string };
      return { hook: p.hook, scriptParlato: p.scriptParlato, testoSchermo: p.testoSchermo, ideaCreativa: p.ideaCreativa };
    },
    callVideo: (imageBuf, prompt) => higgsfieldVideo(imageBuf, prompt),
    persistVideo: async ({ input, prompt, bytes }) => {
      const existing = await prisma.generatedAsset.findFirst({ where: { contentId: input.contentId, slideIndex: input.slideIndex, tipo: "VIDEO" } });
      if (existing) await prisma.generatedAsset.delete({ where: { id: existing.id } });
      const asset = await prisma.generatedAsset.create({
        data: { contentId: input.contentId, slideIndex: input.slideIndex, tipo: "VIDEO", prompt, modello: "higgsfield/dop", path: "" },
      });
      const relPath = saveVideoAssetFile(input.contentId, asset.id, bytes);
      await prisma.generatedAsset.update({ where: { id: asset.id }, data: { path: relPath } });
      return { assetId: asset.id };
    },
  };
}
```
- [ ] **Step 2: Implement** `src/app/api/meta/contents/[id]/video/deps-registry.ts` (copy the image route's deps-registry, swapping the type):
```ts
import { generateVideoAsset } from "@/lib/video/generate";

export type DepsFactory = () => { __run?: typeof generateVideoAsset } & Record<string, unknown>;

let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) {
  depsFactory = f;
}
export function getDepsFactory(): DepsFactory {
  return depsFactory;
}
```
- [ ] **Step 3: Implement** `src/app/api/meta/contents/[id]/video/route.ts`
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateVideoAsset } from "@/lib/video/generate";
import { buildVideoDeps } from "@/lib/video/runtime";
import { getDepsFactory } from "./deps-registry";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ slideIndex: z.number().int().min(0).nullable().optional(), prompt: z.string().optional() });

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const injected = getDepsFactory()();
  const run = injected.__run ?? generateVideoAsset;
  const deps = injected.__run ? ({} as never) : buildVideoDeps();
  const result = await run({ contentId: id, slideIndex: parsed.data.slideIndex ?? null, prompt: parsed.data.prompt }, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
```
- [ ] **Step 4: Verify** `npx tsc --noEmit` (exit 0) and full suite `npx vitest run` still green.
- [ ] **Step 5: Commit** `git add src/lib/video/runtime.ts "src/app/api/meta/contents/[id]/video" && git commit -m "feat(video): runtime deps + POST /api/meta/contents/[id]/video route"`

---

### Task 6: UI — sezione Video sulla pagina Meta

**Files:** Modify `src/app/meta/[id]/page.tsx`

**Interfaces:** Consumes `POST /api/meta/contents/[id]/video`; the content GET already returns `assets` with `tipo`.

- [ ] **Step 1: Add a video-asset finder + generate handler** near the existing `assetFor`/`genImage` in `src/app/meta/[id]/page.tsx`:
```tsx
  const videoAssetFor = (slideIndex: number | null) =>
    (c?.assets ?? []).find((a: any) => a.tipo === "VIDEO" && (a.slideIndex ?? null) === slideIndex) as { id: string } | undefined;
  const [busyVid, setBusyVid] = useState<string | null>(null);
  const genVideo = async (slideIndex: number | null) => {
    setBusyVid(String(slideIndex));
    setMsg(null);
    const res = await fetch(`/api/meta/contents/${id}/video`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slideIndex }),
    });
    setBusyVid(null);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setMsg(e.error ?? "Errore generazione video"); return; }
    await load();
  };
```
(Confirm the component's content-loader function name is `load`; if different, call the existing reload function used after `genImage`.)

- [ ] **Step 2: Render the Video section** in the main-image block (use `null`) — add after the "Genera immagine" button:
```tsx
        <div className="mt-3">
          <div className="mb-1 text-sm font-medium">Video</div>
          {videoAssetFor(null) ? (
            <video src={`/api/assets/${videoAssetFor(null)!.id}`} controls className="mb-2 w-64 rounded border" />
          ) : <p className="text-xs text-neutral-500">Nessun video. Richiede un'immagine già generata.</p>}
          <button onClick={() => genVideo(null)} disabled={busyVid === "null"} className="rounded bg-violet-600 px-3 py-1 text-sm text-white disabled:opacity-40">{busyVid === "null" ? "Genero video…" : "Genera video"}</button>
          <GenerationProgress running={busyVid === "null"} estimatedMs={180000} label="Generazione video" />
        </div>
```
(`GenerationProgress` is already imported on this page. If not, import it from its existing path used elsewhere in the file.)

- [ ] **Step 3: Verify** `npx tsc --noEmit` (exit 0). Do NOT run `npm run build` while the dev server runs.
- [ ] **Step 4: Commit** `git add "src/app/meta/[id]/page.tsx" && git commit -m "feat(meta-ui): reel video section (player + Genera video)"`

---

## Self-Review
- Provider/endpoint/auth/poll → T3 (matches spec + live-verify note). ✓
- Motion prompt from reel script → T1. ✓
- mp4 storage + correct serving content-type → T2. ✓
- Orchestrator with graceful errors (no start image / provider throw) → T4 (+tests). ✓
- Runtime (start image = latest IMMAGINE asset; replace prior VIDEO; save then set path) + route gated → T5. ✓
- UI player + Genera video (needs an image first) → T6. ✓
- Placeholders: none (real code each step). Types consistent: `VideoDeps`/`VideoGenInput`/`VideoPromptInput` shared T1↔T4↔T5. ✓
- **Risk (flagged):** exact DoP body envelope + `model` value need live verification on first real generation (T3 comment). Real Higgsfield video smoke is deferred to the user (network, costs credits).
