# Ritira articolo blog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un'azione "Ritira dalla pubblicazione" che elimina l'articolo live su Shopify e riporta il contenuto blog a BOZZA (ripubblicabile).

**Architecture:** Nuova `deleteArticle` (GraphQL `articleDelete`) nel layer Shopify; orchestrazione pura `retireBlogContent` con deps mockabili (delete Shopify → se ok, riporta il record a BOZZA azzerando i riferimenti Shopify; se la delete fallisce davvero, non ritira localmente); route `POST /api/blog/contents/[id]/retire`; pulsante nella pagina dettaglio blog.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/Postgres, Vitest (node env — solo funzioni pure), Shopify Admin GraphQL API (`2024-10`).

## Global Constraints

- UI in italiano, codice/identificatori in inglese.
- Shopify delete via GraphQL **`articleDelete(id: "gid://shopify/Article/{articleId}")`** (solo article id; il `blogId` NON è salvato). Endpoint `https://{shop}/admin/api/{version}/graphql.json`, header `X-Shopify-Access-Token`. Riusa `cfg()` esistente.
- Un articolo già assente su Shopify → trattato come successo idempotente (`notFound: true`).
- "Ritira" = `status=BOZZA`, `publicationStatus=NON_INVIATO`, `publishedAt=null`, `shopifyArticleId=null`, `shopifyArticleUrl=null`, `publicationError=null`. NON è hard-delete del record locale.
- Se la delete Shopify fallisce con errore reale → `persistError` + ERROR, **niente ritiro locale** (coerenza Shopify/gestionale).
- `NON_INVIATO` (enum `PublicationStatus`) e `BOZZA` (enum `ContentStatus`) sono valori esistenti nello schema.
- Test solo su funzioni pure (vitest node); Shopify layer, route e pagina verificati con `npx tsc --noEmit` + smoke.
- No-silent-failure nell'UI: `res.ok` guard + messaggio.
- Commit frequenti, un commit per task.

---

### Task 1: Shopify `deleteArticle` (GraphQL)

**Files:**
- Modify: `src/lib/shopify/publish.ts`

**Interfaces:**
- Consumes: `cfg()` (esistente in `publish.ts`).
- Produces: `deleteArticle(articleId: string): Promise<{ ok: boolean; notFound: boolean }>`.

- [ ] **Step 1: Add the deleteArticle function**

In `src/lib/shopify/publish.ts`, append at the end of the file:

```ts
/** Deletes a published article on Shopify via the Admin GraphQL `articleDelete` mutation.
 *  Returns `{ ok, notFound }`; an already-absent article resolves to `{ ok: true, notFound: true }`. */
export async function deleteArticle(articleId: string): Promise<{ ok: boolean; notFound: boolean }> {
  const { shop, token, version } = cfg();
  const query = `mutation { articleDelete(id: "gid://shopify/Article/${articleId}") { deletedArticleId userErrors { field message } } }`;
  const res = await fetch(`https://${shop}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Shopify articleDelete HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const json = await res.json();
  const payload = json?.data?.articleDelete;
  if (payload?.deletedArticleId) return { ok: true, notFound: false };
  const errs: { message?: string }[] = payload?.userErrors ?? json?.errors ?? [];
  const msg = errs.map((e) => e.message).filter(Boolean).join("; ");
  if (/not found|does not exist|doesn't exist|invalid.*id|no such/i.test(msg)) return { ok: true, notFound: true };
  throw new Error(`Shopify articleDelete: ${msg || "esito sconosciuto"}`);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/lib/shopify/publish.ts
git commit -m "feat(shopify): deleteArticle via GraphQL articleDelete"
```

---

### Task 2: Logica `retireBlogContent` (pura, TDD)

**Files:**
- Create: `src/lib/blog/retire.ts`
- Test: `src/lib/blog/retire.test.ts`

**Interfaces:**
- Produces:
  - `interface RetireInput { contentId: string }`
  - `interface RetireDeps { loadArticleRef: (contentId: string) => Promise<{ shopifyArticleId: string | null } | null>; deleteShopifyArticle: (articleId: string) => Promise<{ ok: boolean; notFound: boolean }>; persistRetired: (contentId: string) => Promise<void>; persistError: (contentId: string, error: string) => Promise<void> }`
  - `interface RetireResult { status: "DONE" | "ERROR"; error?: string }`
  - `retireBlogContent(input: RetireInput, deps: RetireDeps): Promise<RetireResult>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/blog/retire.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { retireBlogContent } from "@/lib/blog/retire";

function makeDeps(overrides = {}) {
  return {
    loadArticleRef: vi.fn().mockResolvedValue({ shopifyArticleId: "999" }),
    deleteShopifyArticle: vi.fn().mockResolvedValue({ ok: true, notFound: false }),
    persistRetired: vi.fn().mockResolvedValue(undefined),
    persistError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("retireBlogContent", () => {
  it("returns ERROR when the content is not found", async () => {
    const deps = makeDeps({ loadArticleRef: vi.fn().mockResolvedValue(null) });
    const res = await retireBlogContent({ contentId: "c1" }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(deps.deleteShopifyArticle).not.toHaveBeenCalled();
    expect(deps.persistRetired).not.toHaveBeenCalled();
  });

  it("deletes the Shopify article then retires locally on the happy path", async () => {
    const deps = makeDeps();
    const res = await retireBlogContent({ contentId: "c1" }, deps as any);
    expect(deps.deleteShopifyArticle).toHaveBeenCalledWith("999");
    expect(deps.persistRetired).toHaveBeenCalledWith("c1");
    expect(res.status).toBe("DONE");
  });

  it("does NOT retire locally when the Shopify delete throws a real error", async () => {
    const deps = makeDeps({ deleteShopifyArticle: vi.fn().mockRejectedValue(new Error("shopify down")) });
    const res = await retireBlogContent({ contentId: "c1" }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("shopify down");
    expect(deps.persistError).toHaveBeenCalledWith("c1", expect.stringContaining("shopify down"));
    expect(deps.persistRetired).not.toHaveBeenCalled();
  });

  it("retires locally without calling Shopify when there is no shopifyArticleId", async () => {
    const deps = makeDeps({ loadArticleRef: vi.fn().mockResolvedValue({ shopifyArticleId: null }) });
    const res = await retireBlogContent({ contentId: "c1" }, deps as any);
    expect(deps.deleteShopifyArticle).not.toHaveBeenCalled();
    expect(deps.persistRetired).toHaveBeenCalledWith("c1");
    expect(res.status).toBe("DONE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/blog/retire.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/blog/retire"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/blog/retire.ts`:

```ts
export interface RetireInput { contentId: string }

export interface RetireDeps {
  loadArticleRef: (contentId: string) => Promise<{ shopifyArticleId: string | null } | null>;
  deleteShopifyArticle: (articleId: string) => Promise<{ ok: boolean; notFound: boolean }>;
  persistRetired: (contentId: string) => Promise<void>;
  persistError: (contentId: string, error: string) => Promise<void>;
}

export interface RetireResult { status: "DONE" | "ERROR"; error?: string }

export async function retireBlogContent(input: RetireInput, deps: RetireDeps): Promise<RetireResult> {
  const ref = await deps.loadArticleRef(input.contentId);
  if (!ref) return { status: "ERROR", error: "Contenuto non trovato" };

  if (ref.shopifyArticleId) {
    try {
      await deps.deleteShopifyArticle(ref.shopifyArticleId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await deps.persistError(input.contentId, msg);
      return { status: "ERROR", error: msg };
    }
  }

  await deps.persistRetired(input.contentId);
  return { status: "DONE" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/blog/retire.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/lib/blog/retire.ts src/lib/blog/retire.test.ts
git commit -m "feat(blog): retireBlogContent orchestration (delete Shopify then back to draft)"
```

---

### Task 3: Route `POST /api/blog/contents/[id]/retire`

**Files:**
- Create: `src/app/api/blog/contents/[id]/retire/route.ts`

**Interfaces:**
- Consumes: `retireBlogContent`, `RetireDeps` (Task 2), `deleteArticle` (Task 1), `prisma`.

- [ ] **Step 1: Create the route**

Create `src/app/api/blog/contents/[id]/retire/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteArticle } from "@/lib/shopify/publish";
import { retireBlogContent, type RetireDeps } from "@/lib/blog/retire";

type Ctx = { params: Promise<{ id: string }> };

function buildRetireDeps(): RetireDeps {
  return {
    loadArticleRef: async (contentId) =>
      prisma.generatedContent.findUnique({ where: { id: contentId }, select: { shopifyArticleId: true } }),
    deleteShopifyArticle: (articleId) => deleteArticle(articleId),
    persistRetired: async (contentId) => {
      await prisma.generatedContent.update({
        where: { id: contentId },
        data: {
          status: "BOZZA",
          publicationStatus: "NON_INVIATO",
          publishedAt: null,
          shopifyArticleId: null,
          shopifyArticleUrl: null,
          publicationError: null,
        },
      });
    },
    persistError: async (contentId, error) => {
      await prisma.generatedContent.update({ where: { id: contentId }, data: { publicationError: error } });
    },
  };
}

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const result = await retireBlogContent({ contentId: id }, buildRetireDeps());
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Smoke the route (dev server on :3000)**

Run:
```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
curl -s -o /dev/null -w "retire-missing:%{http_code}\n" -X POST http://localhost:3000/api/blog/contents/__nonexistent__/retire
```
Expected: `retire-missing:502` (content not found → ERROR → 502). Do NOT smoke a real published article here (that would delete it on Shopify) — the real end-to-end smoke is Task 5, done deliberately by the controller/user.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add "src/app/api/blog/contents/[id]/retire/route.ts"
git commit -m "feat(blog): POST /api/blog/contents/[id]/retire endpoint"
```

---

### Task 4: UI — pulsante "Ritira dalla pubblicazione"

**Files:**
- Modify: `src/app/blog/[id]/page.tsx`

**Interfaces:**
- Consumes: `POST /api/blog/contents/[id]/retire` (Task 3).

- [ ] **Step 1: Add the retire handler**

In `src/app/blog/[id]/page.tsx`, after the `pubblica` function (it ends with its closing `};` near line 70), add:

```tsx
  const ritira = async () => {
    if (!window.confirm("Ritirare l'articolo? Verrà eliminato l'articolo live su Shopify e il contenuto tornerà in BOZZA.")) return;
    setPubBusy(true); setPubMsg(null);
    try {
      const res = await fetch(`/api/blog/contents/${id}/retire`, { method: "POST" });
      const json = await res.json();
      setPubMsg(res.ok && json.status === "DONE" ? "Articolo ritirato: eliminato da Shopify, tornato in BOZZA." : `Errore: ${json.error ?? "sconosciuto"}`);
      await load();
    } catch { setPubMsg("Errore di rete."); } finally { setPubBusy(false); }
  };
```

- [ ] **Step 2: Add the button to the publication block**

In the "Pubblicazione" block, find:

```tsx
        {c.shopifyArticleUrl && (
          <a href={c.shopifyArticleUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">apri su Shopify</a>
        )}
      </div>
```

Replace it with:

```tsx
        {c.shopifyArticleUrl && (
          <a href={c.shopifyArticleUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">apri su Shopify</a>
        )}
        {c.publicationStatus === "PUBBLICATO" && (
          <button onClick={ritira} disabled={pubBusy} className="rounded border border-red-300 px-2 py-0.5 text-red-600 hover:bg-red-50 disabled:opacity-40">
            {pubBusy ? "Ritiro…" : "Ritira dalla pubblicazione"}
          </button>
        )}
      </div>
```

- [ ] **Step 3: Typecheck + build**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit && npm run build`
Expected: `tsc` clean; `next build` completes.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add "src/app/blog/[id]/page.tsx"
git commit -m "feat(blog): 'Ritira dalla pubblicazione' button on the article detail page"
```

---

### Task 5: Verifica end-to-end

**Files:** nessuna modifica.

- [ ] **Step 1: Full test suite**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run`
Expected: tutti i test verdi (inclusi i 4 nuovi di `retire.test.ts`).

- [ ] **Step 2: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Smoke reale (deliberato — cancella davvero un articolo Shopify)**

⚠️ Questo step elimina un articolo live: eseguirlo SOLO su un articolo di prova, con l'ok dell'utente. Apri `http://localhost:3000/blog/<id-di-un-articolo-pubblicato-di-prova>`, premi **"Ritira dalla pubblicazione"**, conferma. Verifica: la chiamata risponde DONE, lo stato in pagina torna **BOZZA**, il link "apri su Shopify" sparisce, e l'articolo non è più presente sul blog Shopify. Questo conferma anche che la mutation GraphQL `articleDelete` è disponibile sulla versione API configurata.

- [ ] **Step 4: Nessun commit** (task di sola verifica).

---

## Self-Review

**Spec coverage:**
- `deleteArticle` GraphQL con `notFound` idempotente → Task 1. ✓
- `retireBlogContent` orchestrazione (ERROR se non trovato; delete→retire happy; delete-fail→persistError+ERROR senza ritiro; senza articleId→retire) → Task 2. ✓
- Route `POST …/retire` con deps concrete (loadArticleRef/persistRetired/persistError) e campi di reset esatti → Task 3. ✓
- Pulsante "Ritira dalla pubblicazione" visibile se PUBBLICATO, confirm + res.ok guard + reload → Task 4. ✓
- Test funzioni pure + tsc/smoke → Task 2/5. ✓
- Rischio GraphQL `articleDelete` verificato con smoke reale → Task 5. ✓

**Placeholder scan:** nessun TODO/TBD; ogni step ha codice/comando reale. ✓

**Type consistency:** `RetireDeps`/`RetireResult`/`retireBlogContent` coerenti tra Task 2 (definizione) e Task 3 (uso); `deleteArticle` firma `(articleId) => Promise<{ok,notFound}>` coerente Task 1↔3; campi di reset (`status`/`publicationStatus`/`publishedAt`/`shopifyArticleId`/`shopifyArticleUrl`/`publicationError`) coerenti con lo schema `GeneratedContent`. ✓
