# Meta Carousel Per-Image Product Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick a product (or none) per image — the Meta post and each carousel slide independently — instead of one global product/mockup shared by all images.

**Architecture:** UI-only change to `/meta/[id]`. A small reusable `ProductMockupPicker` controlled component renders the product `<select>` + mockup checkbox + thumbnail for one image; the page holds a `perImage` map keyed by `"post"`/slide-index and reads it in `genImage`. The mockup invariant (no product ⇒ `useMockup` false) lives in two pure helpers that are unit-tested. No API/schema/validator/generation changes — `POST /api/meta/contents/[id]/image` already accepts `productId`/`useMockup`/`slideIndex` per request.

**Tech Stack:** Next.js 15 (App Router) client component, React 19, Tailwind, Vitest (node env — pure helpers unit-tested; component verified by typecheck + live smoke).

## Global Constraints

- UI copy in **Italian**, code/identifiers in **English**.
- **No** changes to API routes, Prisma schema, validators (`imageInputSchema`), or image-generation logic. The POST body to `/api/meta/contents/[id]/image` keeps its current shape (`slideIndex`, `productId`, `useMockup`, `provider`, `brief`, `styleId`).
- Keep `provider` and `brief` **global** page state (not per-slide).
- Do NOT restyle the `/meta/[id]` page — follow its existing default-Tailwind style.
- Preserve the existing guard: a mockup is only sent when a product is selected (`useMockup && !!productId`).
- Vitest runs in **node** env — unit-test pure functions only; do NOT add a React-render test. (Precedent: `src/components/status-badge.test.tsx` imports a pure function from a `.tsx` and runs in node env.)
- Path alias `@/` → `./src`.
- Commit message footer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: ProductMockupPicker component + pure helpers + tests

**Files:**
- Create: `src/components/product-mockup-picker.tsx`
- Test: `src/components/product-mockup-picker.test.ts`

**Interfaces:**
- Produces:
  - `interface ProductOption { id: string; nome: string; imagePath: string | null }`
  - `interface ProductMockupValue { productId: string; useMockup: boolean }`
  - `withProduct(value: ProductMockupValue, productId: string): ProductMockupValue` — sets `productId`; keeps `useMockup` only if `productId` is non-empty, else false.
  - `withMockup(value: ProductMockupValue, useMockup: boolean): ProductMockupValue` — sets `useMockup` only if a product is selected, else false.
  - `ProductMockupPicker({ products: ProductOption[], value: ProductMockupValue, onChange: (next: ProductMockupValue) => void }): JSX.Element`

- [ ] **Step 1: Write the failing tests**

`src/components/product-mockup-picker.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { withProduct, withMockup } from "@/components/product-mockup-picker";

describe("withProduct", () => {
  it("keeps useMockup when switching to another product", () => {
    expect(withProduct({ productId: "p1", useMockup: true }, "p2")).toEqual({ productId: "p2", useMockup: true });
  });
  it("forces useMockup off when the product is cleared", () => {
    expect(withProduct({ productId: "p1", useMockup: true }, "")).toEqual({ productId: "", useMockup: false });
  });
});

describe("withMockup", () => {
  it("enables the mockup when a product is selected", () => {
    expect(withMockup({ productId: "p1", useMockup: false }, true)).toEqual({ productId: "p1", useMockup: true });
  });
  it("cannot enable the mockup without a product", () => {
    expect(withMockup({ productId: "", useMockup: false }, true)).toEqual({ productId: "", useMockup: false });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/product-mockup-picker.test.ts`
Expected: FAIL — "Cannot find module '@/components/product-mockup-picker'" / `withProduct`/`withMockup` undefined.

- [ ] **Step 3: Create the component + helpers**

`src/components/product-mockup-picker.tsx`:

```tsx
"use client";

export interface ProductOption { id: string; nome: string; imagePath: string | null }
export interface ProductMockupValue { productId: string; useMockup: boolean }

// Invariant: no product selected => useMockup must be false.
export function withProduct(value: ProductMockupValue, productId: string): ProductMockupValue {
  return { productId, useMockup: productId ? value.useMockup : false };
}
export function withMockup(value: ProductMockupValue, useMockup: boolean): ProductMockupValue {
  return { productId: value.productId, useMockup: value.productId ? useMockup : false };
}

export function ProductMockupPicker({ products, value, onChange }: {
  products: ProductOption[];
  value: ProductMockupValue;
  onChange: (next: ProductMockupValue) => void;
}) {
  const withImage = products.filter((p) => p.imagePath);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <select
        value={value.productId}
        onChange={(e) => onChange(withProduct(value, e.target.value))}
        className="rounded border p-1"
      >
        <option value="">Nessun prodotto</option>
        {withImage.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={value.useMockup}
          onChange={(e) => onChange(withMockup(value, e.target.checked))}
          disabled={!value.productId}
        />
        Includi il mockup nel contesto (image-edit)
      </label>
      {value.productId && value.useMockup && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/products/${value.productId}/image`} alt="" className="h-14 w-14 rounded border object-contain" />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/product-mockup-picker.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/product-mockup-picker.tsx src/components/product-mockup-picker.test.ts
git commit -m "feat(meta): ProductMockupPicker component + per-image mockup invariant helpers + tests"
```

---

### Task 2: Wire per-image product selection into the Meta detail page

**Files:**
- Modify (full rewrite): `src/app/meta/[id]/page.tsx`

**Interfaces:**
- Consumes: `ProductMockupPicker`, `ProductMockupValue` from `@/components/product-mockup-picker` (Task 1).

- [ ] **Step 1: Replace the page with the per-image version**

Overwrite `src/app/meta/[id]/page.tsx` with exactly this (removes the global `refProductId`/`useMockup`; adds `perImage` map + `keyFor`/`valueFor`/`setValueFor`; the top box keeps only provider + brief; the post block and each slide block render their own `ProductMockupPicker`; `genImage` reads the per-image value):

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { CONTENT_STATUSES } from "@/lib/meta/enums";
import { ImageBriefForm, type Brief } from "@/components/image-brief";
import { ProductMockupPicker, type ProductMockupValue } from "@/components/product-mockup-picker";

interface Asset { id: string; slideIndex: number | null; }
interface Content {
  id: string;
  formato: string;
  piattaforme: string[];
  status: string;
  dataPrevista: string | null;
  payload: { caption?: string; ideaCreativa?: string; hashtags?: string[]; cta?: string; slides?: { testo: string }[] };
  modello: string;
  idea?: { id: string; titolo: string } | null;
  assets: Asset[];
}

export default function MetaContentDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Content | null>(null);
  const [busyImg, setBusyImg] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [products, setProducts] = useState<{ id: string; nome: string; imagePath: string | null }[]>([]);
  const [provider, setProvider] = useState("GPT");
  const [brief, setBrief] = useState<Brief>({});
  const [perImage, setPerImage] = useState<Record<string, ProductMockupValue>>({});
  useEffect(() => { fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([])); }, []);

  const keyFor = (slideIndex: number | null) => (slideIndex === null ? "post" : String(slideIndex));
  const valueFor = (slideIndex: number | null): ProductMockupValue => perImage[keyFor(slideIndex)] ?? { productId: "", useMockup: false };
  const setValueFor = (slideIndex: number | null, next: ProductMockupValue) => setPerImage((prev) => ({ ...prev, [keyFor(slideIndex)]: next }));

  const load = useCallback(async () => {
    const res = await fetch(`/api/meta/contents/${id}`);
    setC(await res.json());
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const patch = async (data: Record<string, unknown>) => {
    await fetch(`/api/meta/contents/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    await load();
  };

  const genImage = async (slideIndex: number | null) => {
    setBusyImg(`${slideIndex}`); setMsg(null);
    const v = valueFor(slideIndex);
    const res = await fetch(`/api/meta/contents/${id}/image`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slideIndex, productId: v.productId || undefined, useMockup: v.useMockup && !!v.productId, provider, brief, styleId: brief.stile }),
    });
    const json = await res.json();
    setBusyImg(null);
    if (res.ok) await load(); else setMsg(`Errore immagine: ${json.error ?? "sconosciuto"}`);
  };

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

  if (!c) return <p>Caricamento…</p>;
  const assetFor = (slideIndex: number | null) => c.assets.find((a) => a.slideIndex === slideIndex);
  const p = c.payload ?? {};

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">{c.idea?.titolo ?? "Contenuto Meta"}</h1>
      <p className="mb-4 text-sm text-neutral-500">{c.formato} · {c.piattaforme.join(", ")}</p>

      <label className="mb-2 block text-sm">Caption</label>
      <textarea className="mb-3 w-full rounded border p-2" rows={3} defaultValue={p.caption ?? ""} onBlur={(e) => patch({ payload: { ...p, caption: e.target.value } })} />

      <label className="mb-2 block text-sm">Idea creativa (concept immagine)</label>
      <textarea className="mb-3 w-full rounded border p-2" rows={2} defaultValue={p.ideaCreativa ?? ""} onBlur={(e) => patch({ payload: { ...p, ideaCreativa: e.target.value } })} />

      <label className="mb-2 block text-sm">CTA</label>
      <input className="mb-3 w-full rounded border p-2" defaultValue={p.cta ?? ""} onBlur={(e) => patch({ payload: { ...p, cta: e.target.value } })} />

      <p className="mb-3 text-sm text-neutral-600">Hashtag: {(p.hashtags ?? []).join(" ")}</p>

      <div className="mb-4 rounded border bg-neutral-50 p-3 text-sm">
        <div className="mb-2 font-medium">Generatore immagini (provider + brief)</div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded border p-1">
            <option value="GPT">GPT (OpenAI)</option>
            <option value="GEMINI">Gemini (nano banana)</option>
            <option value="HIGGSFIELD">Higgsfield</option>
            <option value="MANUAL">Caricamento manuale</option>
          </select>
        </div>
        <p className="mt-1 text-xs text-neutral-500">Provider e brief valgono per tutte le immagini. Il prodotto si sceglie per singola immagine qui sotto.</p>
        <ImageBriefForm provider={provider} value={brief} onChange={setBrief} />
      </div>

      <div className="mb-4">
        <h2 className="mb-2 font-medium">Immagine principale</h2>
        {assetFor(null) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/assets/${assetFor(null)!.id}`} alt="" className="mb-2 w-64 rounded border" />
        ) : <p className="text-sm text-neutral-500">Nessuna immagine.</p>}
        {provider === "MANUAL" ? (
          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(null, f); }} className="text-sm" />
        ) : (
          <>
            <div className="mb-2"><ProductMockupPicker products={products} value={valueFor(null)} onChange={(v) => setValueFor(null, v)} /></div>
            <button onClick={() => genImage(null)} disabled={busyImg === "null"} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-40">{busyImg === "null" ? "Genero…" : "Genera immagine"}</button>
          </>
        )}
      </div>

      {c.formato === "CAROSELLO" && (p.slides ?? []).map((s, idx) => (
        <div key={idx} className="mb-4 rounded border p-3">
          <p className="mb-2 text-sm font-medium">Slide {idx + 1}</p>
          <textarea className="mb-2 w-full rounded border p-2" rows={2} defaultValue={s.testo} onBlur={(e) => { const slides = [...(p.slides ?? [])]; slides[idx] = { testo: e.target.value }; patch({ payload: { ...p, slides } }); }} />
          {assetFor(idx) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/assets/${assetFor(idx)!.id}`} alt="" className="mb-2 w-48 rounded border" />
          ) : null}
          {provider === "MANUAL" ? (
            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(idx, f); }} className="text-sm" />
          ) : (
            <>
              <div className="mb-2"><ProductMockupPicker products={products} value={valueFor(idx)} onChange={(v) => setValueFor(idx, v)} /></div>
              <button onClick={() => genImage(idx)} disabled={busyImg === `${idx}`} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-40">{busyImg === `${idx}` ? "Genero…" : "Genera immagine slide"}</button>
            </>
          )}
        </div>
      ))}

      <div className="mt-4 flex items-center gap-4 text-sm">
        <label>Stato:&nbsp;
          <select value={c.status} onChange={(e) => patch({ status: e.target.value })} className="rounded border p-1">
            {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Data prevista:&nbsp;
          <input type="date" defaultValue={c.dataPrevista ? c.dataPrevista.slice(0, 10) : ""} onChange={(e) => patch({ dataPrevista: e.target.value ? new Date(e.target.value).toISOString() : null })} className="rounded border p-1" />
        </label>
      </div>
      {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
      <p className="mt-4 text-xs text-neutral-400">Testo generato da {c.modello}</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (confirms `refProductId`/`useMockup` are fully removed and the new imports/usages line up).

- [ ] **Step 3: Full test suite (no regression)**

Run: `npm run test`
Expected: PASS, all suites green (including the new `product-mockup-picker.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add "src/app/meta/[id]/page.tsx"
git commit -m "feat(meta): per-image product selection for carousel + post images"
```

---

### Task 3: Verification + live smoke

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; production build succeeds (if `npm run build` fails ONLY on next/font Google-Fonts network fetch, rely on tsc and note it).

- [ ] **Step 2: Live smoke (manual, needs the dev server + a CAROSELLO content)**

With `npm run dev` running and Postgres up, open a CAROSELLO at `/meta/[id]` and verify:
- The top box shows only provider + brief (no product select).
- The post block and every slide block each show their own product `<select>` + "Includi il mockup" checkbox, defaulting to "Nessun prodotto" with the checkbox disabled.
- Set slide 1 → product A + mockup on, slide 2 → "Nessun prodotto", post → product B + mockup on; generate each. Confirm slide 1 and post are product-guided and slide 2 is generated with no product (the POST bodies carry the per-image `productId`/`useMockup`).
- Clearing a slide's product disables and forces off its mockup checkbox.

- [ ] **Step 3: Commit (only if smoke required a fix)**

```bash
git add -A
git commit -m "fix(meta): polish after live smoke"
```

---

## Self-Review

**Spec coverage:**
- `ProductMockupPicker` component (select + checkbox + thumbnail, image-filtered, mockup-requires-product) → Task 1 ✓
- Mockup invariant (clear product ⇒ useMockup false) → Task 1 helpers + tests ✓
- Per-image `perImage` map keyed `"post"`/index, `valueFor`/`setValueFor`, default no product → Task 2 ✓
- Top box keeps provider + brief only → Task 2 ✓
- Post + each slide render their own picker; hidden under MANUAL → Task 2 ✓
- `genImage` sends per-image `productId`/`useMockup` with the `useMockup && !!productId` guard, provider/brief/styleId unchanged → Task 2 ✓
- No API/schema/validator/generation changes; POST body shape unchanged → honored (only page + new component touched) ✓
- Node-env unit tests on pure helpers; component via typecheck + smoke → Tasks 1, 3 ✓

**Placeholder scan:** No "TBD"/"add error handling"/"similar to" — full file content and full test code shown. ✓

**Type consistency:** `ProductMockupValue` defined in Task 1 and consumed in Task 2; `withProduct`/`withMockup` names match between helper, tests, and component; `valueFor`/`setValueFor`/`keyFor` consistent within Task 2; `ProductMockupPicker` prop names (`products`/`value`/`onChange`) identical in definition (Task 1) and call sites (Task 2). ✓
