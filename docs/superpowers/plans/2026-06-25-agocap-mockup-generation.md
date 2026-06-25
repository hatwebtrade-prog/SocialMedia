# Product Mockup in Image Generation (Fase B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let the image generation optionally use a product mockup as input to OpenAI image-edit (gpt-image-1) — the generated main image is guided by the real product. Meta content detail gets a product selector + an "include mockup" checkbox (works for post and each carosello slide). Image module change is reusable (Blog can adopt later).

**Decisions (brainstormed):** mockup stored 2500×2500 (Fase A); resize down to 1024×1024 for the API; image-edit so the product guides the image.

**Branch:** `mockup-generation` (off `brain-mvp-clean`). Local Postgres via `.env`.

**Current state:** `src/lib/image/generate.ts` — `ImageGenInput {contentId, slideIndex}`, `ImageDeps {loadContent, callOpenAI(prompt)→Buffer, persistAsset}`, `generateImageAsset`. `src/lib/image/runtime.ts` — `buildImageRuntimeDeps`: `loadContent` (reads meta payload ideaCreativa/slides), `callOpenAI` uses `client.images.generate({model:IMAGE_MODEL, prompt, size:"1024x1024"})` → b64, `persistAsset` (saveAssetFile). `src/app/api/meta/validators.ts` `imageInputSchema { slideIndex? }`. `src/app/api/meta/contents/[id]/image/route.ts` posts `{contentId, slideIndex}`. `src/app/meta/[id]/page.tsx` has "Genera immagine" (slideIndex null) + per-slide buttons calling `genImage(slideIndex)`. `Product.imagePath` holds the 2500×2500 mockup rel path; `sharp` installed; `/api/products` lists products (with `imagePath`); `/api/products/[id]/image` serves the mockup.

---

## Task 1: Image module — mockup → OpenAI image-edit

**Files:** Modify `src/lib/image/generate.ts`, `src/lib/image/runtime.ts`, `src/lib/image/generate.test.ts`, `src/app/api/meta/validators.ts`, `src/app/api/meta/contents/[id]/image/route.ts`

- [ ] **Step 1: Update the pipeline test**

In `src/lib/image/generate.test.ts`, add to `makeDeps`:
```ts
    loadMockup: vi.fn().mockResolvedValue(Buffer.from("mockbytes")),
```
Add a test inside the describe:
```ts
  it("loads the mockup and passes it to OpenAI when useMockup", async () => {
    const deps = makeDeps();
    await generateImageAsset({ contentId: "c1", slideIndex: null, productId: "p1", useMockup: true }, deps as any);
    expect(deps.loadMockup).toHaveBeenCalledWith("p1");
    expect((deps.callOpenAI as any).mock.calls[0][1]).toBeInstanceOf(Buffer);
  });
  it("does NOT load a mockup when useMockup is false/absent", async () => {
    const deps = makeDeps();
    await generateImageAsset({ contentId: "c1", slideIndex: null }, deps as any);
    expect(deps.loadMockup).not.toHaveBeenCalled();
    expect((deps.callOpenAI as any).mock.calls[0][1]).toBeUndefined();
  });
```
Run `npx vitest run src/lib/image/generate.test.ts`; confirm the new tests FAIL.

- [ ] **Step 2: Update `src/lib/image/generate.ts`**

- `ImageGenInput` gains optional fields:
```ts
export interface ImageGenInput {
  contentId: string;
  slideIndex: number | null;
  productId?: string;
  useMockup?: boolean;
}
```
- `ImageDeps`: change `callOpenAI` signature and add `loadMockup`:
```ts
export interface ImageDeps {
  loadContent: (contentId: string, slideIndex: number | null) => Promise<{ ideaCreativa: string; slideText: string | null }>;
  loadMockup: (productId: string) => Promise<Buffer | null>;
  callOpenAI: (prompt: string, mockup?: Buffer) => Promise<Buffer>;
  persistAsset: (args: { input: ImageGenInput; prompt: string; bytes: Buffer }) => Promise<{ assetId: string }>;
}
```
- In `generateImageAsset`, load the mockup and pass it:
```ts
    const { ideaCreativa, slideText } = await deps.loadContent(input.contentId, input.slideIndex);
    const prompt = buildImagePrompt({ ideaCreativa, slideText });
    const mockup = input.useMockup && input.productId ? await deps.loadMockup(input.productId) : null;
    const bytes = await deps.callOpenAI(prompt, mockup ?? undefined);
    const { assetId } = await deps.persistAsset({ input, prompt, bytes });
    return { status: "DONE", assetId };
```

- [ ] **Step 3: Update `src/lib/image/runtime.ts`**

- Add imports:
```ts
import sharp from "sharp";
import path from "node:path";
import { readFileSync } from "node:fs";
import { toFile } from "openai";
```
- Add `loadMockup` to the returned deps:
```ts
    loadMockup: async (productId) => {
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { imagePath: true } });
      if (!product?.imagePath) return null;
      try {
        const abs = path.join(process.cwd(), product.imagePath);
        const buf = readFileSync(abs);
        return await sharp(buf).resize(1024, 1024, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
      } catch {
        return null;
      }
    },
```
- Replace `callOpenAI` with one that branches on `mockup`:
```ts
    callOpenAI: async (prompt, mockup) => {
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
    },
```
(Keep `loadContent`/`persistAsset` unchanged. NOTE: confirm `toFile` is importable from `"openai"` in the installed SDK — if tsc/build fails on that import, import from `"openai/uploads"` instead; the smoke (Task 3) confirms the edit call shape live.)

- [ ] **Step 4: Validators + route**

In `src/app/api/meta/validators.ts`, extend `imageInputSchema`:
```ts
export const imageInputSchema = z.object({
  slideIndex: z.number().int().min(0).nullable().optional(),
  productId: z.string().optional(),
  useMockup: z.boolean().optional(),
});
```
In `src/app/api/meta/contents/[id]/image/route.ts`, pass the new fields:
```ts
  const result = await run({ contentId: id, slideIndex, productId: parsed.data.productId, useMockup: parsed.data.useMockup }, deps);
```

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run src/lib/image/generate.test.ts && npx vitest run && npx tsc --noEmit && npm run build`
Expected: image tests pass (incl. 2 new); full suite green; tsc 0; build ok.
```bash
git add src/lib/image/generate.ts src/lib/image/runtime.ts src/lib/image/generate.test.ts src/app/api/meta/validators.ts "src/app/api/meta/contents/[id]/image/route.ts"
git commit -m "feat: image generation can use a product mockup via OpenAI image-edit"
```

---

## Task 2: Meta detail — mockup selector + checkbox

**Files:** Modify `src/app/meta/[id]/page.tsx`

- [ ] **Step 1: Add product selection state + UI**

In `src/app/meta/[id]/page.tsx`:
- Add state near the top of the component:
```tsx
  const [products, setProducts] = useState<{ id: string; nome: string; imagePath: string | null }[]>([]);
  const [refProductId, setRefProductId] = useState("");
  const [useMockup, setUseMockup] = useState(false);
  useEffect(() => { fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([])); }, []);
```
- Change `genImage` to pass the mockup choice:
```tsx
  const genImage = async (slideIndex: number | null) => {
    setBusyImg(`${slideIndex}`); setMsg(null);
    const res = await fetch(`/api/meta/contents/${id}/image`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slideIndex, productId: refProductId || undefined, useMockup: useMockup && !!refProductId }),
    });
    const json = await res.json();
    setBusyImg(null);
    if (res.ok) await load(); else setMsg(`Errore immagine: ${json.error ?? "sconosciuto"}`);
  };
```
- Add a "reference product" panel just above the "Immagine principale" `<div>` (after the hashtag line):
```tsx
      <div className="mb-4 rounded border bg-neutral-50 p-3 text-sm">
        <div className="mb-2 font-medium">Immagine prodotto (mockup) per la generazione</div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={refProductId} onChange={(e) => setRefProductId(e.target.value)} className="rounded border p-1">
            <option value="">Nessun prodotto</option>
            {products.filter((p) => p.imagePath).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={useMockup} onChange={(e) => setUseMockup(e.target.checked)} disabled={!refProductId} />
            Inserisci il mockup nel contesto (image-edit)
          </label>
          {refProductId && useMockup && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/products/${refProductId}/image`} alt="" className="h-14 w-14 rounded border object-contain" />
          )}
        </div>
        <p className="mt-1 text-xs text-neutral-500">Se attivo, l'immagine generata (post o slide) sarà guidata dal mockup reale del prodotto.</p>
      </div>
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit && npm run build`
```bash
git add "src/app/meta/[id]/page.tsx"
git commit -m "feat: Meta detail product-mockup selector + include-in-context checkbox"
```

---

## Task 3: Gate + smoke (live OpenAI image-edit)

- [ ] **Step 1: Gate** — `npx vitest run && npx tsc --noEmit && npm run build` (green).
- [ ] **Step 2: Smoke (SHOPIFY_* + OPENAI + ANTHROPIC keys):** start dev server.
  - Ensure products are imported with mockups (`POST /api/products/import-shopify` if needed); pick a product id with imagePath.
  - Need a Meta content (generate one from an approved idea, or use an existing META content id).
  - **Image-edit live:** `POST /api/meta/contents/<contentId>/image` with `{"slideIndex": null, "productId": "<prodId>", "useMockup": true}` (timeout ~120s). Expect 200 `{status:"DONE", assetId}`. If 502, report the exact error (this confirms the OpenAI `images.edit` call shape + the `toFile` import; if the SDK rejects the import/params, fix per Task 1 step 3 note and retry).
  - `GET /api/meta/contents/<contentId>` → an asset exists; `GET /api/assets/<assetId>` returns a PNG image (the product-guided image).
  - **Plain path still works:** `POST .../image {"slideIndex": null}` (no mockup) → DONE (images.generate path).
  - Open `/meta/<id>`: the "Immagine prodotto (mockup)" panel shows the product select + checkbox + thumbnail; generating with it produces a product-guided image.
  Report: the exact edit response, that an image asset was produced, the confirmed OpenAI edit call works (or the error), and that the no-mockup path still works.
- [ ] **Step 3: Stop the server.**

---

## Self-Review (addressed)
- **Coverage:** image module gains `loadMockup` + mockup→`images.edit` path (T1, pipeline tested for both branches); validators+route pass productId/useMockup (T1); Meta detail mockup selector + checkbox + thumbnail, applied to post and each slide (T2); gate + live OpenAI-edit smoke incl. the no-mockup regression path (T3). Blog featured image can adopt the same module change as a small follow-up.
- **Types:** `ImageGenInput.productId/useMockup` + `ImageDeps.loadMockup` + `callOpenAI(prompt, mockup?)` consistent across generate.ts/runtime.ts/test; `imageInputSchema` matches the route body; mockup resized 2500→1024 for the API; `Product.imagePath` read in loadMockup.
- **No placeholders:** mockup is opt-in (useMockup && productId); loadMockup degrades to null (then plain generate); the `toFile` import has a documented fallback verified at smoke.
```
