# Blog Generator (SEO/GEO draft articles) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From an approved Idea, generate a SEO+GEO blog article DRAFT (Claude) — with product references pulled read-only from Shopify metafields (CTA+links), a featured image (OpenAI), data-driven secondary keywords (SEOZoom or Claude), and JSON-LD (Article+FAQPage) — stored as a `GeneratedContent` (canale BLOG, formato ARTICOLO, status BOZZA) reviewable in the portal.

**Architecture:** Mirrors the Meta generator (injected-deps + fail-safe + `claude.messages.create` JSON+zod + `GeneratedContent`/`GeneratedAsset`). New read-only `src/lib/shopify/` module (GraphQL Admin API) for products+metafields. New `src/lib/blog/` pipeline. Non-essential external steps DEGRADE (SEOZoom down → Claude proposes secondary keywords; Shopify down → article without product refs). Publishing to Shopify, the editorial calendar, and n8n are SEPARATE later fette — this fetta never writes to Shopify.

**Tech Stack:** Next.js 15, Prisma/Postgres, `@anthropic-ai/sdk` (`claude-opus-4-8`), `openai` (`gpt-image-1`), Shopify Admin GraphQL API (read), SEOZoom (`fetchKeywords`), Vitest.

**Branch:** `blog-generator` (off `brain-mvp-clean`). Local Postgres via `.env`.

**Patterns to reuse (already in repo):**
- `src/lib/meta/runtime.ts` exports `stripFences` — import it, don't duplicate.
- `src/lib/meta/generate.ts` — the injected-deps + fail-safe shape to mirror.
- `src/lib/image/{openai.ts (getOpenAI, IMAGE_MODEL), store.ts (saveAssetFile, deleteAssetFile), prompt.ts (buildImagePrompt)}`.
- `src/lib/brain/context.ts` (`buildKbContext`), `src/lib/claude.ts` (`getClaude`, `BRAINSTORM_MODEL`), `src/lib/seozoom/client.ts` (`fetchKeywords`).
- Route seam: `deps-registry.ts` + `injected.__run ?? fn` (see `src/app/api/meta/generate/route.ts`).
- Content PATCH/GET/DELETE: `src/app/api/meta/contents/[id]/route.ts`.

---

## File Structure
```
prisma/schema.prisma                         # ContentFormat += ARTICOLO
src/lib/shopify/products.ts                  # fetchProductsWithMetafields + normalizeProducts (read-only)
src/lib/blog/jsonld.ts                       # buildArticleJsonLd (pure)
src/lib/blog/schema.ts                       # blogArticleSchema (zod) + types
src/lib/blog/prompt.ts                       # buildBlogPrompt + BlogIdea/BlogSeo types
src/lib/blog/generate.ts                     # BlogDeps + generateBlogArticle (pipeline)
src/lib/blog/runtime.ts                      # buildBlogDeps (Shopify+KB+SEOZoom+Claude+OpenAI+Prisma)
src/app/api/blog/validators.ts               # blogGenerateSchema + blogUpdateSchema
src/app/api/blog/generate/route.ts           # POST  (+ deps-registry.ts)
src/app/api/blog/generate/deps-registry.ts
src/app/api/blog/contents/route.ts           # GET list (canale BLOG)
src/app/api/blog/contents/[id]/route.ts      # GET / PATCH / DELETE
src/app/blog/page.tsx                        # list
src/app/blog/[id]/page.tsx                   # detail/preview
src/app/blog/genera/page.tsx                 # generate from approved idea
src/components/blog-content-table.tsx        # list table
src/components/nav.tsx                        # + "Blog" link
.env.example / docker-compose.yml            # SHOPIFY_SHOP_DOMAIN, SHOPIFY_ADMIN_TOKEN, SHOPIFY_STORE_URL
```

---

## Task 1: Prisma — ContentFormat += ARTICOLO

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add the enum value**

In `prisma/schema.prisma`, in `enum ContentFormat`, add `ARTICOLO`:
```prisma
enum ContentFormat {
  POST
  CAROSELLO
  ARTICOLO
}
```

- [ ] **Step 2: Validate + migrate + generate**

Run:
```bash
npx prisma validate
npx prisma migrate dev --name content_format_articolo
npx prisma generate
```
Expected: valid; migration created+applied; client regenerated. If DB unreachable, report BLOCKED with the error.

- [ ] **Step 3: Commit**
```bash
git add prisma/
git commit -m "feat: ContentFormat ARTICOLO for blog articles"
```

---

## Task 2: Shopify read module (products + metafields)

**Files:** Create `src/lib/shopify/products.ts`, Test `src/lib/shopify/products.test.ts`

> ⚠️ The exact Shopify Admin API shape is verified live in Task 12. `normalizeProducts` is the only format-aware code; the GraphQL query/URL get finalized at the smoke test. Only the normalizer is unit-tested here.

- [ ] **Step 1: Write the failing test**

`src/lib/shopify/products.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeProducts } from "@/lib/shopify/products";

describe("normalizeProducts", () => {
  it("maps GraphQL product edges + metafields to ShopProduct[]", () => {
    const raw = {
      data: { products: { edges: [
        { node: {
          handle: "magnesio-supremo", title: "Magnesio Supremo", productType: "Integratori",
          metafields: { edges: [
            { node: { key: "ingredienti_dettagliati", value: "Magnesio citrato" } },
            { node: { key: "posologia", value: "1 misurino/die" } },
          ] },
        } },
      ] } },
    };
    const out = normalizeProducts(raw, "https://agocap.it");
    expect(out).toHaveLength(1);
    expect(out[0].handle).toBe("magnesio-supremo");
    expect(out[0].titolo).toBe("Magnesio Supremo");
    expect(out[0].url).toBe("https://agocap.it/products/magnesio-supremo");
    expect(out[0].categoria).toBe("Integratori");
    expect(out[0].metafields.posologia).toBe("1 misurino/die");
  });
  it("returns [] for a malformed response", () => {
    expect(normalizeProducts({}, "https://x")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/shopify/products.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/shopify/products.ts`:
```ts
export interface ShopProduct {
  handle: string;
  titolo: string;
  url: string;
  categoria: string;
  metafields: Record<string, string>;
}

// NOTE: GraphQL query + API version verified live (Task 12).
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2024-10";

function storeUrl(): string {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN ?? "";
  return process.env.SHOPIFY_STORE_URL ?? `https://${shop}`;
}

/** Maps the Shopify Admin GraphQL products response to ShopProduct[]. The ONLY Shopify-format-aware code. */
export function normalizeProducts(raw: unknown, store: string): ShopProduct[] {
  const edges = (raw as { data?: { products?: { edges?: unknown[] } } })?.data?.products?.edges;
  if (!Array.isArray(edges)) return [];
  const out: ShopProduct[] = [];
  for (const e of edges) {
    const node = (e as { node?: Record<string, unknown> })?.node;
    if (!node || typeof node.handle !== "string") continue;
    const metafields: Record<string, string> = {};
    const mfEdges = (node.metafields as { edges?: unknown[] })?.edges;
    if (Array.isArray(mfEdges)) {
      for (const m of mfEdges) {
        const mn = (m as { node?: { key?: unknown; value?: unknown } })?.node;
        if (mn && typeof mn.key === "string" && typeof mn.value === "string") metafields[mn.key] = mn.value;
      }
    }
    out.push({
      handle: node.handle,
      titolo: typeof node.title === "string" ? node.title : node.handle,
      url: `${store}/products/${node.handle}`,
      categoria: typeof node.productType === "string" ? node.productType : "",
      metafields,
    });
  }
  return out;
}

/** Fetches products + metafields from the Shopify Admin GraphQL API (read-only). */
export async function fetchProductsWithMetafields(): Promise<ShopProduct[]> {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!shop || !token) throw new Error("SHOPIFY_SHOP_DOMAIN o SHOPIFY_ADMIN_TOKEN mancante");
  const query = `{ products(first: 50) { edges { node { handle title productType metafields(first: 30) { edges { node { key value } } } } } } }`;
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Shopify HTTP ${res.status}`);
  const json = await res.json();
  return normalizeProducts(json, storeUrl());
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/shopify/products.test.ts && npx tsc --noEmit`
Expected: 2 tests pass; tsc 0.

- [ ] **Step 5: Commit**
```bash
git add src/lib/shopify/products.ts src/lib/shopify/products.test.ts
git commit -m "feat: Shopify read module (products + metafields, format-isolated)"
```

---

## Task 3: Blog article schema + prompt

**Files:** Create `src/lib/blog/schema.ts`, `src/lib/blog/prompt.ts`; Test `src/lib/blog/schema.test.ts`, `src/lib/blog/prompt.test.ts`

- [ ] **Step 1: Write the failing schema test**

`src/lib/blog/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { blogArticleSchema } from "@/lib/blog/schema";

const valid = {
  keywordPrincipale: "magnesio sonno",
  keywordSecondarie: ["magnesio stress"],
  intentoRicerca: "informazionale",
  titoloSeo: "Magnesio e sonno: guida",
  metaDescription: "Come il magnesio favorisce il sonno.",
  puntiChiave: ["punto 1"],
  corpoHtml: "<h2>Intro</h2><p>...</p>",
  faq: [{ domanda: "Quando assumerlo?", risposta: "La sera." }],
  cta: "Scopri Magnesio Supremo",
  prodotti: [{ handle: "magnesio-supremo", titolo: "Magnesio Supremo", url: "https://x/products/magnesio-supremo" }],
};

describe("blogArticleSchema", () => {
  it("accepts a valid article", () => {
    expect(blogArticleSchema.parse(valid).titoloSeo).toBe("Magnesio e sonno: guida");
  });
  it("rejects a malformed faq entry", () => {
    expect(() => blogArticleSchema.parse({ ...valid, faq: [{ domanda: "x" }] })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/blog/schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schema**

`src/lib/blog/schema.ts`:
```ts
import { z } from "zod";

export const blogArticleSchema = z.object({
  keywordPrincipale: z.string().min(1),
  keywordSecondarie: z.array(z.string()),
  intentoRicerca: z.string(),
  titoloSeo: z.string().min(1),
  metaDescription: z.string().min(1),
  puntiChiave: z.array(z.string()),
  corpoHtml: z.string().min(1),
  faq: z.array(z.object({ domanda: z.string().min(1), risposta: z.string().min(1) })),
  cta: z.string(),
  prodotti: z.array(z.object({ handle: z.string(), titolo: z.string(), url: z.string() })),
});

export type BlogArticle = z.infer<typeof blogArticleSchema>;
```

- [ ] **Step 4: Run to verify the schema test passes**

Run: `npx vitest run src/lib/blog/schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing prompt test**

`src/lib/blog/prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildBlogPrompt } from "@/lib/blog/prompt";

describe("buildBlogPrompt", () => {
  it("includes KB, idea, products, seo keywords, GEO + JSON instructions", () => {
    const p = buildBlogPrompt({
      kbContext: "## Tono\nNaturale",
      idea: { keyword: "magnesio sonno", volumeRicerca: 1900, difficolta: 35, titolo: "Magnesio e sonno", descrizione: "d", category: "EDUCATIONAL" },
      prodotti: [{ handle: "magnesio-supremo", titolo: "Magnesio Supremo", url: "https://x/products/magnesio-supremo", categoria: "Integratori", metafields: { posologia: "1/die" } }],
      seo: { keywordPrincipale: "magnesio sonno", keywordSecondarie: ["magnesio stress"] },
    });
    expect(p).toContain("magnesio sonno");
    expect(p).toContain("Magnesio Supremo");
    expect(p).toContain("posologia");
    expect(p.toLowerCase()).toContain("faq");
    expect(p.toLowerCase()).toContain("json");
    expect(p.toLowerCase()).toContain("html");
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/lib/blog/prompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the prompt builder**

`src/lib/blog/prompt.ts`:
```ts
export interface BlogIdea {
  keyword: string | null;
  volumeRicerca: number | null;
  difficolta: number | null;
  titolo: string;
  descrizione: string;
  category: string;
}

export interface BlogSeo {
  keywordPrincipale: string;
  keywordSecondarie: string[];
}

export interface BlogProductInfo {
  handle: string;
  titolo: string;
  url: string;
  categoria: string;
  metafields: Record<string, string>;
}

export interface BlogPromptArgs {
  kbContext: string;
  idea: BlogIdea;
  prodotti: BlogProductInfo[];
  seo: BlogSeo;
}

export function buildBlogPrompt({ kbContext, idea, prodotti, seo }: BlogPromptArgs): string {
  const catalogo = prodotti.length
    ? prodotti
        .map((p) => {
          const mf = Object.entries(p.metafields)
            .map(([k, v]) => `${k}: ${v}`)
            .join("; ");
          return `- ${p.titolo} (handle ${p.handle}, url ${p.url}, categoria ${p.categoria})${mf ? ` — ${mf}` : ""}`;
        })
        .join("\n")
    : "(nessun prodotto disponibile: non inventare prodotti né link)";

  const secondarie = seo.keywordSecondarie.length
    ? `Usa anche queste keyword secondarie reali: ${seo.keywordSecondarie.join(", ")}.`
    : "Proponi tu 3-6 keyword secondarie pertinenti.";

  return `Sei un copywriter SEO esperto per Agocap (integratori, benessere, beauty, salute naturale).

# Knowledge base (tono di voce, brand)
${kbContext}

# Idea di partenza
Titolo: ${idea.titolo}
Descrizione: ${idea.descrizione}
Categoria: ${idea.category}
Keyword principale: ${seo.keywordPrincipale}${idea.volumeRicerca ? ` (volume ${idea.volumeRicerca}, difficoltà ${idea.difficolta})` : ""}
${secondarie}

# Catalogo prodotti Agocap (con metafield) — scegli SOLO i prodotti pertinenti all'argomento e usali per CTA con link reali
${catalogo}

# Compito
Scrivi un articolo per il blog ottimizzato SEO e GEO (Generative Engine Optimization). Requisiti:
- corpoHtml: HTML semantico (h2/h3, paragrafi citabili e fattuali, un blocco "punti chiave"); niente <html>/<head>, solo il contenuto dell'articolo.
- titoloSeo accattivante; metaDescription ≤ 160 caratteri.
- puntiChiave: 3-5 takeaway sintetici.
- faq: 3-5 domande/risposte reali e utili.
- prodotti: solo quelli pertinenti scelti dal catalogo (handle, titolo, url esatti dal catalogo); cta coerente. Se il catalogo è vuoto, prodotti = [] e nessun link inventato.
- Ancora tutto alla knowledge base (tono, claim prudenti e conformi).

Rispondi esclusivamente con un oggetto JSON valido di forma:
{"keywordPrincipale":"...","keywordSecondarie":["..."],"intentoRicerca":"...","titoloSeo":"...","metaDescription":"...","puntiChiave":["..."],"corpoHtml":"...","faq":[{"domanda":"...","risposta":"..."}],"cta":"...","prodotti":[{"handle":"...","titolo":"...","url":"..."}]}
senza testo prima o dopo, senza markdown.`;
}
```

- [ ] **Step 8: Run to verify the prompt test passes + typecheck**

Run: `npx vitest run src/lib/blog/prompt.test.ts && npx tsc --noEmit`
Expected: PASS; tsc 0.

- [ ] **Step 9: Commit**
```bash
git add src/lib/blog/schema.ts src/lib/blog/schema.test.ts src/lib/blog/prompt.ts src/lib/blog/prompt.test.ts
git commit -m "feat: blog article schema + prompt builder"
```

---

## Task 4: JSON-LD builder (pure)

**Files:** Create `src/lib/blog/jsonld.ts`; Test `src/lib/blog/jsonld.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/blog/jsonld.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildArticleJsonLd } from "@/lib/blog/jsonld";

describe("buildArticleJsonLd", () => {
  it("builds Article + FAQPage JSON-LD as a JSON string", () => {
    const s = buildArticleJsonLd({
      titoloSeo: "Magnesio e sonno",
      metaDescription: "Guida al magnesio.",
      faq: [{ domanda: "Quando?", risposta: "La sera." }],
    });
    const parsed = JSON.parse(s);
    expect(Array.isArray(parsed["@graph"])).toBe(true);
    const types = parsed["@graph"].map((n: { ["@type"]: string }) => n["@type"]);
    expect(types).toContain("Article");
    expect(types).toContain("FAQPage");
    const faqNode = parsed["@graph"].find((n: { ["@type"]: string }) => n["@type"] === "FAQPage");
    expect(faqNode.mainEntity[0].name).toBe("Quando?");
    expect(faqNode.mainEntity[0].acceptedAnswer.text).toBe("La sera.");
  });
  it("emits an empty FAQPage mainEntity when there are no faq", () => {
    const parsed = JSON.parse(buildArticleJsonLd({ titoloSeo: "t", metaDescription: "d", faq: [] }));
    const faqNode = parsed["@graph"].find((n: { ["@type"]: string }) => n["@type"] === "FAQPage");
    expect(faqNode.mainEntity).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/blog/jsonld.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/blog/jsonld.ts`:
```ts
export interface JsonLdArgs {
  titoloSeo: string;
  metaDescription: string;
  faq: { domanda: string; risposta: string }[];
}

/** Builds an Article + FAQPage JSON-LD graph as a JSON string (schema.org). Pure. */
export function buildArticleJsonLd({ titoloSeo, metaDescription, faq }: JsonLdArgs): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: titoloSeo, description: metaDescription },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.domanda,
          acceptedAnswer: { "@type": "Answer", text: f.risposta },
        })),
      },
    ],
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/blog/jsonld.test.ts && npx tsc --noEmit`
Expected: PASS (2 tests); tsc 0.

- [ ] **Step 5: Commit**
```bash
git add src/lib/blog/jsonld.ts src/lib/blog/jsonld.test.ts
git commit -m "feat: blog JSON-LD builder (Article + FAQPage)"
```

---

## Task 5: Pipeline `generateBlogArticle` (deps injected, fail-safe, JSON-LD merge)

**Files:** Create `src/lib/blog/generate.ts`; Test `src/lib/blog/generate.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/blog/generate.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { generateBlogArticle } from "@/lib/blog/generate";

const article = {
  keywordPrincipale: "magnesio sonno", keywordSecondarie: [], intentoRicerca: "info",
  titoloSeo: "Magnesio e sonno", metaDescription: "d", puntiChiave: ["x"],
  corpoHtml: "<p>x</p>", faq: [{ domanda: "Q", risposta: "A" }], cta: "c", prodotti: [],
};

function makeDeps(overrides = {}) {
  return {
    loadContext: vi.fn().mockResolvedValue({
      idea: { keyword: "magnesio sonno", volumeRicerca: 1900, difficolta: 35, titolo: "T", descrizione: "d", category: "EDUCATIONAL" },
      kbContext: "kb", prodotti: [],
    }),
    loadSeoData: vi.fn().mockResolvedValue({ keywordPrincipale: "magnesio sonno", keywordSecondarie: [] }),
    callClaude: vi.fn().mockResolvedValue({ payload: article, promptUsato: "P", modello: "claude-opus-4-8", inputTokens: 1, outputTokens: 1, rawOutput: {} }),
    generateImage: vi.fn().mockResolvedValue({ bytes: Buffer.from("img"), prompt: "imgprompt" }),
    persist: vi.fn().mockResolvedValue({ contentId: "c1" }),
    ...overrides,
  };
}

describe("generateBlogArticle", () => {
  it("returns DONE and persists a payload that includes a JSON-LD string", async () => {
    const deps = makeDeps();
    const res = await generateBlogArticle({ ideaId: "i1" }, deps as any);
    expect(res.status).toBe("DONE");
    expect(res.contentId).toBe("c1");
    const persisted = (deps.persist as any).mock.calls[0][0].payload;
    expect(typeof persisted.jsonLd).toBe("string");
    expect(persisted.jsonLd).toContain("FAQPage");
    expect(persisted.titoloSeo).toBe("Magnesio e sonno");
    // image generated from the seo title
    expect((deps.generateImage as any).mock.calls[0][0].titoloSeo).toBe("Magnesio e sonno");
  });

  it("returns ERROR when Claude fails (nothing persisted)", async () => {
    const deps = makeDeps({ callClaude: vi.fn().mockRejectedValue(new Error("AI down")) });
    const res = await generateBlogArticle({ ideaId: "i1" }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("AI down");
    expect(deps.persist).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/blog/generate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/blog/generate.ts`:
```ts
import { buildArticleJsonLd } from "./jsonld";
import type { BlogArticle } from "./schema";
import type { BlogIdea, BlogProductInfo, BlogSeo } from "./prompt";

export interface BlogGenInput {
  ideaId: string;
}

export interface BlogClaudeResult {
  payload: BlogArticle;
  promptUsato: string;
  modello: string;
  inputTokens: number;
  outputTokens: number;
  rawOutput: unknown;
}

export interface BlogDeps {
  loadContext: (ideaId: string) => Promise<{ idea: BlogIdea; kbContext: string; prodotti: BlogProductInfo[] }>;
  loadSeoData: (idea: BlogIdea) => Promise<BlogSeo>;
  callClaude: (args: { idea: BlogIdea; kbContext: string; prodotti: BlogProductInfo[]; seo: BlogSeo }) => Promise<BlogClaudeResult>;
  generateImage: (args: { titoloSeo: string }) => Promise<{ bytes: Buffer; prompt: string }>;
  persist: (args: { input: BlogGenInput; payload: object; claude: BlogClaudeResult; image: { bytes: Buffer; prompt: string } }) => Promise<{ contentId: string }>;
}

export interface BlogGenResult {
  status: "DONE" | "ERROR";
  contentId?: string;
  error?: string;
}

export async function generateBlogArticle(input: BlogGenInput, deps: BlogDeps): Promise<BlogGenResult> {
  try {
    const { idea, kbContext, prodotti } = await deps.loadContext(input.ideaId);
    const seo = await deps.loadSeoData(idea);
    const claude = await deps.callClaude({ idea, kbContext, prodotti, seo });
    const jsonLd = buildArticleJsonLd(claude.payload);
    const payload = { ...claude.payload, jsonLd };
    const image = await deps.generateImage({ titoloSeo: claude.payload.titoloSeo });
    const { contentId } = await deps.persist({ input, payload, claude, image });
    return { status: "DONE", contentId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/blog/generate.test.ts && npx tsc --noEmit`
Expected: PASS (2 tests); tsc 0.

- [ ] **Step 5: Commit**
```bash
git add src/lib/blog/generate.ts src/lib/blog/generate.test.ts
git commit -m "feat: blog generation pipeline (injected deps, fail-safe, JSON-LD merge)"
```

---

## Task 6: Runtime `buildBlogDeps`

**Files:** Create `src/lib/blog/runtime.ts`; Test `src/lib/blog/runtime.test.ts`

Wires the real deps. `loadContext` loads the approved idea + KB + Shopify products (degrades to `[]` on Shopify error); `loadSeoData` derives the principal keyword and pulls secondary keywords from SEOZoom (degrades to `[]`); `callClaude` reuses the proven pattern + `stripFences` from meta/runtime; `generateImage` reuses the OpenAI image client; `persist` creates the `GeneratedContent` (BLOG/ARTICOLO/BOZZA) + featured-image `GeneratedAsset`. Only the pure helper `deriveSeo` is unit-tested.

- [ ] **Step 1: Write the failing test**

`src/lib/blog/runtime.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { deriveSecondaryKeywords } from "@/lib/blog/runtime";

describe("deriveSecondaryKeywords", () => {
  it("drops the principal keyword and caps the list", () => {
    const related = [
      { keyword: "magnesio sonno", volume: 1, difficolta: 1, trend: "stabile" },
      { keyword: "magnesio stress", volume: 1, difficolta: 1, trend: "stabile" },
      { keyword: "magnesio sport", volume: 1, difficolta: 1, trend: "stabile" },
    ];
    const out = deriveSecondaryKeywords("Magnesio Sonno", related, 2);
    expect(out).toEqual(["magnesio stress", "magnesio sport"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/blog/runtime.test.ts`
Expected: FAIL — `deriveSecondaryKeywords` not exported.

- [ ] **Step 3: Implement**

`src/lib/blog/runtime.ts`:
```ts
import { prisma } from "@/lib/prisma";
import { getClaude, BRAINSTORM_MODEL } from "@/lib/claude";
import { buildKbContext } from "@/lib/brain/context";
import { stripFences } from "@/lib/meta/runtime";
import { getOpenAI, IMAGE_MODEL } from "@/lib/image/openai";
import { saveAssetFile } from "@/lib/image/store";
import { buildImagePrompt } from "@/lib/image/prompt";
import { fetchKeywords } from "@/lib/seozoom/client";
import type { NormalizedKeyword } from "@/lib/seozoom/select";
import { fetchProductsWithMetafields } from "@/lib/shopify/products";
import { buildBlogPrompt, type BlogIdea } from "./prompt";
import { blogArticleSchema } from "./schema";
import type { BlogDeps, BlogClaudeResult } from "./generate";

/** Maps SEOZoom related keywords to secondary keyword strings, dropping the principal and capping. */
export function deriveSecondaryKeywords(principal: string, related: NormalizedKeyword[], cap = 8): string[] {
  const p = principal.trim().toLowerCase();
  return related
    .map((k) => k.keyword)
    .filter((k) => k.trim().toLowerCase() !== p)
    .slice(0, cap);
}

export function buildBlogDeps(): BlogDeps {
  return {
    loadContext: async (ideaId) => {
      const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
      if (!idea) throw new Error("Idea non trovata");
      if (idea.status !== "APPROVATA") throw new Error("Idea non approvata: genera solo da idee APPROVATA");
      const knowledge = await prisma.knowledgeItem.findMany();
      const product = idea.productId ? await prisma.product.findUnique({ where: { id: idea.productId } }) : null;
      const kbContext = buildKbContext({ products: product ? [product] : [], knowledge });
      let prodotti = [] as Awaited<ReturnType<typeof fetchProductsWithMetafields>>;
      try {
        prodotti = await fetchProductsWithMetafields();
      } catch (err) {
        console.error("Shopify prodotti non disponibili, genero senza riferimenti prodotto:", err instanceof Error ? err.message : err);
      }
      const blogIdea: BlogIdea = {
        keyword: idea.keyword, volumeRicerca: idea.volumeRicerca, difficolta: idea.difficolta,
        titolo: idea.titolo, descrizione: idea.descrizione, category: String(idea.category),
      };
      return { idea: blogIdea, kbContext, prodotti };
    },

    loadSeoData: async (idea) => {
      const keywordPrincipale = idea.keyword ?? idea.titolo;
      let keywordSecondarie: string[] = [];
      if (idea.keyword) {
        try {
          const related = await fetchKeywords(idea.keyword);
          keywordSecondarie = deriveSecondaryKeywords(keywordPrincipale, related);
        } catch (err) {
          console.error("SEOZoom correlate non disponibili, Claude proporrà le secondarie:", err instanceof Error ? err.message : err);
        }
      }
      return { keywordPrincipale, keywordSecondarie };
    },

    callClaude: async ({ idea, kbContext, prodotti, seo }): Promise<BlogClaudeResult> => {
      const prompt = buildBlogPrompt({ kbContext, idea, prodotti, seo });
      const claude = getClaude();
      const response = await claude.messages.create({
        model: BRAINSTORM_MODEL,
        max_tokens: 16000,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("Output AI non conforme");
      const payload = blogArticleSchema.parse(JSON.parse(stripFences(textBlock.text)));
      return {
        payload,
        promptUsato: prompt,
        modello: BRAINSTORM_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        rawOutput: response.content,
      };
    },

    generateImage: async ({ titoloSeo }) => {
      const prompt = buildImagePrompt({ ideaCreativa: titoloSeo, slideText: null });
      const client = getOpenAI();
      const res = await client.images.generate({ model: IMAGE_MODEL, prompt, size: "1024x1024" });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error("OpenAI non ha restituito un'immagine");
      return { bytes: Buffer.from(b64, "base64"), prompt };
    },

    persist: async ({ input, payload, claude, image }) => {
      const content = await prisma.generatedContent.create({
        data: {
          ideaId: input.ideaId,
          canale: "BLOG",
          formato: "ARTICOLO",
          status: "BOZZA",
          payload: payload as object,
          promptUsato: claude.promptUsato,
          modello: claude.modello,
          inputTokens: claude.inputTokens,
          outputTokens: claude.outputTokens,
          outputGrezzo: (claude.rawOutput ?? {}) as object,
        },
      });
      const asset = await prisma.generatedAsset.create({
        data: { contentId: content.id, slideIndex: null, tipo: "IMMAGINE", prompt: image.prompt, modello: IMAGE_MODEL, path: "" },
      });
      try {
        const relPath = saveAssetFile(content.id, asset.id, image.bytes);
        await prisma.generatedAsset.update({ where: { id: asset.id }, data: { path: relPath } });
      } catch (err) {
        await prisma.generatedAsset.delete({ where: { id: asset.id } }).catch(() => {});
        throw err;
      }
      return { contentId: content.id };
    },
  };
}
```

- [ ] **Step 4: Verify helper test + typecheck + full suite**

Run: `npx vitest run src/lib/blog/runtime.test.ts && npx tsc --noEmit && npx vitest run`
Expected: helper test passes; tsc 0; full suite green.

- [ ] **Step 5: Commit**
```bash
git add src/lib/blog/runtime.ts src/lib/blog/runtime.test.ts
git commit -m "feat: blog runtime deps (Shopify+KB+SEOZoom+Claude+OpenAI, degrade)"
```

---

## Task 7: API — validators + generate route

**Files:** Create `src/app/api/blog/validators.ts`, `src/app/api/blog/generate/route.ts`, `src/app/api/blog/generate/deps-registry.ts`; Test `src/app/api/blog/validators.test.ts`, `src/app/api/blog/generate/route.test.ts`

- [ ] **Step 1: Write the failing validators test**

`src/app/api/blog/validators.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { blogGenerateSchema } from "@/app/api/blog/validators";

describe("blogGenerateSchema", () => {
  it("accepts an ideaId", () => {
    expect(blogGenerateSchema.parse({ ideaId: "i1" }).ideaId).toBe("i1");
  });
  it("rejects a missing ideaId", () => {
    expect(() => blogGenerateSchema.parse({})).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/api/blog/validators.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the validators**

`src/app/api/blog/validators.ts`:
```ts
import { z } from "zod";
import { CONTENT_STATUSES } from "@/lib/meta/enums";

export const blogGenerateSchema = z.object({
  ideaId: z.string().min(1),
});

export const blogUpdateSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  dataPrevista: z.string().datetime().nullable().optional(),
});
```

- [ ] **Step 4: Run to verify the validators test passes**

Run: `npx vitest run src/app/api/blog/validators.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Create the deps-registry seam**

`src/app/api/blog/generate/deps-registry.ts`:
```ts
import { generateBlogArticle } from "@/lib/blog/generate";

export type DepsFactory = () => { __run?: typeof generateBlogArticle } & Record<string, unknown>;

let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) {
  depsFactory = f;
}
export function getDepsFactory(): DepsFactory {
  return depsFactory;
}
```

- [ ] **Step 6: Write the failing route test**

`src/app/api/blog/generate/route.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/blog/generate/route";
import { __setDepsFactory } from "@/app/api/blog/generate/deps-registry";

function req(body: unknown) {
  return new Request("http://test/api/blog/generate", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("POST /api/blog/generate", () => {
  it("returns 200 with contentId on success", async () => {
    const spy = vi.fn().mockResolvedValue({ status: "DONE", contentId: "c1" });
    __setDepsFactory(() => ({ __run: spy }) as any);
    const res = await POST(req({ ideaId: "i1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).contentId).toBe("c1");
  });
  it("returns 400 on missing ideaId", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
  it("returns 502 when generation errors", async () => {
    __setDepsFactory(() => ({ __run: vi.fn().mockResolvedValue({ status: "ERROR", error: "x" }) }) as any);
    const res = await POST(req({ ideaId: "i1" }));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/app/api/blog/generate/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 8: Implement the route**

`src/app/api/blog/generate/route.ts`:
```ts
import { NextResponse } from "next/server";
import { generateBlogArticle } from "@/lib/blog/generate";
import { buildBlogDeps } from "@/lib/blog/runtime";
import { blogGenerateSchema } from "../validators";
import { getDepsFactory } from "./deps-registry";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const parsed = blogGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido", details: parsed.error.flatten() }, { status: 400 });
  }

  const injected = getDepsFactory()();
  const run = injected.__run ?? generateBlogArticle;
  const deps = injected.__run ? ({} as never) : buildBlogDeps();

  const result = await run(parsed.data, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
```

- [ ] **Step 9: Verify + full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass; tsc 0.

- [ ] **Step 10: Commit**
```bash
git add src/app/api/blog/validators.ts src/app/api/blog/validators.test.ts src/app/api/blog/generate/
git commit -m "feat: blog validators + POST /api/blog/generate route"
```

---

## Task 8: API — contents list + detail/PATCH/DELETE

**Files:** Create `src/app/api/blog/contents/route.ts`, `src/app/api/blog/contents/[id]/route.ts`

- [ ] **Step 1: Implement the list route**

`src/app/api/blog/contents/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const where: Record<string, unknown> = { canale: "BLOG" };
  const status = searchParams.get("status");
  if (status) where.status = status;

  const contents = await prisma.generatedContent.findMany({
    where,
    orderBy: [{ dataPrevista: "asc" }, { createdAt: "desc" }],
    include: { idea: { select: { titolo: true } }, assets: { select: { id: true } } },
  });
  return NextResponse.json(contents);
}
```

- [ ] **Step 2: Implement the detail/PATCH/DELETE route**

`src/app/api/blog/contents/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blogUpdateSchema } from "../../validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const content = await prisma.generatedContent.findUnique({
    where: { id },
    include: { idea: { select: { id: true, titolo: true } }, assets: true },
  });
  if (!content) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  return NextResponse.json(content);
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = blogUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (parsed.data.payload !== undefined) data.payload = parsed.data.payload;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.dataPrevista !== undefined) {
    data.dataPrevista = parsed.data.dataPrevista ? new Date(parsed.data.dataPrevista) : null;
  }
  try {
    const content = await prisma.generatedContent.update({ where: { id }, data });
    return NextResponse.json(content);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.generatedContent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}
```

- [ ] **Step 3: Verify build + typecheck**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build compiles the new routes.

- [ ] **Step 4: Commit**
```bash
git add src/app/api/blog/contents/
git commit -m "feat: blog contents list + detail/PATCH/DELETE API"
```

---

## Task 9: UI — list, detail, generate-from-idea, nav

**Files:** Create `src/app/blog/page.tsx`, `src/app/blog/[id]/page.tsx`, `src/app/blog/genera/page.tsx`, `src/components/blog-content-table.tsx`; Modify `src/components/nav.tsx`

- [ ] **Step 1: Add the nav link**

In `src/components/nav.tsx`, add to `links` after the "Area Meta" entry:
```tsx
  { href: "/blog", label: "Blog" },
```

- [ ] **Step 2: Create the list table component**

`src/components/blog-content-table.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Content { id: string; status: string; createdAt: string; payload: { titoloSeo?: string }; idea?: { titolo: string } | null; }

export function BlogContentTable() {
  const [items, setItems] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blog/contents")
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Caricamento…</p>;
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-neutral-500">
          <th className="p-2">Titolo SEO</th>
          <th className="p-2">Idea</th>
          <th className="p-2">Stato</th>
        </tr>
      </thead>
      <tbody>
        {items.map((c) => (
          <tr key={c.id} className="border-b hover:bg-neutral-50">
            <td className="p-2"><Link href={`/blog/${c.id}`} className="text-blue-600 hover:underline">{c.payload?.titoloSeo ?? "Articolo"}</Link></td>
            <td className="p-2">{c.idea?.titolo ?? "—"}</td>
            <td className="p-2">{c.status}</td>
          </tr>
        ))}
        {items.length === 0 && <tr><td colSpan={3} className="p-4 text-neutral-500">Nessun articolo.</td></tr>}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Create the list page**

`src/app/blog/page.tsx`:
```tsx
import Link from "next/link";
import { BlogContentTable } from "@/components/blog-content-table";

export const dynamic = "force-dynamic";

export default function BlogPage() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Blog</h1>
        <Link href="/blog/genera" className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Genera articolo da idea</Link>
      </div>
      <BlogContentTable />
    </div>
  );
}
```

- [ ] **Step 4: Create the generate-from-idea page**

`src/app/blog/genera/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Idea { id: string; titolo: string; }

export default function BlogGeneraPage() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideaId, setIdeaId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ideas?status=APPROVATA").then((r) => r.json()).then(setIdeas).catch(() => setIdeas([]));
  }, []);

  const submit = async () => {
    if (!ideaId) { setError("Scegli un'idea approvata."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/blog/generate", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ideaId }),
      });
      const json = await res.json();
      if (res.ok && json.contentId) router.push(`/blog/${json.contentId}`);
      else setError(`Errore: ${json.error ?? "sconosciuto"}`);
    } catch {
      setError("Errore di rete durante la generazione.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-2xl font-semibold">Genera articolo blog</h1>
      <select className="mb-3 w-full rounded border p-2" value={ideaId} onChange={(e) => setIdeaId(e.target.value)}>
        <option value="">Scegli un'idea approvata…</option>
        {ideas.map((i) => <option key={i.id} value={i.id}>{i.titolo}</option>)}
      </select>
      <button onClick={submit} disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40">
        {busy ? "Genero… (può richiedere ~1 min)" : "Genera"}
      </button>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Create the detail page**

`src/app/blog/[id]/page.tsx`:
```tsx
"use client";

import { useEffect, useState, use } from "react";

interface Asset { id: string; }
interface Content {
  id: string; status: string;
  payload: {
    titoloSeo?: string; metaDescription?: string; keywordPrincipale?: string; keywordSecondarie?: string[];
    corpoHtml?: string; cta?: string; puntiChiave?: string[];
    faq?: { domanda: string; risposta: string }[];
    prodotti?: { handle: string; titolo: string; url: string }[];
    jsonLd?: string;
  };
  assets: Asset[];
}

const STATUSES = ["BOZZA", "DA_APPROVARE", "APPROVATO", "PROGRAMMATO", "PUBBLICATO"];

export default function BlogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<Content | null>(null);

  const load = () => fetch(`/api/blog/contents/${id}`).then((r) => r.json()).then(setC).catch(() => setC(null));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (!c) return <p>Caricamento…</p>;
  const p = c.payload ?? {};
  const setStatus = async (status: string) => {
    await fetch(`/api/blog/contents/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">{p.titoloSeo ?? "Articolo"}</h1>
      <p className="mb-2 text-sm text-neutral-500">{p.metaDescription}</p>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="rounded bg-neutral-100 px-2 py-0.5">{c.status}</span>
        <select className="rounded border p-1" value={c.status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <p className="mb-3 text-xs text-neutral-500">Keyword: {p.keywordPrincipale} {p.keywordSecondarie?.length ? `· ${p.keywordSecondarie.join(", ")}` : ""}</p>
      {c.assets[0] && <img src={`/api/assets/${c.assets[0].id}`} alt="" className="mb-4 w-full max-w-md rounded" />}
      {p.puntiChiave?.length ? (
        <div className="mb-4 rounded bg-amber-50 p-3 text-sm">
          <strong>Punti chiave</strong>
          <ul className="ml-4 list-disc">{p.puntiChiave.map((k, i) => <li key={i}>{k}</li>)}</ul>
        </div>
      ) : null}
      <article className="prose mb-4 max-w-none" dangerouslySetInnerHTML={{ __html: p.corpoHtml ?? "" }} />
      {p.cta && <p className="mb-4 font-medium">{p.cta}</p>}
      {p.prodotti?.length ? (
        <div className="mb-4 text-sm">
          <strong>Prodotti collegati</strong>
          <ul className="ml-4 list-disc">
            {p.prodotti.map((pr) => <li key={pr.handle}><a href={pr.url} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">{pr.titolo}</a></li>)}
          </ul>
        </div>
      ) : null}
      {p.faq?.length ? (
        <div className="mb-4 text-sm">
          <strong>FAQ</strong>
          {p.faq.map((f, i) => <div key={i} className="mt-2"><div className="font-medium">{f.domanda}</div><div>{f.risposta}</div></div>)}
        </div>
      ) : null}
      {p.jsonLd && <details className="text-xs text-neutral-500"><summary>JSON-LD</summary><pre className="overflow-auto">{p.jsonLd}</pre></details>}
    </div>
  );
}
```

- [ ] **Step 6: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds (`/blog`, `/blog/[id]`, `/blog/genera` compile).

- [ ] **Step 7: Commit**
```bash
git add src/app/blog/ src/components/blog-content-table.tsx src/components/nav.tsx
git commit -m "feat: blog UI (list, detail/preview, generate-from-idea, nav)"
```

---

## Task 10: Env + Docker — Shopify config

**Files:** Modify `.env.example`, `docker-compose.yml`

- [ ] **Step 1: Append to `.env.example`**
```
SHOPIFY_SHOP_DOMAIN="e1ec06-4.myshopify.com"
SHOPIFY_ADMIN_TOKEN="shpat_..."
SHOPIFY_STORE_URL="https://e1ec06-4.myshopify.com"
```

- [ ] **Step 2: Add to the `app` service `environment:` block in `docker-compose.yml`**
```yaml
      SHOPIFY_SHOP_DOMAIN: "${SHOPIFY_SHOP_DOMAIN}"
      SHOPIFY_ADMIN_TOKEN: "${SHOPIFY_ADMIN_TOKEN}"
      SHOPIFY_STORE_URL: "${SHOPIFY_STORE_URL}"
```

- [ ] **Step 3: Validate**

Run: `docker compose config`
Expected: exits 0; the three vars wired into the app env (others preserved). If docker unavailable, validate the YAML by reading and report.

- [ ] **Step 4: Commit**
```bash
git add .env.example docker-compose.yml
git commit -m "feat: Shopify env wiring (read-only products/metafields)"
```

---

## Task 11: Full suite + build gate

- [ ] **Step 1: Run everything**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all unit tests pass; tsc 0; build succeeds. Fix any integration issues (import paths, types). Commit only if a fix was needed:
```bash
git add -A && git commit -m "chore: blog generator integration fixes"
```

---

## Task 12: End-to-end verification (+ confirm Shopify contract live)

**Files:** possibly `src/lib/shopify/products.ts` (finalize GraphQL/version/domain after live check). Requires real `SHOPIFY_ADMIN_TOKEN` + `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` + `SEOZOOM_API_KEY`, and an Idea with `status=APPROVATA` in the DB.

- [ ] **Step 1: Suite + build + migrate**

Run: `npx vitest run && npx tsc --noEmit && npm run build`, then `npx prisma migrate deploy`.

- [ ] **Step 2: Confirm the Shopify contract live**

Probe the Admin GraphQL API (confirm domain `e1ec06-4.myshopify.com`, API version, and that products+metafields return as expected):
```bash
curl -s -X POST "https://e1ec06-4.myshopify.com/admin/api/2024-10/graphql.json" \
  -H "X-Shopify-Access-Token: $SHOPIFY_ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"{ products(first: 3) { edges { node { handle title productType metafields(first:10){edges{node{key value}}} } } } }"}' | head -c 2000
```
Report the exact JSON. If the domain 404s, get the real `.myshopify.com` domain from Shopify admin Settings → Domains and set `SHOPIFY_SHOP_DOMAIN`. If the version is unsupported, use a supported one (e.g. `2025-01`) via `SHOPIFY_API_VERSION`. If metafields need a `namespace` or the shape differs, adjust the GraphQL query in `fetchProductsWithMetafields` and the `normalizeProducts` mapping (keep the 2 unit tests passing — adjust the sample only if field names differ). Re-run `npx vitest run`. Report what you confirmed/changed.

- [ ] **Step 3: Ensure an approved idea exists**

`GET http://localhost:8001/api/ideas?status=APPROVATA` — if empty, approve one (PATCH an existing idea's status to APPROVATA, or run a SEOZoom discovery then approve one). Note its id.

- [ ] **Step 4: Start the server with all keys**

Run (background): `SHOPIFY_SHOP_DOMAIN=... SHOPIFY_ADMIN_TOKEN=... SHOPIFY_STORE_URL=... ANTHROPIC_API_KEY=... OPENAI_API_KEY=... SEOZOOM_API_KEY=... PORT=8001 npm run dev`. Wait until ready.

- [ ] **Step 5: Live generation**

`POST http://localhost:8001/api/blog/generate` with `{"ideaId":"<approved id>"}` (timeout ~240s — Claude article + OpenAI image + Shopify read).
Expected: 200 `{"status":"DONE","contentId":"..."}`. If 502, report the exact error.

- [ ] **Step 6: Verify the draft**

`GET http://localhost:8001/api/blog/contents/<contentId>` → confirm: payload has `corpoHtml` (non-trivial HTML), `titoloSeo`, `metaDescription`, `faq`, `jsonLd` (contains FAQPage), `prodotti` referencing REAL Shopify products (handle/url) when products were available, and an `assets[0]` featured image. Open `/blog/<id>` in a browser; confirm the article + image + products + FAQ render. Note whether product refs are present (Shopify read worked) or empty (degraded — check console for the Shopify error).

- [ ] **Step 7: Stop the server. Report honestly.**

Report: suite/build, the confirmed Shopify contract (domain/version/metafields) + any change, the generation response, and a verified draft (HTML length, image present, product refs present/degraded, JSON-LD present). If Shopify read can't be confirmed, report that generation still completes via degrade (no product refs) and exactly why Shopify failed.

---

## Self-Review notes (addressed)
- **Spec coverage:** ARTICOLO enum (T1); Shopify read module + format-isolated normalizer + live contract (T2, T12); blog schema + GEO prompt with product catalog/metafields + data-driven keywords (T3); JSON-LD Article+FAQPage (T4); fail-safe pipeline with JSON-LD merge (T5); runtime deps deriving keyword data, SEOZoom secondary keywords with degrade, Shopify products with degrade, Claude article, OpenAI featured image, persist GeneratedContent+asset (T6); generate route with seam + validators (T7); contents list/detail/PATCH for review workflow (T8); UI list/detail-preview/generate-from-idea/nav (T9); env/docker (T10); gates (T11); live e2e + Shopify contract confirmation (T12). Publishing/calendar/n8n explicitly out of scope (roadmap).
- **Type consistency:** `ShopProduct` (T2) ↔ `BlogProductInfo` (T3 prompt) share the same shape (handle/titolo/url/categoria/metafields) and `fetchProductsWithMetafields` returns it, consumed by `loadContext` (T6) and passed as `prodotti` to `callClaude`→`buildBlogPrompt`; `BlogArticle` (T3) is `BlogClaudeResult.payload` (T5) and the pipeline spreads it + `jsonLd` into the persisted payload; `BlogIdea`/`BlogSeo` (T3) flow through `BlogDeps` (T5) into `runtime` (T6); `blogGenerateSchema` (T7) matches `BlogGenInput` (T5); `stripFences` imported from meta/runtime (no dup); image reuse via `buildImagePrompt`/`getOpenAI`/`saveAssetFile`.
- **No placeholders:** every code/test step is complete; the Shopify GraphQL contract is the only deferred item, handled by the explicit live-confirmation step (T12) with concrete fallbacks (domain/version/namespace), not a placeholder. `BlogProductInfo` is defined in `prompt.ts` and `ShopProduct` in `products.ts` with identical fields — runtime passes `ShopProduct[]` where `BlogProductInfo[]` is expected (structurally compatible; if tsc complains, import `ShopProduct` as the type in `generate.ts`/`prompt.ts` instead).
```
