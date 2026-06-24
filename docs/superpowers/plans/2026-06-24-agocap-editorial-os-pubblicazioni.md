# Editorial OS — Pubblicazioni Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish blog articles directly to Shopify from the app; expose secret-protected n8n endpoints for Meta publishing (poll due + success/error callbacks); add the `/pubblicazioni` monitoring area. Smoke publishes to Shopify as a DRAFT (`published:false`) for safety.

**Architecture:** Direct Shopify write for blog (REST Admin API, injected-deps + fail-safe), reusing the Fase-4 publication fields on `GeneratedContent`. n8n endpoints gated by `N8N_WEBHOOK_SECRET`. Monitoring area filters by `publicationStatus`. Reuse `StatusBadge`. The n8n Meta workflow itself is created later via the n8n API (needs the n8n base URL) — NOT in this plan.

**Tech Stack:** Next.js 15, Prisma/Postgres, Shopify Admin REST, Vitest. UI Italian, code English.

**Branch:** `publications` (off `brain-mvp-clean`). Local Postgres via `.env`.

**Current state:** `GeneratedContent` has `publicationStatus` (PublicationStatus enum NON_INVIATO/INVIATO_A_N8N/IN_PUBBLICAZIONE/PUBBLICATO/ERRORE), `publicationError`, `publishedAt`, `shopifyArticleId`, `shopifyArticleUrl`, plus `status` (ContentStatus), `payload`, `assets`, `canale`. Blog payload has `titoloSeo`, `corpoHtml`, `jsonLd`. `src/lib/image/store.ts` saves assets under an uploads dir (has `UPLOADS_DIR`, `saveAssetFile`). `src/lib/shopify/products.ts` reads via env `SHOPIFY_SHOP_DOMAIN`/`SHOPIFY_ADMIN_TOKEN`/`SHOPIFY_API_VERSION`(default 2024-10)/`SHOPIFY_STORE_URL`.

---

## Task 1: N8N_WEBHOOK_SECRET env + auth helper

**Files:** Modify `.env.example`, `docker-compose.yml`; Create `src/lib/publications/auth.ts`; Test `src/lib/publications/auth.test.ts`

- [ ] **Step 1: Failing test**

`src/lib/publications/auth.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { checkWebhookSecret } from "@/lib/publications/auth";

const req = (secret?: string) => new Request("http://t/x", secret ? { headers: { "x-webhook-secret": secret } } : undefined);

describe("checkWebhookSecret", () => {
  afterEach(() => { delete process.env.N8N_WEBHOOK_SECRET; });
  it("true when header matches env", () => {
    process.env.N8N_WEBHOOK_SECRET = "s3cret";
    expect(checkWebhookSecret(req("s3cret"))).toBe(true);
  });
  it("false when missing/mismatch/unset", () => {
    process.env.N8N_WEBHOOK_SECRET = "s3cret";
    expect(checkWebhookSecret(req("nope"))).toBe(false);
    expect(checkWebhookSecret(req())).toBe(false);
    delete process.env.N8N_WEBHOOK_SECRET;
    expect(checkWebhookSecret(req("s3cret"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL, implement**

`src/lib/publications/auth.ts`:
```ts
/** True only when N8N_WEBHOOK_SECRET is set AND the x-webhook-secret header matches it. */
export function checkWebhookSecret(request: Request): boolean {
  const expected = process.env.N8N_WEBHOOK_SECRET;
  if (!expected) return false;
  return request.headers.get("x-webhook-secret") === expected;
}
```

- [ ] **Step 3: Env + Docker**

Append to `.env.example`:
```
N8N_WEBHOOK_SECRET="change-me"
```
Add to the `app` service `environment:` in `docker-compose.yml`:
```yaml
      N8N_WEBHOOK_SECRET: "${N8N_WEBHOOK_SECRET}"
```

- [ ] **Step 4: Verify + commit**

Run: `npx vitest run src/lib/publications/auth.test.ts && npx tsc --noEmit`
```bash
git add src/lib/publications/ .env.example docker-compose.yml
git commit -m "feat: N8N_WEBHOOK_SECRET + checkWebhookSecret helper"
```

---

## Task 2: Shopify publish module

**Files:** Modify `src/lib/image/store.ts` (add `readAssetBase64`); Create `src/lib/shopify/publish.ts`; Test `src/lib/shopify/publish.test.ts`

- [ ] **Step 1: Failing test (pure body builder)**

`src/lib/shopify/publish.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildArticleBodyHtml } from "@/lib/shopify/publish";

describe("buildArticleBodyHtml", () => {
  it("appends JSON-LD script when present", () => {
    const out = buildArticleBodyHtml("<p>ciao</p>", '{"@type":"Article"}');
    expect(out).toContain("<p>ciao</p>");
    expect(out).toContain('application/ld+json');
    expect(out).toContain('"@type":"Article"');
  });
  it("returns corpoHtml unchanged when no JSON-LD", () => {
    expect(buildArticleBodyHtml("<p>x</p>")).toBe("<p>x</p>");
  });
});
```

- [ ] **Step 2: Run → FAIL, implement publish module**

`src/lib/shopify/publish.ts`:
```ts
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2024-10";

function cfg() {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!shop || !token) throw new Error("SHOPIFY_SHOP_DOMAIN o SHOPIFY_ADMIN_TOKEN mancante");
  return { shop, token, version: API_VERSION };
}

export function buildArticleBodyHtml(corpoHtml: string, jsonLd?: string): string {
  if (!jsonLd) return corpoHtml;
  return `${corpoHtml}\n<script type="application/ld+json">${jsonLd}</script>`;
}

export interface ShopBlog { id: number; title: string; handle: string; }

export async function fetchBlogs(): Promise<ShopBlog[]> {
  const { shop, token, version } = cfg();
  const res = await fetch(`https://${shop}/admin/api/${version}/blogs.json`, {
    headers: { "X-Shopify-Access-Token": token, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Shopify blogs HTTP ${res.status}`);
  const json = await res.json();
  return (json?.blogs ?? []).map((b: { id: number; title: string; handle: string }) => ({ id: b.id, title: b.title, handle: b.handle }));
}

export interface PublishArticleArgs {
  blogId: number;
  title: string;
  bodyHtml: string;
  tags?: string;
  imageBase64?: string;
  published: boolean;
}

export async function publishArticle(args: PublishArticleArgs): Promise<{ id: number; handle: string }> {
  const { shop, token, version } = cfg();
  const article: Record<string, unknown> = { title: args.title, body_html: args.bodyHtml, published: args.published };
  if (args.tags) article.tags = args.tags;
  if (args.imageBase64) article.image = { attachment: args.imageBase64 };
  const res = await fetch(`https://${shop}/admin/api/${version}/blogs/${args.blogId}/articles.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ article }),
  });
  if (!res.ok) throw new Error(`Shopify article HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  const json = await res.json();
  return { id: json.article.id, handle: json.article.handle };
}
```

- [ ] **Step 3: Add `readAssetBase64` to `src/lib/image/store.ts`**

Read the existing file first to reuse its `UPLOADS_DIR` + imports (`fs`, `path`). Add:
```ts
/** Reads a stored asset file (by its relative path) and returns base64, or null if missing/outside uploads. */
export function readAssetBase64(relPath: string): string | null {
  if (!relPath || !relPath.trim()) return null;
  const abs = path.resolve(process.cwd(), relPath);
  if (!abs.startsWith(UPLOADS_DIR)) return null;
  try {
    return fs.readFileSync(abs).toString("base64");
  } catch {
    return null;
  }
}
```
(If `store.ts` imports fs as `import { promises as fsp } from "fs"` or similar, add a sync `readFileSync` import accordingly — match the file's style.)

- [ ] **Step 4: Verify + commit**

Run: `npx vitest run src/lib/shopify/publish.test.ts && npx tsc --noEmit`
```bash
git add src/lib/shopify/publish.ts src/lib/shopify/publish.test.ts src/lib/image/store.ts
git commit -m "feat: Shopify blog publish module + readAssetBase64"
```

---

## Task 3: Blog publish pipeline + route + blogs list

**Files:** Create `src/lib/blog/publish.ts`, `src/app/api/blog/contents/[id]/publish/route.ts`, `src/app/api/blog/contents/[id]/publish/deps-registry.ts`, `src/app/api/blog/shopify-blogs/route.ts`; Test `src/lib/blog/publish.test.ts`

- [ ] **Step 1: Failing pipeline test**

`src/lib/blog/publish.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { publishBlogContent } from "@/lib/blog/publish";

function makeDeps(over = {}) {
  return {
    loadContent: vi.fn().mockResolvedValue({ titoloSeo: "T", corpoHtml: "<p>x</p>", jsonLd: '{"@type":"Article"}', imageBase64: "abc" }),
    publish: vi.fn().mockResolvedValue({ id: 99, handle: "t", url: "https://shop/blogs/news/t" }),
    persistSuccess: vi.fn().mockResolvedValue(undefined),
    persistError: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("publishBlogContent", () => {
  it("DONE → publishes and persists success with the article url", async () => {
    const deps = makeDeps();
    const res = await publishBlogContent({ contentId: "c1", blogId: 1, blogHandle: "news", published: false }, deps as any);
    expect(res.status).toBe("DONE");
    expect(res.shopifyArticleUrl).toBe("https://shop/blogs/news/t");
    // body_html passed to publish contains the JSON-LD
    expect((deps.publish as any).mock.calls[0][0].bodyHtml).toContain("application/ld+json");
    expect(deps.persistSuccess).toHaveBeenCalled();
  });
  it("ERROR → persists error when Shopify throws", async () => {
    const deps = makeDeps({ publish: vi.fn().mockRejectedValue(new Error("Shopify 422")) });
    const res = await publishBlogContent({ contentId: "c1", blogId: 1, blogHandle: "news", published: false }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(deps.persistError).toHaveBeenCalledWith("c1", expect.stringContaining("Shopify 422"));
    expect(deps.persistSuccess).not.toHaveBeenCalled();
  });
  it("ERROR when content not found", async () => {
    const deps = makeDeps({ loadContent: vi.fn().mockResolvedValue(null) });
    const res = await publishBlogContent({ contentId: "x", blogId: 1, blogHandle: "news", published: false }, deps as any);
    expect(res.status).toBe("ERROR");
  });
});
```

- [ ] **Step 2: Run → FAIL, implement pipeline**

`src/lib/blog/publish.ts`:
```ts
import { buildArticleBodyHtml } from "@/lib/shopify/publish";

export interface BlogPublishInput {
  contentId: string;
  blogId: number;
  blogHandle: string;
  published: boolean;
}

export interface BlogPublishDeps {
  loadContent: (contentId: string) => Promise<{ titoloSeo: string; corpoHtml: string; jsonLd?: string; imageBase64?: string } | null>;
  publish: (args: { blogId: number; blogHandle: string; title: string; bodyHtml: string; imageBase64?: string; published: boolean }) => Promise<{ id: number; handle: string; url: string }>;
  persistSuccess: (contentId: string, data: { shopifyArticleId: string; shopifyArticleUrl: string }) => Promise<void>;
  persistError: (contentId: string, error: string) => Promise<void>;
}

export interface BlogPublishResult {
  status: "DONE" | "ERROR";
  shopifyArticleUrl?: string;
  error?: string;
}

export async function publishBlogContent(input: BlogPublishInput, deps: BlogPublishDeps): Promise<BlogPublishResult> {
  const content = await deps.loadContent(input.contentId);
  if (!content) return { status: "ERROR", error: "Contenuto non trovato" };
  try {
    const bodyHtml = buildArticleBodyHtml(content.corpoHtml, content.jsonLd);
    const article = await deps.publish({
      blogId: input.blogId,
      blogHandle: input.blogHandle,
      title: content.titoloSeo,
      bodyHtml,
      imageBase64: content.imageBase64,
      published: input.published,
    });
    await deps.persistSuccess(input.contentId, { shopifyArticleId: String(article.id), shopifyArticleUrl: article.url });
    return { status: "DONE", shopifyArticleUrl: article.url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await deps.persistError(input.contentId, msg);
    return { status: "ERROR", error: msg };
  }
}
```

- [ ] **Step 3: deps-registry + route + blogs list**

`src/app/api/blog/contents/[id]/publish/deps-registry.ts`:
```ts
import { publishBlogContent } from "@/lib/blog/publish";
export type DepsFactory = () => { __run?: typeof publishBlogContent } & Record<string, unknown>;
let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) { depsFactory = f; }
export function getDepsFactory(): DepsFactory { return depsFactory; }
```

`src/app/api/blog/contents/[id]/publish/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { publishBlogContent, type BlogPublishDeps } from "@/lib/blog/publish";
import { publishArticle } from "@/lib/shopify/publish";
import { readAssetBase64 } from "@/lib/image/store";
import { getDepsFactory } from "./deps-registry";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ blogId: z.number(), blogHandle: z.string().min(1), published: z.boolean().optional() });

function storeUrl() {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN ?? "";
  return process.env.SHOPIFY_STORE_URL ?? `https://${shop}`;
}

function buildDeps(): BlogPublishDeps {
  return {
    loadContent: async (contentId) => {
      const c = await prisma.generatedContent.findUnique({ where: { id: contentId }, include: { assets: true } });
      if (!c || c.canale !== "BLOG") return null;
      const p = (c.payload ?? {}) as { titoloSeo?: string; corpoHtml?: string; jsonLd?: string };
      const asset = c.assets[0];
      const imageBase64 = asset?.path ? readAssetBase64(asset.path) ?? undefined : undefined;
      return { titoloSeo: p.titoloSeo ?? "Articolo", corpoHtml: p.corpoHtml ?? "", jsonLd: p.jsonLd, imageBase64 };
    },
    publish: async ({ blogId, blogHandle, title, bodyHtml, imageBase64, published }) => {
      const a = await publishArticle({ blogId, title, bodyHtml, imageBase64, published });
      return { id: a.id, handle: a.handle, url: `${storeUrl()}/blogs/${blogHandle}/${a.handle}` };
    },
    persistSuccess: async (contentId, data) => {
      await prisma.generatedContent.update({
        where: { id: contentId },
        data: { status: "PUBBLICATO", publicationStatus: "PUBBLICATO", publishedAt: new Date(), shopifyArticleId: data.shopifyArticleId, shopifyArticleUrl: data.shopifyArticleUrl },
      });
    },
    persistError: async (contentId, error) => {
      await prisma.generatedContent.update({ where: { id: contentId }, data: { publicationStatus: "ERRORE", publicationError: error } });
    },
  };
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });

  const injected = getDepsFactory()();
  const run = injected.__run ?? publishBlogContent;
  const deps = injected.__run ? ({} as never) : buildDeps();

  const result = await run({ contentId: id, blogId: parsed.data.blogId, blogHandle: parsed.data.blogHandle, published: parsed.data.published ?? false }, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
```

`src/app/api/blog/shopify-blogs/route.ts`:
```ts
import { NextResponse } from "next/server";
import { fetchBlogs } from "@/lib/shopify/publish";

export async function GET() {
  try {
    return NextResponse.json(await fetchBlogs());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore Shopify" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Verify (pipeline test + full suite + tsc + build) + commit**

Run: `npx vitest run src/lib/blog/publish.test.ts && npx vitest run && npx tsc --noEmit && npm run build`
```bash
git add src/lib/blog/publish.ts src/lib/blog/publish.test.ts "src/app/api/blog/contents/[id]/publish/" src/app/api/blog/shopify-blogs/
git commit -m "feat: direct Blog->Shopify publish (pipeline + route + blogs list)"
```

---

## Task 4: n8n publication endpoints

**Files:** Create `src/app/api/publications/due/route.ts`, `src/app/api/publications/[id]/sent/route.ts`, `src/app/api/publications/[id]/success/route.ts`, `src/app/api/publications/[id]/error/route.ts`; Test `src/app/api/publications/endpoints.test.ts`

- [ ] **Step 1: Failing test (secret + transitions)**

`src/app/api/publications/endpoints.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    generatedContent: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({ id: "c1" }) },
  },
}));

import { GET as due } from "@/app/api/publications/due/route";
import { PATCH as success } from "@/app/api/publications/[id]/success/route";
import { prisma } from "@/lib/prisma";

beforeEach(() => { vi.clearAllMocks(); process.env.N8N_WEBHOOK_SECRET = "s"; });

const withSecret = (url: string, init: RequestInit = {}) =>
  new Request(url, { ...init, headers: { ...(init.headers ?? {}), "x-webhook-secret": "s" } });

describe("publications endpoints", () => {
  it("due 401 without secret", async () => {
    const res = await due(new Request("http://t/api/publications/due"));
    expect(res.status).toBe(401);
  });
  it("due 200 with secret", async () => {
    const res = await due(withSecret("http://t/api/publications/due"));
    expect(res.status).toBe(200);
  });
  it("success sets PUBBLICATO + publicationStatus", async () => {
    const res = await success(withSecret("http://t/api/publications/c1/success", { method: "PATCH", body: JSON.stringify({ url: "https://x" }) }), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    expect((prisma.generatedContent.update as any)).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1" }, data: expect.objectContaining({ status: "PUBBLICATO", publicationStatus: "PUBBLICATO" }) }));
  });
});
```

- [ ] **Step 2: Run → FAIL, implement the four routes**

`src/app/api/publications/due/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkWebhookSecret } from "@/lib/publications/auth";

export async function GET(request: Request) {
  if (!checkWebhookSecret(request)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const due = await prisma.generatedContent.findMany({
    where: { status: "PROGRAMMATO", dataPrevista: { lte: new Date() }, publicationStatus: { in: ["NON_INVIATO", "ERRORE"] } },
    orderBy: { dataPrevista: "asc" },
    include: { idea: { select: { titolo: true } }, assets: { select: { id: true, path: true, slideIndex: true } } },
  });
  return NextResponse.json(due);
}
```

`src/app/api/publications/[id]/sent/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkWebhookSecret } from "@/lib/publications/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  if (!checkWebhookSecret(request)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { id } = await params;
  try {
    await prisma.generatedContent.update({ where: { id }, data: { publicationStatus: "INVIATO_A_N8N" } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}
```

`src/app/api/publications/[id]/success/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkWebhookSecret } from "@/lib/publications/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  if (!checkWebhookSecret(request)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const url = typeof (body as { url?: unknown })?.url === "string" ? (body as { url: string }).url : undefined;
  try {
    await prisma.generatedContent.update({
      where: { id },
      data: { status: "PUBBLICATO", publicationStatus: "PUBBLICATO", publishedAt: new Date(), ...(url ? { shopifyArticleUrl: url } : {}) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}
```

`src/app/api/publications/[id]/error/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkWebhookSecret } from "@/lib/publications/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  if (!checkWebhookSecret(request)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const error = typeof (body as { error?: unknown })?.error === "string" ? (body as { error: string }).error : "Errore di pubblicazione";
  try {
    await prisma.generatedContent.update({ where: { id }, data: { publicationStatus: "ERRORE", publicationError: error } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx vitest run src/app/api/publications/endpoints.test.ts && npx vitest run && npx tsc --noEmit`
```bash
git add src/app/api/publications/
git commit -m "feat: n8n publication endpoints (due/sent/success/error, secret-protected)"
```

---

## Task 5: /api/publications list + /pubblicazioni area

**Files:** Create `src/app/api/publications/route.ts`, `src/components/publications-table.tsx`; Modify `src/app/pubblicazioni/page.tsx`

- [ ] **Step 1: List API (internal, no secret — read-only monitoring)**

`src/app/api/publications/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const where: Record<string, unknown> = {};
  const ps = searchParams.get("publicationStatus");
  if (ps) where.publicationStatus = ps;
  const items = await prisma.generatedContent.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { dataPrevista: "asc" }, { createdAt: "desc" }],
    include: { idea: { select: { titolo: true } } },
  });
  return NextResponse.json(items.map((c) => ({
    id: c.id, canale: String(c.canale), status: c.status, publicationStatus: c.publicationStatus,
    publicationError: c.publicationError, dataPrevista: c.dataPrevista, shopifyArticleUrl: c.shopifyArticleUrl,
    titolo: (c.payload as { titoloSeo?: string } | null)?.titoloSeo ?? c.idea?.titolo ?? "Contenuto",
  })));
}
```

- [ ] **Step 2: Table component**

`src/components/publications-table.tsx`:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusBadge } from "@/components/status-badge";

const PUB_STATUSES = ["NON_INVIATO", "INVIATO_A_N8N", "IN_PUBBLICAZIONE", "PUBBLICATO", "ERRORE"];

interface Row { id: string; canale: string; status: string; publicationStatus: string; publicationError: string | null; dataPrevista: string | null; shopifyArticleUrl: string | null; titolo: string; }

export function PublicationsTable() {
  const [items, setItems] = useState<Row[]>([]);
  const [ps, setPs] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (ps) qs.set("publicationStatus", ps);
      const res = await fetch(`/api/publications?${qs.toString()}`);
      const d = await res.json();
      setItems(Array.isArray(d) ? d : []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [ps]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-4 flex gap-3 text-sm">
        <select value={ps} onChange={(e) => setPs(e.target.value)} className="rounded border p-1">
          <option value="">Tutti gli stati pubblicazione</option>
          {PUB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {loading ? <p>Caricamento…</p> : (
        <table className="w-full border-collapse text-sm">
          <thead><tr className="border-b text-left text-neutral-500">
            <th className="p-2">Contenuto</th><th className="p-2">Canale</th><th className="p-2">Pubblicazione</th><th className="p-2">Data</th><th className="p-2">Note</th>
          </tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b hover:bg-neutral-50">
                <td className="p-2">{r.titolo}</td>
                <td className="p-2">{r.canale}</td>
                <td className="p-2"><StatusBadge status={r.publicationStatus} /></td>
                <td className="p-2">{r.dataPrevista ? new Date(r.dataPrevista).toLocaleDateString("it-IT") : "—"}</td>
                <td className="p-2 text-xs text-neutral-500">{r.publicationError ?? (r.shopifyArticleUrl ? <a href={r.shopifyArticleUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">apri</a> : "—")}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-4 text-neutral-500">Nessuna pubblicazione.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Page (replace placeholder)**

`src/app/pubblicazioni/page.tsx`:
```tsx
import { PublicationsTable } from "@/components/publications-table";

export const dynamic = "force-dynamic";

export default function PubblicazioniPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Pubblicazioni</h1>
      <PublicationsTable />
    </div>
  );
}
```

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npm run build`
```bash
git add src/app/api/publications/route.ts src/components/publications-table.tsx src/app/pubblicazioni/page.tsx
git commit -m "feat: /pubblicazioni monitoring area + list API"
```

---

## Task 6: Blog detail — "Pubblica su Shopify"

**Files:** Modify `src/app/blog/[id]/page.tsx`

- [ ] **Step 1: Add the publish section**

In `src/app/blog/[id]/page.tsx`:
(a) Ensure the `Content` interface has `status` and (already added in Fase 4) `publicationStatus`/`shopifyArticleUrl`.
(b) Add state + a publish UI shown when `c.status === "APPROVATO"`. Add near the top of the component:
```tsx
  const [blogs, setBlogs] = useState<{ id: number; title: string; handle: string }[]>([]);
  const [blogId, setBlogId] = useState("");
  const [pubMsg, setPubMsg] = useState<string | null>(null);
  const [pubBusy, setPubBusy] = useState(false);
  useEffect(() => { fetch("/api/blog/shopify-blogs").then((r) => r.json()).then((d) => setBlogs(Array.isArray(d) ? d : [])).catch(() => setBlogs([])); }, []);
  const pubblica = async () => {
    const blog = blogs.find((b) => String(b.id) === blogId);
    if (!blog) { setPubMsg("Scegli un blog Shopify."); return; }
    setPubBusy(true); setPubMsg(null);
    try {
      const res = await fetch(`/api/blog/contents/${id}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ blogId: blog.id, blogHandle: blog.handle, published: true }) });
      const json = await res.json();
      setPubMsg(res.ok && json.status === "DONE" ? `Pubblicato su Shopify.` : `Errore: ${json.error ?? "sconosciuto"}`);
      await load();
    } catch { setPubMsg("Errore di rete."); } finally { setPubBusy(false); }
  };
```
(c) Render, after the publication-status block (or near it), shown only when `c.status === "APPROVATO"`:
```tsx
      {c.status === "APPROVATO" && (
        <div className="mb-4 rounded border bg-neutral-50 p-3 text-sm">
          <strong>Pubblica su Shopify</strong>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={blogId} onChange={(e) => setBlogId(e.target.value)} className="rounded border p-1">
              <option value="">Scegli blog…</option>
              {blogs.map((b) => <option key={b.id} value={String(b.id)}>{b.title}</option>)}
            </select>
            <button onClick={pubblica} disabled={pubBusy} className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-40">{pubBusy ? "Pubblico…" : "Pubblica su Shopify"}</button>
          </div>
          {pubMsg && <p className="mt-2">{pubMsg}</p>}
        </div>
      )}
```
(Match the loaded-content variable name — the detail page uses `c` and a `load()` function; reuse them. Ensure `useState`/`useEffect` are imported, which they already are.)

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit && npm run build`
```bash
git add src/app/blog/[id]/page.tsx
git commit -m "feat: Blog detail Publish-to-Shopify action"
```

---

## Task 7: Gate + smoke

- [ ] **Step 1: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npm run build`. Expected: green. Commit only if a fix was needed.

- [ ] **Step 2: Smoke — Blog publish to Shopify as DRAFT + n8n endpoints**

`npx prisma migrate deploy`, start the dev server with SHOPIFY_* + N8N_WEBHOOK_SECRET + Anthropic/OpenAI keys.
- **Shopify blogs:** `GET /api/blog/shopify-blogs` → returns the store's blogs (confirms write-capable token + endpoint). Report the blogs.
- **Publish (DRAFT):** pick an APPROVATO blog content (approve one). Call `POST /api/blog/contents/<id>/publish` with `{ "blogId": <id>, "blogHandle": "<handle>", "published": false }` → expect 200 `{status:"DONE", shopifyArticleUrl}`. Verify in Shopify admin the article exists as a DRAFT (not visible). `GET /api/blog/contents/<id>` → `status:"PUBBLICATO"`, `publicationStatus:"PUBBLICATO"`, `shopifyArticleId/Url` set. (If the token lacks write scope, report the exact Shopify error.)
- **n8n endpoints:** `GET /api/publications/due` without the secret → 401; with header `x-webhook-secret: <secret>` → 200 list. `PATCH /api/publications/<someContentId>/success` with the secret → content becomes PUBBLICATO.
- **/pubblicazioni:** shows the published item with the badge.

Report: blogs list, the exact publish response, the verified content fields, the 401-vs-200 on /due, and any error verbatim. Confirm the Shopify article was created as a draft.

- [ ] **Step 3: Stop the server.**

---

## Self-Review notes (addressed)
- **Spec coverage:** N8N secret + helper (T1); Shopify publish module + body-html builder + asset base64 (T2); direct Blog→Shopify publish pipeline+route+blogs list (T3); secret-protected n8n endpoints due/sent/success/error (T4); /api/publications + /pubblicazioni area (T5); blog-detail Publish action (T6); gate + draft-safe smoke (T7). The n8n Meta *workflow* (created via n8n API) is explicitly out — needs the n8n base URL.
- **Type consistency:** `BlogPublishDeps`/`publishBlogContent` (T3) wired with real deps using `publishArticle`/`readAssetBase64` (T2); `buildArticleBodyHtml` (T2) used by the pipeline (T3); `checkWebhookSecret` (T1) used by all publication endpoints (T4); publication fields written are exactly the Fase-4 schema fields; `StatusBadge` reused (T5).
- **No placeholders:** all code complete; outward-facing Shopify write is smoke-tested as a DRAFT (`published:false`); Shopify REST contract (blogs/articles/image attachment) confirmed live in the smoke (T7).
```
