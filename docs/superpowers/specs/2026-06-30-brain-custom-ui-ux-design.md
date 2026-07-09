# Brain — Custom UI/UX Redesign ("Natural & Calm")

Date: 2026-06-30
Status: Design approved (pending user spec review)

## Goal

Redesign the **Brain** area of AGOCAP Content AI Hub as a distinctive, branded
experience — both a new **visual identity** and a new **workflow (UX)**. The
current Brain is functional but visually "default Tailwind" (neutral grays, blue
buttons, emoji icons, a dense data table). We replace it with a cohesive design
system and a kanban-first idea workflow.

Scope of this spec: the **shared shell** (sidebar + page chrome) and the **three
Brain surfaces**:

1. `/dashboard` — "Tutte le idee" → becomes a **kanban by status**
2. `/genera` — "Genera idee" (3 tabs) → restyled
3. `/ideas/[id]` — idea detail → restyled, two-column

A reusable **design system** is established (Tailwind theme tokens + UI
primitives) so the look can later extend to the rest of the app. No data-model
or API changes are required.

## Non-goals

- No changes to API routes, Prisma schema, or business logic.
- No redesign of non-Brain areas (Meta/Blog/Email/Calendario/etc.) in this spec —
  only the shared sidebar/shell, which those areas inherit for free.
- No new idea statuses or fields.

## Design direction — "Natural & Calm"

A warm, organic, wellness aesthetic appropriate to AGOCAP (integratori,
benessere, beauty, salute naturale): sage greens, cream/sand neutrals, soft
rounded surfaces, gentle shadows.

### Color tokens (`tailwind.config.ts` → `theme.extend.colors`)

| Token | Use | Value |
|---|---|---|
| `sage.500` | primary actions, active states | `#6B8E5A` |
| `sage.700` | primary text-on-light, active label | `#4F6B43` |
| `sage.50/100` | soft active backgrounds, hovers | tints of sage |
| `cream` | app background | `#FBF8F1` |
| `surface` | cards | `#FFFFFF` |
| `sand` | borders / muted fills | warm neutral (`#E9E3D6` border, `#F4EFE6` fill) |
| `ink` | primary text | `#2B2A26` (warm near-black) |
| `ink-soft` | secondary text | `#6B6760` |

Full `50→900` ramps are generated for `sage`, `sand`, and the status accents so
utilities like `bg-sage-100`, `text-sage-700`, `border-sand-200` are available.

**Status accents** (warmed, used by `StatusBadge` + kanban column headers + card
dots):

| Status | Accent family |
|---|---|
| `NUOVA` | stone (neutral warm) |
| `DA_APPROFONDIRE` | sky (soft blue) |
| `INTERESSANTE` | amber |
| `APPROVATA` | leaf green |
| `SCARTATA` | terracotta/clay |

### Typography (`next/font`)

- **Headings / titles**: `Fraunces` (soft serif) — gives editorial, natural
  character. Used for page titles, idea-card titles, section headers.
- **UI / body**: `Inter` — clean, legible.

Both loaded via `next/font/google` in `layout.tsx`, exposed as CSS variables
(`--font-fraunces`, `--font-inter`) and wired into Tailwind `fontFamily`
(`font-display` → Fraunces, `font-sans` → Inter).

### Shape & elevation

- Cards: `rounded-2xl`, 1px `border-sand-200`, soft layered shadow
  (`shadow-[0_1px_2px_rgba(43,42,38,0.04),0_4px_12px_rgba(43,42,38,0.05)]`,
  exposed as a `shadow-soft` utility via theme `boxShadow`).
- Buttons / pills: `rounded-full` or `rounded-xl`.
- Hover lift on cards: subtle `transl-y` + shadow increase, `transition`.

## Reusable UI primitives (`src/components/ui/`)

Small, single-purpose, framework-agnostic components reused across the Brain and
later the whole app. Each has one clear job and a typed props interface.

| Component | Purpose |
|---|---|
| `Button` | variants `primary` (sage) / `soft` (sage-50) / `ghost` / `danger`; sizes sm/md |
| `Pill` | rounded tag; `tone` prop maps to status/neutral/sage palettes |
| `Card` | surface container (rounded-2xl, border, shadow-soft); optional `interactive` (hover lift) |
| `SegmentedControl` | sage segmented switcher (tabs, view toggle) — generic over an options array |
| `Field` (`Input`, `Select`, `Textarea`) | themed form controls + label/helper |
| `PageHeader` | page title (Fraunces) + subtitle + actions slot |
| `EmptyState` | icon + message + optional action |
| `Skeleton` | sage-tinted loading placeholder |
| `Icon` | thin wrapper over `react-icons` (Lucide set `react-icons/lu`) for a consistent line-icon look |

These are presentational only (no data fetching). Existing
`StatusBadge`/`channel-icon` are kept but restyled to consume the new tokens
(`StatusBadge` re-expressed in terms of `Pill` + status tone).

## Shared shell

### Sidebar (`src/components/sidebar.tsx`)

- Cream panel (`bg-cream` / `bg-sand-50`), `border-r border-sand-200`.
- Brandmark at top: AGOCAP wordmark (Fraunces) + small leaf glyph.
- Nav items: Lucide icons (replace emoji in `src/lib/nav/items.ts` — `icon`
  becomes a Lucide icon key instead of an emoji string; an `iconMap` resolves
  keys → components so `items.ts` stays data-only).
- Active area: soft sage background (`bg-sage-100`), `text-sage-700`, a 3px sage
  accent bar on the left edge. Hover: `bg-sand-100`.
- Sub-items (Brain children) keep the indented reveal-when-active behavior, styled
  in sage tones.

### Main chrome (`src/app/layout.tsx`)

- `bg-cream` body, fonts wired. `<main>` keeps `max-w-6xl` container; pages render
  a `PageHeader` at top instead of ad-hoc `<h1>`.

## Surface 1 — Dashboard kanban (`/dashboard`)

Replaces the dense table as the **default** view (table preserved as secondary).

### Layout

- `PageHeader` "Brain — Idee" + subtitle + actions (link to `/genera`).
- Toolbar row: debounced **search** (kept) · filter pill-dropdowns (categoria,
  fonte, priorità, destinazione) · **view toggle** `Kanban | Tabella`
  (`SegmentedControl`, persisted to `localStorage`).
- **Kanban board**: 4 primary columns left→right:
  `Nuove` · `Da approfondire` · `Interessanti` · `Approvate`.
  - `SCARTATA` is **not** a primary column; a "Mostra scartate" toggle reveals a
    secondary muted column (or collapsible drawer) so discarded ideas stay out of
    the main flow but remain reachable / restorable.
  - Column header: status color dot + label (Fraunces) + count pill.
  - Column body: vertical scroll, gap-3 stacked `IdeaCard`s, `EmptyState` when 0.

### IdeaCard (`src/components/brain/idea-card.tsx`)

Reads the same fields the table uses (`GET /api/ideas`):

- top row: status dot + priority indicator (e.g. `P8` pill or small flame scale)
- title (Fraunces, 2-line clamp) → links to `/ideas/[id]`
- keyword chip (when present)
- micro-stat row: `SEO {seoScore} · vol {volumeRicerca} · KD {difficolta}`
  (graceful `—` when null)
- channel icons for `destinazioni` (reuse `ChannelIcons`)
- product chip (when present)
- selection checkbox (for bulk "assegna a canali", preserved)

### Drag & drop

- Library: **`@dnd-kit/core`** (+ `@dnd-kit/sortable` for in-column ordering if
  needed; ordering within a column is **not** persisted in this spec — only the
  cross-column status change is). Smooth, keyboard-accessible.
- Dragging a card to another column → **optimistic** local move, then
  `PATCH /api/ideas/[id]` `{ status }`. On failure: **revert** the card to its
  original column and surface a non-blocking error toast (no silent failure).
- Dropping into "Scartate" sets `SCARTATA`; dragging out restores.

### Bulk actions

Preserved from today (approve/scarta/interessante + assegna-a-canali), surfaced
as a contextual action bar when ≥1 card is selected, restyled with primitives.

### Table view (secondary)

Existing `idea-table.tsx` kept and **restyled** to the new tokens (cream rows,
sand borders, Pill status, sage links). Same data/filters. Reached via the view
toggle.

## Surface 2 — Genera (`/genera`)

- `PageHeader` "Genera idee" + "Importa prodotti da Shopify" as a `soft` Button in
  the actions slot.
- 3 tabs (`Ricerca → idee` / `AI brainstorming` / `Manuale`) → `SegmentedControl`.
- Each form wrapped in a `Card` with a section header + helper text.
- Destination-channel checkboxes (from the just-shipped feature) → **pill toggles**
  consistent with the rest of the design. Form controls use `Field` primitives.
- `ScopriKeyword`, `AiBrainstormForm`, `ManualIdeaForm` internals keep their logic;
  only their presentation is updated to primitives.

## Surface 3 — Idea detail (`/ideas/[id]`)

Two-column layout inside the container:

- **Left (main)**: title (Fraunces) + description + Note editor (autosave on blur,
  calm "Salvato ✓" toast instead of inline text).
- **Right (aside `Card`)**:
  - Status as `SegmentedControl` (or themed `Select`) → `PATCH status`
  - Priority + scores `SEO` / `Viral` as small **stat tiles**
  - `destinazioni` as **pill toggles** → `PATCH destinazioni`
  - product chip + recommended platforms
- When `status === APPROVATA`: prominent **"Genera contenuto"** action cards per
  assigned channel (Meta → `/meta/genera?ideaId=`, Blog → `/blog/genera?ideaId=`;
  TikTok/Email show "generatore in arrivo").
- Generation provenance kept as a muted footnote.

All PATCH calls reuse the existing `/api/ideas/[id]` endpoint and its optimistic
+ saved-toast pattern.

## Data flow & error handling

- **No new endpoints.** Kanban + detail use `GET /api/ideas` (+ query filters),
  `PATCH /api/ideas/[id]`, `PATCH /api/ideas/bulk-status`,
  `PATCH /api/ideas/bulk-destinazioni`.
- Optimistic UI for drag-move and status/destinazioni edits; **revert on API
  failure** + visible toast. Loads show `Skeleton`s; fetch errors show an
  `EmptyState` with a retry, never a blank screen.
- View preference persisted in `localStorage` (`brain.view = kanban|table`).

## Components & files

New:
- `src/components/ui/*` (primitives listed above)
- `src/components/brain/kanban-board.tsx`, `kanban-column.tsx`, `idea-card.tsx`
- `src/lib/brain/kanban.ts` — pure helpers (status→column map, column definitions,
  optimistic move reducer, card view-model formatting)
- `src/lib/ui/toast.tsx` (or reuse existing pattern) — lightweight toast

Modified:
- `tailwind.config.ts` (tokens, fonts, shadow), `src/app/globals.css` (base)
- `src/app/layout.tsx` (fonts, cream bg), `src/components/sidebar.tsx`,
  `src/lib/nav/items.ts` (Lucide icon keys)
- `src/app/dashboard/page.tsx`, `src/components/idea-table.tsx`,
  `src/components/idea-filters.tsx`, `src/components/status-badge.tsx`
- `src/app/genera/page.tsx`, `src/components/forms/*`,
  `src/components/scopri-keyword.tsx`, `src/components/import-products-button.tsx`
- `src/app/ideas/[id]/page.tsx`

Dependency added: `@dnd-kit/core` (+ `@dnd-kit/sortable`).

## Testing

- **Vitest unit tests** for pure helpers in `src/lib/brain/kanban.ts`:
  status→column mapping, column ordering, optimistic-move reducer (move + revert),
  card view-model formatting (null-safe stats). All existing tests stay green.
- **Live-smoke** (npm run dev): kanban renders columns with real ideas; drag a card
  across columns persists the status (verify via reload); "Mostra scartate" works;
  view toggle persists; `/genera` tabs + forms submit; `/ideas/[id]` status +
  destinazioni edits save with toast.
- Visual quality is user-judged.

## Build sequence (for the implementation plan)

1. Design tokens + fonts + globals (Tailwind theme, `next/font`).
2. UI primitives (`src/components/ui/*`) + restyle `StatusBadge`.
3. Shell: sidebar + nav icon map + `PageHeader` + layout bg.
4. `src/lib/brain/kanban.ts` helpers + unit tests.
5. Kanban board / column / card + dnd-kit wiring + optimistic PATCH + toast.
6. Dashboard page: toolbar, view toggle, kanban default, restyled table secondary.
7. `/genera` restyle.
8. `/ideas/[id]` restyle.
9. Live-smoke + polish.
