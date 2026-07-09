# Archivio idee — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un Archivio (soft-archive via `Idea.archivedAt`) per togliere le idee concluse dal board Brain mantenendole recuperabili, distinto dal Cestino.

**Architecture:** Rispecchia il pattern Cestino esistente: nuova colonna nullable `Idea.archivedAt`, il board esclude le archiviate, nuovi endpoint bulk-archive/bulk-unarchive/archive, nav + pulsanti UI + pagina `/archivio`. Riusa `bulkIdsSchema` e (per "sposta nel cestino") l'endpoint `bulk-trash` esistente.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/Postgres, Zod, Vitest (node env — solo funzioni pure), @dnd-kit/core, react-icons/lu.

## Global Constraints

- UI in italiano, codice/identificatori in inglese.
- Soft-archive con `Idea.archivedAt DateTime?` (+ `@@index([archivedAt])`); migration hand-authored applicata con `npx prisma migrate deploy` (NON `migrate dev`, che è interattivo/bloccato), seguita da `npx prisma generate`.
- Il board (`GET /api/ideas`) esclude sia `deletedAt != null` sia `archivedAt != null`.
- L'Archivio mostra `archivedAt != null AND deletedAt == null`; il Cestino resta `deletedAt != null` (invariato).
- Un'idea archiviata mantiene il suo `status`.
- Endpoint bulk: body `{ ids: string[] }` validato con `bulkIdsSchema` (già esistente), `400` su input non valido.
- Test solo su funzioni pure (vitest node); endpoint Prisma e pagine React verificati con `npx tsc --noEmit` + smoke su http://localhost:3000.
- No-silent-failure nell'UI: ogni fetch con `res.ok` guard + toast d'errore.
- Commit frequenti, un commit per task.

---

### Task 1: Schema + migration + filtro board

**Files:**
- Modify: `prisma/schema.prisma` (model `Idea`)
- Create: `prisma/migrations/20260701130000_idea_archived_at/migration.sql`
- Modify: `src/app/api/ideas/route.ts:25`

**Interfaces:**
- Produces: colonna `Idea.archivedAt DateTime?` (typed sul client Prisma dopo `prisma generate`); `GET /api/ideas` esclude le archiviate.

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema.prisma`, model `Idea`, dopo la riga `deletedAt              DateTime?` aggiungere:

```prisma
  archivedAt             DateTime?
```

E nella lista degli `@@index` del model `Idea`, dopo `@@index([deletedAt])` aggiungere:

```prisma
  @@index([archivedAt])
```

- [ ] **Step 2: Create the migration SQL**

Create `prisma/migrations/20260701130000_idea_archived_at/migration.sql` con:

```sql
ALTER TABLE "Idea" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Idea_archivedAt_idx" ON "Idea"("archivedAt");
```

- [ ] **Step 3: Apply the migration and regenerate the client**

Run:
```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
npx prisma migrate deploy
npx prisma generate
```
Expected: `migrate deploy` reports the migration `20260701130000_idea_archived_at` applied (or "No pending migrations" if already applied on a re-run); `generate` completes. If Postgres is unreachable, ensure Docker Desktop + the postgres container on :5432 are up, then retry.

- [ ] **Step 4: Exclude archived ideas from the board query**

In `src/app/api/ideas/route.ts`, find:
```ts
  where.deletedAt = null;
```
Replace with:
```ts
  where.deletedAt = null;
  where.archivedAt = null;
```

- [ ] **Step 5: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: no errors (the generated Prisma client now knows `archivedAt`).

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add prisma/schema.prisma prisma/migrations/20260701130000_idea_archived_at/migration.sql src/app/api/ideas/route.ts
git commit -m "feat(brain): add Idea.archivedAt soft-archive column + exclude archived from board"
```

---

### Task 2: Endpoint archivio

**Files:**
- Create: `src/app/api/ideas/bulk-archive/route.ts`
- Create: `src/app/api/ideas/bulk-unarchive/route.ts`
- Create: `src/app/api/ideas/archive/route.ts`

**Interfaces:**
- Consumes: `bulkIdsSchema` from `src/app/api/ideas/validators.ts`, `prisma`, `Idea.archivedAt` (Task 1).
- Produces:
  - `PATCH /api/ideas/bulk-archive` `{ids}` → `{ archived: number }`
  - `PATCH /api/ideas/bulk-unarchive` `{ids}` → `{ unarchived: number }`
  - `GET /api/ideas/archive` → array di idee archiviate (con `product`, `source`, `_count.contenuti`)

- [ ] **Step 1: Create bulk-archive**

Create `src/app/api/ideas/bulk-archive/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bulkIdsSchema } from "../validators";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bulkIdsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  }
  const result = await prisma.idea.updateMany({
    where: { id: { in: parsed.data.ids }, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  return NextResponse.json({ archived: result.count });
}
```

- [ ] **Step 2: Create bulk-unarchive**

Create `src/app/api/ideas/bulk-unarchive/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bulkIdsSchema } from "../validators";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bulkIdsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  }
  const result = await prisma.idea.updateMany({
    where: { id: { in: parsed.data.ids }, archivedAt: { not: null } },
    data: { archivedAt: null },
  });
  return NextResponse.json({ unarchived: result.count });
}
```

- [ ] **Step 3: Create archive list**

Create `src/app/api/ideas/archive/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ideas = await prisma.idea.findMany({
    where: { archivedAt: { not: null }, deletedAt: null },
    orderBy: { archivedAt: "desc" },
    include: {
      product: { select: { nome: true } },
      source: { select: { key: true } },
      _count: { select: { contenuti: true } },
    },
  });
  return NextResponse.json(ideas);
}
```

- [ ] **Step 4: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Smoke the endpoints (dev server on :3000)**

Run:
```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
curl -s -o /dev/null -w "archive:%{http_code}\n" http://localhost:3000/api/ideas/archive
curl -s -o /dev/null -w "bad-archive:%{http_code}\n" -X PATCH -H "content-type: application/json" -d '{}' http://localhost:3000/api/ideas/bulk-archive
```
Expected: `archive:200` and `bad-archive:400` (empty body fails `bulkIdsSchema`).

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/app/api/ideas/bulk-archive/route.ts src/app/api/ideas/bulk-unarchive/route.ts src/app/api/ideas/archive/route.ts
git commit -m "feat(brain): archive API endpoints (bulk-archive, bulk-unarchive, archive list)"
```

---

### Task 3: Helper `approvedIds` + nav "Archivio"

**Files:**
- Modify: `src/lib/brain/kanban.ts`
- Test: `src/lib/brain/kanban.test.ts`
- Modify: `src/lib/nav/items.ts:12` (Brain children)
- Test: `src/lib/nav/items.test.ts`

**Interfaces:**
- Produces: `approvedIds<T extends { id: string; status: string }>(ideas: T[]): string[]`; nav child `{ label: "Archivio", href: "/archivio" }` under Brain.

- [ ] **Step 1: Write the failing test for approvedIds**

In `src/lib/brain/kanban.test.ts`, add (adapt the import line if `approvedIds` is not yet imported — add it to the existing `@/lib/brain/kanban` import):

```ts
import { approvedIds } from "@/lib/brain/kanban";

describe("approvedIds", () => {
  const ideas = [
    { id: "a", status: "NUOVA" },
    { id: "b", status: "APPROVATA" },
    { id: "c", status: "APPROVATA" },
    { id: "d", status: "SCARTATA" },
  ];
  it("returns only the ids of APPROVATA ideas, preserving order", () => {
    expect(approvedIds(ideas)).toEqual(["b", "c"]);
  });
  it("returns [] when none are approved", () => {
    expect(approvedIds([{ id: "x", status: "NUOVA" }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/brain/kanban.test.ts`
Expected: FAIL — `approvedIds` is not exported.

- [ ] **Step 3: Implement approvedIds**

In `src/lib/brain/kanban.ts`, append:
```ts
export function approvedIds<T extends { id: string; status: string }>(ideas: T[]): string[] {
  return ideas.filter((i) => i.status === "APPROVATA").map((i) => i.id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/brain/kanban.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the nav child + its test**

In `src/lib/nav/items.ts`, in the Brain `children` array, after `{ label: "Cestino", href: "/cestino" }` add:
```ts
      { label: "Archivio", href: "/archivio" },
```

In `src/lib/nav/items.test.ts`, add a test inside the existing `describe("nav", …)` block (before its closing `});`):
```ts
  it("nests Archivio under Brain", () => {
    const brain = navItems.find((a) => a.label === "Brain");
    const childLabels = (brain?.children ?? []).map((c) => c.label);
    expect(childLabels).toContain("Archivio");
  });
```

- [ ] **Step 6: Run the nav test**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/nav/items.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/lib/brain/kanban.ts src/lib/brain/kanban.test.ts src/lib/nav/items.ts src/lib/nav/items.test.ts
git commit -m "feat(brain): approvedIds helper + Archivio nav entry"
```

---

### Task 4: UI board — pulsante Archivia + bulk

**Files:**
- Modify: `src/components/brain/idea-card.tsx`
- Modify: `src/components/brain/kanban-column.tsx`
- Modify: `src/components/brain/kanban-board.tsx`
- Modify: `src/components/idea-table.tsx`

**Interfaces:**
- Consumes: `PATCH /api/ideas/bulk-archive` (Task 2), `approvedIds` (Task 3).
- Produces: `onArchive?: (id: string) => void` threaded IdeaWorkspace → KanbanBoard → KanbanColumn → IdeaCard; bulk "Archivia approvate" + "Archivia selezionate".

- [ ] **Step 1: Add the archive button to IdeaCard**

In `src/components/brain/idea-card.tsx`:

(a) Update the icon import:
```ts
import { LuTrash2, LuArchive } from "react-icons/lu";
```

(b) Update the component signature to accept `onArchive`:
```ts
export function IdeaCard({ idea, selected, onToggleSelect, onTrash, onArchive }: { idea: KanbanIdea; selected: boolean; onToggleSelect: (id: string) => void; onTrash?: (id: string) => void; onArchive?: (id: string) => void }) {
```

(c) In the actions row, immediately BEFORE the `{onTrash && ( … )}` block, add:
```tsx
          {onArchive && (
            <button
              onClick={() => onArchive(idea.id)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Archivia"
              title="Archivia"
              className="text-ink-soft transition hover:text-sage-700"
            >
              <LuArchive size={15} />
            </button>
          )}
```

- [ ] **Step 2: Thread onArchive through KanbanColumn**

In `src/components/brain/kanban-column.tsx`:

(a) `DraggableCard` signature + body:
```tsx
function DraggableCard({ idea, selected, onToggleSelect, onTrash, onArchive }: { idea: KanbanIdea; selected: boolean; onToggleSelect: (id: string) => void; onTrash?: (id: string) => void; onArchive?: (id: string) => void }) {
```
and pass it to `IdeaCard`:
```tsx
      <IdeaCard idea={idea} selected={selected} onToggleSelect={onToggleSelect} onTrash={onTrash} onArchive={onArchive} />
```

(b) `KanbanColumn` signature:
```tsx
export function KanbanColumn({ column, ideas, selected, onToggleSelect, onTrash, onArchive }: {
  column: Column; ideas: KanbanIdea[]; selected: Set<string>; onToggleSelect: (id: string) => void; onTrash?: (id: string) => void; onArchive?: (id: string) => void;
}) {
```
and pass to `DraggableCard`:
```tsx
          <DraggableCard key={idea.id} idea={idea} selected={selected.has(idea.id)} onToggleSelect={onToggleSelect} onTrash={onTrash} onArchive={onArchive} />
```

- [ ] **Step 3: Thread onArchive through KanbanBoard**

In `src/components/brain/kanban-board.tsx`:

(a) Add `onArchive` to the props type and destructuring:
```tsx
export function KanbanBoard({ ideas, setIdeas, selected, onToggleSelect, showDiscarded, persist, onTrash, onArchive }: {
  ideas: KanbanIdea[];
  setIdeas: (updater: (prev: KanbanIdea[]) => KanbanIdea[]) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  showDiscarded: boolean;
  persist: (id: string, status: IdeaStatus) => Promise<boolean>;
  onTrash?: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
```

(b) Pass to `KanbanColumn`:
```tsx
          <KanbanColumn key={col.status} column={col} ideas={grouped[col.status] ?? []} selected={selected} onToggleSelect={onToggleSelect} onTrash={onTrash} onArchive={onArchive} />
```

- [ ] **Step 4: Add archive actions in IdeaWorkspace**

In `src/components/idea-table.tsx`:

(a) Update the kanban import to include `approvedIds`:
```ts
import type { IdeaStatus } from "@/lib/brain/kanban";
import { approvedIds } from "@/lib/brain/kanban";
```

(b) After the `bulkTrash` function (ends at its closing `};`), add three handlers:
```tsx
  const archiveOne = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/ideas/bulk-archive", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
      if (!res.ok) { show("Archiviazione non riuscita.", "error"); return; }
      show("Idea archiviata.");
      await load();
    } catch { show("Archiviazione non riuscita.", "error"); }
  }, [load, show]);

  const bulkArchive = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const res = await fetch("/api/ideas/bulk-archive", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!res.ok) { show("Archiviazione non riuscita.", "error"); return; }
      show("Idee archiviate.");
      await load();
    } catch { show("Archiviazione non riuscita.", "error"); }
  };
```

(c) In the bulk-actions bar (the `{selected.size > 0 && ( … )}` block), after the `🗑 Cestina` button add:
```tsx
          <Button size="sm" variant="ghost" onClick={() => bulkArchive([...selected])}>📥 Archivia ({selected.size})</Button>
```

(d) Add an always-visible "Archivia approvate" control. In the top toolbar row, inside the right-hand `<div className="flex items-center gap-2">` (the one holding the "Mostra scartate" label and `SegmentedControl`), BEFORE the `SegmentedControl`, add:
```tsx
          <Button size="sm" variant="ghost" onClick={() => bulkArchive(approvedIds(ideas))} disabled={approvedIds(ideas).length === 0}>📥 Archivia approvate</Button>
```

(e) Pass `onArchive` to the board — update the `<KanbanBoard … />` usage:
```tsx
        <KanbanBoard ideas={visible} setIdeas={setIdeas} selected={selected} onToggleSelect={toggle} showDiscarded={showDiscarded} persist={persist} onTrash={trashOne} onArchive={archiveOne} />
```

(f) Add a per-row archive button in the table view. In the last `<td>` of each row (currently the trash button), change:
```tsx
                <td className="p-2"><button onClick={() => trashOne(i.id)} aria-label="Sposta nel cestino" title="Sposta nel cestino" className="text-ink-soft hover:text-red-600">🗑</button></td>
```
to:
```tsx
                <td className="p-2 whitespace-nowrap">
                  <button onClick={() => archiveOne(i.id)} aria-label="Archivia" title="Archivia" className="mr-2 text-ink-soft hover:text-sage-700">📥</button>
                  <button onClick={() => trashOne(i.id)} aria-label="Sposta nel cestino" title="Sposta nel cestino" className="text-ink-soft hover:text-red-600">🗑</button>
                </td>
```

- [ ] **Step 5: Typecheck + build**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit && npm run build`
Expected: `tsc` clean; `next build` completes.

- [ ] **Step 6: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/components/brain/idea-card.tsx src/components/brain/kanban-column.tsx src/components/brain/kanban-board.tsx src/components/idea-table.tsx
git commit -m "feat(brain): archive button on cards/rows + bulk archive (selected + approved)"
```

---

### Task 5: Pagina `/archivio`

**Files:**
- Create: `src/app/archivio/page.tsx`

**Interfaces:**
- Consumes: `GET /api/ideas/archive`, `PATCH /api/ideas/bulk-unarchive`, `PATCH /api/ideas/bulk-trash` (existing).

- [ ] **Step 1: Create the archive page**

Create `src/app/archivio/page.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Card, Button, Pill, EmptyState, useToast } from "@/components/ui";

interface ArchivedIdea {
  id: string;
  titolo: string;
  category: string;
  status: string;
  archivedAt: string | null;
  _count?: { contenuti: number };
}

export default function ArchivioPage() {
  const { show } = useToast();
  const [ideas, setIdeas] = useState<ArchivedIdea[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ideas/archive");
      if (!res.ok) { show("Caricamento dell'archivio non riuscito.", "error"); setIdeas([]); return; }
      const data = await res.json();
      setIdeas(Array.isArray(data) ? data : []);
    } catch { show("Caricamento dell'archivio non riuscito.", "error"); setIdeas([]); } finally { setLoading(false); }
  }, [show]);
  useEffect(() => { load(); }, [load]);

  const restore = async (id: string) => {
    try {
      const res = await fetch("/api/ideas/bulk-unarchive", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
      if (!res.ok) { show("Ripristino non riuscito.", "error"); return; }
      show("Idea ripristinata sul board."); await load();
    } catch { show("Ripristino non riuscito.", "error"); }
  };

  const toTrash = async (idea: ArchivedIdea) => {
    const extra = idea._count?.contenuti ? ` Ha ${idea._count.contenuti} contenuti collegati.` : "";
    if (!window.confirm(`Spostare "${idea.titolo}" nel cestino?${extra}`)) return;
    try {
      const res = await fetch("/api/ideas/bulk-trash", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [idea.id] }) });
      if (!res.ok) { show("Spostamento nel cestino non riuscito.", "error"); return; }
      show("Spostata nel cestino."); await load();
    } catch { show("Spostamento nel cestino non riuscito.", "error"); }
  };

  return (
    <div>
      <PageHeader
        title="Archivio"
        subtitle="Idee concluse messe da parte — ripristinabili sul board o spostabili nel cestino."
      />
      {loading ? (
        <p className="text-ink-soft">Caricamento…</p>
      ) : ideas.length === 0 ? (
        <EmptyState title="Archivio vuoto" hint="Le idee che archivi dal board compaiono qui." />
      ) : (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <Card key={idea.id} className="flex items-center justify-between gap-4 p-3">
              <div className="min-w-0">
                <div className="font-display text-sm font-semibold text-ink truncate">{idea.titolo}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                  <span>{idea.category}</span>
                  <Pill tone="neutral">{idea.status}</Pill>
                  {idea.archivedAt && <span>· archiviata il {new Date(idea.archivedAt).toLocaleDateString("it-IT")}</span>}
                  {idea._count?.contenuti ? <Pill tone="amber">{idea._count.contenuti} contenuti collegati</Pill> : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="soft" onClick={() => restore(idea.id)}>Ripristina</Button>
                <Button size="sm" variant="ghost" onClick={() => toTrash(idea)}>Sposta nel cestino</Button>
              </div>
            </Card>
          ))}
        </div>
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
git add src/app/archivio/page.tsx
git commit -m "feat(brain): /archivio page (restore to board or move to trash)"
```

---

### Task 6: Verifica end-to-end

**Files:** nessuna modifica.

- [ ] **Step 1: Full test suite**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run`
Expected: tutti i test verdi (inclusi i nuovi `approvedIds` e nav "Archivio").

- [ ] **Step 2: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Smoke manuale (dev server su :3000)**

Apri `http://localhost:3000/dashboard`. Archivia un'idea dal board (icona 📥 su una card) → l'idea sparisce dal board. Vai su **Brain → Archivio** (`/archivio`) → l'idea è lì. Premi **Ripristina** → torna sul board nella sua colonna. Riarchiviala, poi da `/archivio` premi **Sposta nel cestino** → l'idea lascia l'archivio e compare in `/cestino`. Prova anche **📥 Archivia approvate** con almeno un'idea APPROVATA sul board.

- [ ] **Step 4: Nessun commit** (task di sola verifica).

---

## Self-Review

**Spec coverage:**
- `Idea.archivedAt` + index + migration → Task 1. ✓
- Board esclude archiviate → Task 1 (`where.archivedAt = null`). ✓
- bulk-archive / bulk-unarchive / archive GET → Task 2. ✓
- "Sposta nel cestino" riusa bulk-trash → Task 5 (`toTrash`). ✓
- Nav "Archivio" sotto Brain → Task 3. ✓
- Pulsante Archivia su ogni card (qualsiasi status) + threading → Task 4. ✓
- Bulk "Archivia approvate" + "Archivia selezionate" → Task 4 (`approvedIds`/`bulkArchive`). ✓
- Pagina `/archivio` con Ripristina + Sposta nel cestino + `_count.contenuti` → Task 5. ✓
- Helper puro `approvedIds` testato → Task 3. ✓
- No-silent-failure (res.ok + toast) → Task 4/5. ✓

**Placeholder scan:** nessun TODO/TBD; ogni step ha codice/comando reale. ✓

**Type consistency:** `onArchive?: (id: string) => void` identico in idea-card/kanban-column/kanban-board/idea-table; `approvedIds` firma coerente tra kanban.ts (Task 3) e idea-table.tsx (Task 4); endpoint `{archived}`/`{unarchived}` e query `archivedAt`/`deletedAt` coerenti Task 1→2→5. ✓
