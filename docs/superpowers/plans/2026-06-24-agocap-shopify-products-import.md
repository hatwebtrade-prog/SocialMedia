# Shopify Products Import (idea generation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Import the Shopify product catalogue into the local `Product` table (upsert, enriched with metafields) and let all three idea-generation modes pick a reference product from that list.

**Design decisions (brainstormed):** import-to-DB via upsert by `handle`; enrich `descrizione` (from `descrizione_seo`) and `ingredienti` (from `ingredienti_dettagliati`) metafields. Reuse `fetchProductsWithMetafields()` (src/lib/shopify/products.ts).

**Branch:** `shopify-products-import` (off `brain-mvp-clean`). Local Postgres via `.env`.

**Current state:** `Product` (nome, categoria?, descrizione?, benefici?, ingredienti?, target?, url?, attivo, ideas[]) — NO handle. `/api/products` GET lists products, POST creates one. `ShopProduct = {handle, titolo, url, categoria, metafields}`. Genera hub `/genera` has 3 tabs: ScopriKeyword (already has product select from `/api/products`), `AiBrainstormForm` (free-text "Prodotto in focus" → `prodotto`), `ManualIdeaForm` (no product). `manualIdeaSchema` already supports `productId`.

---

## Task 1: Prisma — Product.handle (unique)

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1:** In `model Product`, add (after `url`):
```prisma
  handle      String?         @unique
```
- [ ] **Step 2:** Run `npx prisma validate && npx prisma migrate dev --name product_handle && npx prisma generate && npx tsc --noEmit`. Expected: valid; additive migration (nullable unique column); tsc 0. If DB unreachable, report BLOCKED.
- [ ] **Step 3:** Commit:
```bash
git add prisma/
git commit -m "feat: Product.handle (unique) for Shopify upsert"
```

---

## Task 2: Import mapping + endpoint

**Files:** Create `src/lib/shopify/import-products.ts`, `src/app/api/products/import-shopify/route.ts`; Test `src/lib/shopify/import-products.test.ts`

- [ ] **Step 1: Failing test (pure mapper)**

`src/lib/shopify/import-products.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mapShopProductToProduct } from "@/lib/shopify/import-products";

describe("mapShopProductToProduct", () => {
  it("maps fields + enriches from metafields", () => {
    const out = mapShopProductToProduct({
      handle: "magnesio-supremo", titolo: "Magnesio Supremo", url: "https://x/products/magnesio-supremo",
      categoria: "Integratori",
      metafields: { descrizione_seo: "Integratore di magnesio", ingredienti_dettagliati: "Magnesio citrato" },
    });
    expect(out).toEqual({
      handle: "magnesio-supremo", nome: "Magnesio Supremo", categoria: "Integratori",
      url: "https://x/products/magnesio-supremo", descrizione: "Integratore di magnesio", ingredienti: "Magnesio citrato",
    });
  });
  it("uses null for missing categoria/metafields", () => {
    const out = mapShopProductToProduct({ handle: "x", titolo: "X", url: "u", categoria: "", metafields: {} });
    expect(out.categoria).toBeNull();
    expect(out.descrizione).toBeNull();
    expect(out.ingredienti).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL, implement**

`src/lib/shopify/import-products.ts`:
```ts
import { prisma } from "@/lib/prisma";
import { fetchProductsWithMetafields, type ShopProduct } from "./products";

export interface MappedProduct {
  handle: string;
  nome: string;
  categoria: string | null;
  url: string;
  descrizione: string | null;
  ingredienti: string | null;
}

export function mapShopProductToProduct(p: ShopProduct): MappedProduct {
  return {
    handle: p.handle,
    nome: p.titolo,
    categoria: p.categoria || null,
    url: p.url,
    descrizione: p.metafields["descrizione_seo"] ?? null,
    ingredienti: p.metafields["ingredienti_dettagliati"] ?? null,
  };
}

/** Fetches Shopify products and upserts them into the local Product table (by handle). */
export async function importShopifyProducts(): Promise<{ imported: number }> {
  const products = await fetchProductsWithMetafields();
  let imported = 0;
  for (const p of products) {
    const data = mapShopProductToProduct(p);
    await prisma.product.upsert({
      where: { handle: data.handle },
      update: { nome: data.nome, categoria: data.categoria, url: data.url, descrizione: data.descrizione, ingredienti: data.ingredienti },
      create: data,
    });
    imported++;
  }
  return { imported };
}
```

- [ ] **Step 3: Route**

`src/app/api/products/import-shopify/route.ts`:
```ts
import { NextResponse } from "next/server";
import { importShopifyProducts } from "@/lib/shopify/import-products";

export async function POST() {
  try {
    const result = await importShopifyProducts();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore import Shopify" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Verify + commit**

Run: `npx vitest run src/lib/shopify/import-products.test.ts && npx vitest run && npx tsc --noEmit && npm run build`
```bash
git add src/lib/shopify/import-products.ts src/lib/shopify/import-products.test.ts src/app/api/products/import-shopify/
git commit -m "feat: import Shopify products into Product table (upsert + metafields)"
```

---

## Task 3: UI — import button + product selectors in generation

**Files:** Create `src/components/import-products-button.tsx`; Modify `src/app/genera/page.tsx`, `src/components/forms/ai-brainstorm-form.tsx`, `src/components/forms/manual-idea-form.tsx`

- [ ] **Step 1: Import button component**

`src/components/import-products-button.tsx`:
```tsx
"use client";

import { useState } from "react";

export function ImportProductsButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/products/import-shopify", { method: "POST" });
      const json = await res.json();
      setMsg(res.ok ? `Importati ${json.imported} prodotti da Shopify.` : `Errore: ${json.error ?? "sconosciuto"}`);
    } catch { setMsg("Errore di rete."); } finally { setBusy(false); }
  };
  return (
    <div className="mb-4 flex items-center gap-3 text-sm">
      <button onClick={run} disabled={busy} className="rounded border px-3 py-1 disabled:opacity-40">{busy ? "Importo…" : "Importa prodotti da Shopify"}</button>
      {msg && <span className="text-neutral-600">{msg}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Show the import button in the hub**

In `src/app/genera/page.tsx`, import `ImportProductsButton` and render it just under the `<h1>`:
```tsx
      <ImportProductsButton />
```

- [ ] **Step 3: Product select in AI brainstorm form**

In `src/components/forms/ai-brainstorm-form.tsx`: load products and replace the free-text "Prodotto in focus" input with a select that sets `prodotto` to the chosen product NAME. Add:
```tsx
  const [products, setProducts] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => { fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([])); }, []);
```
Replace the prodotto `<input>` with:
```tsx
        <select className="w-full rounded border p-2" value={form.prodotto} onChange={(e) => setForm({ ...form, prodotto: e.target.value })}>
          <option value="">Prodotto in focus (opzionale)</option>
          {products.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
        </select>
```
(Ensure `useEffect` is imported alongside `useState`.)

- [ ] **Step 4: Product select in manual form**

In `src/components/forms/manual-idea-form.tsx`: add `productId: ""` to the form state, load products, and add a select. Add:
```tsx
  const [products, setProducts] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => { fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([])); }, []);
```
Add the select (e.g. after the category select):
```tsx
        <select className="w-full rounded border p-2" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
          <option value="">Prodotto collegato (opzionale)</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
```
And include `productId` in the POST body only when set (the `/api/ideas` manual schema accepts `productId`). If the current submit sends the whole `form`, ensure an empty `productId` is omitted or acceptable — send `productId: form.productId || undefined`.

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npm run build`
```bash
git add src/components/import-products-button.tsx src/app/genera/page.tsx src/components/forms/ai-brainstorm-form.tsx src/components/forms/manual-idea-form.tsx
git commit -m "feat: Shopify product import button + product selectors in idea generation"
```

---

## Task 4: Gate + smoke

- [ ] **Step 1: Gate** — `npx vitest run && npx tsc --noEmit && npm run build` (green; commit fixes if needed).
- [ ] **Step 2: Smoke (SHOPIFY_* keys):** start dev server.
  - `POST /api/products/import-shopify` → `{imported: N}` with N ≥ 1 (real Shopify catalogue). `GET /api/products` → the imported products (with `handle`, and `descrizione`/`ingredienti` populated where metafields exist). Re-run import → count stable (upsert, no duplicates).
  - Open `/genera`: the "Importa prodotti da Shopify" button works; AI brainstorming + Manuale tabs show the product **select** populated; Ricerca→idee still has its product picker.
  Report: imported count, a sample product (handle + whether descrizione/ingredienti filled), and that re-import doesn't duplicate. Any error verbatim.
- [ ] **Step 3: Stop the server.**

---

## Self-Review (addressed)
- **Coverage:** Product.handle unique (T1); pure mapper + upsert import + endpoint (T2); import button + product selects in all 3 generation modes (T3); gate + idempotent-import smoke (T4).
- **Types:** `ShopProduct` (products.ts) → `mapShopProductToProduct` → upsert; `/api/products` feeds the selects; manual uses `productId` (schema supports it), AI uses product name (`prodotto`, backend unchanged), Ricerca uses existing picker.
- **No placeholders:** upsert by handle is idempotent; enrichment best-effort (null when metafield absent).
```
