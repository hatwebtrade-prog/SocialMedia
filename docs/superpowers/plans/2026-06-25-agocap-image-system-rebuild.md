# Image System Rebuild (Spec A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix the broken content image flow: decouple the Blog image from the article pipeline, replace fragile prompt concatenation with a structured per-provider **image brief (filters)**, and drive Higgsfield natively via Soul **styles** (UGC).

**Architecture:** A pure `ImageBrief` + `buildImagePromptFromBrief(brief, ctx)` builds a clean prompt per provider (GPT/Gemini rich + negatives; Higgsfield short, positive, no negatives, style via `style_id`). The image pipeline (`generateImageAsset`) uses the brief when present. Higgsfield rewritten to `POST /v1/text2image/soul` with `style_id` (106 styles from `GET /v1/text2image/soul-styles`). Blog generation persists text without image; image is on-demand.

**Tech Stack:** Next.js 15, Prisma/Postgres, Tailwind, Vitest, OpenAI (gpt-image-1), Gemini, Higgsfield Soul.

**Branch:** `image-system-rebuild` (off `brain-mvp-clean`). Spec: `docs/superpowers/specs/2026-06-25-agocap-image-system-rebuild-design.md`.

**Current state (key):** `src/lib/blog/generate.ts` pipeline calls `deps.generateImage` then `persist({input,payload,claude,image})` (image mandatory). `src/lib/blog/runtime.ts` `generateImage` + `persist` creates a `GeneratedAsset`. `src/lib/image/generate.ts` `ImageGenInput {contentId, slideIndex, productId?, useMockup?, provider?}`, `generateImageAsset` builds prompt via `buildImagePrompt(loadContent)`. `src/lib/image/providers/` `index.ts` (`IMAGE_PROVIDERS`, `generateWithProvider`), `higgsfield.ts` (currently `/higgsfield-ai/soul/{standard,reference}` + presigned upload + poll). `src/app/api/meta/validators.ts` `imageInputSchema {slideIndex?,productId?,useMockup?,provider?}`. Higgsfield v1 contract verified: `POST /v1/text2image/soul` body `{params:{prompt,width_and_height,style_id,quality}}`, auth `Authorization: Key {key}:{secret}`; styles `GET /v1/text2image/soul-styles` (auth `hf-api-key`/`hf-secret`); upload `POST /files/generate-upload-url`; async poll `status_url` → `images[0].url`.

---

## Task 1: Decouple Blog image from the article pipeline (BUG FIX)

**Files:** Modify `src/lib/blog/generate.ts`, `src/lib/blog/runtime.ts`, `src/lib/blog/generate.test.ts`

- [ ] **Step 1: Update the test** — in `src/lib/blog/generate.test.ts`: remove `generateImage` from `makeDeps`, remove the assertion `expect((deps.generateImage...).titoloSeo)...`. The first test keeps DONE + jsonLd + titoloSeo assertions. Add an assertion that persist receives no `image`:
```ts
    expect((deps.persist as any).mock.calls[0][0].image).toBeUndefined();
```
Run `npx vitest run src/lib/blog/generate.test.ts` → FAIL (generateImage still required by types/impl).

- [ ] **Step 2: `src/lib/blog/generate.ts`** — remove image from the flow:
  - Delete `generateImage` from `BlogDeps`.
  - Change `persist` signature to `(args: { input: BlogGenInput; payload: object; claude: BlogClaudeResult }) => Promise<{ contentId: string }>`.
  - In `generateBlogArticle`, remove the `const image = await deps.generateImage(...)` line and pass `persist({ input, payload, claude })` (no image).

- [ ] **Step 3: `src/lib/blog/runtime.ts`** — remove the `generateImage` dep entirely, and in `persist` remove the `GeneratedAsset` creation + `saveAssetFile` call (persist now only creates the `GeneratedContent` and returns `{contentId}`). Drop the `image` param from persist. Remove now-unused imports (`buildImagePrompt`, `getOpenAI`, `IMAGE_MODEL`, `saveAssetFile`) **only if unused after the change** — verify with tsc.

- [ ] **Step 4: Verify + commit**
Run: `npx vitest run src/lib/blog/generate.test.ts && npx vitest run && npx tsc --noEmit && npm run build`
```bash
git add src/lib/blog/generate.ts src/lib/blog/runtime.ts src/lib/blog/generate.test.ts
git commit -m "fix: decouple Blog image from article pipeline (article saved even if image fails)"
```

---

## Task 2: ImageBrief + per-provider prompt builder

**Files:** Create `src/lib/image/brief.ts`; Test `src/lib/image/brief.test.ts`

- [ ] **Step 1: Failing test** `src/lib/image/brief.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildImagePromptFromBrief, isBriefEmpty, briefDimensions } from "@/lib/image/brief";

const brief = { soggetto: "donna che tiene il prodotto", ambientazione: "cucina luminosa", luce: "luce naturale", inquadratura: "medio busto", mood: "autentico", tieneProdotto: true };

describe("buildImagePromptFromBrief", () => {
  it("GPT: rich prompt with negatives", () => {
    const p = buildImagePromptFromBrief(brief, { provider: "GPT" });
    expect(p).toContain("cucina luminosa");
    expect(p.toLowerCase()).toContain("iperrealistica");
    expect(p.toLowerCase()).toContain("vietato");
  });
  it("HIGGSFIELD: short, positive, no negatives, no style word", () => {
    const p = buildImagePromptFromBrief({ ...brief, stile: "STYLE-UUID" }, { provider: "HIGGSFIELD" });
    expect(p.toLowerCase()).not.toContain("vietato");
    expect(p.toLowerCase()).not.toContain("iperrealistica");
    expect(p).not.toContain("STYLE-UUID");
    expect(p).toContain("cucina luminosa");
  });
  it("falls back to ctx.fallback when brief empty", () => {
    const p = buildImagePromptFromBrief({}, { provider: "GPT", fallback: "bottiglia di magnesio" });
    expect(p).toContain("bottiglia di magnesio");
  });
});

describe("isBriefEmpty", () => {
  it("true for empty/undefined", () => { expect(isBriefEmpty()).toBe(true); expect(isBriefEmpty({})).toBe(true); });
  it("false when a field set", () => { expect(isBriefEmpty({ soggetto: "x" })).toBe(false); });
});

describe("briefDimensions", () => {
  it("maps formato", () => {
    expect(briefDimensions("verticale").soul).toBe("1152x2048");
    expect(briefDimensions("quadrato").soul).toBe("1536x1536");
    expect(briefDimensions(undefined).openaiSize).toBe("1024x1024");
  });
});
```

- [ ] **Step 2: Implement** `src/lib/image/brief.ts`:
```ts
import type { ImageProvider } from "./providers";

export interface ImageBrief {
  soggetto?: string;
  ambientazione?: string;
  luce?: string;
  inquadratura?: string;
  mood?: string;
  formato?: "verticale" | "quadrato" | "orizzontale";
  stile?: string; // Higgsfield style_id (UUID) or a generic style name
  tieneProdotto?: boolean;
  note?: string;
}

export interface PromptCtx {
  provider: ImageProvider;
  hasMockup?: boolean;
  productName?: string;
  fallback?: string;
}

const SCENE_FIELDS: (keyof ImageBrief)[] = ["soggetto", "ambientazione", "luce", "inquadratura", "mood"];

export function isBriefEmpty(b?: ImageBrief): boolean {
  if (!b) return true;
  const anyScene = SCENE_FIELDS.some((k) => typeof b[k] === "string" && (b[k] as string).trim());
  return !anyScene && !b.tieneProdotto && !(b.note && b.note.trim());
}

export function briefDimensions(formato?: ImageBrief["formato"]): { soul: string; openaiSize: "1024x1024" | "1024x1536" | "1536x1024" } {
  switch (formato) {
    case "verticale": return { soul: "1152x2048", openaiSize: "1024x1536" };
    case "orizzontale": return { soul: "2048x1152", openaiSize: "1536x1024" };
    default: return { soul: "1536x1536", openaiSize: "1024x1024" };
  }
}

export function buildImagePromptFromBrief(brief: ImageBrief, ctx: PromptCtx): string {
  const b = brief ?? {};
  const soggetto = (b.soggetto && b.soggetto.trim()) || (ctx.fallback && ctx.fallback.trim()) || "scena lifestyle del prodotto";

  if (ctx.provider === "HIGGSFIELD") {
    // Short, positive, no negatives, NO style word (style is passed as style_id).
    const holding = b.tieneProdotto ? "che tiene il prodotto" : "";
    const phrase = [soggetto, b.ambientazione, b.luce, b.inquadratura, b.mood, holding, b.note]
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join(", ");
    return phrase || "foto autentica e realistica";
  }

  // GPT / Gemini: rich descriptive prompt + photoreal direction + negatives (these models honor them).
  const holding = b.tieneProdotto ? "Una persona tiene/usa il prodotto in modo naturale." : "";
  const scene = [
    `${soggetto}.`,
    b.ambientazione ? `Ambientazione: ${b.ambientazione}.` : "",
    b.luce ? `Luce: ${b.luce}.` : "",
    b.inquadratura ? `Inquadratura: ${b.inquadratura}.` : "",
    b.mood ? `Mood: ${b.mood}.` : "",
    holding,
    b.note ? `${b.note}.` : "",
  ].filter(Boolean).join(" ");
  const product = ctx.hasMockup
    ? " Mantieni il prodotto IDENTICO al packaging di riferimento (etichetta, forma, colori, testo invariati), inserito in modo naturale."
    : "";
  return `${scene} Una SINGOLA fotografia iperrealistica, indistinguibile da uno scatto reale: full-frame 50mm, luce naturale morbida, pelle e mani realistiche.${product} VIETATO nell'immagine: testo, scritte, loghi, watermark, collage, riquadri multipli, aspetto 3D/cartoon/CGI.`;
}
```

- [ ] **Step 3: Verify + commit**
Run: `npx vitest run src/lib/image/brief.test.ts && npx tsc --noEmit`
```bash
git add src/lib/image/brief.ts src/lib/image/brief.test.ts
git commit -m "feat: ImageBrief + per-provider prompt builder (replaces fragile concatenation)"
```

---

## Task 3: Higgsfield soul-styles list + API

**Files:** Modify `src/lib/image/providers/higgsfield.ts` (add `listSoulStyles`); Create `src/app/api/higgsfield/soul-styles/route.ts`; Test `src/lib/image/providers/higgsfield-styles.test.ts`

- [ ] **Step 1: Failing test** `src/lib/image/providers/higgsfield-styles.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeSoulStyles } from "@/lib/image/providers/higgsfield";

describe("normalizeSoulStyles", () => {
  it("maps id/name/preview from array or {items}", () => {
    const raw = [{ id: "a", name: "Realistic", preview_url: "u1", description: "d" }];
    expect(normalizeSoulStyles(raw)).toEqual([{ id: "a", name: "Realistic", previewUrl: "u1" }]);
    expect(normalizeSoulStyles({ items: raw })).toEqual([{ id: "a", name: "Realistic", previewUrl: "u1" }]);
  });
  it("[] for malformed", () => { expect(normalizeSoulStyles(null)).toEqual([]); expect(normalizeSoulStyles({})).toEqual([]); });
});
```

- [ ] **Step 2: Implement** — add to `src/lib/image/providers/higgsfield.ts`:
```ts
export interface SoulStyle { id: string; name: string; previewUrl: string | null }

export function normalizeSoulStyles(raw: unknown): SoulStyle[] {
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: unknown[] }).items : [];
  return (arr as Record<string, unknown>[])
    .filter((s) => typeof s?.id === "string" && typeof s?.name === "string")
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
```

- [ ] **Step 3: Route** `src/app/api/higgsfield/soul-styles/route.ts`:
```ts
import { NextResponse } from "next/server";
import { listSoulStyles } from "@/lib/image/providers/higgsfield";

export async function GET() {
  const styles = await listSoulStyles();
  return NextResponse.json(styles);
}
```

- [ ] **Step 4: Verify + commit**
Run: `npx vitest run src/lib/image/providers/higgsfield-styles.test.ts && npx tsc --noEmit`
```bash
git add src/lib/image/providers/higgsfield.ts src/lib/image/providers/higgsfield-styles.test.ts src/app/api/higgsfield/
git commit -m "feat: Higgsfield soul-styles list + /api/higgsfield/soul-styles"
```

---

## Task 4: Higgsfield provider → v1 Soul (style-driven)

**Files:** Modify `src/lib/image/providers/higgsfield.ts`, `src/lib/image/providers/index.ts`, `src/lib/image/generate.ts`, `src/lib/image/runtime.ts`

> Goal: `higgsfieldImage(prompt, mockup?, opts?)` with `opts={ styleId?, soulSize?: string }` posting to `/v1/text2image/soul`. Provider dispatch must carry `styleId` + size. The mockup reference handling stays best-effort (Task 5 refines product fidelity).

- [ ] **Step 1: Extend the dispatcher** `src/lib/image/providers/index.ts`:
```ts
export interface ProviderOpts { styleId?: string; soulSize?: string }

export async function generateWithProvider(provider: ImageProvider, prompt: string, mockup?: Buffer, opts?: ProviderOpts): Promise<Buffer> {
  switch (provider) {
    case "GEMINI": return geminiImage(prompt, mockup);
    case "HIGGSFIELD": return higgsfieldImage(prompt, mockup, opts);
    default: return openaiImage(prompt, mockup);
  }
}
```

- [ ] **Step 2: Rewrite the Higgsfield generation** in `src/lib/image/providers/higgsfield.ts` — keep `uploadToHiggsfield`, `downloadImage`, `sleep`, polling, `normalizeSoulStyles`/`listSoulStyles`. Change `higgsfieldImage`:
```ts
const V1_SOUL = "https://platform.higgsfield.ai/v1/text2image/soul";
const DEFAULT_STYLE = process.env.HIGGSFIELD_DEFAULT_STYLE ?? "1cb4b936-77bf-4f9a-9039-f3d349a4cdbe"; // "Realistic"

export async function higgsfieldImage(prompt: string, mockup?: Buffer, opts?: { styleId?: string; soulSize?: string }): Promise<Buffer> {
  const key = process.env.HIGGSFIELD_API_KEY, secret = process.env.HIGGSFIELD_API_SECRET;
  if (!key || !secret) throw new Error("HIGGSFIELD_API_KEY/HIGGSFIELD_API_SECRET mancante");
  const auth = `Key ${key}:${secret}`;

  const params: Record<string, unknown> = {
    prompt,
    width_and_height: opts?.soulSize ?? "1536x1536",
    style_id: opts?.styleId ?? DEFAULT_STYLE,
    quality: "1080p",
  };
  if (mockup) {
    const publicUrl = await uploadToHiggsfield(mockup, key, secret);
    params.input_images = [{ type: "image_url", image_url: publicUrl }];
  }
  const res = await fetch(V1_SOUL, { method: "POST", headers: { Authorization: auth, "content-type": "application/json" }, body: JSON.stringify({ params }) });
  if (!res.ok) throw new Error(`Higgsfield HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  let job: HiggsfieldJob = await res.json().catch(() => ({}));
  const immediate = job.images?.[0]?.url;
  if (job.status === "completed" && immediate) return downloadImage(immediate);
  const statusUrl = job.status_url;
  if (!statusUrl) throw new Error("Higgsfield: risposta senza status_url");
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (job.status === "completed") { const u = job.images?.[0]?.url; if (!u) throw new Error("Higgsfield: completato senza immagine"); return downloadImage(u); }
    if (job.status === "failed" || job.status === "canceled" || job.status === "error" || job.status === "nsfw") throw new Error(`Higgsfield: generazione ${job.status}`);
    await sleep(3000);
    const st = await fetch(statusUrl, { headers: { Authorization: auth } });
    if (!st.ok) throw new Error(`Higgsfield status HTTP ${st.status}`);
    job = await st.json().catch(() => ({}));
  }
  throw new Error("Higgsfield: timeout");
}
```
(Keep `HiggsfieldJob` interface; note `input_images` on v1 is best-effort — Task 5 may switch to SoulId if fidelity is poor.)

- [ ] **Step 3: Thread opts through the image module** — `src/lib/image/generate.ts`: `ImageDeps.callOpenAI` signature → `(prompt: string, mockup?: Buffer, provider?: ImageProvider, opts?: { styleId?: string; soulSize?: string }) => Promise<Buffer>`. In `generateImageAsset`, pass opts (built in Task 6 from brief). `src/lib/image/runtime.ts` `sharedImageDeps().callOpenAI`: `async (prompt, mockup, provider, opts) => generateWithProvider(provider ?? "GPT", prompt, mockup, opts)`.

- [ ] **Step 4: Verify + commit**
Run: `npx vitest run && npx tsc --noEmit && npm run build`
```bash
git add src/lib/image/providers/ src/lib/image/generate.ts src/lib/image/runtime.ts
git commit -m "feat: Higgsfield v1 Soul generation (style_id + size) via provider opts"
```

---

## Task 5: Product reference fidelity (SoulId, live-verified)

**Files:** `prisma/schema.prisma` (Product.higgsfieldSoulId); Modify `src/lib/image/providers/higgsfield.ts`

> This task has a **live verification gate**: SoulId may or may not preserve a product packshot. Implement the SoulId path, verify live, and keep input_images as the fallback.

- [ ] **Step 1: Prisma field** — in `model Product` add `higgsfieldSoulId String?`. Hand-author `prisma/migrations/<ts>_product_higgsfield_soul/migration.sql` (`ALTER TABLE "Product" ADD COLUMN "higgsfieldSoulId" TEXT;`), run `npx prisma migrate deploy && npx prisma generate`. `npx tsc --noEmit` = 0.

- [ ] **Step 2: SoulId helper** in `higgsfield.ts`:
```ts
/** Creates (or returns) a Higgsfield SoulId from a product image URL; polls until ready. */
export async function createSoulId(name: string, imageUrl: string, key: string, secret: string): Promise<string | null> {
  try {
    const res = await fetch("https://platform.higgsfield.ai/v1/custom-references", {
      method: "POST", headers: { "hf-api-key": key, "hf-secret": secret, "content-type": "application/json" },
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
```

- [ ] **Step 3: Live verification (manual gate)** — Using a real product mockup: upload it, `createSoulId`, then generate `/v1/text2image/soul` with `params.custom_reference_id = <soulId>` + `custom_reference_strength: 1` + a UGC style, and visually compare product fidelity vs the `input_images` path. **Document the winner.** If SoulId wins, wire it into `higgsfieldImage` (when a `productId` with a cached `higgsfieldSoulId` is provided, prefer `custom_reference_id`; create+cache the SoulId on first use). If input_images wins or SoulId can't represent the packshot, keep input_images and note GPT-edit for pixel-perfect. **Report findings before finalizing.**

- [ ] **Step 4: Commit** (after the chosen path is wired)
```bash
git add prisma/ src/lib/image/providers/higgsfield.ts
git commit -m "feat: Higgsfield product reference (SoulId cached on Product, verified path)"
```

---

## Task 6: Brief in the image request (schema + routes + pipeline)

**Files:** Modify `src/app/api/meta/validators.ts`, `src/app/api/meta/contents/[id]/image/route.ts`, `src/app/api/blog/contents/[id]/image/route.ts`, `src/lib/image/generate.ts`, `src/lib/image/runtime.ts`

- [ ] **Step 1: Schema** `src/app/api/meta/validators.ts` — add a brief schema + fields to `imageInputSchema`:
```ts
const briefSchema = z.object({
  soggetto: z.string().optional(), ambientazione: z.string().optional(), luce: z.string().optional(),
  inquadratura: z.string().optional(), mood: z.string().optional(),
  formato: z.enum(["verticale", "quadrato", "orizzontale"]).optional(),
  stile: z.string().optional(), tieneProdotto: z.boolean().optional(), note: z.string().optional(),
}).optional();
// in imageInputSchema add:
  brief: briefSchema,
  styleId: z.string().optional(),
```

- [ ] **Step 2: generate.ts uses the brief** — `ImageGenInput` += `brief?: ImageBrief; styleId?: string` (import `ImageBrief` from `./brief`). In `generateImageAsset`:
```ts
    const { ideaCreativa, slideText } = await deps.loadContent(input.contentId, input.slideIndex);
    const mockup = input.useMockup && input.productId ? await deps.loadMockup(input.productId) : null;
    const fallback = slideText ? `${ideaCreativa}. ${slideText}` : ideaCreativa;
    const prompt = input.brief && !isBriefEmpty(input.brief)
      ? buildImagePromptFromBrief(input.brief, { provider: input.provider ?? "GPT", hasMockup: !!mockup, fallback })
      : buildImagePrompt({ ideaCreativa, slideText, hasMockup: !!mockup });
    const dims = briefDimensions(input.brief?.formato);
    const opts = { styleId: input.styleId ?? input.brief?.stile, soulSize: dims.soul };
    const bytes = await deps.callOpenAI(prompt, mockup ?? undefined, input.provider, opts);
```
(import `buildImagePromptFromBrief, isBriefEmpty, briefDimensions` from `./brief`.)

- [ ] **Step 3: Routes pass brief+styleId** — in both `src/app/api/meta/contents/[id]/image/route.ts` and `src/app/api/blog/contents/[id]/image/route.ts`, add `brief: parsed.data.brief, styleId: parsed.data.styleId` to the `run({...})` input. (Blog route's `imageInputSchema` is imported from meta validators — already includes brief/styleId.)

- [ ] **Step 4: Verify + commit**
Run: `npx vitest run && npx tsc --noEmit && npm run build`
```bash
git add src/app/api/meta/validators.ts "src/app/api/meta/contents/[id]/image/route.ts" "src/app/api/blog/contents/[id]/image/route.ts" src/lib/image/generate.ts src/lib/image/runtime.ts
git commit -m "feat: pass image brief + styleId through routes into the image pipeline"
```

---

## Task 7: UI — brief filters + Higgsfield style picker (Meta + Blog)

**Files:** Create `src/components/image-brief.tsx`; Modify `src/app/meta/[id]/page.tsx`, `src/app/blog/[id]/page.tsx`

- [ ] **Step 1: Brief component** `src/components/image-brief.tsx` (`"use client"`):
```tsx
"use client";
import { useEffect, useState } from "react";

export interface Brief {
  soggetto?: string; ambientazione?: string; luce?: string; inquadratura?: string; mood?: string;
  formato?: "verticale" | "quadrato" | "orizzontale"; stile?: string; tieneProdotto?: boolean; note?: string;
}
const AMBIENTAZIONI = ["cucina luminosa", "bagno spa", "esterno naturale", "studio minimal", "camera accogliente", "palestra"];
const LUCI = ["luce naturale morbida", "golden hour", "studio softbox", "luce mattutina"];
const INQUADRATURE = ["primo piano", "medio busto", "figura intera", "dall'alto (flat lay)", "selfie 0.5"];
const MOOD = ["autentico UGC", "fresco ed energico", "calmo e rilassante", "lusso", "naturale"];

export function ImageBriefForm({ provider, value, onChange }: { provider: string; value: Brief; onChange: (b: Brief) => void }) {
  const [styles, setStyles] = useState<{ id: string; name: string; previewUrl: string | null }[]>([]);
  useEffect(() => {
    if (provider === "HIGGSFIELD") fetch("/api/higgsfield/soul-styles").then((r) => r.json()).then((d) => setStyles(Array.isArray(d) ? d : [])).catch(() => setStyles([]));
  }, [provider]);
  const set = (k: keyof Brief, v: unknown) => onChange({ ...value, [k]: v });
  const sel = (k: keyof Brief, opts: string[], label: string) => (
    <label className="flex flex-col text-xs">{label}
      <select className="rounded border p-1" value={(value[k] as string) ?? ""} onChange={(e) => set(k, e.target.value || undefined)}>
        <option value="">—</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
  return (
    <div className="mb-3 rounded border bg-neutral-50 p-3">
      <div className="mb-2 text-sm font-medium">Brief immagine</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sel("ambientazione", AMBIENTAZIONI, "Ambientazione")}
        {sel("luce", LUCI, "Luce")}
        {sel("inquadratura", INQUADRATURE, "Inquadratura")}
        {sel("mood", MOOD, "Mood")}
        <label className="flex flex-col text-xs">Formato
          <select className="rounded border p-1" value={value.formato ?? "quadrato"} onChange={(e) => set("formato", e.target.value)}>
            <option value="quadrato">Quadrato</option><option value="verticale">Verticale</option><option value="orizzontale">Orizzontale</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!value.tieneProdotto} onChange={(e) => set("tieneProdotto", e.target.checked)} /> Tiene il prodotto</label>
      </div>
      <input className="mt-2 w-full rounded border p-1 text-sm" placeholder="Soggetto / descrizione (opzionale)" value={value.soggetto ?? ""} onChange={(e) => set("soggetto", e.target.value || undefined)} />
      {provider === "HIGGSFIELD" && (
        <label className="mt-2 flex flex-col text-xs">Stile UGC (Higgsfield)
          <select className="rounded border p-1" value={value.stile ?? ""} onChange={(e) => set("stile", e.target.value || undefined)}>
            <option value="">Default (Realistic)</option>
            {styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into Meta detail** `src/app/meta/[id]/page.tsx`: import `ImageBriefForm, type Brief`; add `const [brief, setBrief] = useState<Brief>({});`; render `<ImageBriefForm provider={provider} value={brief} onChange={setBrief} />` inside the image panel; in `genImage`, add `brief, styleId: brief.stile` to the POST body. (For carousel, a single shared brief is acceptable for v1; per-slide override is a later enhancement — note it in the UI.)

- [ ] **Step 3: Wire into Blog detail** `src/app/blog/[id]/page.tsx`: same — add brief state + `<ImageBriefForm>` in the "Immagine in evidenza" panel; include `brief, styleId: brief.stile` in the genImage POST body.

- [ ] **Step 4: Verify + commit**
Run: `npx tsc --noEmit && npm run build`
```bash
git add src/components/image-brief.tsx "src/app/meta/[id]/page.tsx" "src/app/blog/[id]/page.tsx"
git commit -m "feat: image brief filters UI + Higgsfield style picker (Meta + Blog)"
```

---

## Task 8: Gate + smoke

- [ ] **Step 1: Gate** — `npx vitest run && npx tsc --noEmit && npm run build` (green).
- [ ] **Step 2: Smoke (all keys + Shopify):** start dev server.
  - **Blog decoupling:** generate a blog article (`POST /api/blog/generate {ideaId}`) → DONE, content saved with NO asset (image step removed). Open `/blog/<id>` → article visible without image; generate the image on-demand via the brief → asset appears. (Article survives even if image generation errors.)
  - **Brief → GPT:** `/meta/<id>` set brief (ambientazione/luce/inquadratura/mood/tieneProdotto), provider GPT → generate → clean realistic image; confirm no slide/text artifacts.
  - **Higgsfield UGC:** `GET /api/higgsfield/soul-styles` returns ~106; pick an UGC style (e.g. iPhone) → generate via Higgsfield → realistic UGC image (no text/collage). With a product mockup → reference applied.
  - Report: blog-without-image works, brief-driven GPT image, Higgsfield styled image, styles count, and any error verbatim.
- [ ] **Step 3: Stop the server.**

---

## Self-Review (addressed)
- **Spec coverage:** §2 decouple blog (T1); §3 brief + per-provider prompt (T2) + pipeline use (T6); §4 Higgsfield v1 soul + styles (T3,T4) + product ref (T5); §5 API+UI (T6,T7); §6 migration (T5); §8 testing across; §10 backlog mapped 1:1.
- **Type consistency:** `ImageBrief`/`buildImagePromptFromBrief`/`isBriefEmpty`/`briefDimensions` (T2) used in generate.ts (T6); `generateWithProvider(...,opts)` + `ProviderOpts` (T4) used by runtime callOpenAI (T4) and fed from brief (T6); `imageInputSchema.brief/styleId` (T6) matches routes + UI POST (T6,T7); `listSoulStyles`/`SoulStyle` (T3) used by UI (T7) + API (T3).
- **No placeholders:** all code complete; T5 is an explicit live-verification gate (SoulId vs input_images) with a documented decision, not a vague TODO.
- **Decoupling note:** removing `generateImage` from blog deps requires updating `blog/generate.test.ts` (T1 Step1) and removing now-unused imports in runtime (T1 Step3) — flagged.
