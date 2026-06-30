# Meta Direct Publish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pubblicare i contenuti Meta (Facebook Page + Instagram Business) **direttamente dall'app** via Graph API, senza n8n, aggiornando lo stato del contenuto — sullo stesso schema di Blog→Shopify.

**Architecture:** Pipeline pura `publishMetaContent(input, deps)` con seam `deps` (loadContent / publishFacebook / publishInstagram / persistSuccess / persistError), testata con deps mock. La route HTTP costruisce le deps reali (Prisma + client Graph API) e usa il registry di test-injection già in uso per il Blog. Trigger: bottone "Pubblica ora" sul dettaglio contenuto + endpoint `dispatch` per l'automazione a `dataPrevista`.

**Tech Stack:** Next.js 15 (App Router), Prisma/Postgres, TypeScript, Graph API v20.0 via global `fetch`/`FormData`, vitest.

## Global Constraints

- UI in italiano, codice in inglese.
- Niente structured-output dell'SDK: non rilevante qui (nessuna chiamata LLM in questo piano).
- Credenziali da env: `META_PAGE_ACCESS_TOKEN`, `META_FACEBOOK_PAGE_ID`, `META_INSTAGRAM_ACCOUNT_ID`, `META_API_VERSION` (default `v20.0`), `META_PUBLIC_BASE_URL` (per gli URL immagine IG; fallback `http://localhost:8001`).
- **Facebook**: l'immagine si carica come **byte** (multipart `source`) → funziona anche in locale.
- **Instagram**: il container richiede un **`image_url` pubblico** (i server Meta lo scaricano) → IG funziona solo se `META_PUBLIC_BASE_URL` è raggiungibile da internet (tunnel/deploy). In locale IG fallisce in modo pulito (ERRORE), FB no.
- **REEL/video**: non supportato (nessun asset video prodotto dal generatore) → marcato come errore esplicito.
- ⚠️ La Pagina è reale (~7.000 follower): i test di pubblicazione sono pubblici. Test solo con ok esplicito dell'utente; primo test FB da cancellare subito.
- Pattern deps-registry identico a `src/app/api/blog/contents/[id]/publish/deps-registry.ts`.
- Mapping piattaforme: enum Prisma `Platform.FACEBOOK`→`'facebook'`, `Platform.INSTAGRAM`→`'instagram'`.
- Mapping `formato`→`postType`: `POST`+asset immagine→`image`; `POST` senza asset→`text`; `CAROSELLO`→`carousel`; `STORY`→`story`; `REEL`→errore.

---

### Task 1: Campi post id su GeneratedContent

**Files:**
- Modify: `prisma/schema.prisma` (model `GeneratedContent`, dopo `shopifyArticleUrl`)
- Create: `prisma/migrations/<timestamp>_meta_post_ids/migration.sql`

**Interfaces:**
- Produces: campi `GeneratedContent.facebookPostId: string | null`, `GeneratedContent.instagramPostId: string | null`.

- [ ] **Step 1: Aggiungi i campi al modello**

In `model GeneratedContent`, dopo `shopifyArticleUrl  String?`:
```prisma
  facebookPostId     String?
  instagramPostId    String?
```

- [ ] **Step 2: Scrivi la migration a mano** (in questo ambiente `prisma migrate dev` è interattivo/bloccato — vedi memoria progetto)

Crea `prisma/migrations/20260630120000_meta_post_ids/migration.sql`:
```sql
ALTER TABLE "GeneratedContent" ADD COLUMN "facebookPostId" TEXT;
ALTER TABLE "GeneratedContent" ADD COLUMN "instagramPostId" TEXT;
```

- [ ] **Step 3: Applica e rigenera**

Run: `npx prisma migrate deploy && npx prisma generate`
Expected: "migration(s) applied" + client generato senza errori.

- [ ] **Step 4: Commit**
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(meta): facebookPostId/instagramPostId su GeneratedContent"
```

---

### Task 2: Descrittore contenuto (pure) + test

**Files:**
- Create: `src/lib/meta/describe.ts`
- Test: `src/lib/meta/describe.test.ts`

**Interfaces:**
- Consumes: tipi Prisma `GeneratedContent` + `GeneratedAsset` (solo i campi `formato`, `piattaforme`, `payload`, `assets[].path`, `assets[].slideIndex`, `assets[].tipo`).
- Produces:
```ts
export type MetaPostType = "image" | "text" | "carousel" | "story" | "reel";
export interface MetaDescriptor {
  postType: MetaPostType;
  caption: string;
  platforms: ("facebook" | "instagram")[];
  assetPaths: string[]; // ordinati per slideIndex (null = 0)
}
export function describeMetaContent(content: {
  formato: string;
  piattaforme: string[];
  payload: unknown;
  assets: { path: string; slideIndex: number | null }[];
}): MetaDescriptor;
```

- [ ] **Step 1: Scrivi i test**
```ts
import { describe, it, expect } from "vitest";
import { describeMetaContent } from "./describe";

const base = { piattaforme: ["FACEBOOK", "INSTAGRAM"] };

describe("describeMetaContent", () => {
  it("POST con immagine -> image, caption dal payload, asset ordinati", () => {
    const d = describeMetaContent({
      ...base, formato: "POST",
      payload: { caption: "Ciao" },
      assets: [{ path: "uploads/b.png", slideIndex: 1 }, { path: "uploads/a.png", slideIndex: 0 }],
    });
    expect(d.postType).toBe("image");
    expect(d.caption).toBe("Ciao");
    expect(d.platforms).toEqual(["facebook", "instagram"]);
    expect(d.assetPaths).toEqual(["uploads/a.png", "uploads/b.png"]);
  });
  it("POST senza asset -> text", () => {
    const d = describeMetaContent({ ...base, formato: "POST", payload: { caption: "Solo testo" }, assets: [] });
    expect(d.postType).toBe("text");
    expect(d.assetPaths).toEqual([]);
  });
  it("CAROSELLO -> carousel", () => {
    const d = describeMetaContent({ ...base, formato: "CAROSELLO", payload: { caption: "C" }, assets: [{ path: "x.png", slideIndex: 0 }] });
    expect(d.postType).toBe("carousel");
  });
  it("STORY -> story, caption da payload.testo", () => {
    const d = describeMetaContent({ ...base, formato: "STORY", payload: { testo: "overlay" }, assets: [{ path: "s.png", slideIndex: null }] });
    expect(d.postType).toBe("story");
    expect(d.caption).toBe("overlay");
  });
  it("mappa solo le piattaforme note", () => {
    const d = describeMetaContent({ piattaforme: ["FACEBOOK", "TIKTOK"], formato: "POST", payload: { caption: "x" }, assets: [{ path: "a.png", slideIndex: 0 }] });
    expect(d.platforms).toEqual(["facebook"]);
  });
});
```

- [ ] **Step 2: Esegui il test (deve fallire)**

Run: `npx vitest run src/lib/meta/describe.test.ts`
Expected: FAIL ("describeMetaContent is not a function").

- [ ] **Step 3: Implementa**
```ts
import type { MetaDescriptor, MetaPostType } from "./describe";

export type MetaPostType = "image" | "text" | "carousel" | "story" | "reel";
export interface MetaDescriptor {
  postType: MetaPostType;
  caption: string;
  platforms: ("facebook" | "instagram")[];
  assetPaths: string[];
}

const PLATFORM_MAP: Record<string, "facebook" | "instagram"> = { FACEBOOK: "facebook", INSTAGRAM: "instagram" };

export function describeMetaContent(content: {
  formato: string;
  piattaforme: string[];
  payload: unknown;
  assets: { path: string; slideIndex: number | null }[];
}): MetaDescriptor {
  const p = (content.payload ?? {}) as { caption?: string; testo?: string };
  const assetPaths = [...content.assets]
    .sort((a, b) => (a.slideIndex ?? 0) - (b.slideIndex ?? 0))
    .map((a) => a.path)
    .filter(Boolean);
  const platforms = content.piattaforme.map((x) => PLATFORM_MAP[x]).filter(Boolean) as ("facebook" | "instagram")[];

  let postType: MetaPostType;
  if (content.formato === "CAROSELLO") postType = "carousel";
  else if (content.formato === "STORY") postType = "story";
  else if (content.formato === "REEL") postType = "reel";
  else postType = assetPaths.length > 0 ? "image" : "text";

  const caption = content.formato === "STORY" ? (p.testo ?? "") : (p.caption ?? "");
  return { postType, caption, platforms, assetPaths };
}
```
(Nota: rimuovi la riga `import type {...} from "./describe"` — i tipi sono dichiarati qui; era solo per chiarezza.)

- [ ] **Step 4: Esegui il test (deve passare)**

Run: `npx vitest run src/lib/meta/describe.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**
```bash
git add src/lib/meta/describe.ts src/lib/meta/describe.test.ts
git commit -m "feat(meta): describeMetaContent (formato/piattaforme/caption -> descrittore)"
```

---

### Task 3: Pipeline `publishMetaContent` + test (deps mock)

**Files:**
- Create: `src/lib/meta/publish.ts`
- Test: `src/lib/meta/publish.test.ts`

**Interfaces:**
- Consumes: `MetaDescriptor` (Task 2).
- Produces:
```ts
export interface MetaImage { bytes?: Buffer; url?: string }
export interface MetaContentData { postType: MetaPostType; caption: string; platforms: ("facebook"|"instagram")[]; images: MetaImage[] }
export interface MetaPublishDeps {
  loadContent: (contentId: string) => Promise<MetaContentData | null>;
  publishFacebook: (a: { postType: MetaPostType; caption: string; images: MetaImage[] }) => Promise<{ postId: string }>;
  publishInstagram: (a: { postType: MetaPostType; caption: string; images: MetaImage[] }) => Promise<{ postId: string }>;
  persistSuccess: (contentId: string, ids: { facebookPostId?: string; instagramPostId?: string }) => Promise<void>;
  persistError: (contentId: string, error: string, ids: { facebookPostId?: string; instagramPostId?: string }) => Promise<void>;
}
export interface MetaPublishResult { status: "DONE" | "ERROR"; facebookPostId?: string; instagramPostId?: string; error?: string }
export function publishMetaContent(input: { contentId: string }, deps: MetaPublishDeps): Promise<MetaPublishResult>;
```

- [ ] **Step 1: Scrivi i test**
```ts
import { describe, it, expect, vi } from "vitest";
import { publishMetaContent, type MetaPublishDeps, type MetaContentData } from "./publish";

const data = (over: Partial<MetaContentData> = {}): MetaContentData => ({
  postType: "image", caption: "Ciao", platforms: ["facebook", "instagram"],
  images: [{ bytes: Buffer.from("x"), url: "https://pub/a.png" }], ...over,
});
const baseDeps = (over: Partial<MetaPublishDeps> = {}): MetaPublishDeps => ({
  loadContent: async () => data(),
  publishFacebook: async () => ({ postId: "FB1" }),
  publishInstagram: async () => ({ postId: "IG1" }),
  persistSuccess: vi.fn(async () => {}),
  persistError: vi.fn(async () => {}),
  ...over,
});

describe("publishMetaContent", () => {
  it("contenuto inesistente -> ERROR", async () => {
    const r = await publishMetaContent({ contentId: "x" }, baseDeps({ loadContent: async () => null }));
    expect(r.status).toBe("ERROR");
  });
  it("pubblica su entrambe e salva i due id", async () => {
    const deps = baseDeps();
    const r = await publishMetaContent({ contentId: "c1" }, deps);
    expect(r).toMatchObject({ status: "DONE", facebookPostId: "FB1", instagramPostId: "IG1" });
    expect(deps.persistSuccess).toHaveBeenCalledWith("c1", { facebookPostId: "FB1", instagramPostId: "IG1" });
  });
  it("solo facebook quando platforms=['facebook']", async () => {
    const ig = vi.fn(async () => ({ postId: "IG" }));
    const deps = baseDeps({ loadContent: async () => data({ platforms: ["facebook"] }), publishInstagram: ig });
    const r = await publishMetaContent({ contentId: "c" }, deps);
    expect(r.facebookPostId).toBe("FB1");
    expect(ig).not.toHaveBeenCalled();
  });
  it("REEL -> ERROR senza chiamare le pubblicazioni", async () => {
    const fb = vi.fn(async () => ({ postId: "FB" }));
    const deps = baseDeps({ loadContent: async () => data({ postType: "reel" }), publishFacebook: fb });
    const r = await publishMetaContent({ contentId: "c" }, deps);
    expect(r.status).toBe("ERROR");
    expect(fb).not.toHaveBeenCalled();
  });
  it("IG fallisce ma FB riesce -> ERROR, salva comunque l'id FB", async () => {
    const deps = baseDeps({ publishInstagram: async () => { throw new Error("image_url non raggiungibile"); } });
    const r = await publishMetaContent({ contentId: "c1" }, deps);
    expect(r.status).toBe("ERROR");
    expect(r.facebookPostId).toBe("FB1");
    expect(deps.persistError).toHaveBeenCalledWith("c1", expect.stringContaining("instagram"), { facebookPostId: "FB1" });
  });
});
```

- [ ] **Step 2: Esegui (deve fallire)**

Run: `npx vitest run src/lib/meta/publish.test.ts`
Expected: FAIL ("publishMetaContent is not a function").

- [ ] **Step 3: Implementa**
```ts
import type { MetaPostType } from "./describe";

export interface MetaImage { bytes?: Buffer; url?: string }
export interface MetaContentData { postType: MetaPostType; caption: string; platforms: ("facebook" | "instagram")[]; images: MetaImage[] }
export interface MetaPublishDeps {
  loadContent: (contentId: string) => Promise<MetaContentData | null>;
  publishFacebook: (a: { postType: MetaPostType; caption: string; images: MetaImage[] }) => Promise<{ postId: string }>;
  publishInstagram: (a: { postType: MetaPostType; caption: string; images: MetaImage[] }) => Promise<{ postId: string }>;
  persistSuccess: (contentId: string, ids: { facebookPostId?: string; instagramPostId?: string }) => Promise<void>;
  persistError: (contentId: string, error: string, ids: { facebookPostId?: string; instagramPostId?: string }) => Promise<void>;
}
export interface MetaPublishResult { status: "DONE" | "ERROR"; facebookPostId?: string; instagramPostId?: string; error?: string }

export async function publishMetaContent(input: { contentId: string }, deps: MetaPublishDeps): Promise<MetaPublishResult> {
  const data = await deps.loadContent(input.contentId);
  if (!data) return { status: "ERROR", error: "Contenuto non trovato" };
  if (data.postType === "reel") {
    await deps.persistError(input.contentId, "Formato REEL/video non supportato in pubblicazione diretta", {});
    return { status: "ERROR", error: "Formato REEL/video non supportato" };
  }
  if (data.platforms.length === 0) {
    await deps.persistError(input.contentId, "Nessuna piattaforma selezionata", {});
    return { status: "ERROR", error: "Nessuna piattaforma selezionata" };
  }

  const ids: { facebookPostId?: string; instagramPostId?: string } = {};
  const errors: string[] = [];
  const args = { postType: data.postType, caption: data.caption, images: data.images };

  if (data.platforms.includes("facebook")) {
    try { ids.facebookPostId = (await deps.publishFacebook(args)).postId; }
    catch (e) { errors.push("facebook: " + (e instanceof Error ? e.message : String(e))); }
  }
  if (data.platforms.includes("instagram")) {
    try { ids.instagramPostId = (await deps.publishInstagram(args)).postId; }
    catch (e) { errors.push("instagram: " + (e instanceof Error ? e.message : String(e))); }
  }

  if (errors.length > 0) {
    await deps.persistError(input.contentId, errors.join(" | "), ids);
    return { status: "ERROR", error: errors.join(" | "), ...ids };
  }
  await deps.persistSuccess(input.contentId, ids);
  return { status: "DONE", ...ids };
}
```

- [ ] **Step 4: Esegui (deve passare)**

Run: `npx vitest run src/lib/meta/publish.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**
```bash
git add src/lib/meta/publish.ts src/lib/meta/publish.test.ts
git commit -m "feat(meta): pipeline publishMetaContent con seam deps"
```

---

### Task 4: Client Graph API — Facebook

**Files:**
- Create: `src/lib/meta/graph.ts`
- Test: `src/lib/meta/graph.test.ts`

**Interfaces:**
- Consumes: `MetaImage`, `MetaPostType` (Task 2/3).
- Produces:
```ts
export interface GraphConfig { apiVersion: string; pageId: string; igAccountId: string; token: string }
export function metaConfigFromEnv(): GraphConfig;
export function publishFacebook(cfg: GraphConfig, a: { postType: MetaPostType; caption: string; images: MetaImage[] }, fetchImpl?: typeof fetch): Promise<{ postId: string }>;
export function publishInstagram(cfg: GraphConfig, a: { postType: MetaPostType; caption: string; images: MetaImage[] }, fetchImpl?: typeof fetch): Promise<{ postId: string }>;
```
(`fetchImpl` opzionale per i test; default `fetch` globale.)

- [ ] **Step 1: Scrivi i test (FB, fetch mockata)**
```ts
import { describe, it, expect, vi } from "vitest";
import { publishFacebook, type GraphConfig } from "./graph";

const cfg: GraphConfig = { apiVersion: "v20.0", pageId: "P", igAccountId: "IG", token: "T" };

function mockFetch(responses: any[]) {
  const calls: any[] = [];
  const impl = vi.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    const body = responses.shift();
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as any;
  });
  return { impl, calls };
}

describe("publishFacebook", () => {
  it("text -> POST /{page}/feed con message", async () => {
    const { impl, calls } = mockFetch([{ id: "PAGE_123" }]);
    const r = await publishFacebook(cfg, { postType: "text", caption: "Ciao", images: [] }, impl as any);
    expect(r.postId).toBe("PAGE_123");
    expect(calls[0].url).toContain("/P/feed");
  });
  it("image -> POST /{page}/photos (multipart) ritorna post_id", async () => {
    const { impl, calls } = mockFetch([{ id: "PH", post_id: "PAGE_456" }]);
    const r = await publishFacebook(cfg, { postType: "image", caption: "x", images: [{ bytes: Buffer.from("img") }] }, impl as any);
    expect(r.postId).toBe("PAGE_456");
    expect(calls[0].url).toContain("/P/photos");
  });
  it("carousel -> N foto unpublished + feed con attached_media", async () => {
    const { impl, calls } = mockFetch([{ id: "1" }, { id: "2" }, { id: "POST_C" }]);
    const r = await publishFacebook(cfg, { postType: "carousel", caption: "c", images: [{ bytes: Buffer.from("a") }, { bytes: Buffer.from("b") }] }, impl as any);
    expect(r.postId).toBe("POST_C");
    expect(calls.length).toBe(3);
    expect(calls[2].url).toContain("/P/feed");
  });
});
```

- [ ] **Step 2: Esegui (deve fallire)**

Run: `npx vitest run src/lib/meta/graph.test.ts`
Expected: FAIL ("publishFacebook is not a function").

- [ ] **Step 3: Implementa il client (FB completo, IG stub che lancia)**
```ts
import type { MetaImage, MetaPostType } from "./publish";

export interface GraphConfig { apiVersion: string; pageId: string; igAccountId: string; token: string }

export function metaConfigFromEnv(): GraphConfig {
  return {
    apiVersion: process.env.META_API_VERSION || "v20.0",
    pageId: process.env.META_FACEBOOK_PAGE_ID || "",
    igAccountId: process.env.META_INSTAGRAM_ACCOUNT_ID || "",
    token: process.env.META_PAGE_ACCESS_TOKEN || "",
  };
}

const base = (cfg: GraphConfig) => `https://graph.facebook.com/${cfg.apiVersion}`;

async function gfetch(f: typeof fetch, url: string, init: RequestInit) {
  const res = await f(url, init);
  const text = await res.text();
  let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok || json.error) throw new Error(json?.error?.message || `Graph ${res.status}: ${text.slice(0, 200)}`);
  return json;
}

async function fbUploadPhoto(cfg: GraphConfig, f: typeof fetch, bytes: Buffer, opts: { caption?: string; published: boolean }) {
  const form = new FormData();
  form.append("source", new Blob([bytes], { type: "image/png" }), "image.png");
  if (opts.caption) form.append("caption", opts.caption);
  form.append("published", String(opts.published));
  form.append("access_token", cfg.token);
  return gfetch(f, `${base(cfg)}/${cfg.pageId}/photos`, { method: "POST", body: form });
}

export async function publishFacebook(cfg: GraphConfig, a: { postType: MetaPostType; caption: string; images: MetaImage[] }, fetchImpl: typeof fetch = fetch): Promise<{ postId: string }> {
  if (a.postType === "text") {
    const r = await gfetch(fetchImpl, `${base(cfg)}/${cfg.pageId}/feed`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: a.caption, access_token: cfg.token }),
    });
    return { postId: r.id };
  }
  if (a.postType === "carousel") {
    const fbids: { media_fbid: string }[] = [];
    for (const img of a.images) {
      if (!img.bytes) throw new Error("byte immagine mancanti per il carosello FB");
      const ph = await fbUploadPhoto(cfg, fetchImpl, img.bytes, { published: false });
      fbids.push({ media_fbid: ph.id });
    }
    const r = await gfetch(fetchImpl, `${base(cfg)}/${cfg.pageId}/feed`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: a.caption, attached_media: fbids, access_token: cfg.token }),
    });
    return { postId: r.id };
  }
  // image | story -> foto singola
  const img = a.images[0];
  if (!img?.bytes) throw new Error("byte immagine mancanti per il post FB");
  const ph = await fbUploadPhoto(cfg, fetchImpl, img.bytes, { caption: a.caption, published: true });
  return { postId: ph.post_id || ph.id };
}

export async function publishInstagram(_cfg: GraphConfig, _a: { postType: MetaPostType; caption: string; images: MetaImage[] }, _fetchImpl: typeof fetch = fetch): Promise<{ postId: string }> {
  throw new Error("publishInstagram non ancora implementato (Task 6)");
}
```

- [ ] **Step 4: Esegui (deve passare)**

Run: `npx vitest run src/lib/meta/graph.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**
```bash
git add src/lib/meta/graph.ts src/lib/meta/graph.test.ts
git commit -m "feat(meta): client Graph API Facebook (text/image/carousel, upload byte)"
```

---

### Task 5: Route `POST /api/meta/contents/[id]/publish` + registry

**Files:**
- Create: `src/app/api/meta/contents/[id]/publish/route.ts`
- Create: `src/app/api/meta/contents/[id]/publish/deps-registry.ts`
- Test: `src/app/api/meta/contents/[id]/publish/route.test.ts`

**Interfaces:**
- Consumes: `publishMetaContent`, `describeMetaContent`, `metaConfigFromEnv`, `publishFacebook`, `publishInstagram`, `readAssetBase64` (`@/lib/image/store`), `prisma`.
- Produces: endpoint che ritorna `MetaPublishResult` (200 se DONE, 502 se ERROR).

- [ ] **Step 1: deps-registry (identico al blog)**
```ts
import { publishMetaContent } from "@/lib/meta/publish";
export type DepsFactory = () => { __run?: typeof publishMetaContent } & Record<string, unknown>;
let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) { depsFactory = f; }
export function getDepsFactory(): DepsFactory { return depsFactory; }
```

- [ ] **Step 2: Scrivi il test della route (deps iniettate)**
```ts
import { describe, it, expect, afterEach } from "vitest";
import { POST } from "./route";
import { __setDepsFactory } from "./deps-registry";

afterEach(() => __setDepsFactory(() => ({})));

function req() { return new Request("http://t/api/meta/contents/c1/publish", { method: "POST" }); }
const ctx = { params: Promise.resolve({ id: "c1" }) };

describe("POST publish meta", () => {
  it("200 quando la pipeline ritorna DONE", async () => {
    __setDepsFactory(() => ({ __run: async () => ({ status: "DONE", facebookPostId: "FB" }) }));
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "DONE", facebookPostId: "FB" });
  });
  it("502 quando la pipeline ritorna ERROR", async () => {
    __setDepsFactory(() => ({ __run: async () => ({ status: "ERROR", error: "x" }) }));
    const res = await POST(req(), ctx);
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 3: Esegui (deve fallire)**

Run: `npx vitest run "src/app/api/meta/contents/[id]/publish/route.test.ts"`
Expected: FAIL (modulo `./route` inesistente).

- [ ] **Step 4: Implementa la route**
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMetaContent, type MetaPublishDeps, type MetaImage } from "@/lib/meta/publish";
import { describeMetaContent } from "@/lib/meta/describe";
import { metaConfigFromEnv, publishFacebook, publishInstagram } from "@/lib/meta/graph";
import { readAssetBase64 } from "@/lib/image/store";
import { getDepsFactory } from "./deps-registry";

type Ctx = { params: Promise<{ id: string }> };

function publicBaseUrl() { return process.env.META_PUBLIC_BASE_URL || "http://localhost:8001"; }

function buildDeps(): MetaPublishDeps {
  const cfg = metaConfigFromEnv();
  return {
    loadContent: async (contentId) => {
      const c = await prisma.generatedContent.findUnique({ where: { id: contentId }, include: { assets: true } });
      if (!c || c.canale !== "META") return null;
      const desc = describeMetaContent({ formato: c.formato, piattaforme: c.piattaforme as unknown as string[], payload: c.payload, assets: c.assets.map((a) => ({ path: a.path, slideIndex: a.slideIndex })) });
      const ordered = [...c.assets].sort((a, b) => (a.slideIndex ?? 0) - (b.slideIndex ?? 0));
      const images: MetaImage[] = ordered.map((a) => {
        const b64 = a.path ? readAssetBase64(a.path) : null;
        return { bytes: b64 ? Buffer.from(b64, "base64") : undefined, url: `${publicBaseUrl()}/api/assets/${a.id}` };
      });
      return { postType: desc.postType, caption: desc.caption, platforms: desc.platforms, images };
    },
    publishFacebook: (a) => publishFacebook(cfg, a),
    publishInstagram: (a) => publishInstagram(cfg, a),
    persistSuccess: async (contentId, ids) => {
      await prisma.generatedContent.update({ where: { id: contentId }, data: { status: "PUBBLICATO", publicationStatus: "PUBBLICATO", publishedAt: new Date(), publicationError: null, facebookPostId: ids.facebookPostId, instagramPostId: ids.instagramPostId } });
    },
    persistError: async (contentId, error, ids) => {
      await prisma.generatedContent.update({ where: { id: contentId }, data: { publicationStatus: "ERRORE", publicationError: error, facebookPostId: ids.facebookPostId, instagramPostId: ids.instagramPostId } });
    },
  };
}

export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const injected = getDepsFactory()();
  const run = injected.__run ?? publishMetaContent;
  const deps = injected.__run ? ({} as never) : buildDeps();
  const result = await run({ contentId: id }, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
```

- [ ] **Step 5: Esegui (deve passare)**

Run: `npx vitest run "src/app/api/meta/contents/[id]/publish/route.test.ts"`
Expected: PASS (2 test).

- [ ] **Step 6: Commit**
```bash
git add "src/app/api/meta/contents/[id]/publish"
git commit -m "feat(meta): route POST publish (FB reale + IG via Task 6)"
```

---

### Task 6: Client Graph API — Instagram

**Files:**
- Modify: `src/lib/meta/graph.ts` (sostituisci lo stub `publishInstagram`)
- Test: `src/lib/meta/graph-instagram.test.ts`

**Interfaces:**
- Produces: `publishInstagram` reale (image / story / carousel via container + media_publish, usando `image.url`).

- [ ] **Step 1: Scrivi i test (IG, fetch mockata)**
```ts
import { describe, it, expect, vi } from "vitest";
import { publishInstagram, type GraphConfig } from "./graph";
const cfg: GraphConfig = { apiVersion: "v20.0", pageId: "P", igAccountId: "IG", token: "T" };
function mockFetch(responses: any[]) {
  const calls: any[] = [];
  const impl = vi.fn(async (url: any) => { calls.push(String(url)); const b = responses.shift(); return { ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) } as any; });
  return { impl, calls };
}
describe("publishInstagram", () => {
  it("image -> create container + status FINISHED + publish", async () => {
    const { impl, calls } = mockFetch([{ id: "CONT" }, { status_code: "FINISHED" }, { id: "IG_POST" }]);
    const r = await publishInstagram(cfg, { postType: "image", caption: "x", images: [{ url: "https://pub/a.png" }] }, impl as any);
    expect(r.postId).toBe("IG_POST");
    expect(calls[0]).toContain("/IG/media");
    expect(calls[calls.length - 1]).toContain("/IG/media_publish");
  });
  it("carousel -> N child + container CAROUSEL + publish", async () => {
    const { impl } = mockFetch([{ id: "c1" }, { id: "c2" }, { id: "CONT" }, { status_code: "FINISHED" }, { id: "IG_C" }]);
    const r = await publishInstagram(cfg, { postType: "carousel", caption: "c", images: [{ url: "https://pub/1.png" }, { url: "https://pub/2.png" }] }, impl as any);
    expect(r.postId).toBe("IG_C");
  });
  it("senza url -> errore raggiungibilità", async () => {
    const { impl } = mockFetch([]);
    await expect(publishInstagram(cfg, { postType: "image", caption: "x", images: [{ bytes: Buffer.from("x") }] }, impl as any)).rejects.toThrow(/url/i);
  });
});
```

- [ ] **Step 2: Esegui (deve fallire)** — il test fallisce perché lo stub lancia sempre.

Run: `npx vitest run src/lib/meta/graph-instagram.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa `publishInstagram`** (sostituisci lo stub)
```ts
export async function publishInstagram(cfg: GraphConfig, a: { postType: MetaPostType; caption: string; images: MetaImage[] }, fetchImpl: typeof fetch = fetch): Promise<{ postId: string }> {
  const url = (path: string, params: Record<string, string>) =>
    `${base(cfg)}/${path}?` + new URLSearchParams({ ...params, access_token: cfg.token }).toString();
  const POST = (u: string) => gfetch(fetchImpl, u, { method: "POST" });

  const createImageContainer = async (imageUrl: string, extra: Record<string, string>) => {
    if (!imageUrl) throw new Error("IG richiede un image_url pubblico (raggiungibile da internet)");
    return POST(url(`${cfg.igAccountId}/media`, { image_url: imageUrl, ...extra }));
  };
  const waitFinished = async (creationId: string) => {
    for (let i = 0; i < 12; i++) {
      const s = await gfetch(fetchImpl, url(`${creationId}`, { fields: "status_code" }), { method: "GET" });
      if (s.status_code === "FINISHED") return;
      if (s.status_code === "ERROR") throw new Error("IG container in stato ERROR");
      await new Promise((r) => setTimeout(r, 3000));
    }
  };
  const publish = async (creationId: string) => {
    await waitFinished(creationId);
    const r = await POST(url(`${cfg.igAccountId}/media_publish`, { creation_id: creationId }));
    return { postId: r.id };
  };

  if (a.postType === "carousel") {
    const children: string[] = [];
    for (const img of a.images) { const c = await createImageContainer(img.url ?? "", { is_carousel_item: "true" }); children.push(c.id); }
    const cont = await POST(url(`${cfg.igAccountId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: a.caption }));
    return publish(cont.id);
  }
  if (a.postType === "story") {
    const cont = await createImageContainer(a.images[0]?.url ?? "", { media_type: "STORIES" });
    return publish(cont.id);
  }
  // image
  const cont = await createImageContainer(a.images[0]?.url ?? "", { caption: a.caption });
  return publish(cont.id);
}
```

- [ ] **Step 4: Esegui (deve passare)** + suite meta completa

Run: `npx vitest run src/lib/meta`
Expected: PASS (tutti i test meta).

- [ ] **Step 5: Commit**
```bash
git add src/lib/meta/graph.ts src/lib/meta/graph-instagram.test.ts
git commit -m "feat(meta): client Graph API Instagram (image/story/carousel via container)"
```

---

### Task 7: UI bottone "Pubblica ora su Meta" sul dettaglio

**Files:**
- Modify: `src/app/meta/[id]/page.tsx` (aggiungi azione di pubblicazione + stato)
- Eventuale Create: `src/components/meta-publish-button.tsx` (client component)

**Interfaces:**
- Consumes: `POST /api/meta/contents/[id]/publish`.

- [ ] **Step 1: Componente bottone (client)**

Crea `src/components/meta-publish-button.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function MetaPublishButton({ contentId, disabled }: { contentId: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  async function publish() {
    if (!confirm("Pubblicare ORA su Facebook/Instagram? Il post sarà visibile pubblicamente.")) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/meta/contents/${contentId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Pubblicazione fallita"); else router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Errore"); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-1">
      <button onClick={publish} disabled={busy || disabled} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        {busy ? "Pubblicazione…" : "Pubblica ora su Meta"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Inserisci il bottone nel dettaglio**

In `src/app/meta/[id]/page.tsx`, importa `MetaPublishButton` e rendilo dove ci sono le azioni del contenuto, mostrandolo quando `status === "APPROVATO" || status === "PROGRAMMATO"`. Mostra anche `publicationStatus`, `facebookPostId`, `instagramPostId` se presenti (badge `StatusBadge` già esistente per lo stato pubblicazione).

- [ ] **Step 3: Verifica build/lint**

Run: `npx next build` (o `npx tsc --noEmit`)
Expected: nessun errore di tipi.

- [ ] **Step 4: Commit**
```bash
git add src/components/meta-publish-button.tsx "src/app/meta/[id]/page.tsx"
git commit -m "feat(meta): bottone Pubblica ora su Meta nel dettaglio contenuto"
```

---

### Task 8: Dispatch automatico a `dataPrevista`

**Files:**
- Create: `src/lib/meta/dispatch.ts`
- Create: `src/app/api/meta/publish/dispatch/route.ts`
- Test: `src/lib/meta/dispatch.test.ts`

**Interfaces:**
- Consumes: `prisma`, `publishMetaContent` + deps reali (riusa `buildDeps` estratto, oppure ricostruisce inline).
- Produces: `dispatchDueMeta(deps): Promise<{ published: string[]; failed: string[] }>` + endpoint `POST /api/meta/publish/dispatch` autenticato con header `x-agocap-secret` (riusa `AGOCAP_N8N_SECRET`/`resolveSecret` se presente, altrimenti `process.env.DISPATCH_SECRET`).

- [ ] **Step 1: Test di `dispatchDueMeta` (selezione + invocazione)**
```ts
import { describe, it, expect, vi } from "vitest";
import { dispatchDueMeta } from "./dispatch";

describe("dispatchDueMeta", () => {
  it("pubblica solo i META due e raccoglie esiti", async () => {
    const due = [{ id: "a" }, { id: "b" }];
    const publishOne = vi.fn(async (id: string) => ({ status: id === "a" ? "DONE" : "ERROR" }));
    const r = await dispatchDueMeta({ findDue: async () => due, publishOne } as any);
    expect(publishOne).toHaveBeenCalledTimes(2);
    expect(r.published).toEqual(["a"]);
    expect(r.failed).toEqual(["b"]);
  });
});
```

- [ ] **Step 2: Esegui (deve fallire)**

Run: `npx vitest run src/lib/meta/dispatch.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa `dispatch.ts`**
```ts
export interface DispatchDeps {
  findDue: () => Promise<{ id: string }[]>;
  publishOne: (contentId: string) => Promise<{ status: "DONE" | "ERROR" }>;
}
export async function dispatchDueMeta(deps: DispatchDeps): Promise<{ published: string[]; failed: string[] }> {
  const due = await deps.findDue();
  const published: string[] = []; const failed: string[] = [];
  for (const c of due) {
    const r = await deps.publishOne(c.id);
    (r.status === "DONE" ? published : failed).push(c.id);
  }
  return { published, failed };
}
```

- [ ] **Step 4: Esegui (deve passare)**

Run: `npx vitest run src/lib/meta/dispatch.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementa la route** `src/app/api/meta/publish/dispatch/route.ts`

`POST` che: valida header `x-agocap-secret` (vs `process.env.AGOCAP_N8N_SECRET`); `findDue` = `prisma.generatedContent.findMany({ where: { canale: "META", status: "PROGRAMMATO", dataPrevista: { lte: new Date() }, publicationStatus: { in: ["NON_INVIATO", "ERRORE"] } }, select: { id: true } })`; `publishOne` chiama `publishMetaContent({contentId}, buildDeps())` (estrai `buildDeps` da Task 5 in un modulo condiviso `src/app/api/meta/contents/[id]/publish/build-deps.ts` e importalo in entrambe le route). Ritorna `{ published, failed }` 200, 401 se secret errato.

- [ ] **Step 6: Documenta il cron**

Aggiungi a `n8n/README.md` (o nuovo `docs/`): per l'automazione, un cron esterno chiama
`curl -X POST -H "x-agocap-secret: <AGOCAP_N8N_SECRET>" https://<app>/api/meta/publish/dispatch` ogni N minuti.
In locale l'app non è raggiungibile da internet: il dispatch va lanciato da un cron sulla stessa macchina dell'app.

- [ ] **Step 7: Commit**
```bash
git add src/lib/meta/dispatch.ts src/lib/meta/dispatch.test.ts src/app/api/meta/publish/dispatch n8n/README.md
git commit -m "feat(meta): dispatch automatico dei contenuti META programmati"
```

---

## Note finali

- Dopo tutte le task: `npx vitest run` (intera suite) deve passare.
- **Test live** (con ok esplicito utente): primo post FB di prova da cancellare subito (la Pagina ha ~7k follower). IG richiede `META_PUBLIC_BASE_URL` pubblico (tunnel/deploy).
- Il workflow n8n resta nel repo/istanza come alternativa (decoupling), non usato dal flusso diretto.
