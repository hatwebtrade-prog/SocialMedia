# Editorial OS — Fase 2 (Brain ordinato) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editorial **destinazioni** (META/BLOG/TIKTOK/EMAIL) to ideas; make the Brain dashboard cleaner (Fonte/Destinazioni columns, colored status badges, extended filters, bulk "Assegna a canali"); assign destinazioni from the idea detail too; and wire the Meta/Blog "Genera da idea" pages to show only APPROVATA ideas with that destinazione.

**Architecture:** Additive data-model change (`Idea.destinazioni[]`). Reuse existing patterns: `/api/ideas` filters, `updateIdeaSchema`/bulk routes, `StatusBadge` (Fase 1), `idea-table`/`idea-filters`. No change to idea/content state separation (already distinct enums).

**Tech Stack:** Next.js 15, Prisma/Postgres, Tailwind, Vitest. UI Italian, code English.

**Branch:** `editorial-os-phase2` (off `brain-mvp-clean`). Local Postgres via `.env`.

**Current state (verified):**
- `src/lib/brain/enums.ts`: IDEA_CATEGORIES, PLATFORMS, IDEA_STATUSES.
- `src/app/api/ideas/validators.ts`: `manualIdeaSchema`, `updateIdeaSchema = manualIdeaSchema.partial()`, `bulkStatusSchema`. (`validation.test.ts` must keep passing.)
- `src/app/api/ideas/route.ts` GET filters: status/category/platform/productId/source; includes `product`, `source`.
- `src/app/api/ideas/[id]/route.ts`: PATCH uses `updateIdeaSchema`. `bulk-status/route.ts` exists.
- `src/app/ideas/[id]/page.tsx`: detail with status select + "Genera contenuto Meta" link when APPROVATA.
- `src/components/idea-filters.tsx`: `Filters {status,category,platform,source}` + 4 selects.
- `src/components/idea-table.tsx`: columns Titolo/Categoria/Keyword/Vol/Diff/SEO/Prio/Stato + bulk status buttons + source in query.
- `src/app/meta/genera/page.tsx`: fetches `/api/ideas?status=APPROVATA`, reads `?ideaId`. `src/app/blog/genera/page.tsx`: fetches `/api/ideas?status=APPROVATA`, no `?ideaId`.
- `src/components/status-badge.tsx`: `StatusBadge` (Fase 1).

---

## Task 1: Prisma — Destinazione enum + Idea.destinazioni + DESTINAZIONI const

**Files:** Modify `prisma/schema.prisma`, `src/lib/brain/enums.ts`

- [ ] **Step 1: Add the enum + field**

In `prisma/schema.prisma`, add a new enum (near the other enums):
```prisma
enum Destinazione {
  META
  BLOG
  TIKTOK
  EMAIL
}
```
In `model Idea { ... }`, add (after `tags`):
```prisma
  destinazioni           Destinazione[]  @default([])
```

- [ ] **Step 2: Add the const to enums.ts**

In `src/lib/brain/enums.ts`, append:
```ts
export const DESTINAZIONI = ["META", "BLOG", "TIKTOK", "EMAIL"] as const;
export type DestinazioneValue = (typeof DESTINAZIONI)[number];
```

- [ ] **Step 3: Validate + migrate + generate**

Run:
```bash
npx prisma validate
npx prisma migrate dev --name idea_destinazioni
npx prisma generate
```
Expected: valid; migration created+applied; client regenerated. If DB unreachable, report BLOCKED with the error.

- [ ] **Step 4: Commit**
```bash
git add prisma/ src/lib/brain/enums.ts
git commit -m "feat: Idea.destinazioni (editorial destinations) + Destinazione enum"
```

---

## Task 2: Validators — destinazioni + bulkDestinazioniSchema

**Files:** Modify `src/app/api/ideas/validators.ts`; Test `src/app/api/ideas/destinazioni-validators.test.ts`

- [ ] **Step 1: Write the failing test**

`src/app/api/ideas/destinazioni-validators.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { bulkDestinazioniSchema, updateIdeaSchema } from "@/app/api/ideas/validators";

describe("destinazioni validators", () => {
  it("updateIdeaSchema accepts destinazioni", () => {
    expect(updateIdeaSchema.parse({ destinazioni: ["META", "BLOG"] }).destinazioni).toEqual(["META", "BLOG"]);
  });
  it("bulkDestinazioniSchema requires ids and valid channels", () => {
    expect(bulkDestinazioniSchema.parse({ ids: ["i1"], destinazioni: ["TIKTOK"] }).destinazioni).toEqual(["TIKTOK"]);
    expect(() => bulkDestinazioniSchema.parse({ ids: [], destinazioni: ["META"] })).toThrow();
    expect(() => bulkDestinazioniSchema.parse({ ids: ["i1"], destinazioni: ["XYZ"] })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/api/ideas/destinazioni-validators.test.ts`
Expected: FAIL — `bulkDestinazioniSchema` not exported.

- [ ] **Step 3: Implement**

In `src/app/api/ideas/validators.ts`:
- add `DESTINAZIONI` to the enums import: `import { IDEA_CATEGORIES, PLATFORMS, IDEA_STATUSES, DESTINAZIONI } from "@/lib/brain/enums";`
- add to `manualIdeaSchema` object (so `updateIdeaSchema.partial()` includes it), after `productId`:
```ts
  destinazioni: z.array(z.enum(DESTINAZIONI)).default([]),
```
- append:
```ts
export const bulkDestinazioniSchema = z.object({
  ids: z.array(z.string()).min(1),
  destinazioni: z.array(z.enum(DESTINAZIONI)),
});
```

- [ ] **Step 4: Run to verify it passes + existing validator tests**

Run: `npx vitest run src/app/api/ideas/destinazioni-validators.test.ts src/app/api/ideas/validation.test.ts && npx tsc --noEmit`
Expected: new tests pass; existing `validation.test.ts` still passes (destinazioni defaults to []); tsc 0.

- [ ] **Step 5: Commit**
```bash
git add src/app/api/ideas/validators.ts src/app/api/ideas/destinazioni-validators.test.ts
git commit -m "feat: destinazioni in updateIdeaSchema + bulkDestinazioniSchema"
```

---

## Task 3: API — destinazione/priority filter + bulk-destinazioni route

**Files:** Modify `src/app/api/ideas/route.ts`; Create `src/app/api/ideas/bulk-destinazioni/route.ts`; Test `src/app/api/ideas/bulk-destinazioni/route.test.ts`

- [ ] **Step 1: Add filters to GET /api/ideas**

In `src/app/api/ideas/route.ts` GET, after the existing `source` filter lines, add:
```ts
  const destinazione = searchParams.get("destinazione");
  const priorityParam = searchParams.get("priority");
  if (destinazione) where.destinazioni = { has: destinazione };
  if (priorityParam) {
    const p = Number(priorityParam);
    if (Number.isInteger(p)) where.priority = p;
  }
```
(Leave the rest of GET — and POST — unchanged.)

- [ ] **Step 2: Write the failing bulk route test**

`src/app/api/ideas/bulk-destinazioni/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { idea: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) } },
}));

import { PATCH } from "@/app/api/ideas/bulk-destinazioni/route";
import { prisma } from "@/lib/prisma";

function req(body: unknown) {
  return new Request("http://test/api/ideas/bulk-destinazioni", {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("PATCH /api/ideas/bulk-destinazioni", () => {
  beforeEach(() => vi.clearAllMocks());
  it("updates destinazioni for the given ids", async () => {
    const res = await PATCH(req({ ids: ["a", "b"], destinazioni: ["META", "BLOG"] }));
    expect(res.status).toBe(200);
    expect((await res.json()).updated).toBe(2);
    expect((prisma.idea.updateMany as any)).toHaveBeenCalledWith({
      where: { id: { in: ["a", "b"] } }, data: { destinazioni: ["META", "BLOG"] },
    });
  });
  it("returns 400 on empty ids", async () => {
    const res = await PATCH(req({ ids: [], destinazioni: ["META"] }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/app/api/ideas/bulk-destinazioni/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the route**

`src/app/api/ideas/bulk-destinazioni/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bulkDestinazioniSchema } from "../validators";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bulkDestinazioniSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  }
  const result = await prisma.idea.updateMany({
    where: { id: { in: parsed.data.ids } },
    data: { destinazioni: parsed.data.destinazioni },
  });
  return NextResponse.json({ updated: result.count });
}
```

- [ ] **Step 5: Verify + full suite + typecheck + build**

Run: `npx vitest run src/app/api/ideas/bulk-destinazioni/route.test.ts && npx vitest run && npx tsc --noEmit && npm run build`
Expected: route tests pass; full suite green; tsc 0; build succeeds.

- [ ] **Step 6: Commit**
```bash
git add src/app/api/ideas/route.ts src/app/api/ideas/bulk-destinazioni/
git commit -m "feat: ideas destinazione/priority filter + bulk-destinazioni route"
```

---

## Task 4: Idea detail — destinazioni multi-select + generate links

**Files:** Modify `src/app/ideas/[id]/page.tsx`

- [ ] **Step 1: Add destinazioni + per-destination generate links**

In `src/app/ideas/[id]/page.tsx`:
(a) Add `import { IDEA_STATUSES, DESTINAZIONI } from "@/lib/brain/enums";` (extend the existing import).
(b) Add `destinazioni: string[];` to the `Idea` interface.
(c) Replace the `idea.status === "APPROVATA"` block with destinazioni controls + per-destination links. Insert this after the Stato `<label>`:
```tsx
      <div className="mb-4">
        <span className="mb-1 block text-sm">Destinazioni editoriali:</span>
        <div className="flex flex-wrap gap-3 text-sm">
          {DESTINAZIONI.map((d) => {
            const checked = idea.destinazioni?.includes(d) ?? false;
            return (
              <label key={d} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? (idea.destinazioni ?? []).filter((x) => x !== d)
                      : [...(idea.destinazioni ?? []), d];
                    patch({ destinazioni: next });
                  }}
                />
                {d}
              </label>
            );
          })}
        </div>
      </div>
      {idea.status === "APPROVATA" && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {idea.destinazioni?.includes("META") && (
            <Link href={`/meta/genera?ideaId=${idea.id}`} className="rounded bg-blue-600 px-3 py-1 text-white">Genera contenuto Meta</Link>
          )}
          {idea.destinazioni?.includes("BLOG") && (
            <Link href={`/blog/genera?ideaId=${idea.id}`} className="rounded bg-blue-600 px-3 py-1 text-white">Genera articolo Blog</Link>
          )}
          {(idea.destinazioni?.includes("TIKTOK") || idea.destinazioni?.includes("EMAIL")) && (
            <span className="rounded bg-neutral-100 px-3 py-1 text-neutral-500">TikTok/Email: generatore in arrivo</span>
          )}
        </div>
      )}
```
(`patch` already accepts `Partial<Idea>`; `destinazioni` is part of `updateIdeaSchema` now.)

- [ ] **Step 2: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds.

- [ ] **Step 3: Commit**
```bash
git add src/app/ideas/[id]/page.tsx
git commit -m "feat: idea detail destinazioni multi-select + per-channel generate links"
```

---

## Task 5: Brain dashboard — filters + table (Fonte/Destinazioni, StatusBadge, bulk assign)

**Files:** Modify `src/components/idea-filters.tsx`, `src/components/idea-table.tsx`

- [ ] **Step 1: Extend the filters**

Replace `src/components/idea-filters.tsx` with:
```tsx
"use client";

import { IDEA_STATUSES, IDEA_CATEGORIES, PLATFORMS, DESTINAZIONI } from "@/lib/brain/enums";

export interface Filters {
  status: string;
  category: string;
  platform: string;
  source: string;
  destinazione: string;
  priorita: string;
}

const SOURCES = [
  { key: "", label: "Tutte le sorgenti" },
  { key: "ai-brainstorming", label: "AI" },
  { key: "manuale", label: "Manuale" },
  { key: "seozoom", label: "SEOZoom" },
];

export function IdeaFilters({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const set = (k: keyof Filters, v: string) => onChange({ ...filters, [k]: v });
  return (
    <div className="mb-4 flex flex-wrap gap-3 text-sm">
      <select value={filters.status} onChange={(e) => set("status", e.target.value)} className="rounded border p-1">
        <option value="">Tutti gli stati</option>
        {IDEA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={filters.source} onChange={(e) => set("source", e.target.value)} className="rounded border p-1">
        {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <select value={filters.destinazione} onChange={(e) => set("destinazione", e.target.value)} className="rounded border p-1">
        <option value="">Tutte le destinazioni</option>
        {DESTINAZIONI.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select value={filters.category} onChange={(e) => set("category", e.target.value)} className="rounded border p-1">
        <option value="">Tutte le categorie</option>
        {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={filters.platform} onChange={(e) => set("platform", e.target.value)} className="rounded border p-1">
        <option value="">Tutte le piattaforme</option>
        {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <select value={filters.priorita} onChange={(e) => set("priorita", e.target.value)} className="rounded border p-1">
        <option value="">Tutte le priorità</option>
        {[5, 4, 3, 2, 1].map((p) => <option key={p} value={String(p)}>Priorità {p}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Extend the table (columns + badge + bulk assign)**

Replace `src/components/idea-table.tsx` with:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { IdeaFilters, type Filters } from "./idea-filters";
import { StatusBadge } from "./status-badge";
import { DESTINAZIONI } from "@/lib/brain/enums";

interface Idea {
  id: string;
  titolo: string;
  category: string;
  seoScore: number;
  priority: number;
  status: string;
  keyword?: string | null;
  volumeRicerca?: number | null;
  difficolta?: number | null;
  destinazioni?: string[];
  product?: { nome: string } | null;
  source?: { key: string } | null;
}

const SOURCE_LABEL: Record<string, string> = { "ai-brainstorming": "AI", manuale: "Manuale", seozoom: "SEOZoom" };

export function IdeaTable() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [filters, setFilters] = useState<Filters>({ status: "", category: "", platform: "", source: "", destinazione: "", priorita: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destSel, setDestSel] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filters.status) qs.set("status", filters.status);
      if (filters.category) qs.set("category", filters.category);
      if (filters.platform) qs.set("platform", filters.platform);
      if (filters.source) qs.set("source", filters.source);
      if (filters.destinazione) qs.set("destinazione", filters.destinazione);
      if (filters.priorita) qs.set("priority", filters.priorita);
      const res = await fetch(`/api/ideas?${qs.toString()}`);
      setIdeas(await res.json());
      setSelected(new Set());
    } catch {
      setIdeas([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleDest = (d: string) => setDestSel((prev) => {
    const next = new Set(prev); next.has(d) ? next.delete(d) : next.add(d); return next;
  });

  const bulkStatus = async (status: string) => {
    if (selected.size === 0) return;
    await fetch("/api/ideas/bulk-status", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [...selected], status }) });
    await load();
  };
  const bulkDestinazioni = async () => {
    if (selected.size === 0) return;
    await fetch("/api/ideas/bulk-destinazioni", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [...selected], destinazioni: [...destSel] }) });
    setDestSel(new Set());
    await load();
  };

  return (
    <div>
      <IdeaFilters filters={filters} onChange={setFilters} />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => bulkStatus("APPROVATA")} className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0}>Approva ({selected.size})</button>
        <button onClick={() => bulkStatus("SCARTATA")} className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0}>Scarta</button>
        <button onClick={() => bulkStatus("INTERESSANTE")} className="rounded bg-amber-500 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0}>Interessante</button>
        <span className="ml-3 text-neutral-400">|</span>
        <span className="text-neutral-500">Assegna a canali:</span>
        {DESTINAZIONI.map((d) => (
          <label key={d} className="flex items-center gap-1">
            <input type="checkbox" checked={destSel.has(d)} onChange={() => toggleDest(d)} />{d}
          </label>
        ))}
        <button onClick={bulkDestinazioni} className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0 || destSel.size === 0}>Assegna ({selected.size})</button>
      </div>
      {loading ? <p>Caricamento…</p> : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="p-2"></th>
              <th className="p-2">Titolo</th>
              <th className="p-2">Categoria</th>
              <th className="p-2">Fonte</th>
              <th className="p-2">Destinazioni</th>
              <th className="p-2">Keyword</th>
              <th className="p-2">Vol.</th>
              <th className="p-2">Diff.</th>
              <th className="p-2">SEO</th>
              <th className="p-2">Prio</th>
              <th className="p-2">Stato</th>
            </tr>
          </thead>
          <tbody>
            {ideas.map((i) => (
              <tr key={i.id} className="border-b hover:bg-neutral-50">
                <td className="p-2"><input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} /></td>
                <td className="p-2"><Link href={`/ideas/${i.id}`} className="text-blue-600 hover:underline">{i.titolo}</Link></td>
                <td className="p-2">{i.category}</td>
                <td className="p-2">{i.source ? (SOURCE_LABEL[i.source.key] ?? i.source.key) : "—"}</td>
                <td className="p-2">{i.destinazioni?.length ? i.destinazioni.join(", ") : "—"}</td>
                <td className="p-2">{i.keyword ?? "—"}</td>
                <td className="p-2">{i.volumeRicerca ?? "—"}</td>
                <td className="p-2">{i.difficolta ?? "—"}</td>
                <td className="p-2">{i.seoScore}</td>
                <td className="p-2">{i.priority}</td>
                <td className="p-2"><StatusBadge status={i.status} /></td>
              </tr>
            ))}
            {ideas.length === 0 && <tr><td colSpan={11} className="p-4 text-neutral-500">Nessuna idea.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
```
(The GET `/api/ideas` already includes `source: { select: { key: true } }` and `product`; `destinazioni` is a scalar array returned by default.)

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds.

- [ ] **Step 4: Commit**
```bash
git add src/components/idea-filters.tsx src/components/idea-table.tsx
git commit -m "feat: Brain dashboard — Fonte/Destinazioni columns, badges, filters, bulk assign"
```

---

## Task 6: Area "Genera da idea" — filter by destinazione

**Files:** Modify `src/app/meta/genera/page.tsx`, `src/app/blog/genera/page.tsx`

- [ ] **Step 1: Meta genera — filter by destinazione META**

In `src/app/meta/genera/page.tsx`, change the ideas fetch line:
```tsx
    fetch("/api/ideas?status=APPROVATA&destinazione=META").then((r) => r.json()).then((d) => setIdeas(Array.isArray(d) ? d : []));
```
(Only that line changes — keep the `?ideaId` preselect and the rest.)

- [ ] **Step 2: Blog genera — filter by destinazione BLOG + accept ?ideaId**

Replace `src/app/blog/genera/page.tsx` with (adds Suspense + `?ideaId` preselect + destinazione filter):
```tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Idea { id: string; titolo: string; }

function BlogGeneraInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideaId, setIdeaId] = useState(search.get("ideaId") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ideas?status=APPROVATA&destinazione=BLOG").then((r) => r.json()).then((d) => setIdeas(Array.isArray(d) ? d : [])).catch(() => setIdeas([]));
  }, []);

  const submit = async () => {
    if (!ideaId) { setError("Scegli un'idea approvata."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/blog/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ideaId }) });
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

export default function BlogGeneraPage() {
  return <Suspense><BlogGeneraInner /></Suspense>;
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds.

- [ ] **Step 4: Commit**
```bash
git add src/app/meta/genera/page.tsx src/app/blog/genera/page.tsx
git commit -m "feat: Meta/Blog 'Genera da idea' filtered by destinazione (+ blog ?ideaId)"
```

---

## Task 7: Gate + smoke

- [ ] **Step 1: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all unit tests pass; tsc 0; build succeeds. Commit only if a fix was needed:
```bash
git add -A && git commit -m "chore: editorial OS fase 2 integration fixes"
```

- [ ] **Step 2: Smoke (local, with DB)**

`npx prisma migrate deploy` then start `PORT=8001 npm run dev` and verify:
- Dashboard `/dashboard`: new columns Fonte/Destinazioni visible; status shown as colored badge; new filters (destinazione, priorità) work.
- Select ideas → check some channels under "Assegna a canali" → "Assegna" → reload shows the destinazioni; `PATCH /api/ideas/bulk-destinazioni` returns `{updated:N}`.
- Idea detail `/ideas/[id]`: destinazioni checkboxes toggle + persist; when APPROVATA, per-destination generate links appear for assigned channels.
- `/meta/genera` lists only APPROVATA ideas with destinazione META; `/blog/genera` only those with BLOG (and `?ideaId=` preselects).
- `GET /api/ideas?destinazione=META` and `?priority=4` filter correctly.

Report what renders + any error verbatim.

---

## Self-Review notes (addressed)
- **Spec coverage:** Destinazione enum + Idea.destinazioni (T1); validators + bulk schema (T2); GET filters destinazione/priority + bulk-destinazioni route (T3); detail multi-select + per-channel generate links (T4); dashboard columns/badges/filters/bulk-assign (T5); area genera filtered by destinazione + blog ?ideaId (T6); gate+smoke (T7). Idea/content state separation untouched (distinct enums).
- **Type consistency:** `DESTINAZIONI`/`DestinazioneValue` in enums.ts (T1) consumed by validators (T2), idea-filters/idea-table (T5), detail (T4); `Filters` gains `destinazione`+`priorita` consistently across idea-filters and idea-table (T5); `bulkDestinazioniSchema` (T2) used by the bulk route (T3); `StatusBadge` (Fase 1) reused in idea-table (T5).
- **No placeholders:** every code/test step is complete. The `destinazioni` array uses Prisma `has` filtering (scalar enum array) — valid. Existing `validation.test.ts` stays green because `destinazioni` defaults to `[]`.
```
