# Cestino contenuti blog (con cascata Shopify) — design

**Data:** 2026-07-01
**Progetto:** AGOCAP Content AI Hub
**Modulo:** Blog (`src/lib/blog/*`, `src/app/api/blog/*`, area Blog)

## Contesto e problema

Nell'area Blog i contenuti (`GeneratedContent` con `canale = "BLOG"`) sono elencati da `GET /api/blog/contents` → `BlogContentTable`. Oggi non c'è modo di rimuoverli in modo recuperabile: esiste solo un hard-`DELETE /api/blog/contents/[id]`. Serve un **Cestino** (soft-delete recuperabile) + **eliminazione definitiva**, come già fatto per le idee. In più: cestinare un articolo **già pubblicato su Shopify** deve eliminare anche l'articolo live (nessun articolo orfano online), riusando la logica del "Ritira" appena costruita.

`GeneratedContent` non ha `deletedAt`. Esiste già `deleteArticle(articleId)` (Shopify GraphQL `articleDelete`, feature "Ritira") riutilizzabile per la cascata.

## Decisioni di design (confermate)

1. **Contenuti pubblicati:** cestinare un contenuto pubblicato **elimina anche l'articolo live su Shopify** (cascata via `deleteArticle`), con conferma.
2. **Ampiezza:** **cestino completo** — soft-delete dalla lista blog → pagina Cestino blog con Ripristina ed Elimina definitivamente.

## Architettura

### Dati (Prisma)

`prisma/schema.prisma`, model `GeneratedContent`:
- Aggiungere `deletedAt DateTime?`
- Aggiungere `@@index([deletedAt])`

Migration hand-authored, applicata con `npx prisma migrate deploy` + `npx prisma generate`:
```sql
ALTER TABLE "GeneratedContent" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "GeneratedContent_deletedAt_idx" ON "GeneratedContent"("deletedAt");
```

La lista Meta (`canale: "META"`) non è impattata: solo l'UI Blog imposta `deletedAt`.

### Logica cestino — `src/lib/blog/trash.ts` (orchestrazione pura + deps, come `retire.ts`)

```ts
export interface TrashInput { contentId: string }

export interface TrashDeps {
  loadArticleRef: (contentId: string) => Promise<{ shopifyArticleId: string | null } | null>;
  deleteShopifyArticle: (articleId: string) => Promise<{ ok: boolean; notFound: boolean }>;
  persistTrashed: (contentId: string) => Promise<void>;
  persistError: (contentId: string, error: string) => Promise<void>;
}

export interface TrashResult { status: "DONE" | "ERROR"; error?: string }

export async function trashBlogContent(input: TrashInput, deps: TrashDeps): Promise<TrashResult>
```

Flusso (identico a `retireBlogContent` con `persistTrashed` al posto di `persistRetired`):
1. `ref = loadArticleRef(contentId)`; se `null` → `{ status: "ERROR", error: "Contenuto non trovato" }`.
2. Se `ref.shopifyArticleId`: `try { deleteShopifyArticle(id) } catch (err) { persistError(contentId, msg); return ERROR }` (**non** cestina se la delete Shopify fallisce → coerenza).
3. `persistTrashed(contentId)`.
4. `return { status: "DONE" }`.

`persistTrashed` (nella route, non nella logica pura) imposta:
`deletedAt = new Date()`, `status = "BOZZA"`, `publicationStatus = "NON_INVIATO"`, `publishedAt = null`, `shopifyArticleId = null`, `shopifyArticleUrl = null`, `publicationError = null`.

### Endpoint

- **`PATCH /api/blog/contents/[id]/trash`** — costruisce `TrashDeps` (prisma + `deleteArticle`) ed esegue `trashBlogContent`; risponde `{status, error?}` (502 su ERROR, 200 su DONE).
- **`PATCH /api/blog/contents/[id]/restore`** — `prisma.generatedContent.update` con `deletedAt: null`; risponde `{ ok: true }`. (Il contenuto torna nella lista blog come bozza.)
- **`GET /api/blog/contents/trash`** — `findMany` where `canale: "BLOG", deletedAt: { not: null }`, `orderBy deletedAt desc`, `include` `idea(titolo)`, `assets(id)`; risponde con l'array.
- **`DELETE /api/blog/contents/[id]`** — **già esistente** (hard delete del record + cascade assets via Prisma): usato per "Elimina definitivamente".
- **`GET /api/blog/contents`** — aggiungere `where.deletedAt = null` (la lista blog esclude i cestinati).

I nuovi handler seguono i pattern esistenti: input via params, `try/catch`, codici coerenti.

### UI

- **`src/components/blog-content-table.tsx`**: colonna azioni con pulsante per-riga **"🗑 Cestina"**:
  - `window.confirm("Cestinare l'articolo? Se è pubblicato, verrà eliminato anche l'articolo live su Shopify.")`.
  - `PATCH /api/blog/contents/${id}/trash`; `res.ok` guard + messaggio d'errore (stato locale, es. un `msg` + `useState`); su successo `load()`.
- **`src/app/blog/page.tsx`**: nell'header, accanto a "Genera articolo da idea", un link **"Cestino"** → `/blog/cestino`.
- **`src/app/blog/cestino/page.tsx`** (sul modello di `src/app/cestino/page.tsx`):
  - Carica `GET /api/blog/contents/trash` in `load()` con `res.ok` guard + toast/msg.
  - Per ogni contenuto: titolo SEO, idea, data cestinamento; azioni **"Ripristina"** (`PATCH …/restore`) e **"Elimina definitivamente"** (`DELETE /api/blog/contents/[id]`, `window.confirm` irreversibile).

## Testing

Ambiente vitest = node → solo funzioni pure. `src/lib/blog/trash.test.ts` con deps mockate (mirror di `retire.test.ts`):
- content assente → `{ status: "ERROR" }`, nessun delete/persist.
- delete Shopify lancia → `persistError` chiamato, `persistTrashed` NON chiamato, `{ status: "ERROR" }`.
- happy path (con `shopifyArticleId`) → `deleteShopifyArticle(id)` + `persistTrashed(contentId)` + `{ status: "DONE" }`.
- senza `shopifyArticleId` → `deleteShopifyArticle` NON chiamato, `persistTrashed` chiamato, `{ status: "DONE" }`.

Route e pagine verificate con `npx tsc --noEmit` + smoke: `PATCH …/trash` su id inesistente → 502; `GET …/contents/trash` → 200; `/blog/cestino` → 200.

## File

- **Nuovi:** `src/lib/blog/trash.ts`, `src/lib/blog/trash.test.ts`, `src/app/api/blog/contents/[id]/trash/route.ts`, `src/app/api/blog/contents/[id]/restore/route.ts`, `src/app/api/blog/contents/trash/route.ts`, `src/app/blog/cestino/page.tsx`, `prisma/migrations/<timestamp>_generatedcontent_deleted_at/migration.sql`
- **Modificati:** `prisma/schema.prisma`, `src/app/api/blog/contents/route.ts`, `src/components/blog-content-table.tsx`, `src/app/blog/page.tsx`

## Fuori scope

- Filtro `deletedAt` in pubblicazioni/calendario: un contenuto cestinato è resettato a `NON_INVIATO`, quindi non compare come pubblicato; eventuale rifinitura successiva.
- Cestino per i contenuti Meta (questa feature è blog-scoped; il campo `deletedAt` è generico su `GeneratedContent` e riusabile in futuro).
- Bulk trash/restore (per-riga singolo per ora).
