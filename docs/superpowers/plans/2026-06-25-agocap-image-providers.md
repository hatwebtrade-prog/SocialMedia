# Image Generation Providers (selector) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let the user pick the image generator per generation — **GPT** (OpenAI gpt-image-1), **GEMINI** (nano banana, gemini-2.5-flash-image), **HIGGSFIELD** (best-effort), or **MANUAL upload** — in the Meta and Blog image areas. Mockup (image-edit) still supported on GPT/Gemini.

**Decisions (brainstormed/confirmed):** all 4 options in the selector; Higgsfield built now best-effort (contract partial, no credit → may need finalizing). Keys via env only. ⚠️ ALL three AI providers are currently credit-blocked (OpenAI billing, Gemini quota 0, Higgsfield no credit) — only MANUAL works without credit; AI providers are wired/contract-verified and run once credit is added.

**Branch:** `image-providers` (off `brain-mvp-clean`). Env: `GEMINI_API_KEY`, `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_SECRET` (+ optional `GEMINI_IMAGE_MODEL`, `HIGGSFIELD_IMAGE_MODEL`).

**Current state:** `src/lib/image/generate.ts` — `ImageGenInput {contentId, slideIndex, productId?, useMockup?}`, `ImageDeps {loadContent, loadMockup, callOpenAI(prompt, mockup?), persistAsset}`, `generateImageAsset`. `src/lib/image/runtime.ts` — private `sharedImageDeps()` (loadMockup, callOpenAI(uses OpenAI generate/edit), persistAsset) + `buildImageRuntimeDeps()` (Meta loadContent) + `buildBlogImageDeps()` (Blog loadContent). `src/lib/image/openai.ts` — `getOpenAI()`, `IMAGE_MODEL`. `src/app/api/meta/validators.ts` `imageInputSchema {slideIndex?, productId?, useMockup?}`. Meta image route `src/app/api/meta/contents/[id]/image/route.ts`; Blog image route `src/app/api/blog/contents/[id]/image/route.ts`. Meta detail `src/app/meta/[id]/page.tsx` + Blog detail `src/app/blog/[id]/page.tsx` have mockup selector + checkbox + genImage. `saveAssetFile`/`deleteAssetFile` in `src/lib/image/store.ts`. Gemini image API verified: `POST generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent` header `x-goog-api-key`, body `{contents:[{parts:[{text},{inlineData:{mimeType,data}}]}]}`, returns `candidates[0].content.parts[].inlineData.data` (base64). Higgsfield: `POST https://platform.higgsfield.ai/{model}` header `Authorization: Key {key}:{secret}`, body `{prompt, aspect_ratio, resolution}`, response shape unconfirmed.

---

## Task 1: Provider modules + dispatcher

**Files:** Create `src/lib/image/providers/index.ts`, `src/lib/image/providers/openai.ts`, `src/lib/image/providers/gemini.ts`, `src/lib/image/providers/higgsfield.ts`; Test `src/lib/image/providers/index.test.ts`

- [ ] **Step 1: Failing test (provider list + default dispatch shape)**

`src/lib/image/providers/index.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { IMAGE_PROVIDERS, isImageProvider } from "@/lib/image/providers";

describe("image providers", () => {
  it("lists the AI providers", () => {
    expect(IMAGE_PROVIDERS).toEqual(["GPT", "GEMINI", "HIGGSFIELD"]);
  });
  it("validates provider strings", () => {
    expect(isImageProvider("GEMINI")).toBe(true);
    expect(isImageProvider("MANUAL")).toBe(false);
    expect(isImageProvider("x")).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL, implement provider modules**

`src/lib/image/providers/openai.ts`:
```ts
import { toFile } from "openai";
import { getOpenAI, IMAGE_MODEL } from "../openai";

export async function openaiImage(prompt: string, mockup?: Buffer): Promise<Buffer> {
  const client = getOpenAI();
  if (mockup) {
    const file = await toFile(mockup, "mockup.png", { type: "image/png" });
    const res = await client.images.edit({ model: IMAGE_MODEL, image: file, prompt, size: "1024x1024" });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI non ha restituito un'immagine (edit)");
    return Buffer.from(b64, "base64");
  }
  const res = await client.images.generate({ model: IMAGE_MODEL, prompt, size: "1024x1024" });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI non ha restituito un'immagine");
  return Buffer.from(b64, "base64");
}
```

`src/lib/image/providers/gemini.ts`:
```ts
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

interface Part { text?: string; inlineData?: { mimeType: string; data: string } }

export async function geminiImage(prompt: string, mockup?: Buffer): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY mancante");
  const parts: Part[] = [{ text: prompt }];
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
```

`src/lib/image/providers/higgsfield.ts`:
```ts
const MODEL = process.env.HIGGSFIELD_IMAGE_MODEL ?? "higgsfield-ai/soul/standard";

/** Best-effort Higgsfield image generation. Contract partial (sync vs async response unconfirmed);
 *  handles url/base64 shapes, otherwise throws a clear error. Mockup/image-to-image not yet supported. */
export async function higgsfieldImage(prompt: string, _mockup?: Buffer): Promise<Buffer> {
  const key = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET;
  if (!key || !secret) throw new Error("HIGGSFIELD_API_KEY/HIGGSFIELD_API_SECRET mancante");
  const res = await fetch(`https://platform.higgsfield.ai/${MODEL}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}:${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt, aspect_ratio: "1:1", resolution: "1024p" }),
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
```

`src/lib/image/providers/index.ts`:
```ts
import { openaiImage } from "./openai";
import { geminiImage } from "./gemini";
import { higgsfieldImage } from "./higgsfield";

export const IMAGE_PROVIDERS = ["GPT", "GEMINI", "HIGGSFIELD"] as const;
export type ImageProvider = (typeof IMAGE_PROVIDERS)[number];

export function isImageProvider(v: string): v is ImageProvider {
  return (IMAGE_PROVIDERS as readonly string[]).includes(v);
}

export async function generateWithProvider(provider: ImageProvider, prompt: string, mockup?: Buffer): Promise<Buffer> {
  switch (provider) {
    case "GEMINI": return geminiImage(prompt, mockup);
    case "HIGGSFIELD": return higgsfieldImage(prompt, mockup);
    default: return openaiImage(prompt, mockup);
  }
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx vitest run src/lib/image/providers/index.test.ts && npx tsc --noEmit`
```bash
git add src/lib/image/providers/
git commit -m "feat: image provider modules (GPT/Gemini/Higgsfield) + dispatcher"
```

---

## Task 2: Image module provider-aware

**Files:** Modify `src/lib/image/generate.ts`, `src/lib/image/runtime.ts`, `src/lib/image/generate.test.ts`, `src/app/api/meta/validators.ts`, `src/app/api/meta/contents/[id]/image/route.ts`, `src/app/api/blog/contents/[id]/image/route.ts`

- [ ] **Step 1: Update the pipeline test**

In `src/lib/image/generate.test.ts`, add a test:
```ts
  it("passes the chosen provider to callOpenAI", async () => {
    const deps = makeDeps();
    await generateImageAsset({ contentId: "c1", slideIndex: null, provider: "GEMINI" }, deps as any);
    expect((deps.callOpenAI as any).mock.calls[0][2]).toBe("GEMINI");
  });
```
Run `npx vitest run src/lib/image/generate.test.ts`; confirm it FAILS (3rd arg undefined).

- [ ] **Step 2: generate.ts**

- `ImageGenInput` gains `provider?: ImageProvider` (import the type):
```ts
import type { ImageProvider } from "./providers";
// ...
export interface ImageGenInput {
  contentId: string;
  slideIndex: number | null;
  productId?: string;
  useMockup?: boolean;
  provider?: ImageProvider;
}
```
- `ImageDeps.callOpenAI` signature gains the provider:
```ts
  callOpenAI: (prompt: string, mockup?: Buffer, provider?: ImageProvider) => Promise<Buffer>;
```
- In `generateImageAsset`, pass it:
```ts
    const bytes = await deps.callOpenAI(prompt, mockup ?? undefined, input.provider);
```

- [ ] **Step 3: runtime.ts — delegate callOpenAI to the dispatcher**

In `src/lib/image/runtime.ts`, replace the body of `callOpenAI` inside `sharedImageDeps()` with:
```ts
    callOpenAI: async (prompt, mockup, provider) => {
      return generateWithProvider(provider ?? "GPT", prompt, mockup);
    },
```
Add `import { generateWithProvider } from "./providers";`. Remove now-unused imports if any (`toFile`, `getOpenAI`, `IMAGE_MODEL`) ONLY if no longer referenced — check first (IMAGE_MODEL is still used by persistAsset's `modello` field, keep it; `getOpenAI`/`toFile` move to providers/openai.ts so remove from runtime if unused). Keep `loadMockup`/`persistAsset` unchanged. Verify `npx tsc --noEmit` is 0 (unused imports are errors under noUnusedLocals if enabled — remove them).

- [ ] **Step 4: validators + routes carry provider**

In `src/app/api/meta/validators.ts`:
```ts
import { IMAGE_PROVIDERS } from "@/lib/image/providers";
// ...
export const imageInputSchema = z.object({
  slideIndex: z.number().int().min(0).nullable().optional(),
  productId: z.string().optional(),
  useMockup: z.boolean().optional(),
  provider: z.enum(IMAGE_PROVIDERS).optional(),
});
```
In `src/app/api/meta/contents/[id]/image/route.ts`, pass `provider: parsed.data.provider` into the `run({...})` call.
In `src/app/api/blog/contents/[id]/image/route.ts`, pass `provider: parsed.data.provider` into the `run({...})` call.

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
```bash
git add src/lib/image/generate.ts src/lib/image/runtime.ts src/lib/image/generate.test.ts src/app/api/meta/validators.ts "src/app/api/meta/contents/[id]/image/route.ts" "src/app/api/blog/contents/[id]/image/route.ts"
git commit -m "feat: image generation dispatches to the chosen provider"
```

---

## Task 3: Manual image upload

**Files:** Create `src/lib/image/manual.ts`; Create `src/app/api/meta/contents/[id]/image/upload/route.ts`, `src/app/api/blog/contents/[id]/image/upload/route.ts`; Test `src/lib/image/manual.test.ts`

- [ ] **Step 1: Failing test (pure data-URL parser)**

`src/lib/image/manual.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseDataUrl } from "@/lib/image/manual";

describe("parseDataUrl", () => {
  it("extracts bytes from a png data URL", () => {
    const b64 = Buffer.from("hello").toString("base64");
    const buf = parseDataUrl(`data:image/png;base64,${b64}`);
    expect(buf?.toString()).toBe("hello");
  });
  it("returns null for non-data/non-image input", () => {
    expect(parseDataUrl("http://x/y.png")).toBeNull();
    expect(parseDataUrl("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL, implement `src/lib/image/manual.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { saveAssetFile, deleteAssetFile } from "./store";

/** Parses a `data:image/...;base64,...` URL into a Buffer (null if not an image data URL). */
export function parseDataUrl(dataUrl: string): Buffer | null {
  const m = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(dataUrl ?? "");
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}

/** Persists a manually-uploaded image as the content's asset (replaces existing for that slide). */
export async function saveManualImage(contentId: string, slideIndex: number | null, bytes: Buffer): Promise<{ assetId: string }> {
  const existing = await prisma.generatedAsset.findFirst({ where: { contentId, slideIndex, tipo: "IMMAGINE" } });
  if (existing) {
    if (existing.path) deleteAssetFile(existing.path);
    await prisma.generatedAsset.delete({ where: { id: existing.id } });
  }
  const asset = await prisma.generatedAsset.create({
    data: { contentId, slideIndex, tipo: "IMMAGINE", prompt: "(caricamento manuale)", modello: "manuale", path: "" },
  });
  try {
    const relPath = saveAssetFile(contentId, asset.id, bytes);
    await prisma.generatedAsset.update({ where: { id: asset.id }, data: { path: relPath } });
  } catch (err) {
    await prisma.generatedAsset.delete({ where: { id: asset.id } }).catch(() => {});
    throw err;
  }
  return { assetId: asset.id };
}
```

- [ ] **Step 3: Upload routes**

`src/app/api/meta/contents/[id]/image/upload/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseDataUrl, saveManualImage } from "@/lib/image/manual";

const schema = z.object({ slideIndex: z.number().int().min(0).nullable().optional(), dataUrl: z.string() });
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const bytes = parseDataUrl(parsed.data.dataUrl);
  if (!bytes) return NextResponse.json({ error: "Immagine non valida (atteso data URL image/*)" }, { status: 400 });
  try {
    const { assetId } = await saveManualImage(id, parsed.data.slideIndex ?? null, bytes);
    return NextResponse.json({ status: "DONE", assetId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore salvataggio" }, { status: 500 });
  }
}
```
`src/app/api/blog/contents/[id]/image/upload/route.ts`: identical but the blog featured image always uses `slideIndex: null` — same code is fine (slideIndex optional, defaults null).

- [ ] **Step 4: Verify + commit**

Run: `npx vitest run src/lib/image/manual.test.ts && npx vitest run && npx tsc --noEmit && npm run build`
```bash
git add src/lib/image/manual.ts src/lib/image/manual.test.ts "src/app/api/meta/contents/[id]/image/upload/" "src/app/api/blog/contents/[id]/image/upload/"
git commit -m "feat: manual image upload (Meta + Blog)"
```

---

## Task 4: UI — provider selector + manual upload (Meta + Blog)

**Files:** Modify `src/app/meta/[id]/page.tsx`, `src/app/blog/[id]/page.tsx`

- [ ] **Step 1: Meta detail**

In `src/app/meta/[id]/page.tsx`, add a provider state:
```tsx
  const [provider, setProvider] = useState("GPT");
```
In the existing "Immagine prodotto (mockup)" panel, add a provider selector at the top of its controls row:
```tsx
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded border p-1">
            <option value="GPT">GPT (OpenAI)</option>
            <option value="GEMINI">Gemini (nano banana)</option>
            <option value="HIGGSFIELD">Higgsfield</option>
            <option value="MANUAL">Caricamento manuale</option>
          </select>
```
Change `genImage` to send the provider (only for AI providers):
```tsx
  const genImage = async (slideIndex: number | null) => {
    setBusyImg(`${slideIndex}`); setMsg(null);
    const res = await fetch(`/api/meta/contents/${id}/image`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slideIndex, productId: refProductId || undefined, useMockup: useMockup && !!refProductId, provider }),
    });
    const json = await res.json();
    setBusyImg(null);
    if (res.ok) await load(); else setMsg(`Errore immagine: ${json.error ?? "sconosciuto"}`);
  };
```
Add a manual-upload handler + hidden file input, used when provider === "MANUAL":
```tsx
  const uploadImage = async (slideIndex: number | null, file: File) => {
    setBusyImg(`${slideIndex}`); setMsg(null);
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file);
    });
    const res = await fetch(`/api/meta/contents/${id}/image/upload`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slideIndex, dataUrl }),
    });
    const json = await res.json();
    setBusyImg(null);
    if (res.ok) await load(); else setMsg(`Errore upload: ${json.error ?? "sconosciuto"}`);
  };
```
For the main-image button and each slide button: when `provider === "MANUAL"`, render a file input instead of the generate button. Replace the main "Genera immagine" button with:
```tsx
        {provider === "MANUAL" ? (
          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(null, f); }} className="text-sm" />
        ) : (
          <button onClick={() => genImage(null)} disabled={busyImg === "null"} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-40">{busyImg === "null" ? "Genero…" : "Genera immagine"}</button>
        )}
```
And similarly for the carosello slide button (use `idx` and `uploadImage(idx, f)` / `genImage(idx)`).
(The mockup selector + checkbox stay; they apply to GPT/Gemini. Note in the helper text that il mockup vale per GPT/Gemini.)

- [ ] **Step 2: Blog detail**

In `src/app/blog/[id]/page.tsx`, add `const [provider, setProvider] = useState("GPT");`. In the "Immagine in evidenza" panel add the same provider `<select>` (GPT/Gemini/Higgsfield/Manuale). Change `genImage` to include `provider` in the POST body. Add an `uploadImage(file)` handler posting to `/api/blog/contents/${id}/image/upload` with `{ dataUrl }`. When `provider === "MANUAL"`, render a `<input type="file" accept="image/*">` (calling uploadImage) instead of the (Ri)genera button.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npm run build`
```bash
git add "src/app/meta/[id]/page.tsx" "src/app/blog/[id]/page.tsx"
git commit -m "feat: image provider selector + manual upload UI (Meta + Blog)"
```

---

## Task 5: Gate + smoke

- [ ] **Step 1: Gate** — `npx vitest run && npx tsc --noEmit && npm run build` (green).
- [ ] **Step 2: Smoke:** start dev server with `OPENAI_API_KEY`, `GEMINI_API_KEY`, `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_SECRET`, `SHOPIFY_*`. Pick a META content id.
  - **MANUAL (must fully work — no credit needed):** `POST /api/meta/contents/<id>/image/upload` with `{"slideIndex":null,"dataUrl":"data:image/png;base64,<tiny png>"}` → 200 `{status:"DONE", assetId}`; `GET /api/assets/<assetId>` returns the PNG. This is the key live verification.
  - **GEMINI:** `POST /api/meta/contents/<id>/image {"slideIndex":null,"provider":"GEMINI"}` → report response. Expected: either DONE (if billing enabled) or ERROR with a Gemini quota/billing message (confirms the call reaches Gemini correctly).
  - **HIGGSFIELD:** `POST .../image {"provider":"HIGGSFIELD"}` → report the exact response (confirms whether the contract/credit works or returns the "risposta non riconosciuta"/HTTP error — informs finalizing it).
  - **GPT:** `POST .../image {"provider":"GPT"}` → expected billing error (unchanged).
  - Open `/meta/<id>` and `/blog/<id>`: the provider `<select>` shows GPT/Gemini/Higgsfield/Manuale; choosing Manuale shows a file input.
  Report: MANUAL upload result (the one that should succeed), and the exact provider responses for Gemini/Higgsfield/GPT (credit-blocked expected). Any error verbatim.
- [ ] **Step 3: Stop the server.**

---

## Self-Review (addressed)
- **Coverage:** provider modules + dispatcher (T1); image module provider-aware + validators/routes (T2); manual upload lib + routes (T3); UI selector + manual file input on Meta & Blog (T4); gate + smoke with MANUAL as the verifiable path + provider contract checks (T5). Mockup edit still flows through GPT/Gemini.
- **Types:** `ImageProvider`/`IMAGE_PROVIDERS`/`isImageProvider` (T1) used by generate.ts input, validators enum, runtime dispatch (T2); `parseDataUrl`/`saveManualImage` (T3) used by upload routes; UI posts provider + dataUrl matching the schemas.
- **No placeholders:** Gemini contract verified live; Higgsfield best-effort with explicit "da finalizzare" error on unknown response; manual upload fully functional offline; all AI providers degrade with clear errors when credit-blocked.
```
