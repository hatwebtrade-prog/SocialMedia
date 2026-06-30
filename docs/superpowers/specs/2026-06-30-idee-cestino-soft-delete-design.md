# Brain — Cestino idee (soft-delete recuperabile)

Date: 2026-06-30
Status: Design approved (pending user spec review)

## Problem

The Brain has no way to remove useless ideas. The kanban only marks ideas
`SCARTATA` (an editorial decision, kept on the board behind "Mostra scartate").
There is a hard-`DELETE` API endpoint but it is not exposed in the UI and it is
irreversible.

## Goal

A **recoverable trash** ("cestino") for ideas: an idea can be moved to the trash
(it disappears from the kanban/table), then later **restored** or **permanently
deleted**, with an **empty-trash** action. Recoverable by design — no accidental
permanent loss.

## Non-goals

- No change to the editorial `SCARTATA` status or the "Mostra scartate" toggle —
  trash is a separate concept from editorial rejection.
- No redesign of the existing pages beyond adding the trash affordances.
- Trash applies to **ideas** only (not to generated Meta/Blog/Email content).

## Data model

Add one nullable field to `Idea` (`prisma/schema.prisma`):

```prisma
deletedAt DateTime?
```

- `null` → active idea (shown on board).
- non-null → in the trash (timestamp of when it was trashed).
- Add `@@index([deletedAt])` for the filtered queries.

Migration is **authored by hand** as `prisma/migrations/<timestamp>_idea_deleted_at/migration.sql`
(`ALTER TABLE "Idea" ADD COLUMN "deletedAt" TIMESTAMP(3); CREATE INDEX ...`) and
applied with `npx prisma migrate deploy` — `prisma migrate dev` is interactive and
blocked in this non-interactive shell (known project constraint).

**Cascade note:** `GeneratedContent.idea` is `onDelete: Cascade`. Therefore a
**permanent** delete of an idea also deletes its linked generated content. Soft
delete (trashing) does NOT — it only sets `deletedAt`. The UI must warn before a
permanent delete / empty-trash when linked content exists.

## API

All under `src/app/api/ideas/`. Bodies reuse the existing `{ ids: string[] }`
bulk shape (see `bulk-status`).

| Route | Method | Behaviour |
|---|---|---|
| `route.ts` (`GET /api/ideas`) | GET | **Add `deletedAt: null`** to the `where` so trashed ideas vanish from kanban/table. All existing filters preserved. |
| `bulk-trash/route.ts` | PATCH | `{ ids }` → `updateMany` set `deletedAt = new Date()` where id in ids **and** `deletedAt: null`. Returns `{ count }`. |
| `bulk-restore/route.ts` | PATCH | `{ ids }` → `updateMany` set `deletedAt = null` where id in ids. Returns `{ count }`. |
| `trash/route.ts` | GET | List ideas with `deletedAt != null`, ordered `deletedAt desc`, including `product{nome}`, `source{key}`, and `_count.contenuti` (to drive the cascade warning). |
| `trash/route.ts` | DELETE | **Empty trash**: `deleteMany` where `deletedAt != null`. Returns `{ count }`. |
| `[id]/route.ts` (`DELETE`) | DELETE | **Unchanged** — permanent delete of one idea (already exists; cascades to its content). Used by "Elimina definitivamente" in the trash. |

Validation: `bulk-trash` / `bulk-restore` reuse a zod `{ ids: z.array(z.string()).min(1) }`
schema (mirror `bulk-status`'s validator). Unknown/empty ids → 400.

## UI

### Sidebar (`src/lib/nav/items.ts`)
Add a third child under **Brain**: `{ label: "Cestino", href: "/cestino" }`
(after "Tutte le idee" and "Genera idee"). Uses a trash Lucide icon where the
sidebar renders child rows (children currently render text-only, so no icon-map
change is required; the area icon stays `brain`).

### Dashboard (`src/components/idea-table.tsx` — `IdeaWorkspace`)
- **Bulk action bar** (shown when ≥1 selected): add a **"Cestina"** button (soft
  `soft`/neutral tone with a trash glyph) → `PATCH /api/ideas/bulk-trash { ids:[...selected] }`
  → toast "Spostate nel cestino" → reload. **No confirm** (recoverable).
- **Per-card quick trash** (`src/components/brain/idea-card.tsx`): a small trash
  icon button in the card's top row (next to the select checkbox), `onPointerDown`
  stop-propagation (so it doesn't start a drag), calling a new optional
  `onTrash?(id)` prop. The board/workspace passes `onTrash` = soft-delete one id
  (`bulk-trash` with a single id) → toast → reload. The icon is hidden in the
  trash page context (card reused there passes no `onTrash`).

### Trash page (`src/app/cestino/page.tsx`, client)
- `PageHeader` "Cestino" + subtitle "Idee eliminate — ripristinabili o eliminabili
  definitivamente." + action **"Svuota cestino"** (in the actions slot, disabled
  when empty).
- Fetches `GET /api/ideas/trash`. Renders a list of `Card` rows: title, category,
  trashed date, and a badge "N contenuti collegati" when `_count.contenuti > 0`.
  Each row has **Ripristina** (`bulk-restore` single id → reload + toast) and
  **Elimina definitivamente** (`DELETE /api/ideas/[id]` → reload + toast).
- `EmptyState` "Il cestino è vuoto" when there are no trashed ideas.
- **Confirms + cascade warning**:
  - "Elimina definitivamente" → confirm dialog; if `_count.contenuti > 0`, the
    confirm text states the linked content will also be deleted.
  - "Svuota cestino" → confirm dialog showing the count to be permanently deleted
    (and a note that any linked content is deleted too) → `DELETE /api/ideas/trash`.
  - Confirmation uses a small in-page confirm (a `window.confirm` is acceptable for
    MVP, consistent with the project's current simplicity) — the destructive action
    only proceeds on explicit confirm.

## Data flow & error handling

- All mutations reuse the existing `fetch` + reload pattern, guarded on `res.ok`
  with a `useToast()` success/error toast (no silent failures — matches the
  bulk-action fix already in the codebase).
- Trashing/restoring reloads the affected list. The dashboard reload naturally
  drops trashed ideas (GET filters `deletedAt: null`); the trash page reload drops
  restored/deleted ones.

## Testing

- **Vitest (node env)**: unit-test the new bulk validator (`{ids}` min-1, rejects
  empty) and any pure helper added (e.g. a `formatTrashedDate` / cascade-warning
  label builder). No React-render tests.
- Keep the existing suite green; the `GET /api/ideas` change must not break its
  validation tests.
- **Live smoke** (`agocap-hub`, dev server + Postgres): generate an idea → select
  it → "Cestina" → it leaves the board and appears in `/cestino` → "Ripristina" →
  back on the board → per-card trash icon → in `/cestino` → "Elimina
  definitivamente" (confirm) → gone → "Svuota cestino" empties remaining.
- `npx tsc --noEmit` + `npm run build`.

## Files

Create:
- `prisma/migrations/<ts>_idea_deleted_at/migration.sql`
- `src/app/api/ideas/bulk-trash/route.ts`
- `src/app/api/ideas/bulk-restore/route.ts`
- `src/app/api/ideas/trash/route.ts`
- `src/app/cestino/page.tsx`

Modify:
- `prisma/schema.prisma` (`Idea.deletedAt` + index)
- `src/app/api/ideas/route.ts` (`deletedAt: null` filter)
- `src/app/api/ideas/validators.ts` (add `bulkIdsSchema` if not already shared)
- `src/lib/nav/items.ts` (Cestino child)
- `src/components/idea-table.tsx` (bulk "Cestina" + pass `onTrash`)
- `src/components/brain/idea-card.tsx` (optional per-card trash icon via `onTrash?`)
