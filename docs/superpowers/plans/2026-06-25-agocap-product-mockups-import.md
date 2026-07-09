# Product Mockups Import (Fase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Import each Shopify product's first image (mockup), resize it to 2500×2500 (contain on white), store it under the uploads volume, link it to `Product.imagePath`, and serve it. Foundation for Fase B (using the mockup in image generation via OpenAI image-edit).

**Decisions (brainstormed):** 2500×2500 **contain on white**; mockups feed OpenAI image-edit in Fase B.

**Branch:** `product-mockups` (off `brain-mvp-clean`). Local Postgres via `.env`.

**Current state:** `src/lib/shopify/products.ts` — `fetchProductsWithMetafields()` (GraphQL: handle/title/productType/metafields) + `normalizeProducts`; `ShopProduct = {handle,titolo,url,categoria,metafields}`. `src/lib/shopify/import-products.ts` — `mapShopProductToProduct` + `importShopifyProducts` (upsert by handle). `Product` has `handle @unique` (no image field). `src/lib/image/store.ts` has an uploads dir constant + `saveAssetFile`. Assets served via `/api/assets/[id]`.

---

## Task 1: sharp + Product.imagePath + Shopify image url

**Files:** `package.json` (sharp), `prisma/schema.prisma`, `src/lib/shopify/products.ts`

- [ ] **Step 1: Install sharp**

Run `npm install sharp`; confirm it's in dependencies.

- [ ] **Step 2: Prisma field**

In `model Product`, add after `handle`:
```prisma
  imagePath   String?
```
Run `npx prisma validate`. Then (migrate dev is interactive in this shell — if it blocks, hand-author the migration): create `prisma/migrations/<timestamp>_product_image_path/migration.sql` with `ALTER TABLE "Product" ADD COLUMN "imagePath" TEXT;` and run `npx prisma migrate deploy`. Then `npx prisma generate`. Confirm `npx tsc --noEmit` is 0.

- [ ] **Step 3: Add the first-image URL to the Shopify query + normalizer**

In `src/lib/shopify/products.ts`:
- Add `imageUrl: string | null;` to the `ShopProduct` interface.
- In `fetchProductsWithMetafields`'s GraphQL query, add `featuredImage { url }` to the product node selection (alongside handle/title/productType/metafields).
- In `normalizeProducts`, set `imageUrl: typeof (node.featuredImage as { url?: unknown })?.url === "string" ? (node.featuredImage as { url: string }).url : null,` (read `node.featuredImage?.url`).
- Update the existing `normalizeProducts` unit test sample to include a `featuredImage: { url: "https://img/x.jpg" }` on one product and assert `out[0].imageUrl === "https://img/x.jpg"` (and `null` when absent). Keep the other assertions.

- [ ] **Step 4: Verify + commit**

Run: `npx vitest run src/lib/shopify/products.test.ts && npx tsc --noEmit`
```bash
git add package.json package-lock.json prisma/ src/lib/shopify/products.ts src/lib/shopify/products.test.ts
git commit -m "feat: sharp + Product.imagePath + Shopify featuredImage url"
```

---

## Task 2: Download + resize module

**Files:** Create `src/lib/shopify/product-image.ts`; Test `src/lib/shopify/product-image.test.ts`

- [ ] **Step 1: Failing test (pure path helper)**

`src/lib/shopify/product-image.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { productImageRelPath } from "@/lib/shopify/product-image";

describe("productImageRelPath", () => {
  it("builds a stable uploads path per handle", () => {
    const p = productImageRelPath("magnesio-supremo");
    expect(p.replace(/\\\\/g, "/")).toBe("uploads/products/magnesio-supremo.png");
  });
  it("sanitises unsafe handle characters", () => {
    expect(productImageRelPath("a/b c").replace(/\\\\/g, "/")).toBe("uploads/products/a-b-c.png");
  });
});
```

- [ ] **Step 2: Run → FAIL, implement**

`src/lib/shopify/product-image.ts`:
```ts
import sharp from "sharp";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const PRODUCTS_DIR = path.join(process.cwd(), "uploads", "products");

/** Relative uploads path for a product mockup (sanitised handle). */
export function productImageRelPath(handle: string): string {
  const safe = handle.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "prodotto";
  return path.join("uploads", "products", `${safe}.png`);
}

/** Downloads a product image and stores it resized to 2500x2500 (contain, white bg). Returns the rel path or null on any error. */
export async function downloadAndResizeProductImage(url: string, handle: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const out = await sharp(input)
      .resize(2500, 2500, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    mkdirSync(PRODUCTS_DIR, { recursive: true });
    const rel = productImageRelPath(handle);
    writeFileSync(path.join(process.cwd(), rel), out);
    return rel;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx vitest run src/lib/shopify/product-image.test.ts && npx tsc --noEmit`
```bash
git add src/lib/shopify/product-image.ts src/lib/shopify/product-image.test.ts
git commit -m "feat: product mockup download + 2500x2500 contain resize"
```

---

## Task 3: Wire into import + serve route

**Files:** Modify `src/lib/shopify/import-products.ts`; Create `src/app/api/products/[id]/image/route.ts`

- [ ] **Step 1: Download mockups during import**

In `src/lib/shopify/import-products.ts`:
- import `downloadAndResizeProductImage` from `./product-image`.
- In `importShopifyProducts`, inside the loop, after computing `data`, download the mockup best-effort and include it:
```ts
    const imagePath = p.imageUrl ? await downloadAndResizeProductImage(p.imageUrl, p.handle) : null;
    const withImage = { ...data, ...(imagePath ? { imagePath } : {}) };
    await prisma.product.upsert({
      where: { handle: data.handle },
      update: { nome: data.nome, categoria: data.categoria, url: data.url, descrizione: data.descrizione, ingredienti: data.ingredienti, ...(imagePath ? { imagePath } : {}) },
      create: withImage,
    });
```
(Keep returning `{ imported }`. The `MappedProduct` type doesn't include imagePath — pass it as an extra field on the data objects; if tsc complains about the create/update shape, that's fine since Prisma accepts `imagePath`. Cast the spread objects as needed, e.g. type them as `Record<string, unknown>` for the upsert args, OR add `imagePath?: string` to `MappedProduct`.)

- [ ] **Step 2: Serve route**

`src/app/api/products/[id]/image/route.ts`:
```ts
import { prisma } from "@/lib/prisma";
import { readFileSync } from "node:fs";
import path from "node:path";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { imagePath: true } });
  if (!product?.imagePath) return new Response("Not found", { status: 404 });
  try {
    const abs = path.join(process.cwd(), product.imagePath);
    const uploadsRoot = path.join(process.cwd(), "uploads");
    if (!abs.startsWith(uploadsRoot)) return new Response("Forbidden", { status: 403 });
    const buf = readFileSync(abs);
    return new Response(buf, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
```bash
git add src/lib/shopify/import-products.ts "src/app/api/products/[id]/image/"
git commit -m "feat: import product mockups + serve route"
```

---

## Task 4: Gate + smoke

- [ ] **Step 1: Gate** — `npx vitest run && npx tsc --noEmit && npm run build` (green).
- [ ] **Step 2: Smoke (SHOPIFY_* keys):** start dev server.
  - `POST /api/products/import-shopify` → `{imported:N}` (now also downloads mockups; may take longer). `GET /api/products` → products have non-null `imagePath` for those with a Shopify image.
  - Pick a product id with imagePath → `GET /api/products/<id>/image` → returns HTTP 200 `image/png`. Verify the stored file is **2500×2500** (e.g. `node -e "require('sharp')('<relpath>').metadata().then(m=>console.log(m.width,m.height,m.format))"`).
  - Re-import → still idempotent (count stable); mockups re-downloaded/overwritten.
  Report: imported count, how many got an imagePath, the served image status, and the verified 2500×2500 dimensions. Any error verbatim. (If Shopify product images are missing or sharp fails on the platform, report it — degrade leaves imagePath null.)
- [ ] **Step 3: Stop the server.**

---

## Self-Review (addressed)
- **Coverage:** sharp + Product.imagePath + Shopify featuredImage url (T1); download+resize 2500×2500 contain-white module + path helper (T2); wire into import (best-effort, idempotent) + serve route with uploads path guard (T3); gate + dimension-verified smoke (T4). Fase B (image-edit generation + UI selector + carosello checkbox) is a separate follow-up.
- **Types:** `ShopProduct.imageUrl` (T1) consumed by import (T3); `productImageRelPath`/`downloadAndResizeProductImage` (T2) used by import; serve route reads `Product.imagePath`.
- **No placeholders:** mockup download is best-effort (null on failure, import still succeeds); resize is deterministic contain-white; serve route guards against path escape.
```
