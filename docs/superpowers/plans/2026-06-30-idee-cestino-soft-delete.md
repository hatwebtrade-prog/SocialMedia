# Brain — Cestino idee (soft-delete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a recoverable trash ("cestino") for Brain ideas — move ideas to trash (they leave the kanban/table), then restore, permanently delete, or empty the trash.

**Architecture:** A nullable `Idea.deletedAt` soft-delete flag. `GET /api/ideas` excludes trashed ideas; new endpoints trash/restore/list/empty them. UI adds a "Cestino" nav entry, a bulk "Cestina" action + per-card trash icon on the dashboard, and a `/cestino` management page. Permanent delete reuses the existing `DELETE /api/ideas/[id]` (which cascades to linked content).

**Tech Stack:** Next.js 15 (App Router), React 19, Prisma/Postgres, Tailwind, Vitest (node env), `react-icons/lu`. Work directory: `C:/Users/Hatweb Lim/agocap-hub` (the clean clone).

## Global Constraints

- UI copy **Italian**, code/identifiers **English**.
- Work in `C:/Users/Hatweb Lim/agocap-hub`. Path alias `@/` → `./src`.
- Migrations: author `migration.sql` by hand and apply with `npx prisma migrate deploy` (then `npx prisma generate`). `prisma migrate dev` is interactive and blocked in this shell.
- `GeneratedContent.idea` is `onDelete: Cascade` → **permanent** delete of an idea also deletes its generated content. Soft delete (trashing) does not.
- Vitest is **node** env — unit-test pure functions/validators only; components verified by `npx tsc --noEmit` + live smoke. Existing suite must stay green.
- Reuse the existing bulk pattern (`src/app/api/ideas/bulk-status/route.ts`): PATCH, zod-validated body, `updateMany`, JSON count response.
- Commit message footer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: `Idea.deletedAt` schema + migration + exclude trashed from `GET /api/ideas`

**Files:**
- Modify: `prisma/schema.prisma` (Idea model)
- Create: `prisma/migrations/20260630170000_idea_deleted_at/migration.sql`
- Modify: `src/app/api/ideas/route.ts` (GET `where`)

**Interfaces:**
- Produces: `Idea.deletedAt: DateTime?` column + Prisma client field; `GET /api/ideas` returns only ideas with `deletedAt = null`.

- [ ] **Step 1: Add the field to the Idea model**

In `prisma/schema.prisma`, inside `model Idea { … }`, add after the `updatedAt` line:

```prisma
  deletedAt              DateTime?
```

and add an index alongside the existing `@@index(...)` lines:

```prisma
  @@index([deletedAt])
```

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/20260630170000_idea_deleted_at/migration.sql`:

```sql
-- Soft-delete flag for ideas (cestino)
ALTER TABLE "Idea" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "Idea_deletedAt_idx" ON "Idea"("deletedAt");
```

- [ ] **Step 3: Apply the migration + regenerate the client**

Run: `npx prisma migrate deploy`
Expected: applies `20260630170000_idea_deleted_at` with no error.
Run: `npx prisma generate`
Expected: client regenerated.

- [ ] **Step 4: Exclude trashed ideas from the list endpoint**

In `src/app/api/ideas/route.ts`, in the `GET` handler, add this line immediately before the `const ideas = await prisma.idea.findMany({` call (after all the existing `where.*` filters are set):

```ts
  where.deletedAt = null;
```

- [ ] **Step 5: Verify column + filter work**

Run: `npx tsc --noEmit`
Expected: no errors.
Run:
```bash
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.idea.findMany({where:{deletedAt:null},take:1}).then(r=>{console.log('ok, deletedAt filter works, rows:',r.length);process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})"
```
Expected: `ok, deletedAt filter works` (proves the column exists and the client has the field).

- [ ] **Step 6: Run the existing idea tests (no regression)**

Run: `npx vitest run src/app/api/ideas`
Expected: PASS (validation tests unaffected by the where-clause change).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260630170000_idea_deleted_at src/app/api/ideas/route.ts
git commit -m "feat(cestino): Idea.deletedAt soft-delete column + exclude trashed from GET /api/ideas"
```

---

### Task 2: Trash API — validator + bulk-trash / bulk-restore / trash list+empty

**Files:**
- Modify: `src/app/api/ideas/validators.ts`
- Create: `src/app/api/ideas/bulk-ids-validators.test.ts`
- Create: `src/app/api/ideas/bulk-trash/route.ts`
- Create: `src/app/api/ideas/bulk-restore/route.ts`
- Create: `src/app/api/ideas/trash/route.ts`

**Interfaces:**
- Consumes: `Idea.deletedAt` (Task 1).
- Produces:
  - `bulkIdsSchema` (zod) in validators — `{ ids: string[] }`, min 1.
  - `PATCH /api/ideas/bulk-trash` `{ ids }` → `{ trashed: number }`
  - `PATCH /api/ideas/bulk-restore` `{ ids }` → `{ restored: number }`
  - `GET /api/ideas/trash` → array of trashed ideas (each with `product{nome}`, `source{key}`, `_count.contenuti`)
  - `DELETE /api/ideas/trash` → `{ deleted: number }`

- [ ] **Step 1: Write the failing validator test**

Create `src/app/api/ideas/bulk-ids-validators.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { bulkIdsSchema } from "@/app/api/ideas/validators";

describe("bulkIdsSchema", () => {
  it("accepts a non-empty array of ids", () => {
    const r = bulkIdsSchema.safeParse({ ids: ["a", "b"] });
    expect(r.success).toBe(true);
  });
  it("rejects an empty array", () => {
    expect(bulkIdsSchema.safeParse({ ids: [] }).success).toBe(false);
  });
  it("rejects a missing ids field", () => {
    expect(bulkIdsSchema.safeParse({}).success).toBe(false);
  });
  it("rejects non-string ids", () => {
    expect(bulkIdsSchema.safeParse({ ids: [1, 2] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/api/ideas/bulk-ids-validators.test.ts`
Expected: FAIL — `bulkIdsSchema` is not exported.

- [ ] **Step 3: Add the validator**

In `src/app/api/ideas/validators.ts`, add (the file already imports `z` from "zod"):

```ts
export const bulkIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/app/api/ideas/bulk-ids-validators.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create bulk-trash route**

Create `src/app/api/ideas/bulk-trash/route.ts`:

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
    where: { id: { in: parsed.data.ids }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ trashed: result.count });
}
```

- [ ] **Step 6: Create bulk-restore route**

Create `src/app/api/ideas/bulk-restore/route.ts`:

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
    where: { id: { in: parsed.data.ids } },
    data: { deletedAt: null },
  });
  return NextResponse.json({ restored: result.count });
}
```

- [ ] **Step 7: Create trash route (GET list + DELETE empty)**

Create `src/app/api/ideas/trash/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ideas = await prisma.idea.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: {
      product: { select: { nome: true } },
      source: { select: { key: true } },
      _count: { select: { contenuti: true } },
    },
  });
  return NextResponse.json(ideas);
}

export async function DELETE() {
  const result = await prisma.idea.deleteMany({ where: { deletedAt: { not: null } } });
  return NextResponse.json({ deleted: result.count });
}
```

- [ ] **Step 8: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/ideas/validators.ts src/app/api/ideas/bulk-ids-validators.test.ts src/app/api/ideas/bulk-trash src/app/api/ideas/bulk-restore src/app/api/ideas/trash
git commit -m "feat(cestino): trash API (bulk-trash/bulk-restore + trash list/empty) + bulkIdsSchema"
```

---

### Task 3: UI on the board — Cestino nav + bulk "Cestina" + per-card trash icon

**Files:**
- Modify: `src/lib/nav/items.ts`
- Modify: `src/components/brain/idea-card.tsx`
- Modify: `src/components/brain/kanban-column.tsx`
- Modify: `src/components/brain/kanban-board.tsx`
- Modify: `src/components/idea-table.tsx`

**Interfaces:**
- Consumes: `PATCH /api/ideas/bulk-trash` (Task 2); `Button`, `useToast` (`@/components/ui`).
- Produces: an `onTrash?: (id: string) => void` prop threaded `IdeaWorkspace → KanbanBoard → KanbanColumn → IdeaCard`; a bulk "Cestina" action.

- [ ] **Step 1: Add the Cestino nav child**

In `src/lib/nav/items.ts`, in the Brain area `children` array, add a third entry after "Genera idee":

```ts
      { label: "Cestino", href: "/cestino" },
```

- [ ] **Step 2: Add the trash icon to IdeaCard**

In `src/components/brain/idea-card.tsx`:
1. Add the import at the top: `import { LuTrash2 } from "react-icons/lu";`
2. Add `onTrash` to the component props type — change the signature to:

```tsx
export function IdeaCard({ idea, selected, onToggleSelect, onTrash }: { idea: KanbanIdea; selected: boolean; onToggleSelect: (id: string) => void; onTrash?: (id: string) => void }) {
```

3. Replace the top-row checkbox block (the `<input type="checkbox" … aria-label="Seleziona idea" />` and its wrapper) so the checkbox sits next to an optional trash button:

```tsx
      <div className="mb-2 flex items-center justify-between gap-2">
        <Pill tone="sage">P{idea.priority}</Pill>
        <div className="flex items-center gap-1.5">
          {onTrash && (
            <button
              onClick={() => onTrash(idea.id)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Sposta nel cestino"
              title="Sposta nel cestino"
              className="text-ink-soft transition hover:text-red-600"
            >
              <LuTrash2 size={15} />
            </button>
          )}
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(idea.id)}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Seleziona idea"
          />
        </div>
      </div>
```

(Keep the rest of the card — title link, keyword, stats, channels, product — unchanged.)

- [ ] **Step 3: Thread `onTrash` through KanbanColumn**

In `src/components/brain/kanban-column.tsx`:
1. Add `onTrash` to the `KanbanColumn` props type: `onTrash?: (id: string) => void` (alongside `onToggleSelect`).
2. Add `onTrash` to the inner `DraggableCard` props and pass it to `IdeaCard`.
3. Where the column maps cards (`<DraggableCard … />`), pass `onTrash={onTrash}`.

Concretely, the `DraggableCard` render becomes:

```tsx
        <DraggableCard key={idea.id} idea={idea} selected={selected.has(idea.id)} onToggleSelect={onToggleSelect} onTrash={onTrash} />
```

and `DraggableCard` forwards it:

```tsx
      <IdeaCard idea={idea} selected={selected} onToggleSelect={onToggleSelect} onTrash={onTrash} />
```

with both `DraggableCard` and `KanbanColumn` prop types extended by `onTrash?: (id: string) => void`.

- [ ] **Step 4: Thread `onTrash` through KanbanBoard**

In `src/components/brain/kanban-board.tsx`:
1. Add `onTrash?: (id: string) => void` to the `KanbanBoard` props type.
2. Pass it to each `<KanbanColumn … onTrash={onTrash} />`.

- [ ] **Step 5: Wire trash handlers + bulk "Cestina" in IdeaWorkspace**

In `src/components/idea-table.tsx` (`IdeaWorkspace`):
1. Add a single-id trash handler and a bulk one (place them near `bulkStatus`):

```tsx
  const trashOne = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/ideas/bulk-trash", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
      if (!res.ok) { show("Spostamento nel cestino non riuscito.", "error"); return; }
      show("Spostata nel cestino.");
      await load();
    } catch { show("Spostamento nel cestino non riuscito.", "error"); }
  }, [load, show]);

  const bulkTrash = async () => {
    if (selected.size === 0) return;
    try {
      const res = await fetch("/api/ideas/bulk-trash", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [...selected] }) });
      if (!res.ok) { show("Spostamento nel cestino non riuscito.", "error"); return; }
      show("Spostate nel cestino.");
      await load();
    } catch { show("Spostamento nel cestino non riuscito.", "error"); }
  };
```

2. Add a "Cestina" button to the bulk action bar (the block rendered when `selected.size > 0`), after the existing "Interessante" button:

```tsx
          <Button size="sm" variant="ghost" onClick={bulkTrash}>🗑 Cestina ({selected.size})</Button>
```

3. Pass `onTrash={trashOne}` to `<KanbanBoard … />` (add the prop to the existing KanbanBoard usage). The restyled **table** view also gets a per-row trash button: in the table body row, add a cell at the end:

```tsx
                <td className="p-2"><button onClick={() => trashOne(i.id)} aria-label="Sposta nel cestino" title="Sposta nel cestino" className="text-ink-soft hover:text-red-600">🗑</button></td>
```

(and a matching empty `<th className="p-2"></th>` at the end of the table header row).

- [ ] **Step 6: Verify typecheck + existing tests**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run test`
Expected: PASS (all suites, including the new `bulk-ids-validators` test).

- [ ] **Step 7: Commit**

```bash
git add src/lib/nav/items.ts src/components/brain/idea-card.tsx src/components/brain/kanban-column.tsx src/components/brain/kanban-board.tsx src/components/idea-table.tsx
git commit -m "feat(cestino): Cestino nav + bulk Cestina + per-card/per-row trash on dashboard"
```

---

### Task 4: Cestino page (`/cestino`)

**Files:**
- Create: `src/app/cestino/page.tsx`

**Interfaces:**
- Consumes: `GET /api/ideas/trash`, `PATCH /api/ideas/bulk-restore`, `DELETE /api/ideas/[id]`, `DELETE /api/ideas/trash` (Task 2); `PageHeader`, `Card`, `Button`, `Pill`, `EmptyState`, `useToast` (`@/components/ui`).

- [ ] **Step 1: Create the trash page**

Create `src/app/cestino/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, Button, Pill, EmptyState, useToast } from "@/components/ui";

interface TrashIdea {
  id: string;
  titolo: string;
  category: string;
  deletedAt: string | null;
  _count?: { contenuti: number };
}

export default function CestinoPage() {
  const { show } = useToast();
  const [ideas, setIdeas] = useState<TrashIdea[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ideas/trash");
      const data = await res.json();
      setIdeas(Array.isArray(data) ? data : []);
    } catch { setIdeas([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const restore = async (id: string) => {
    try {
      const res = await fetch("/api/ideas/bulk-restore", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
      if (!res.ok) { show("Ripristino non riuscito.", "error"); return; }
      show("Idea ripristinata."); await load();
    } catch { show("Ripristino non riuscito.", "error"); }
  };

  const deleteForever = async (idea: TrashIdea) => {
    const extra = idea._count?.contenuti ? ` Verranno eliminati anche ${idea._count.contenuti} contenuti collegati.` : "";
    if (!window.confirm(`Eliminare definitivamente "${idea.titolo}"?${extra} L'azione non è reversibile.`)) return;
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, { method: "DELETE" });
      if (!res.ok) { show("Eliminazione non riuscita.", "error"); return; }
      show("Idea eliminata definitivamente."); await load();
    } catch { show("Eliminazione non riuscita.", "error"); }
  };

  const emptyTrash = async () => {
    const withContent = ideas.filter((i) => (i._count?.contenuti ?? 0) > 0).length;
    const extra = withContent ? ` ${withContent} hanno contenuti collegati che verranno eliminati.` : "";
    if (!window.confirm(`Svuotare il cestino? ${ideas.length} idee verranno eliminate definitivamente.${extra} L'azione non è reversibile.`)) return;
    try {
      const res = await fetch("/api/ideas/trash", { method: "DELETE" });
      if (!res.ok) { show("Svuotamento non riuscito.", "error"); return; }
      show("Cestino svuotato."); await load();
    } catch { show("Svuotamento non riuscito.", "error"); }
  };

  return (
    <div>
      <PageHeader
        title="Cestino"
        subtitle="Idee eliminate — ripristinabili o eliminabili definitivamente."
        actions={<Button variant="danger" onClick={emptyTrash} disabled={ideas.length === 0}>Svuota cestino</Button>}
      />
      {loading ? (
        <p className="text-ink-soft">Caricamento…</p>
      ) : ideas.length === 0 ? (
        <EmptyState title="Il cestino è vuoto" hint="Le idee che sposti nel cestino compaiono qui." />
      ) : (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <Card key={idea.id} className="flex items-center justify-between gap-4 p-3">
              <div className="min-w-0">
                <div className="font-display text-sm font-semibold text-ink truncate">{idea.titolo}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                  <span>{idea.category}</span>
                  {idea.deletedAt && <span>· cestinata il {new Date(idea.deletedAt).toLocaleDateString("it-IT")}</span>}
                  {idea._count?.contenuti ? <Pill tone="amber">{idea._count.contenuti} contenuti collegati</Pill> : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="soft" onClick={() => restore(idea.id)}>Ripristina</Button>
                <Button size="sm" variant="danger" onClick={() => deleteForever(idea)}>Elimina definitivamente</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/cestino/page.tsx
git commit -m "feat(cestino): /cestino page with restore, delete-forever, empty-trash + cascade warning"
```

---

### Task 5: Verification + live smoke

**Files:** none (verification only)

- [ ] **Step 1: Full test suite + typecheck + build**

Run: `npm run test`
Expected: PASS (all suites green, including `bulk-ids-validators`).
Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; production build succeeds (if `npm run build` fails ONLY on a next/font Google-Fonts network fetch, rely on tsc and note it).

- [ ] **Step 2: Live smoke (dev server on :3000 + Postgres up)**

Restart the dev server if running (`npm run dev`), then in the browser at `http://localhost:3000`:
- On `/dashboard`, select one or more idea cards → bulk **"Cestina"** → they leave the board, toast shown.
- The per-card **trash icon** (and the table-view trash button) also moves a single idea to the trash.
- Open **`/cestino`** (sidebar → Brain → Cestino): the trashed ideas are listed with their trashed date; an idea with linked content shows the "N contenuti collegati" badge.
- **Ripristina** → the idea returns to `/dashboard` and leaves the trash.
- **Elimina definitivamente** → confirm dialog (warns about linked content if any) → the idea is gone.
- **Svuota cestino** → confirm → the trash empties.
- Reload `/dashboard` and confirm trashed ideas never reappear there (GET filters `deletedAt`).

- [ ] **Step 3: Commit (only if smoke required a fix)**

```bash
git add -A
git commit -m "fix(cestino): polish after live smoke"
```

---

## Self-Review

**Spec coverage:**
- `Idea.deletedAt` + index + hand-authored migration + `migrate deploy` → Task 1 ✓
- `GET /api/ideas` excludes trashed → Task 1 ✓
- `bulk-trash` / `bulk-restore` (PATCH, `{ids}`) → Task 2 ✓
- `GET /api/ideas/trash` (list + `_count.contenuti`) and `DELETE` (empty) → Task 2 ✓
- `bulkIdsSchema` validator (min-1, string ids) + tests → Task 2 ✓
- existing `DELETE /api/ideas/[id]` reused for permanent delete → Tasks 4 (unchanged) ✓
- Sidebar "Cestino" child → Task 3 ✓
- Bulk "Cestina" (no confirm, recoverable) + per-card/per-row trash icon → Task 3 ✓
- `/cestino` page: list, restore, delete-forever, empty, confirms + cascade warning → Task 4 ✓
- Cascade note (permanent delete removes linked content; warn in UI) → Task 4 (`deleteForever`/`emptyTrash` warnings) ✓
- No silent failures (res.ok guard + toast) → Tasks 3, 4 ✓
- Node-env unit test on validator; components via tsc + smoke → Tasks 2, 5 ✓

**Placeholder scan:** No "TBD"/"add error handling"/"similar to" — full code shown for routes, validator, page; component edits give exact JSX/prop snippets. ✓

**Type consistency:** `bulkIdsSchema` defined in Task 2, consumed in Tasks 2–4; `onTrash?: (id: string) => void` identical across IdeaCard (Task 3.2), KanbanColumn/DraggableCard (3.3), KanbanBoard (3.4), IdeaWorkspace (3.5); response field names (`trashed`/`restored`/`deleted`) are internal to each handler and not relied on by the UI (UI only checks `res.ok` then reloads). `TrashIdea._count.contenuti` matches the `_count: { select: { contenuti: true } }` include in Task 2's trash GET. ✓
