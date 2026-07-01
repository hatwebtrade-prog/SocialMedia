# Archivio idee — design

**Data:** 2026-07-01
**Progetto:** AGOCAP Content AI Hub
**Modulo:** Brain (idee) — `src/app/api/ideas/*`, `src/components/brain/*`, `src/lib/brain/*`

## Contesto e problema

Nel Brain le idee vivono su un board kanban per `status` (`NUOVA → DA_APPROFONDIRE → INTERESSANTE → APPROVATA`, più `SCARTATA`). Esiste già un **Cestino** (soft-delete via `Idea.deletedAt`) per le idee da eliminare. Dopo che le idee vengono approvate e lavorate, il board si riempie: serve un'**area di archiviazione** per togliere di mezzo le idee concluse **senza cancellarle**, mantenendo il board pulito.

L'archivio è concettualmente distinto dagli altri due meccanismi di "rimozione":
- **Scartata** — status kanban, resta visibile sul board (colonna "Scartate").
- **Cestino** (`deletedAt`) — da eliminare; recuperabile o cancellabile definitivamente.
- **Archivio** (`archivedAt`, NUOVO) — messa da parte perché conclusa; conservata, tolta dal board, ripristinabile.

## Decisioni di design (confermate)

1. **Cosa si archivia:** qualsiasi idea, in qualsiasi status (il pulsante Archivia compare su ogni card).
2. **Come si archivia:** pulsante per-card + bulk "Archivia approvate" (one-click su tutte le APPROVATA) + "Archivia selezionate" dalla selezione tabella.
3. **Azioni dall'archivio:** Ripristina (torna sul board) e Sposta nel cestino (riusa il trash esistente). La cancellazione definitiva passa dal Cestino, non dall'archivio.
4. **Meccanismo:** rispecchia il pattern Cestino con una colonna `Idea.archivedAt DateTime?`.
5. Un'idea archiviata **mantiene il suo status**; al ripristino torna nella sua colonna originale.

## Architettura

### Dati (Prisma)

`prisma/schema.prisma`, model `Idea`:
- Aggiungere `archivedAt DateTime?`
- Aggiungere `@@index([archivedAt])`

Migration hand-authored (come per il cestino, perché `migrate dev` è interattivo/bloccato), applicata con `npx prisma migrate deploy`:
```sql
ALTER TABLE "Idea" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Idea_archivedAt_idx" ON "Idea"("archivedAt");
```

### Query del board

`GET /api/ideas` (`src/app/api/ideas/route.ts`): prima di `findMany`, oltre all'esistente `where.deletedAt = null`, aggiungere `where.archivedAt = null`. Così le idee archiviate spariscono dal board/kanban e da ogni conteggio del board.

Il Cestino (`GET /api/ideas/trash`, `deletedAt != null`) resta invariato: mostra le idee cestinate a prescindere da `archivedAt`.

### Endpoint (rispecchiano il cestino; riuso `bulkIdsSchema`)

`bulkIdsSchema` esiste già in `src/app/api/ideas/validators.ts`:
```ts
export const bulkIdsSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });
```

- **`PATCH /api/ideas/bulk-archive`** — body `{ids}`; `updateMany` `archivedAt = new Date()` where `id in ids AND archivedAt: null`; risponde `{ archived: <count> }`.
- **`PATCH /api/ideas/bulk-unarchive`** — body `{ids}`; `updateMany` `archivedAt = null` where `id in ids AND archivedAt: { not: null }`; risponde `{ unarchived: <count> }`.
- **`GET /api/ideas/archive`** — lista dove `archivedAt: { not: null } AND deletedAt: null`, `include` `product`, `source`, `_count: { select: { contenuti: true } }`, ordinata per `archivedAt desc`; risponde con l'array.
- **Sposta nel cestino dall'archivio:** riusa l'esistente `PATCH /api/ideas/bulk-trash` (imposta `deletedAt`). Poiché la query archivio richiede `deletedAt: null`, l'idea cestinata lascia l'archivio e compare nel Cestino.

Tutti i nuovi handler seguono il pattern degli handler cestino esistenti: `safeParse` del body con `bulkIdsSchema`, `400` su input non valido, `try/catch` con `500` su errore Prisma.

### UI

**Nav** (`src/lib/nav/items.ts`): aggiungere un figlio `{ label: "Archivio", href: "/archivio" }` sotto l'area Brain, dopo "Cestino". Aggiornare `items.test.ts` per verificarne la presenza.

**Card idea** (`src/components/brain/idea-card.tsx`): aggiungere prop opzionale `onArchive?: (id: string) => void` e un pulsante con icona `LuArchive` (react-icons/lu), accanto al pulsante trash esistente, con `onPointerDown` che fa `stopPropagation` (per non innescare il drag). Compare su **ogni** card.

Threading del callback (come per `onTrash`): `IdeaWorkspace` → `KanbanBoard` (`src/components/brain/kanban-board.tsx`) → `KanbanColumn` (`src/components/brain/kanban-column.tsx`) → `IdeaCard`; e riga per riga nella vista tabella (`src/components/brain/idea-table.tsx`).

**Azioni bulk** (in `IdeaWorkspace`, dentro `src/components/brain/idea-table.tsx`):
- **"📥 Archivia approvate"** — raccoglie gli id delle idee con `status === "APPROVATA"` attualmente caricate e chiama `PATCH /api/ideas/bulk-archive`.
- **"Archivia selezionate"** — archivia gli id selezionati nella tabella (riusa la selezione bulk esistente accanto a "🗑 Cestina").
- Entrambe con update ottimistico + `res.ok` guard + toast d'errore + `reload()`, come per le azioni cestino esistenti.

**Pagina `/archivio`** (`src/app/archivio/page.tsx`), sul modello di `src/app/cestino/page.tsx`:
- Carica `GET /api/ideas/archive` in `load()` con `res.ok` guard + toast d'errore.
- Ogni idea mostra titolo, status, prodotto/fonte, e `_count.contenuti`.
- Azioni: **"Ripristina"** (bulk-unarchive → torna sul board) e **"Sposta nel cestino"** (bulk-trash). Se `_count.contenuti > 0`, `window.confirm` con avviso prima dello spostamento nel cestino.
- Nessuna cancellazione definitiva qui (si passa dal Cestino).

### Helper puro + test

`src/lib/brain/kanban.ts`: aggiungere una funzione pura
```ts
export function approvedIds<T extends { id: string; status: string }>(ideas: T[]): string[]
```
che ritorna gli id delle idee con `status === "APPROVATA"`. Usata dal bulk "Archivia approvate". Testata in `src/lib/brain/kanban.test.ts` (o file test esistente del modulo): ritorna solo gli id approvati, `[]` se nessuno, preserva l'ordine.

## Testing

Ambiente vitest = node → si testano **solo funzioni pure**:
- `approvedIds` (nuovo test).
- `bulkIdsSchema` è già coperto dai test cestino.
- `items.test.ts` aggiornato per includere "Archivio".

Endpoint Prisma e pagine React verificati con `npx tsc --noEmit` + smoke manuale su `http://localhost:3000` (archivia un'idea dal board → sparisce → compare in `/archivio` → Ripristina la riporta sul board; Sposta nel cestino la porta in `/cestino`).

## File

- **Nuovi:** `src/app/api/ideas/bulk-archive/route.ts`, `src/app/api/ideas/bulk-unarchive/route.ts`, `src/app/api/ideas/archive/route.ts`, `src/app/archivio/page.tsx`, `prisma/migrations/<timestamp>_idea_archived_at/migration.sql`
- **Modificati:** `prisma/schema.prisma`, `src/app/api/ideas/route.ts`, `src/lib/nav/items.ts`, `src/lib/nav/items.test.ts`, `src/lib/brain/kanban.ts`, `src/lib/brain/kanban.test.ts`, `src/components/brain/idea-card.tsx`, `src/components/brain/kanban-column.tsx`, `src/components/brain/kanban-board.tsx`, `src/components/brain/idea-table.tsx`

## Fuori scope

- Auto-archiviazione (es. all'atto della pubblicazione del contenuto) — resta manuale.
- Cancellazione definitiva dall'archivio (si passa dal Cestino).
- Filtri/ricerca avanzati nella pagina archivio.
