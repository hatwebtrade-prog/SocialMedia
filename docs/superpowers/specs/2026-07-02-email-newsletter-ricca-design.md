# Newsletter ricca: paragrafi + immagini prodotto + cross-selling (email-safe) — design

**Data:** 2026-07-02
**Progetto:** AGOCAP Content AI Hub
**Modulo:** Email (`src/lib/email/*`, `src/app/email/[id]/page.tsx`), `src/lib/shopify/products.ts`

## Contesto e problema

L'area Email genera newsletter (`emailSchema`: oggetto, preheader, corpoHtml, cta, prodotti) da un'idea approvata, con lo stesso schema del blog. Oggi il corpo è HTML "nudo" senza immagini prodotto né sezione di cross-selling. L'utente vuole newsletter **divise in paragrafi** con **2-3 immagini reali del prodotto** in considerazione intervallate, più una sezione di **cross-selling** di altri prodotti del sito (con link alla pagina prodotto). Solo generazione HTML (nessun invio): l'HTML si copia in un ESP (Mailchimp ecc.).

Vincolo email: i client (Gmail/Outlook) non supportano in modo affidabile `<style>`/hover/animazioni. Serve **HTML email-safe: stili inline + layout a tabella**. (Diverso dal blog, che gira su Shopify e può usare `<style>`.)

## Decisioni di design (confermate)

1. **Immagini nei paragrafi:** 2-3 **foto reali** della galleria Shopify del prodotto dell'idea (no AI).
2. **Cross-sell:** prodotti attivi della **stessa categoria** del prodotto dell'idea (auto, come il blog), immagine + link.
3. **Invio:** nessuno — solo generazione HTML, con un pulsante "Copia HTML".

## Architettura

### Dati Shopify — `src/lib/shopify/products.ts`

- Estendere la query GraphQL dei prodotti per includere la galleria: `images(first: 3) { edges { node { url } } }`.
- Aggiungere `images: string[]` all'interfaccia `ShopProduct` e mapparlo in `normalizeProducts` (array di URL, eventualmente vuoto). `imageUrl` (featuredImage) resta invariato per le card cross-sell.
- Retro-compatibile: il blog usa `ShopProduct` ma ignora `images`.

### Assemblatore `src/lib/email/email-html.ts` (puro, testabile)

```ts
export interface EmailPayloadLike { corpoHtml?: string; cta?: string }
export interface CrossSellItem { nome: string; url: string; imageUrl: string | null }
export interface EmailBlocks { productImages: string[]; crossSell: CrossSellItem[] }
export function assembleEmailHtml(payload: EmailPayloadLike, blocks: EmailBlocks): string;
export function escapeHtml(s: string): string;
```
`assembleEmailHtml` produce HTML **email-safe** (stili inline, `<table>` per layout, larghezza max ~600px, immagini `max-width:100%`):
- `corpoHtml` **spezzato in paragrafi** (`splitParagraphs`: separa sui blocchi `</p>`/`<br><br>`/newline doppio) con le **2-3 `productImages` intervallate** (`injectImagesBetweenParagraphs`: un'immagine ogni ~⌈N_paragrafi / (N_img+1)⌉ paragrafi, centrata in una riga di tabella);
- sezione **"Ti potrebbero interessare"** dalla lista `crossSell`: per ogni item una card a tabella con immagine (se presente) + nome + link `<a href={url}>Scopri →` con stile bottone inline; omessa se `crossSell` vuoto;
- **CTA** finale (se presente) come bottone inline.
Helper puri: `escapeHtml` (applicato a tutti i testi/URL/alt), `emailImage(src, alt)`, `crossSellTable(items)`, `splitParagraphs(html)`, `injectImagesBetweenParagraphs(paragraphs, images)`.

### Risoluzione alla generazione — `src/lib/email/runtime.ts`

In `buildEmailDeps().persist` (o subito dopo `callClaude`), risolvere e salvare i blocchi:
- prodotto dell'idea: `prisma.idea.findUnique({ include: { product: true } })` → `product`.
- `productImages`: da `fetchProductsWithMetafields()` trovare il prodotto per `handle` e prendere `images` (fino a 3); fallback `[imageUrl]` se la galleria è vuota ma c'è la featured; `[]` se nessuna.
- `crossSell`: prodotti attivi stessa categoria (`prisma.product.findMany where categoria=main.categoria, attivo:true, NOT id:main.id`, cap 3) → mappati a `CrossSellItem` risolvendo `imageUrl`/`url` da `fetchProductsWithMetafields` per handle (riuso `buildProductCards` del blog e ne estraggo `{nome,url,imageUrl}`).
- Salvare `payload.emailBlocks = { productImages, crossSell }`.
- Vale quando l'idea ha un prodotto collegato (indipendente dal `formato`). Il tutto in try/catch: se Shopify non risponde → `emailBlocks` con liste vuote, la newsletter esce comunque.

`src/lib/email/schema.ts`: aggiungere `emailBlocks` opzionale (`{ productImages: string[]; crossSell: { nome; url; imageUrl: string|null }[] }`) — Claude non lo genera, lo popola il runtime.

### Anteprima — `src/app/email/[id]/page.tsx`

- Rende `assembleEmailHtml(payload, payload.emailBlocks ?? { productImages: [], crossSell: [] })` (dangerouslySetInnerHTML) al posto/oltre al corpo grezzo.
- Pulsante **"Copia HTML"** che copia negli appunti (`navigator.clipboard.writeText`) l'HTML assemblato, per incollarlo nell'ESP. Feedback (toast/msg) su successo/fallimento.

## Testing

Ambiente vitest = node → solo funzioni pure. `src/lib/email/email-html.test.ts`:
- `splitParagraphs`/`injectImagesBetweenParagraphs`: 3 immagini intervallate tra i paragrafi, non più di quelle fornite, non spezzano tag;
- cross-sell: card per ogni item con link `/products/{handle}` (via url) e immagine; sezione omessa se lista vuota;
- nessuna immagine se `productImages` vuoto;
- `escapeHtml` neutralizza `<`/`"` in nomi/alt/testo;
- output email-safe: contiene `<table` e stili inline, NON contiene `<style`.

Shopify products (`images` nella query), runtime e pagina verificati con `npx tsc --noEmit`; smoke: genera una newsletter da un'idea con prodotto → anteprima con immagini prodotto + cross-sell; "Copia HTML" copia il markup.

## File

- **Nuovi:** `src/lib/email/email-html.ts` (+test)
- **Modificati:** `src/lib/shopify/products.ts` (`images` in query + normalize + tipo), `src/lib/email/schema.ts` (`emailBlocks` opzionale), `src/lib/email/runtime.ts` (risolve+salva i blocchi), `src/app/email/[id]/page.tsx` (anteprima assemblata + Copia HTML)
- **Riuso:** `buildProductCards` da `src/lib/blog/product-cards.ts` (cross-sell)

## Fuori scope

- Invio email / integrazione ESP (solo generazione + copia HTML).
- Immagini AI (si usano foto reali della galleria).
- Guardrail competitor nell'email (il modulo `competitors.ts` è riusabile in futuro, ma non in scope qui).
