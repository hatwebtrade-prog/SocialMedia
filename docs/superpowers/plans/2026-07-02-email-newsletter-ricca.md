# Newsletter ricca (email) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generare newsletter divise in paragrafi con 2-3 foto reali del prodotto intervallate + una sezione cross-selling (altri prodotti stessa categoria, con link), in HTML email-safe, con un pulsante "Copia HTML".

**Architecture:** Estendo Shopify per la galleria immagini prodotto; un assemblatore puro `email-html.ts` produce HTML email-safe (stili inline + tabelle) intervallando le immagini tra i paragrafi e aggiungendo il cross-sell; i blocchi si risolvono alla generazione e si salvano in `payload.emailBlocks`; l'anteprima li assembla e offre "Copia HTML".

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma, Zod, Vitest (node env — solo funzioni pure), Shopify GraphQL, Claude.

## Global Constraints

- HTML email-safe: **stili inline + layout `<table>`**, larghezza max ~600px, immagini `max-width:100%`. **NIENTE `<style>`**, hover o animazioni.
- Immagini nei paragrafi = fino a **3 foto reali** della galleria Shopify del prodotto dell'idea (fallback: featured image; poi []).
- Cross-sell = prodotti attivi **stessa categoria** del prodotto dell'idea (cap 3), immagine + link `{store}/products/{handle}`. Riuso `buildProductCards` da `src/lib/blog/product-cards.ts`.
- `corpoHtml` (da Claude) è HTML semantico affidabile → inserito senza escape; TUTTO il resto (URL immagini, nomi/url cross-sell, alt) passa da `escapeHtml`.
- Nessun invio: solo generazione + "Copia HTML".
- Risoluzione blocchi in try/catch: se Shopify non risponde → `emailBlocks` con liste vuote, la newsletter esce comunque.
- Test solo su funzioni pure; Shopify/runtime/pagina via `npx tsc --noEmit` + smoke.
- Commit frequenti, un commit per task.

---

### Task 1: Galleria immagini prodotto in Shopify

**Files:**
- Modify: `src/lib/shopify/products.ts`
- Test: `src/lib/shopify/products.test.ts`

**Interfaces:**
- Produces: `ShopProduct.images: string[]` (fino a 3 URL galleria); `normalizeProducts` la popola.

- [ ] **Step 1: Add the failing test**

In `src/lib/shopify/products.test.ts`, add a test inside `describe("normalizeProducts", …)` (before its closing `});`):
```ts
  it("maps up to 3 gallery images", () => {
    const raw = {
      data: { products: { edges: [
        { node: {
          handle: "p", title: "P", productType: "T",
          featuredImage: { url: "https://img/f.jpg" },
          images: { edges: [ { node: { url: "https://img/1.jpg" } }, { node: { url: "https://img/2.jpg" } } ] },
          metafields: { edges: [] },
        } },
      ] } },
    };
    const out = normalizeProducts(raw, "https://agocap.it");
    expect(out[0].images).toEqual(["https://img/1.jpg", "https://img/2.jpg"]);
  });
  it("defaults images to [] when absent", () => {
    const raw = { data: { products: { edges: [ { node: { handle: "n", title: "N", productType: "T", metafields: { edges: [] } } } ] } } };
    expect(normalizeProducts(raw, "https://x")[0].images).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/shopify/products.test.ts`
Expected: FAIL — `out[0].images` is undefined.

- [ ] **Step 3: Implement**

In `src/lib/shopify/products.ts`:

(a) Add `images: string[]` to the `ShopProduct` interface (after `imageUrl`):
```ts
  imageUrl: string | null;
  images: string[];
```

(b) In `normalizeProducts`, before the `out.push({...})`, extract the gallery:
```ts
    const imgEdges = (node.images as { edges?: unknown[] } | undefined)?.edges;
    const images = Array.isArray(imgEdges)
      ? imgEdges
          .map((e) => (e as { node?: { url?: unknown } })?.node?.url)
          .filter((u): u is string => typeof u === "string")
          .slice(0, 3)
      : [];
```
and add `images,` to the pushed object (e.g. right after `imageUrl: ...,`).

(c) In `fetchProductsWithMetafields`, add `images(first: 3) { edges { node { url } } }` to the GraphQL query node. The query becomes:
```ts
  const query = `{ products(first: 50) { edges { node { handle title productType featuredImage { url } images(first: 3) { edges { node { url } } } metafields(first: 30) { edges { node { key value } } } } } } }`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/shopify/products.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
npx tsc --noEmit
git add src/lib/shopify/products.ts src/lib/shopify/products.test.ts
git commit -m "feat(shopify): fetch product gallery images (up to 3)"
```
Expected: tsc clean. (The new `images` field is additive; the blog's `ShopProduct` usage is unaffected.)

---

### Task 2: Assemblatore email `email-html.ts` (puro, TDD)

**Files:**
- Create: `src/lib/email/email-html.ts`
- Test: `src/lib/email/email-html.test.ts`

**Interfaces:**
- Produces:
  - `interface EmailPayloadLike { corpoHtml?: string; cta?: string }`
  - `interface CrossSellItem { nome: string; url: string; imageUrl: string | null }`
  - `interface EmailBlocks { productImages: string[]; crossSell: CrossSellItem[] }`
  - `escapeHtml(s: string): string`
  - `splitParagraphs(html: string): string[]`
  - `injectImagesBetweenParagraphs(paragraphs: string[], images: string[]): string[]`
  - `assembleEmailHtml(payload: EmailPayloadLike, blocks: EmailBlocks): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/email/email-html.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { assembleEmailHtml, splitParagraphs, injectImagesBetweenParagraphs, escapeHtml } from "@/lib/email/email-html";

describe("splitParagraphs", () => {
  it("splits on </p>", () => {
    expect(splitParagraphs("<p>a</p><p>b</p>")).toEqual(["<p>a</p>", "<p>b</p>"]);
  });
  it("splits on blank lines when no <p>", () => {
    expect(splitParagraphs("uno\n\ndue")).toEqual(["uno", "due"]);
  });
  it("empty -> []", () => { expect(splitParagraphs("")).toEqual([]); });
});

describe("injectImagesBetweenParagraphs", () => {
  it("interleaves the provided images among paragraphs", () => {
    const joined = injectImagesBetweenParagraphs(["<p>1</p>","<p>2</p>","<p>3</p>","<p>4</p>"], ["i1","i2"]).join("");
    expect((joined.match(/<img /g) || []).length).toBe(2);
    expect(joined).toContain('src="i1"');
  });
  it("caps at 3 images", () => {
    const joined = injectImagesBetweenParagraphs(["<p>1</p>","<p>2</p>"], ["i1","i2","i3","i4"]).join("");
    expect((joined.match(/<img /g) || []).length).toBe(3);
  });
  it("no images -> no <img>", () => {
    expect(injectImagesBetweenParagraphs(["<p>1</p>"], []).join("")).not.toContain("<img");
  });
});

describe("assembleEmailHtml", () => {
  const payload = { corpoHtml: "<p>uno</p><p>due</p><p>tre</p>", cta: "Acquista ora" };
  const blocks = { productImages: ["https://cdn/a.jpg", "https://cdn/b.jpg"], crossSell: [{ nome: "Magnesio", url: "https://s/products/magnesio", imageUrl: "https://cdn/m.jpg" }] };
  it("is email-safe: tables + inline styles, no <style>", () => {
    const html = assembleEmailHtml(payload, blocks);
    expect(html).toContain("<table");
    expect(html).not.toContain("<style");
  });
  it("includes product images and cross-sell with product link", () => {
    const html = assembleEmailHtml(payload, blocks);
    expect(html).toContain("https://cdn/a.jpg");
    expect(html).toContain("Ti potrebbero interessare");
    expect(html).toContain("https://s/products/magnesio");
    expect(html).toContain("Magnesio");
  });
  it("omits cross-sell when empty and images when none", () => {
    const html = assembleEmailHtml({ corpoHtml: "<p>x</p>" }, { productImages: [], crossSell: [] });
    expect(html).not.toContain("Ti potrebbero interessare");
    expect(html).not.toContain("<img");
  });
  it("escapes data-derived text", () => {
    const html = assembleEmailHtml({ corpoHtml: "<p>x</p>" }, { productImages: [], crossSell: [{ nome: 'X<script>"', url: "u", imageUrl: null }] });
    expect(html).toContain("X&lt;script&gt;&quot;");
  });
});

describe("escapeHtml", () => {
  it("escapes", () => { expect(escapeHtml('a<b>&"\'')).toBe("a&lt;b&gt;&amp;&quot;&#39;"); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/email/email-html.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/email/email-html.ts`:
```ts
export interface EmailPayloadLike { corpoHtml?: string; cta?: string }
export interface CrossSellItem { nome: string; url: string; imageUrl: string | null }
export interface EmailBlocks { productImages: string[]; crossSell: CrossSellItem[] }

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TD_TEXT = 'style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#2b3d4e;"';

export function splitParagraphs(html: string): string[] {
  const s = (html ?? "").trim();
  if (!s) return [];
  if (/<\/p>/i.test(s)) return s.split(/(?<=<\/p>)/i).map((x) => x.trim()).filter(Boolean);
  return s.split(/(?:<br\s*\/?>\s*){2,}|\n{2,}/i).map((x) => x.trim()).filter(Boolean);
}

function imageRow(src: string): string {
  return `<tr><td align="center" style="padding:16px 0;"><img src="${escapeHtml(src)}" alt="" width="560" style="max-width:100%;height:auto;border-radius:8px;display:block;margin:0 auto;"></td></tr>`;
}

export function injectImagesBetweenParagraphs(paragraphs: string[], images: string[]): string[] {
  const imgs = (images ?? []).slice(0, 3);
  const rows: string[] = [];
  const step = imgs.length > 0 ? Math.max(1, Math.floor(paragraphs.length / (imgs.length + 1))) : 0;
  let placed = 0;
  paragraphs.forEach((p, i) => {
    rows.push(`<tr><td ${TD_TEXT}>${p}</td></tr>`);
    if (step > 0 && placed < imgs.length && (i + 1) % step === 0 && i < paragraphs.length - 1) {
      rows.push(imageRow(imgs[placed]));
      placed++;
    }
  });
  while (placed < imgs.length) { rows.push(imageRow(imgs[placed])); placed++; }
  return rows;
}

function crossSellTable(items: CrossSellItem[]): string {
  if (!items || items.length === 0) return "";
  const cards = items
    .map((it) => {
      const img = it.imageUrl
        ? `<img src="${escapeHtml(it.imageUrl)}" alt="${escapeHtml(it.nome)}" width="120" style="max-width:120px;height:auto;border-radius:8px;display:block;margin:0 auto 8px;">`
        : "";
      return `<td align="center" valign="top" style="padding:8px;font-family:Arial,Helvetica,sans-serif;">${img}<div style="font-size:14px;font-weight:bold;color:#2b3d4e;margin-bottom:8px;">${escapeHtml(it.nome)}</div><a href="${escapeHtml(it.url)}" style="display:inline-block;background:#a9d9cb;color:#2b3d4e;text-decoration:none;font-weight:bold;font-size:13px;padding:8px 14px;border-radius:999px;">Scopri &rarr;</a></td>`;
    })
    .join("");
  return `<tr><td style="padding:24px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#2b3d4e;border-top:1px solid #e7f2ef;">Ti potrebbero interessare</td></tr><tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cards}</tr></table></td></tr>`;
}

function ctaRow(cta: string | undefined): string {
  if (!cta || !cta.trim()) return "";
  return `<tr><td align="center" style="padding:24px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#2b3d4e;">${escapeHtml(cta)}</td></tr>`;
}

export function assembleEmailHtml(payload: EmailPayloadLike, blocks: EmailBlocks): string {
  const paragraphs = splitParagraphs(payload.corpoHtml ?? "");
  const bodyRows = injectImagesBetweenParagraphs(paragraphs, blocks.productImages ?? []).join("");
  const cta = ctaRow(payload.cta);
  const cross = crossSellTable(blocks.crossSell ?? []);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8f7;"><tr><td align="center" style="padding:20px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;padding:24px;">${bodyRows}${cta}${cross}</table></td></tr></table>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/email/email-html.test.ts`
Expected: PASS — all tests.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/lib/email/email-html.ts src/lib/email/email-html.test.ts
git commit -m "feat(email): email-safe assembler (paragraphs + product images + cross-sell)"
```

---

### Task 3: Salva `emailBlocks` alla generazione

**Files:**
- Modify: `src/lib/email/schema.ts`
- Modify: `src/lib/email/runtime.ts`

**Interfaces:**
- Consumes: `CrossSellItem` shape (Task 2), `buildProductCards`/`ProductRec` (`@/lib/blog/product-cards`), `fetchProductsWithMetafields` (+ `images` from Task 1).
- Produces: `payload.emailBlocks = { productImages: string[]; crossSell: CrossSellItem[] }` popolato alla generazione.

- [ ] **Step 1: Add the schema field**

In `src/lib/email/schema.ts`, add before the closing `})` of `emailSchema`:
```ts
  emailBlocks: z.object({
    productImages: z.array(z.string()),
    crossSell: z.array(z.object({ nome: z.string(), url: z.string(), imageUrl: z.string().nullable() })),
  }).optional(),
```

- [ ] **Step 2: Resolve + save the blocks**

In `src/lib/email/runtime.ts`:

(a) Add imports (after the existing `./` and `@/lib` imports):
```ts
import { buildProductCards, type ProductRec } from "@/lib/blog/product-cards";
```

(b) Add a module-scope resolver (before `buildEmailDeps`):
```ts
async function resolveEmailBlocks(ideaId: string) {
  try {
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, include: { product: true } });
    const main = (idea?.product ?? null) as ProductRec | null;
    if (!main) return { productImages: [], crossSell: [] };
    let shop: Awaited<ReturnType<typeof fetchProductsWithMetafields>> = [];
    try { shop = await fetchProductsWithMetafields(); } catch (err) {
      console.error("Shopify non disponibile per i blocchi email:", err instanceof Error ? err.message : err);
    }
    const mainShop = main.handle ? shop.find((p) => p.handle === main.handle) : undefined;
    const productImages = (mainShop?.images?.length ? mainShop.images : (mainShop?.imageUrl ? [mainShop.imageUrl] : [])).slice(0, 3);
    const sameCategory = main.categoria
      ? ((await prisma.product.findMany({ where: { categoria: main.categoria, attivo: true, NOT: { id: main.id } } })) as ProductRec[])
      : [];
    const shopifyByHandle = Object.fromEntries(shop.map((p) => [p.handle, { imageUrl: p.imageUrl, url: p.url }]));
    const crossSell = buildProductCards({ main: null, sameCategory, shopifyByHandle }).related.map((c) => ({ nome: c.nome, url: c.url, imageUrl: c.imageUrl }));
    return { productImages, crossSell };
  } catch {
    return { productImages: [], crossSell: [] };
  }
}
```

(c) In `buildEmailDeps().persist`, enrich the payload. Find:
```ts
    persist: async ({ input, result }) => {
      const content = await prisma.generatedContent.create({
        data: {
          ideaId: input.ideaId,
          canale: "EMAIL",
          formato: input.formato as never,
          status: "BOZZA",
          payload: result.payload as object,
```
Replace the `payload: result.payload as object,` region so the create uses an enriched payload:
```ts
    persist: async ({ input, result }) => {
      const emailBlocks = await resolveEmailBlocks(input.ideaId);
      const enrichedPayload = { ...(result.payload as object), emailBlocks };
      const content = await prisma.generatedContent.create({
        data: {
          ideaId: input.ideaId,
          canale: "EMAIL",
          formato: input.formato as never,
          status: "BOZZA",
          payload: enrichedPayload as object,
```
(Leave the remaining create fields — promptUsato/modello/tokens/outputGrezzo — unchanged.)

- [ ] **Step 3: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/lib/email/schema.ts src/lib/email/runtime.ts
git commit -m "feat(email): resolve and persist emailBlocks (product images + cross-sell) at generation"
```

---

### Task 4: Anteprima assemblata + "Copia HTML"

**Files:**
- Modify: `src/app/email/[id]/page.tsx`

**Interfaces:**
- Consumes: `assembleEmailHtml`, `EmailBlocks` (Task 2), `payload.emailBlocks` (Task 3).

- [ ] **Step 1: Import + extend the payload type**

In `src/app/email/[id]/page.tsx`:

(a) Add imports (after the existing imports):
```tsx
import { assembleEmailHtml, type EmailBlocks } from "@/lib/email/email-html";
```

(b) In the `Content.payload` type, add:
```tsx
    emailBlocks?: EmailBlocks;
```

- [ ] **Step 2: Add a "Copia HTML" handler + message state**

After the `const [err, setErr] = useState(false);` line, add:
```tsx
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
```
After the `setStatus` function (before the `return`), add:
```tsx
  const assembled = assembleEmailHtml(p, p.emailBlocks ?? { productImages: [], crossSell: [] });
  const copyHtml = async () => {
    try { await navigator.clipboard.writeText(assembled); setCopyMsg("HTML copiato negli appunti."); }
    catch { setCopyMsg("Copia non riuscita."); }
  };
```
(Note: `p` and the hooks are already defined above; `assembled` must be computed after `p` is set — place these lines after `const p = c.payload ?? {};`. The existing code computes `p` after the early returns; put the `assembled`/`copyHtml`/`setStatus` block together after `const p = ...`.)

- [ ] **Step 3: Replace the body render + redundant blocks with the assembled HTML + button**

Find:
```tsx
      <article className="prose mb-4 max-w-none rounded border p-3" dangerouslySetInnerHTML={{ __html: p.corpoHtml ?? "" }} />
      {p.cta && <p className="mb-4 font-medium">{p.cta}</p>}
      {p.prodotti?.length ? (
        <div className="text-sm"><strong>Prodotti</strong>
          <ul className="ml-4 list-disc">{p.prodotti.map((pr) => <li key={pr.handle}><a href={pr.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{pr.titolo}</a></li>)}</ul>
        </div>
      ) : null}
```
Replace with:
```tsx
      <div className="mb-3 flex items-center gap-3">
        <button onClick={copyHtml} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Copia HTML</button>
        {copyMsg && <span className="text-sm text-neutral-600">{copyMsg}</span>}
      </div>
      <div className="mb-4 rounded border" dangerouslySetInnerHTML={{ __html: assembled }} />
```

- [ ] **Step 4: Typecheck + build**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit && npm run build`
Expected: `tsc` clean; `next build` completes.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add "src/app/email/[id]/page.tsx"
git commit -m "feat(email): assembled newsletter preview + Copia HTML button"
```

---

### Task 5: Verifica end-to-end

**Files:** nessuna modifica.

- [ ] **Step 1: Full test suite**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run`
Expected: tutti verdi (inclusi i nuovi `email-html.test.ts` e le aggiunte a `products.test.ts`).

- [ ] **Step 2: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Smoke manuale (dev server su :3000)**

Genera una newsletter da un'idea con prodotto collegato, apri `http://localhost:3000/email/<id>`: il corpo mostra i paragrafi con 2-3 immagini reali del prodotto intervallate e la sezione "Ti potrebbero interessare" con i prodotti stessa categoria (link a `/products/{handle}`). Premi "Copia HTML" → l'HTML viene copiato. Il markup usa tabelle/stili inline (email-safe).

- [ ] **Step 4: Nessun commit** (task di sola verifica).

---

## Self-Review

**Spec coverage:**
- Galleria immagini Shopify (`images` in query + type + normalize) → Task 1. ✓
- Assemblatore email-safe (paragrafi + immagini intervallate + cross-sell + CTA, escapeHtml) → Task 2. ✓
- Risoluzione/salvataggio `emailBlocks` (foto reali prodotto + cross-sell stessa categoria) → Task 3. ✓
- Anteprima assemblata + "Copia HTML" + rimozione blocchi ridondanti → Task 4. ✓
- Solo generazione (nessun invio) → nessun send integrato. ✓
- Test funzioni pure + tsc/smoke → Task 2/5. ✓

**Placeholder scan:** nessun TODO/TBD; ogni step ha codice/comando reale. ✓

**Type consistency:** `EmailBlocks`/`CrossSellItem`/`assembleEmailHtml` coerenti tra Task 2 (def) e Task 3/4 (uso); `emailBlocks` shape identica in schema (Task 3), runtime (Task 3), pagina (Task 4); `ShopProduct.images` (Task 1) consumato in `resolveEmailBlocks` (Task 3); `buildProductCards`/`ProductRec` riusati dal blog con firme note; Prisma `Product` è strutturalmente `ProductRec`. ✓
