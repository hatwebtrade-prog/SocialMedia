# Cestino contenuti blog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un Cestino ai contenuti blog (soft-delete recuperabile + eliminazione definitiva), con cascata su Shopify quando si cestina un articolo pubblicato.

**Architecture:** `GeneratedContent.deletedAt` esclude i cestinati dalla lista blog; `trashBlogContent` (orchestrazione pura, mirror di `retireBlogContent`) elimina l'articolo Shopify via `deleteArticle` poi imposta `deletedAt` + reset pubblicazione; endpoint trash/restore/trash-list; UI con pulsante "Cestina", link "Cestino" e pagina `/blog/cestino`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/Postgres, Vitest (node env — solo funzioni pure), Shopify Admin GraphQL (`deleteArticle` esistente).

## Global Constraints

- UI in italiano, codice/identificatori in inglese.
- Soft-delete con `GeneratedContent.deletedAt DateTime?` (+ `@@index([deletedAt])`); migration hand-authored applicata con `npx prisma migrate deploy` + `npx prisma generate` (NON `migrate dev`).
- Cestinare un contenuto pubblicato **elimina anche** l'articolo Shopify (riusa `deleteArticle` da `@/lib/shopify/publish`).
- Se la delete Shopify fallisce con errore reale → `persistError` + ERROR, **non** cestina (coerenza) — stessa regola del "Ritira".
- `persistTrashed` imposta: `deletedAt=new Date()`, `status="BOZZA"`, `publicationStatus="NON_INVIATO"`, `publishedAt=null`, `shopifyArticleId=null`, `shopifyArticleUrl=null`, `publicationError=null`.
- Lista blog (`GET /api/blog/contents`) esclude `deletedAt != null`; cestino blog (`GET /api/blog/contents/trash`) mostra `canale:"BLOG", deletedAt!=null`.
- Eliminazione definitiva riusa il `DELETE /api/blog/contents/[id]` esistente.
- Test solo su funzioni pure (vitest node); endpoint/pagine via `npx tsc --noEmit` + smoke.
- No-silent-failure nell'UI: `res.ok` guard + messaggio.
- Commit frequenti, un commit per task.

---

### Task 1: Schema + migration + filtro lista blog

**Files:**
- Modify: `prisma/schema.prisma` (model `GeneratedContent`)
- Create: `prisma/migrations/20260701140000_generatedcontent_deleted_at/migration.sql`
- Modify: `src/app/api/blog/contents/route.ts`

**Interfaces:**
- Produces: colonna `GeneratedContent.deletedAt DateTime?`; la lista blog esclude i cestinati.

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema.prisma`, model `GeneratedContent`, dopo la riga `instagramPostId     String?` aggiungere:
```prisma
  deletedAt          DateTime?
```
E nella lista `@@index` del model `GeneratedContent`, dopo `@@index([ideaId])` aggiungere:
```prisma
  @@index([deletedAt])
```

- [ ] **Step 2: Create the migration SQL**

Create `prisma/migrations/20260701140000_generatedcontent_deleted_at/migration.sql`:
```sql
ALTER TABLE "GeneratedContent" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "GeneratedContent_deletedAt_idx" ON "GeneratedContent"("deletedAt");
```

- [ ] **Step 3: Apply the migration and regenerate the client**

Run:
```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
npx prisma migrate deploy
npx prisma generate
```
Expected: migration `20260701140000_generatedcontent_deleted_at` applied; `generate` completes. If Postgres is unreachable, start Docker Desktop + the postgres container on :5432 and retry. NOTE: if `prisma generate` fails with `EPERM` on the query engine DLL, a dev server holds it locked — stop the dev server (`Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where CommandLine like agocap...next | Stop-Process`), rerun `generate`, restart `npm run dev`.

- [ ] **Step 4: Exclude trashed from the blog list**

In `src/app/api/blog/contents/route.ts`, find:
```ts
  const where: Record<string, unknown> = { canale: "BLOG" };
```
Replace with:
```ts
  const where: Record<string, unknown> = { canale: "BLOG", deletedAt: null };
```

- [ ] **Step 5: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add prisma/schema.prisma prisma/migrations/20260701140000_generatedcontent_deleted_at/migration.sql src/app/api/blog/contents/route.ts
git commit -m "feat(blog): add GeneratedContent.deletedAt + exclude trashed from blog list"
```

---

### Task 2: Logica `trashBlogContent` (pura, TDD)

**Files:**
- Create: `src/lib/blog/trash.ts`
- Test: `src/lib/blog/trash.test.ts`

**Interfaces:**
- Produces:
  - `interface TrashInput { contentId: string }`
  - `interface TrashDeps { loadArticleRef: (contentId: string) => Promise<{ shopifyArticleId: string | null } | null>; deleteShopifyArticle: (articleId: string) => Promise<{ ok: boolean; notFound: boolean }>; persistTrashed: (contentId: string) => Promise<void>; persistError: (contentId: string, error: string) => Promise<void> }`
  - `interface TrashResult { status: "DONE" | "ERROR"; error?: string }`
  - `trashBlogContent(input: TrashInput, deps: TrashDeps): Promise<TrashResult>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/blog/trash.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { trashBlogContent } from "@/lib/blog/trash";

function makeDeps(overrides = {}) {
  return {
    loadArticleRef: vi.fn().mockResolvedValue({ shopifyArticleId: "999" }),
    deleteShopifyArticle: vi.fn().mockResolvedValue({ ok: true, notFound: false }),
    persistTrashed: vi.fn().mockResolvedValue(undefined),
    persistError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("trashBlogContent", () => {
  it("returns ERROR when the content is not found", async () => {
    const deps = makeDeps({ loadArticleRef: vi.fn().mockResolvedValue(null) });
    const res = await trashBlogContent({ contentId: "c1" }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(deps.deleteShopifyArticle).not.toHaveBeenCalled();
    expect(deps.persistTrashed).not.toHaveBeenCalled();
  });

  it("deletes the Shopify article then trashes locally on the happy path", async () => {
    const deps = makeDeps();
    const res = await trashBlogContent({ contentId: "c1" }, deps as any);
    expect(deps.deleteShopifyArticle).toHaveBeenCalledWith("999");
    expect(deps.persistTrashed).toHaveBeenCalledWith("c1");
    expect(res.status).toBe("DONE");
  });

  it("does NOT trash locally when the Shopify delete throws a real error", async () => {
    const deps = makeDeps({ deleteShopifyArticle: vi.fn().mockRejectedValue(new Error("shopify down")) });
    const res = await trashBlogContent({ contentId: "c1" }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("shopify down");
    expect(deps.persistError).toHaveBeenCalledWith("c1", expect.stringContaining("shopify down"));
    expect(deps.persistTrashed).not.toHaveBeenCalled();
  });

  it("trashes locally without calling Shopify when there is no shopifyArticleId", async () => {
    const deps = makeDeps({ loadArticleRef: vi.fn().mockResolvedValue({ shopifyArticleId: null }) });
    const res = await trashBlogContent({ contentId: "c1" }, deps as any);
    expect(deps.deleteShopifyArticle).not.toHaveBeenCalled();
    expect(deps.persistTrashed).toHaveBeenCalledWith("c1");
    expect(res.status).toBe("DONE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/blog/trash.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/blog/trash"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/blog/trash.ts`:
```ts
export interface TrashInput { contentId: string }

export interface TrashDeps {
  loadArticleRef: (contentId: string) => Promise<{ shopifyArticleId: string | null } | null>;
  deleteShopifyArticle: (articleId: string) => Promise<{ ok: boolean; notFound: boolean }>;
  persistTrashed: (contentId: string) => Promise<void>;
  persistError: (contentId: string, error: string) => Promise<void>;
}

export interface TrashResult { status: "DONE" | "ERROR"; error?: string }

export async function trashBlogContent(input: TrashInput, deps: TrashDeps): Promise<TrashResult> {
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

  await deps.persistTrashed(input.contentId);
  return { status: "DONE" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/blog/trash.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/lib/blog/trash.ts src/lib/blog/trash.test.ts
git commit -m "feat(blog): trashBlogContent orchestration (delete Shopify then soft-delete)"
```

---

### Task 3: Endpoint trash / restore / trash-list

**Files:**
- Create: `src/app/api/blog/contents/[id]/trash/route.ts`
- Create: `src/app/api/blog/contents/[id]/restore/route.ts`
- Create: `src/app/api/blog/contents/trash/route.ts`

**Interfaces:**
- Consumes: `trashBlogContent`, `TrashDeps` (Task 2), `deleteArticle` (`@/lib/shopify/publish`), `prisma`.

- [ ] **Step 1: Create the trash route**

Create `src/app/api/blog/contents/[id]/trash/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteArticle } from "@/lib/shopify/publish";
import { trashBlogContent, type TrashDeps } from "@/lib/blog/trash";

type Ctx = { params: Promise<{ id: string }> };

function buildTrashDeps(): TrashDeps {
  return {
    loadArticleRef: async (contentId) =>
      prisma.generatedContent.findUnique({ where: { id: contentId }, select: { shopifyArticleId: true } }),
    deleteShopifyArticle: (articleId) => deleteArticle(articleId),
    persistTrashed: async (contentId) => {
      await prisma.generatedContent.update({
        where: { id: contentId },
        data: {
          deletedAt: new Date(),
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

export async function PATCH(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const result = await trashBlogContent({ contentId: id }, buildTrashDeps());
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
```

- [ ] **Step 2: Create the restore route**

Create `src/app/api/blog/contents/[id]/restore/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.generatedContent.update({ where: { id }, data: { deletedAt: null } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}
```

- [ ] **Step 3: Create the trash-list route**

Create `src/app/api/blog/contents/trash/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const contents = await prisma.generatedContent.findMany({
    where: { canale: "BLOG", deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: { idea: { select: { titolo: true } }, assets: { select: { id: true } } },
  });
  return NextResponse.json(contents);
}
```

- [ ] **Step 4: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Smoke the endpoints (dev server on :3000)**

Run:
```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
curl -s -o /dev/null -w "trash-list:%{http_code}\n" http://localhost:3000/api/blog/contents/trash
curl -s -o /dev/null -w "trash-missing:%{http_code}\n" -X PATCH http://localhost:3000/api/blog/contents/__nope__/trash
```
Expected: `trash-list:200`; `trash-missing:502` (content not found → ERROR). Do NOT smoke trash on a real published article here (it would delete it on Shopify).

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add "src/app/api/blog/contents/[id]/trash/route.ts" "src/app/api/blog/contents/[id]/restore/route.ts" "src/app/api/blog/contents/trash/route.ts"
git commit -m "feat(blog): trash/restore/trash-list endpoints for blog contents"
```

---

### Task 4: UI — pulsante "Cestina" + link "Cestino"

**Files:**
- Modify: `src/components/blog-content-table.tsx`
- Modify: `src/app/blog/page.tsx`

**Interfaces:**
- Consumes: `PATCH /api/blog/contents/[id]/trash` (Task 3).

- [ ] **Step 1: Add trash action to the table**

In `src/components/blog-content-table.tsx`:

(a) Add a message state — after `const [loading, setLoading] = useState(false);` add:
```tsx
  const [msg, setMsg] = useState<string | null>(null);
```

(b) Add the trash handler — after the `load` `useCallback` block (before `useEffect(() => { load(); }, [load]);`) add:
```tsx
  const cestina = async (id: string) => {
    if (!window.confirm("Cestinare l'articolo? Se è pubblicato, verrà eliminato anche l'articolo live su Shopify.")) return;
    setMsg(null);
    try {
      const res = await fetch(`/api/blog/contents/${id}/trash`, { method: "PATCH" });
      const json = await res.json();
      if (!res.ok || json.status === "ERROR") { setMsg(`Errore: ${json.error ?? "sconosciuto"}`); return; }
      await load();
    } catch { setMsg("Errore di rete."); }
  };
```

(c) Add a header cell — find:
```tsx
              <th className="p-2">Data prevista</th>
            </tr>
```
Replace with:
```tsx
              <th className="p-2">Data prevista</th>
              <th className="p-2"></th>
            </tr>
```

(d) Add the per-row button — find:
```tsx
                <td className="p-2">{c.dataPrevista ? new Date(c.dataPrevista).toLocaleDateString("it-IT") : "—"}</td>
              </tr>
```
Replace with:
```tsx
                <td className="p-2">{c.dataPrevista ? new Date(c.dataPrevista).toLocaleDateString("it-IT") : "—"}</td>
                <td className="p-2"><button onClick={() => cestina(c.id)} aria-label="Cestina" title="Cestina" className="text-neutral-500 hover:text-red-600">🗑</button></td>
              </tr>
```

(e) Update the empty-row colspan — find:
```tsx
            {items.length === 0 && <tr><td colSpan={5} className="p-4 text-neutral-500">Nessun articolo.</td></tr>}
```
Replace with:
```tsx
            {items.length === 0 && <tr><td colSpan={6} className="p-4 text-neutral-500">Nessun articolo.</td></tr>}
```

(f) Show the error message — find:
```tsx
      <div className="mb-4 flex gap-3 text-sm">
```
Insert BEFORE it:
```tsx
      {msg && <p className="mb-2 text-sm text-red-600">{msg}</p>}
```

- [ ] **Step 2: Add the "Cestino" link to the blog header**

In `src/app/blog/page.tsx`, find:
```tsx
        <Link href="/blog/genera" className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Genera articolo da idea</Link>
```
Replace with:
```tsx
        <div className="flex items-center gap-3">
          <Link href="/blog/cestino" className="text-sm text-neutral-600 hover:underline">Cestino</Link>
          <Link href="/blog/genera" className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Genera articolo da idea</Link>
        </div>
```

- [ ] **Step 3: Typecheck + build**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit && npm run build`
Expected: `tsc` clean; `next build` completes.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/components/blog-content-table.tsx src/app/blog/page.tsx
git commit -m "feat(blog): Cestina button on the blog list + Cestino header link"
```

---

### Task 5: Pagina `/blog/cestino`

**Files:**
- Create: `src/app/blog/cestino/page.tsx`

**Interfaces:**
- Consumes: `GET /api/blog/contents/trash`, `PATCH /api/blog/contents/[id]/restore`, `DELETE /api/blog/contents/[id]` (existing).

- [ ] **Step 1: Create the blog cestino page**

Create `src/app/blog/cestino/page.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface TrashItem {
  id: string;
  status: string;
  deletedAt: string | null;
  payload: { titoloSeo?: string };
  idea?: { titolo: string } | null;
}

export default function BlogCestinoPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/blog/contents/trash");
      if (!res.ok) { setMsg("Caricamento del cestino non riuscito."); setItems([]); return; }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setMsg("Caricamento del cestino non riuscito."); setItems([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const restore = async (id: string) => {
    setMsg(null);
    try {
      const res = await fetch(`/api/blog/contents/${id}/restore`, { method: "PATCH" });
      if (!res.ok) { setMsg("Ripristino non riuscito."); return; }
      await load();
    } catch { setMsg("Ripristino non riuscito."); }
  };

  const deleteForever = async (item: TrashItem) => {
    if (!window.confirm(`Eliminare definitivamente "${item.payload?.titoloSeo ?? "Articolo"}"? L'azione non è reversibile.`)) return;
    setMsg(null);
    try {
      const res = await fetch(`/api/blog/contents/${item.id}`, { method: "DELETE" });
      if (!res.ok) { setMsg("Eliminazione non riuscita."); return; }
      await load();
    } catch { setMsg("Eliminazione non riuscita."); }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cestino blog</h1>
        <Link href="/blog" className="text-sm text-neutral-600 hover:underline">← Torna al blog</Link>
      </div>
      {msg && <p className="mb-2 text-sm text-red-600">{msg}</p>}
      {loading ? <p>Caricamento…</p> : items.length === 0 ? (
        <p className="text-neutral-500">Il cestino è vuoto.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="p-2">Titolo SEO</th>
              <th className="p-2">Idea</th>
              <th className="p-2">Cestinato il</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b hover:bg-neutral-50">
                <td className="p-2">{c.payload?.titoloSeo ?? "Articolo"}</td>
                <td className="p-2">{c.idea?.titolo ?? "—"}</td>
                <td className="p-2">{c.deletedAt ? new Date(c.deletedAt).toLocaleDateString("it-IT") : "—"}</td>
                <td className="p-2 whitespace-nowrap">
                  <button onClick={() => restore(c.id)} className="mr-3 text-blue-600 hover:underline">Ripristina</button>
                  <button onClick={() => deleteForever(c)} className="text-red-600 hover:underline">Elimina definitivamente</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit && npm run build`
Expected: `tsc` clean; `next build` completes.

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/app/blog/cestino/page.tsx
git commit -m "feat(blog): /blog/cestino page (restore or permanently delete)"
```

---

### Task 6: Verifica end-to-end

**Files:** nessuna modifica.

- [ ] **Step 1: Full test suite**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run`
Expected: tutti i test verdi (inclusi i 4 nuovi di `trash.test.ts`).

- [ ] **Step 2: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Smoke manuale (dev server su :3000)**

Apri `http://localhost:3000/blog`. Cestina un articolo NON pubblicato (🗑) → sparisce dalla lista. Vai su **Cestino** (`/blog/cestino`) → l'articolo è lì. **Ripristina** → torna nella lista blog. Ricestinalo → da `/blog/cestino` **Elimina definitivamente** → sparisce. (Per un articolo pubblicato, il cestino elimina anche l'articolo Shopify: provalo solo su un articolo di prova, deliberatamente.)

- [ ] **Step 4: Nessun commit** (task di sola verifica).

---

## Self-Review

**Spec coverage:**
- `GeneratedContent.deletedAt` + index + migration → Task 1. ✓
- Lista blog esclude cestinati → Task 1. ✓
- `trashBlogContent` (pura, cascata Shopify, non-cestina su errore) → Task 2. ✓
- Endpoint trash/restore/trash-list; DELETE esistente per elimina definitivo → Task 3 (+ Task 5 usa DELETE). ✓
- `persistTrashed` con reset pubblicazione esatto → Task 3. ✓
- UI "Cestina" + link "Cestino" → Task 4. ✓
- Pagina `/blog/cestino` (Ripristina / Elimina definitivamente) → Task 5. ✓
- Test funzioni pure + tsc/smoke → Task 2/6. ✓

**Placeholder scan:** nessun TODO/TBD; ogni step ha codice/comando reale. ✓

**Type consistency:** `TrashDeps`/`TrashResult`/`trashBlogContent` coerenti tra Task 2 (definizione) e Task 3 (uso); `deleteArticle` `(articleId) => Promise<{ok,notFound}>` coerente col riuso; campi `persistTrashed` coerenti con lo schema `GeneratedContent`; `deletedAt` filtrato in modo coerente Task 1↔3. ✓
