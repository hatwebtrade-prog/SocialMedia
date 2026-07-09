# Articolo blog "ricco" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere l'articolo blog graficamente ricco e coerente in anteprima e pubblicazione: card prodotto principale a metà + area evolutiva finale con prodotti correlati (stessa categoria), stile store con CSS dinamico.

**Architecture:** Due moduli puri — `product-cards.ts` (risolve le card dai dati store) e `article-html.ts` (assembla l'HTML finale con blocco `<style>` scoped + card). Le card si risolvono alla generazione e si salvano in `payload.productCards`. Anteprima (`/blog/[id]`) e pubblicazione usano lo stesso assemblatore; al publish la testata è un data-URI slim e non si invia featured image.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma, Zod, Vitest (node env — solo funzioni pure), sharp (resize testata), Shopify.

## Global Constraints

- UI in italiano, codice/identificatori in inglese.
- Assemblatore UNICO usato sia in anteprima sia in pubblicazione (stesso output).
- CSS: stile base robusto + blocco `<style>` scoped con classi `.ag-*` per hover/transizioni/fade-in (Shopify accetta `<style>` nel body_html).
- Palette store (valori esatti): card `#fff` bordo `#e7f2ef`; box immagine `#f8fbfa`; bottone `#a9d9cb` (hover `#8fccba`); testo ink `#2b3d4e`, muted `#566b7a`; summary `#f2f9f7` bordo-sx `#a9d9cb`.
- Card principale = prodotto dell'idea, a metà articolo. Area finale = fino a **3** prodotti attivi della **stessa categoria**, **escluso** il principale.
- Testi card dai dati store: `nome`, `descrizione`, bullet da `benefici` (≤3). Immagini reali (CDN Shopify per `handle`). Link `{store}/products/{handle}`.
- `escapeHtml` su TUTTI i testi provenienti dai dati (nome/descrizione/bullets/alt).
- Al publish: testata = data-URI JPEG slim (sharp), **niente** featured image (no `imageBase64`).
- Test solo su funzioni pure (vitest node); anteprima/runtime/publish via `npx tsc --noEmit` + smoke.
- Commit frequenti, un commit per task.

---

### Task 1: `product-cards.ts` (puro, TDD)

**Files:**
- Create: `src/lib/blog/product-cards.ts`
- Test: `src/lib/blog/product-cards.test.ts`

**Interfaces:**
- Produces:
  - `interface ProductCard { nome: string; descrizione: string; bullets: string[]; url: string; imageUrl: string | null }`
  - `interface ProductCards { main: ProductCard | null; related: ProductCard[] }`
  - `interface ProductRec { id?: string; nome: string; descrizione?: string | null; benefici?: string | null; handle?: string | null; url?: string | null; categoria?: string | null }`
  - `benefitsToBullets(benefici: string | null | undefined, cap?: number): string[]`
  - `buildProductCards(args: { main: ProductRec | null; sameCategory: ProductRec[]; shopifyByHandle: Record<string, { imageUrl: string | null; url: string }>; cap?: number }): ProductCards`

- [ ] **Step 1: Write the failing test**

Create `src/lib/blog/product-cards.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { benefitsToBullets, buildProductCards } from "@/lib/blog/product-cards";

describe("benefitsToBullets", () => {
  it("splits on newlines/semicolons and trims, capping at 3", () => {
    expect(benefitsToBullets("Energia; Recupero\nSonno; Extra")).toEqual(["Energia", "Recupero", "Sonno"]);
  });
  it("returns [] for empty/nullish", () => {
    expect(benefitsToBullets("")).toEqual([]);
    expect(benefitsToBullets(null)).toEqual([]);
  });
});

describe("buildProductCards", () => {
  const shop = {
    "magnesio": { imageUrl: "https://cdn/mag.jpg", url: "https://s/products/magnesio" },
    "melatonina": { imageUrl: "https://cdn/mel.jpg", url: "https://s/products/melatonina" },
  };
  const main = { id: "1", nome: "Magnesio", descrizione: "desc mag", benefici: "A; B", handle: "magnesio", categoria: "sonno" };
  const related = [
    { id: "1", nome: "Magnesio", handle: "magnesio", categoria: "sonno" },
    { id: "2", nome: "Melatonina", descrizione: "desc mel", benefici: "C", handle: "melatonina", categoria: "sonno" },
  ];

  it("builds main and excludes it from related (by handle), mapping Shopify image/url", () => {
    const res = buildProductCards({ main, sameCategory: related, shopifyByHandle: shop });
    expect(res.main?.nome).toBe("Magnesio");
    expect(res.main?.imageUrl).toBe("https://cdn/mag.jpg");
    expect(res.main?.bullets).toEqual(["A", "B"]);
    expect(res.related.map((r) => r.nome)).toEqual(["Melatonina"]);
    expect(res.related[0].url).toBe("https://s/products/melatonina");
  });

  it("caps related at 3 and handles a null main", () => {
    const many = [2, 3, 4, 5].map((n) => ({ id: String(n), nome: `P${n}`, handle: `h${n}`, categoria: "sonno" }));
    const res = buildProductCards({ main: null, sameCategory: many, shopifyByHandle: {} });
    expect(res.main).toBeNull();
    expect(res.related).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/blog/product-cards.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/blog/product-cards.ts`:
```ts
export interface ProductCard { nome: string; descrizione: string; bullets: string[]; url: string; imageUrl: string | null }
export interface ProductCards { main: ProductCard | null; related: ProductCard[] }
export interface ProductRec {
  id?: string; nome: string; descrizione?: string | null; benefici?: string | null;
  handle?: string | null; url?: string | null; categoria?: string | null;
}

export function benefitsToBullets(benefici: string | null | undefined, cap = 3): string[] {
  if (!benefici) return [];
  return benefici
    .split(/[\n;•]|\.\s/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, cap);
}

function toCard(rec: ProductRec, shopifyByHandle: Record<string, { imageUrl: string | null; url: string }>): ProductCard {
  const sh = rec.handle ? shopifyByHandle[rec.handle] : undefined;
  return {
    nome: rec.nome,
    descrizione: (rec.descrizione ?? "").trim(),
    bullets: benefitsToBullets(rec.benefici),
    url: sh?.url ?? rec.url ?? "",
    imageUrl: sh?.imageUrl ?? null,
  };
}

export function buildProductCards(args: {
  main: ProductRec | null;
  sameCategory: ProductRec[];
  shopifyByHandle: Record<string, { imageUrl: string | null; url: string }>;
  cap?: number;
}): ProductCards {
  const cap = args.cap ?? 3;
  const main = args.main ? toCard(args.main, args.shopifyByHandle) : null;
  const mainHandle = args.main?.handle ?? null;
  const related = args.sameCategory
    .filter((r) => !mainHandle || r.handle !== mainHandle)
    .slice(0, cap)
    .map((r) => toCard(r, args.shopifyByHandle));
  return { main, related };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/blog/product-cards.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/lib/blog/product-cards.ts src/lib/blog/product-cards.test.ts
git commit -m "feat(blog): product-cards resolver (bullets from benefici, related by category)"
```

---

### Task 2: `article-html.ts` (assemblatore, puro, TDD)

**Files:**
- Create: `src/lib/blog/article-html.ts`
- Test: `src/lib/blog/article-html.test.ts`

**Interfaces:**
- Consumes: `ProductCard`, `ProductCards` (Task 1).
- Produces:
  - `interface BlogPayloadLike { corpoHtml?: string; puntiChiave?: string[]; faq?: { domanda: string; risposta: string }[]; cta?: string }`
  - `interface AssembleOpts { headerSrc?: string | null; cards?: ProductCards }`
  - `assembleArticleHtml(payload: BlogPayloadLike, opts?: AssembleOpts): string`
  - `escapeHtml(s: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/blog/article-html.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { assembleArticleHtml, escapeHtml } from "@/lib/blog/article-html";

const cards = {
  main: { nome: "Magnesio", descrizione: "desc", bullets: ["A", "B"], url: "https://s/products/magnesio", imageUrl: "https://cdn/mag.jpg" },
  related: [
    { nome: "Melatonina", descrizione: "mel", bullets: ["C"], url: "https://s/products/melatonina", imageUrl: "https://cdn/mel.jpg" },
  ],
};
const payload = { corpoHtml: "<p>uno</p><p>due</p><p>tre</p><p>quattro</p>", puntiChiave: ["k1"], faq: [{ domanda: "D?", risposta: "R" }], cta: "Compra ora" };

describe("assembleArticleHtml", () => {
  it("emits the scoped style block with the hover rule", () => {
    const html = assembleArticleHtml(payload, { cards });
    expect(html).toContain("<style>");
    expect(html).toContain(".ag-card:hover");
    expect(html).toContain('class="ag-article"');
  });
  it("renders the slim header only when headerSrc is present", () => {
    expect(assembleArticleHtml(payload, { headerSrc: "data:image/jpeg;base64,zz", cards }))
      .toContain('class="ag-header" src="data:image/jpeg;base64,zz"');
    expect(assembleArticleHtml(payload, { cards })).not.toContain("ag-header");
  });
  it("injects the main product card mid-article with the product link", () => {
    const html = assembleArticleHtml(payload, { cards });
    expect(html).toContain("ag-midcard");
    expect(html).toContain('href="https://s/products/magnesio"');
  });
  it("renders the related area with a card per related product", () => {
    const html = assembleArticleHtml(payload, { cards });
    expect(html).toContain("Prodotti consigliati per questo articolo");
    expect(html).toContain('href="https://s/products/melatonina"');
    expect(html).toContain("Melatonina");
  });
  it("omits cards entirely when none are provided", () => {
    const html = assembleArticleHtml(payload, {});
    expect(html).not.toContain("ag-midcard");
    expect(html).not.toContain("Prodotti consigliati");
    expect(html).toContain("<p>uno</p>");
  });
  it("escapes data-derived text", () => {
    const html = assembleArticleHtml(payload, { cards: { main: { nome: 'X<script>"', descrizione: "", bullets: [], url: "u", imageUrl: null }, related: [] } });
    expect(html).toContain("X&lt;script&gt;&quot;");
  });
});

describe("escapeHtml", () => {
  it("escapes the dangerous characters", () => {
    expect(escapeHtml('a<b>&"\'')).toBe("a&lt;b&gt;&amp;&quot;&#39;");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/blog/article-html.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/blog/article-html.ts`:
```ts
import type { ProductCard, ProductCards } from "./product-cards";

export interface BlogPayloadLike {
  corpoHtml?: string;
  puntiChiave?: string[];
  faq?: { domanda: string; risposta: string }[];
  cta?: string;
}

export interface AssembleOpts { headerSrc?: string | null; cards?: ProductCards }

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE = `<style>
.ag-article{max-width:740px;margin:32px auto;padding:0 20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2b3d4e;line-height:1.7;font-size:17px;}
.ag-article h1{font-size:33px;line-height:1.2;font-weight:800;margin:0 0 10px;}
.ag-article h2{font-size:24px;font-weight:800;margin:34px 0 12px;}
.ag-header{width:100%;max-height:200px;object-fit:cover;border-radius:16px;display:block;margin-bottom:24px;}
.ag-summary{background:#f2f9f7;border-left:4px solid #a9d9cb;border-radius:14px;padding:18px 20px;margin:0 0 30px;}
.ag-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;}
.ag-card{background:#fff;border:1px solid #e7f2ef;border-radius:20px;padding:22px;box-shadow:0 10px 28px rgba(43,61,78,.08);display:flex;flex-direction:column;align-items:center;text-align:center;transition:transform .25s ease,box-shadow .25s ease;}
.ag-card:hover{transform:translateY(-6px);box-shadow:0 20px 44px rgba(43,61,78,.16);}
.ag-imgwrap{background:#f8fbfa;border-radius:18px;padding:18px;width:100%;box-sizing:border-box;margin-bottom:18px;overflow:hidden;}
.ag-imgwrap img{width:100%;max-width:250px;height:auto;display:block;margin:0 auto;transition:transform .35s ease;}
.ag-card:hover .ag-imgwrap img{transform:scale(1.05);}
.ag-btn{display:inline-block;width:100%;box-sizing:border-box;padding:14px 18px;background:#a9d9cb;color:#2b3d4e;text-decoration:none;border-radius:999px;font-size:15px;font-weight:800;transition:background .2s ease,transform .15s ease;}
.ag-btn:hover{background:#8fccba;transform:translateY(-1px);}
.ag-mid{display:block;margin:30px 0;text-decoration:none;color:inherit;}
.ag-midcard{display:flex;gap:18px;align-items:center;border:1px solid #e7f2ef;background:#fff;border-radius:20px;padding:18px;box-shadow:0 10px 28px rgba(43,61,78,.08);transition:transform .25s ease,box-shadow .25s ease;}
.ag-mid:hover .ag-midcard{transform:translateY(-4px);box-shadow:0 18px 40px rgba(43,61,78,.15);}
.ag-pill{display:inline-block;background:#a9d9cb;color:#2b3d4e;font-weight:800;font-size:14px;padding:9px 16px;border-radius:999px;transition:background .2s ease;}
.ag-mid:hover .ag-pill{background:#8fccba;}
.ag-final{margin:40px 0 8px;padding-top:26px;border-top:1px solid #e7f2ef;}
.ag-fade{opacity:0;transform:translateY(10px);animation:agfade .6s ease forwards;}
@keyframes agfade{to{opacity:1;transform:none;}}
</style>`;

function summaryHtml(points?: string[]): string {
  if (!points || points.length === 0) return "";
  const rows = points.map((p) => `✓ ${escapeHtml(p)}`).join("<br>");
  return `<div class="ag-summary"><div style="font-weight:800;color:#2b3d4e;margin-bottom:10px;font-size:14px;letter-spacing:.03em;text-transform:uppercase;">In sintesi</div><p style="margin:0;color:#566b7a;font-size:15px;line-height:1.7;">${rows}</p></div>`;
}

function imgWrap(card: ProductCard): string {
  if (!card.imageUrl) return "";
  return `<div class="ag-imgwrap"><img alt="${escapeHtml(card.nome)}" src="${escapeHtml(card.imageUrl)}"></div>`;
}

function bulletsHtml(card: ProductCard): string {
  if (card.bullets.length === 0) return "";
  const rows = card.bullets.map((b) => `✓ ${escapeHtml(b)}`).join("<br>");
  return `<div style="width:100%;margin:0 0 20px;text-align:left;"><p style="margin:0 0 8px;font-size:14px;font-weight:bold;">Ideale se cerchi:</p><p style="margin:0;color:#566b7a;font-size:14px;line-height:1.6;">${rows}</p></div>`;
}

function productCardHtml(card: ProductCard): string {
  return `<div class="ag-card">${imgWrap(card)}<h3 style="margin:0 0 10px;color:#2b3d4e;font-size:21px;line-height:1.25;font-weight:800;">${escapeHtml(card.nome)}</h3><p style="margin:0 0 16px;color:#566b7a;font-size:15px;line-height:1.55;">${escapeHtml(card.descrizione)}</p>${bulletsHtml(card)}<a class="ag-btn" href="${escapeHtml(card.url)}">Scopri ${escapeHtml(card.nome)}</a></div>`;
}

function mainCardHtml(card: ProductCard): string {
  const img = card.imageUrl
    ? `<img src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.nome)}" style="width:110px;height:110px;object-fit:cover;border-radius:14px;flex-shrink:0;background:#f8fbfa;">`
    : "";
  return `<a class="ag-mid" href="${escapeHtml(card.url)}"><div class="ag-midcard">${img}<div style="min-width:0;"><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#79a99b;font-weight:800;margin-bottom:4px;">Prodotto consigliato</div><div style="font-size:20px;font-weight:800;margin-bottom:4px;">${escapeHtml(card.nome)}</div><div style="color:#566b7a;font-size:15px;margin-bottom:12px;">${escapeHtml(card.descrizione)}</div><span class="ag-pill">Scopri il prodotto →</span></div></div></a>`;
}

function faqHtml(faq?: { domanda: string; risposta: string }[]): string {
  if (!faq || faq.length === 0) return "";
  const items = faq
    .map((f) => `<div style="border:1px solid #e7f2ef;border-radius:12px;padding:16px 18px;margin-bottom:10px;"><div style="font-weight:800;margin-bottom:6px;">${escapeHtml(f.domanda)}</div><div style="color:#566b7a;">${escapeHtml(f.risposta)}</div></div>`)
    .join("");
  return `<h2>Domande frequenti</h2>${items}`;
}

function ctaHtml(cta?: string): string {
  if (!cta || !cta.trim()) return "";
  return `<p style="margin:24px 0;font-weight:700;">${escapeHtml(cta)}</p>`;
}

function relatedAreaHtml(related: ProductCard[]): string {
  if (related.length === 0) return "";
  const cards = related.map((c, i) => productCardHtml(c).replace('class="ag-card"', `class="ag-card ag-fade" style="animation-delay:.${i}s;"`)).join("");
  return `<div class="ag-final"><h2 style="margin:0 0 4px;">Prodotti consigliati per questo articolo</h2><p style="color:#566b7a;font-size:15px;margin:0 0 20px;">Selezionati in base al tema trattato.</p><div class="ag-grid">${cards}</div></div>`;
}

/** Inserts `block` after the block-level closing tag nearest the character midpoint of `html`. */
export function injectAtMidpoint(html: string, block: string): string {
  const closers = [...html.matchAll(/<\/(p|h2|h3|ul|ol|blockquote)>/gi)];
  if (closers.length === 0) return html + block;
  const mid = html.length / 2;
  let best = closers[0];
  for (const m of closers) {
    if (Math.abs((m.index ?? 0) - mid) < Math.abs((best.index ?? 0) - mid)) best = m;
  }
  const pos = (best.index ?? 0) + best[0].length;
  return html.slice(0, pos) + block + html.slice(pos);
}

export function assembleArticleHtml(payload: BlogPayloadLike, opts: AssembleOpts = {}): string {
  const cards = opts.cards;
  const header = opts.headerSrc ? `<img class="ag-header" src="${escapeHtml(opts.headerSrc)}" alt="">` : "";
  let body = payload.corpoHtml ?? "";
  if (cards?.main) body = injectAtMidpoint(body, mainCardHtml(cards.main));
  const inner = [
    header,
    summaryHtml(payload.puntiChiave),
    body,
    faqHtml(payload.faq),
    ctaHtml(payload.cta),
    cards ? relatedAreaHtml(cards.related) : "",
  ].join("");
  return `${STYLE}<article class="ag-article">${inner}</article>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/blog/article-html.test.ts`
Expected: PASS — all tests.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/lib/blog/article-html.ts src/lib/blog/article-html.test.ts
git commit -m "feat(blog): assembleArticleHtml (styled body + mid card + related area)"
```

---

### Task 3: Salva `productCards` alla generazione

**Files:**
- Modify: `src/lib/blog/schema.ts`
- Modify: `src/lib/blog/runtime.ts`

**Interfaces:**
- Consumes: `buildProductCards`, `ProductCards` (Task 1).
- Produces: `payload.productCards` popolato al momento della generazione.

- [ ] **Step 1: Add the schema field**

In `src/lib/blog/schema.ts`, aggiungere prima della `})` di chiusura di `blogArticleSchema`:
```ts
  productCards: z.object({
    main: z.object({ nome: z.string(), descrizione: z.string(), bullets: z.array(z.string()), url: z.string(), imageUrl: z.string().nullable() }).nullable(),
    related: z.array(z.object({ nome: z.string(), descrizione: z.string(), bullets: z.array(z.string()), url: z.string(), imageUrl: z.string().nullable() })),
  }).optional(),
```

- [ ] **Step 2: Resolve + save the cards in the persist step**

In `src/lib/blog/runtime.ts`:

(a) Add imports at the top (after the existing imports):
```ts
import { buildProductCards, type ProductRec } from "./product-cards";
```

(b) Add a resolver helper (module scope, before `buildBlogDeps`):
```ts
async function resolveProductCards(ideaId: string) {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, include: { product: true } });
  const main = (idea?.product ?? null) as ProductRec | null;
  const sameCategory = main?.categoria
    ? ((await prisma.product.findMany({ where: { categoria: main.categoria, attivo: true, NOT: { id: main.id } } })) as ProductRec[])
    : [];
  let shopifyByHandle: Record<string, { imageUrl: string | null; url: string }> = {};
  try {
    const prodotti = await fetchProductsWithMetafields();
    shopifyByHandle = Object.fromEntries(prodotti.map((p) => [p.handle, { imageUrl: p.imageUrl, url: p.url }]));
  } catch (err) {
    console.error("Shopify immagini prodotto non disponibili per le card:", err instanceof Error ? err.message : err);
  }
  return buildProductCards({ main, sameCategory, shopifyByHandle });
}
```

(c) In `buildBlogDeps().persist`, enrich the payload before create. Find:
```ts
    persist: async ({ input, payload, claude }) => {
      const content = await prisma.generatedContent.create({
        data: {
          ideaId: input.ideaId,
          canale: "BLOG",
          formato: "ARTICOLO",
          status: "BOZZA",
          payload: payload as object,
```
Replace the `payload: payload as object,` line region so the create uses an enriched payload:
```ts
    persist: async ({ input, payload, claude }) => {
      const productCards = await resolveProductCards(input.ideaId);
      const enrichedPayload = { ...(payload as object), productCards };
      const content = await prisma.generatedContent.create({
        data: {
          ideaId: input.ideaId,
          canale: "BLOG",
          formato: "ARTICOLO",
          status: "BOZZA",
          payload: enrichedPayload as object,
```
(Leave the rest of the `create` call — `promptUsato`, `modello`, tokens, `outputGrezzo` — unchanged.)

- [ ] **Step 3: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/lib/blog/schema.ts src/lib/blog/runtime.ts
git commit -m "feat(blog): resolve and persist productCards at generation"
```

---

### Task 4: Anteprima stilizzata (`/blog/[id]`)

**Files:**
- Modify: `src/app/blog/[id]/page.tsx`

**Interfaces:**
- Consumes: `assembleArticleHtml` (Task 2), `payload.productCards` (Task 3).

- [ ] **Step 1: Import the assembler + extend the payload type**

In `src/app/blog/[id]/page.tsx`:

(a) Add the import (after the existing component imports):
```tsx
import { assembleArticleHtml } from "@/lib/blog/article-html";
import type { ProductCards } from "@/lib/blog/product-cards";
```

(b) In the `Content` interface `payload` type, add:
```tsx
    productCards?: ProductCards;
```

- [ ] **Step 2: Replace the raw body render with the assembled article**

Find:
```tsx
      <article className="prose mb-4 max-w-none" dangerouslySetInnerHTML={{ __html: p.corpoHtml ?? "" }} />
```
Replace with:
```tsx
      <div className="mb-4" dangerouslySetInnerHTML={{ __html: assembleArticleHtml(p, { headerSrc: c.assets?.[0] ? `/api/assets/${c.assets[0].id}` : null, cards: p.productCards }) }} />
```

- [ ] **Step 3: Typecheck + build**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit && npm run build`
Expected: `tsc` clean; build completes.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add "src/app/blog/[id]/page.tsx"
git commit -m "feat(blog): styled article preview via assembleArticleHtml"
```

---

### Task 5: Pubblicazione — corpo assemblato + testata slim, no featured image

**Files:**
- Modify: `src/app/api/blog/contents/[id]/publish/route.ts`

**Interfaces:**
- Consumes: `assembleArticleHtml` (Task 2), `sharp`, `readAssetBase64`.
- Nota: `publishBlogContent` (`src/lib/blog/publish.ts`) NON cambia — `loadContent` restituisce già `corpoHtml` = HTML assemblato e `imageBase64: undefined`.

- [ ] **Step 1: Assemble the rich body + slim data-URI header in the publish deps**

In `src/app/api/blog/contents/[id]/publish/route.ts`:

(a) Add imports at the top:
```ts
import sharp from "sharp";
import { assembleArticleHtml } from "@/lib/blog/article-html";
import type { ProductCards } from "@/lib/blog/product-cards";
```

(b) Replace the `loadContent` implementation inside `buildDeps()`. Find:
```ts
    loadContent: async (contentId) => {
      const c = await prisma.generatedContent.findUnique({ where: { id: contentId }, include: { assets: true } });
      if (!c || c.canale !== "BLOG") return null;
      const p = (c.payload ?? {}) as { titoloSeo?: string; corpoHtml?: string; jsonLd?: string };
      const asset = c.assets[0];
      const imageBase64 = asset?.path ? readAssetBase64(asset.path) ?? undefined : undefined;
      return { titoloSeo: p.titoloSeo ?? "Articolo", corpoHtml: p.corpoHtml ?? "", jsonLd: p.jsonLd, imageBase64 };
    },
```
Replace with:
```ts
    loadContent: async (contentId) => {
      const c = await prisma.generatedContent.findUnique({ where: { id: contentId }, include: { assets: true } });
      if (!c || c.canale !== "BLOG") return null;
      const p = (c.payload ?? {}) as {
        titoloSeo?: string; corpoHtml?: string; jsonLd?: string;
        puntiChiave?: string[]; faq?: { domanda: string; risposta: string }[]; cta?: string;
        productCards?: ProductCards;
      };
      const asset = c.assets[0];
      let headerSrc: string | null = null;
      if (asset?.path) {
        const b64 = readAssetBase64(asset.path);
        if (b64) {
          const slim = await sharp(Buffer.from(b64, "base64"))
            .resize(1200, 300, { fit: "cover" })
            .jpeg({ quality: 78 })
            .toBuffer();
          headerSrc = `data:image/jpeg;base64,${slim.toString("base64")}`;
        }
      }
      const corpoHtml = assembleArticleHtml(p, { headerSrc, cards: p.productCards });
      return { titoloSeo: p.titoloSeo ?? "Articolo", corpoHtml, jsonLd: p.jsonLd, imageBase64: undefined };
    },
```
(`publishBlogContent` builds `bodyHtml = buildArticleBodyHtml(corpoHtml, jsonLd)` and passes `imageBase64: undefined` → nessuna featured image.)

- [ ] **Step 2: Typecheck + build**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit && npm run build`
Expected: `tsc` clean; build completes.

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add "src/app/api/blog/contents/[id]/publish/route.ts"
git commit -m "feat(blog): publish assembled rich body + slim data-URI header, drop featured image"
```

---

### Task 6: Verifica end-to-end + pulizia mockup

**Files:**
- Delete: `public/blog-article-sample.html`, `public/blog-sample-v3.html`

- [ ] **Step 1: Full test suite**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run`
Expected: tutti verdi (inclusi i nuovi `product-cards.test.ts` e `article-html.test.ts`; i test di `publish.test.ts` restano verdi — `publishBlogContent` invariato).

- [ ] **Step 2: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Smoke manuale (dev server su :3000)**

Genera un articolo blog da un'idea con prodotto collegato, apri `http://localhost:3000/blog/<id>`: l'articolo è stilizzato (testata slim, box "In sintesi", card prodotto a metà, area "Prodotti consigliati" con i correlati stessa categoria). Verifica che i link delle card puntino a `/products/{handle}`.

- [ ] **Step 4: Remove the mockup files + commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git rm public/blog-article-sample.html public/blog-sample-v3.html
git commit -m "chore(blog): remove design mockup previews"
```

---

## Self-Review

**Spec coverage:**
- `product-cards.ts` (benefitsToBullets, buildProductCards con esclusione main + cap 3) → Task 1. ✓
- `article-html.ts` (style block + slim header + main card a metà + FAQ + CTA + area finale + escapeHtml + injectAtMidpoint) → Task 2. ✓
- `schema.ts` productCards opzionale + runtime risolve/salva → Task 3. ✓
- Anteprima usa l'assemblatore → Task 4. ✓
- Publish: corpo assemblato + testata data-URI slim + no featured image → Task 5. ✓
- Palette/stile/dinamicità (valori esatti) → Task 2 (STYLE + markup). ✓
- Immagini reali Shopify per handle, link `/products/{handle}` → Task 1/2/3. ✓
- Test funzioni pure + tsc/smoke; pulizia mockup → Task 6. ✓

**Placeholder scan:** nessun TODO/TBD; ogni step ha codice/comando reale. ✓

**Type consistency:** `ProductCard`/`ProductCards`/`ProductRec` coerenti tra Task 1 (def) e Task 2/3 (uso); `assembleArticleHtml(payload, opts)`/`escapeHtml` coerenti Task 2↔4↔5; `productCards` shape identica in schema (Task 3), preview (Task 4), publish (Task 5). `publishBlogContent` invariato → `publish.test.ts` resta verde. ✓
