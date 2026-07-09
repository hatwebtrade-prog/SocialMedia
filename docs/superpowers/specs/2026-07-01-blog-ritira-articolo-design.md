# Ritira articolo blog (elimina da Shopify, torna a bozza) — design

**Data:** 2026-07-01
**Progetto:** AGOCAP Content AI Hub
**Modulo:** Blog / Shopify publishing (`src/lib/blog/*`, `src/lib/shopify/publish.ts`, area Blog)

## Contesto e problema

Gli articoli blog generati dal gestionale vengono pubblicati su **Shopify** (`publishArticle` in `src/lib/shopify/publish.ts`), che crea un articolo live e ne salva `shopifyArticleId` + `shopifyArticleUrl` su `GeneratedContent`. Oggi non c'è modo di **rimuovere un articolo già pubblicato**: esiste solo un `DELETE /api/blog/contents/[id]` che cancella il record locale ma **NON tocca Shopify** (l'articolo resterebbe live). Serve un'azione che elimini l'articolo su Shopify e riporti il contenuto a bozza, così lo si può correggere e ripubblicare (utile ad es. per rimuovere un articolo che cita un competitor).

Vincolo dati: `GeneratedContent` salva `shopifyArticleId` ma **non** il `blogId`. La delete REST di Shopify (`DELETE /admin/api/{v}/blogs/{blog_id}/articles/{article_id}.json`) richiederebbe il blogId; la mutation **GraphQL `articleDelete(id)`** elimina col solo article id → è la via scelta (il progetto usa già GraphQL Admin, versione `2024-10`).

## Decisione di design (confermata)

**"Ritira e tieni bozza":** cancella l'articolo su Shopify **e** riporta il `GeneratedContent` a `BOZZA` (rimuove pubblicazione e riferimenti Shopify), mantenendo il contenuto per correzione/ripubblicazione. NON è un hard-delete del record locale.

## Architettura

### 1. Shopify layer — `src/lib/shopify/publish.ts`

Nuova funzione:
```ts
export async function deleteArticle(articleId: string): Promise<{ ok: boolean; notFound: boolean }>
```
- Chiama la mutation GraphQL Admin:
  ```graphql
  mutation { articleDelete(id: "gid://shopify/Article/<articleId>") { deletedArticleId userErrors { field message } } }
  ```
  (endpoint `https://{shop}/admin/api/{version}/graphql.json`, header `X-Shopify-Access-Token`).
- Se `deletedArticleId` presente → `{ ok: true, notFound: false }`.
- Se `userErrors` indica articolo inesistente/non trovato (già cancellato) → `{ ok: true, notFound: true }` (trattato come successo idempotente).
- Se HTTP non ok o altri `userErrors` → lancia `Error` con il messaggio.

Riusa `cfg()` esistente per shop/token/version.

### 2. Logica di ritiro — `src/lib/blog/retire.ts` (orchestrazione pura + deps, come `publish.ts`)

```ts
export interface RetireInput { contentId: string }

export interface RetireDeps {
  loadArticleRef: (contentId: string) => Promise<{ shopifyArticleId: string | null } | null>;
  deleteShopifyArticle: (articleId: string) => Promise<{ ok: boolean; notFound: boolean }>;
  persistRetired: (contentId: string) => Promise<void>;
  persistError: (contentId: string, error: string) => Promise<void>;
}

export interface RetireResult { status: "DONE" | "ERROR"; error?: string }

export async function retireBlogContent(input: RetireInput, deps: RetireDeps): Promise<RetireResult>
```

Flusso:
1. `ref = await loadArticleRef(contentId)`. Se `null` → `{ status: "ERROR", error: "Contenuto non trovato" }`.
2. Se `ref.shopifyArticleId` presente:
   - `try { await deleteShopifyArticle(ref.shopifyArticleId) }` (non usa il valore di ritorno oltre a "non ha lanciato"; `notFound` è trattato ok dentro `deleteArticle`).
   - `catch (err)` → `await persistError(contentId, msg)`; `return { status: "ERROR", error: msg }`. **Niente ritiro locale** (Shopify potrebbe avere ancora l'articolo → si resta coerenti).
3. `await persistRetired(contentId)`.
4. `return { status: "DONE" }`.

Se `ref.shopifyArticleId` è `null` (contenuto non pubblicato): si salta lo step Shopify e si esegue comunque `persistRetired` (idempotente: riporta/mantiene BOZZA) → DONE.

### 3. Route — `src/app/api/blog/contents/[id]/retire/route.ts`

`POST` handler:
- Costruisce le deps concrete (nuova `buildRetireDeps()` o inline con prisma + `deleteArticle`):
  - `loadArticleRef`: `prisma.generatedContent.findUnique({ where: { id }, select: { shopifyArticleId: true } })`.
  - `deleteShopifyArticle`: `deleteArticle` (Shopify layer).
  - `persistRetired`: `prisma.generatedContent.update({ where: { id }, data: { status: "BOZZA", publicationStatus: "NON_INVIATO", publishedAt: null, shopifyArticleId: null, shopifyArticleUrl: null, publicationError: null } })`.
  - `persistError`: `prisma.generatedContent.update({ where: { id }, data: { publicationError: <msg> } })`.
- Esegue `retireBlogContent({ contentId: id }, deps)`.
- Risponde `NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 })`.

### 4. UI — `src/app/blog/[id]/page.tsx`

Nel blocco "Pubblicazione" (dove oggi si mostra `StatusBadge` + link "apri su Shopify"), aggiungere un pulsante **"Ritira dalla pubblicazione"** visibile quando `c.publicationStatus === "PUBBLICATO"`:
- `onClick` → `window.confirm("Ritirare l'articolo? Verrà eliminato l'articolo live su Shopify e il contenuto tornerà in BOZZA.")`; se confermato, `POST /api/blog/contents/${id}/retire`.
- Guard `res.ok` + messaggio (riusa lo stato `pubMsg`/`setPubMsg` o un nuovo stato); su successo `await load()` (lo stato torna BOZZA, il pulsante sparisce, il link Shopify sparisce).
- Stato `busy` per disabilitare il pulsante durante la chiamata.

## Testing

Ambiente vitest = node → solo funzioni pure. `src/lib/blog/retire.test.ts` con deps mockate:
- content assente (`loadArticleRef` → null) → `{ status: "ERROR" }`, nessuna chiamata a delete/persist.
- delete Shopify lancia errore reale → `persistError` chiamato, `persistRetired` NON chiamato, `{ status: "ERROR" }`.
- happy path (con `shopifyArticleId`) → `deleteShopifyArticle` chiamato con l'id, poi `persistRetired`, `{ status: "DONE" }`.
- senza `shopifyArticleId` → `deleteShopifyArticle` NON chiamato, `persistRetired` chiamato, `{ status: "DONE" }`.

`deleteArticle` (Shopify, usa fetch/env) e la route sono verificati con `npx tsc --noEmit` + smoke manuale (ritira un articolo di prova pubblicato → sparisce da Shopify, torna BOZZA nel gestionale).

## File

- **Nuovi:** `src/lib/blog/retire.ts`, `src/lib/blog/retire.test.ts`, `src/app/api/blog/contents/[id]/retire/route.ts`
- **Modificati:** `src/lib/shopify/publish.ts` (aggiunge `deleteArticle`), `src/app/blog/[id]/page.tsx` (pulsante "Ritira dalla pubblicazione")

## Rischio noto

La mutation GraphQL `articleDelete` è disponibile nelle versioni Shopify recenti (usiamo `2024-10`). In implementazione va verificata con uno smoke: ritirare un articolo di prova e confermare che sparisce da Shopify. Se non disponibile nella versione configurata, il fallback è la REST `DELETE /blogs/{blogId}/articles/{articleId}.json`, che richiederebbe di **salvare il `blogId` alla pubblicazione** (colonna extra + modifica al publish) — passo aggiuntivo non previsto ora perché ci si aspetta GraphQL funzionante.

## Fuori scope

- Hard-delete del record locale (scelto "ritira e tieni bozza").
- Ripubblicazione automatica dopo il ritiro (manuale, riusa il flusso publish esistente).
- Guardrail anti-competitor (feature B, separata) e blocco prodotto + testata slim (feature A, separata).
