# Articolo blog "ricco": card prodotto a metà + area evolutiva finale — design

**Data:** 2026-07-01
**Progetto:** AGOCAP Content AI Hub
**Modulo:** Blog (`src/lib/blog/*`, `src/app/blog/[id]/page.tsx`, publishing Shopify)

## Contesto e problema

Gli articoli blog generati (payload con `corpoHtml` semantico, `puntiChiave`, `faq`, `cta`, `prodotti`) vengono mostrati grezzi in anteprima (`/blog/[id]` rende `corpoHtml` con `dangerouslySetInnerHTML`) e pubblicati su Shopify quasi identici. Mancano: una **veste grafica** curata, un **blocco prodotto** cliccabile e — soprattutto — un'**area finale di prodotti correlati** ("area evolutiva") in stile store. Le immagini prodotto generate da AI erano infedeli: nel corpo vanno usate le **immagini reali** del catalogo Shopify.

L'output deve essere **identico in anteprima in-app e in pubblicazione** (un unico assemblatore), con **CSS inline + un blocco `<style>` scoped** (Shopify accetta `<style>` nel corpo articolo) per gli effetti dinamici (hover, transizioni, fade-in) che lo stile inline non può esprimere.

## Decisioni di design (confermate)

1. **Posizione:** card del **prodotto principale** (collegato all'idea) **a metà** articolo + **area evolutiva finale** "Prodotti consigliati per questo articolo".
2. **Selezione area finale:** altri **prodotti attivi della stessa categoria** del prodotto dell'idea (cap **3**), **escluso** il principale (già a metà).
3. **Testi card:** dai **dati prodotto dello store** — `nome`, `descrizione`, e bullet "Ideale se cerchi" da `benefici` (≤3 righe).
4. **Immagini:** **reali del catalogo** (CDN Shopify, `imageUrl` per `handle`); testata slim = immagine generata (data-URI al publish, asset in anteprima).
5. **Stile:** palette store — card bianche, bordo `#e7f2ef`, box immagine `#f8fbfa`, bottone `#a9d9cb` (hover `#8fccba`), testo ink `#2b3d4e` / muted `#566b7a`.
6. **Dinamicità:** blocco `<style>` scoped (classi `.ag-*`) con hover-lift card, zoom immagine, hover bottoni, fade-in in sequenza.

## Architettura

### 1. Risoluzione card — `src/lib/blog/product-cards.ts` (puro, testabile)

```ts
export interface ProductCard { nome: string; descrizione: string; bullets: string[]; url: string; imageUrl: string | null }
export interface ProductCards { main: ProductCard | null; related: ProductCard[] }
export interface ProductRec { nome: string; descrizione?: string | null; benefici?: string | null; handle?: string | null; url?: string | null; categoria?: string | null }

/** Spezza `benefici` in max `cap` bullet (per riga o per ; / . ), scartando i vuoti. */
export function benefitsToBullets(benefici: string | null | undefined, cap?: number): string[]

/** Costruisce le card: main dal prodotto dell'idea, related dagli altri della stessa categoria
 *  (cap 3, escluso il main per handle). imageUrl/url risolti da `shopifyByHandle`. */
export function buildProductCards(args: {
  main: ProductRec | null;
  sameCategory: ProductRec[];
  shopifyByHandle: Record<string, { imageUrl: string | null; url: string }>;
  cap?: number; // default 3
}): ProductCards
```
- `benefitsToBullets`: split su `\n` / `;` / `•` / `. ` , trim, filtra vuoti, taglia a `cap` (default 3).
- `buildProductCards`: `related` = `sameCategory` escluso il main (per `handle`), primi `cap`; per ogni `ProductRec` mappa `imageUrl`/`url` da `shopifyByHandle[handle]` (fallback `url` = `rec.url ?? ""`, `imageUrl` = `null`).

### 2. Assemblatore HTML — `src/lib/blog/article-html.ts` (puro, testabile)

```ts
export interface AssembleOpts { headerSrc?: string | null; cards?: import("./product-cards").ProductCards }
export function assembleArticleHtml(payload: BlogPayloadLike, opts: AssembleOpts): string
```
Produce, nell'ordine:
1. **`<style>` scoped** (`buildStyleBlock()`): le classi `.ag-*` (valori esatti dal mockup v3): `.ag-article`, `.ag-header`, `.ag-lead`, `.ag-summary`, `.ag-grid`, `.ag-card` (+ `:hover` translateY(-6px) e ombra), `.ag-imgwrap img` (+ `:hover` scale 1.05), `.ag-btn` (+ `:hover` `#8fccba`), `.ag-mid`/`.ag-midcard`/`.ag-pill`, `.ag-final`, `.ag-fade` + `@keyframes agfade`.
2. **`<article class="ag-article">`** contenente:
   - testata slim `<img class="ag-header" src=headerSrc>` (solo se `headerSrc`),
   - box **"In sintesi"** dai `puntiChiave` (se presenti),
   - **`corpoHtml`** con la **card principale iniettata a metà** (`injectAtMidpoint(corpoHtml, buildMainCardHtml(cards.main))` — solo se `cards.main`),
   - **FAQ** dai `faq` (se presenti),
   - **CTA** dalla `cta` (se presente),
   - **area finale** `buildRelatedArea(cards.related)` (solo se `related.length > 0`).

Helper puri: `buildStyleBlock`, `buildSlimHeader`, `buildSummary`, `buildMainCardHtml`, `buildRelatedArea`, `buildProductCardHtml`, `injectAtMidpoint`, `escapeHtml`.
- `injectAtMidpoint(html, block)`: inserisce `block` dopo il tag di chiusura block-level (`</p>`,`</h2>`,`</h3>`,`</ul>`,`</ol>`,`</blockquote>`) più vicino alla metà dei caratteri; se non trovato, appende in fondo.
- `escapeHtml`: applicato a **tutti** i testi provenienti dai dati (nome/descrizione/bullets/alt) per non rompere il markup; gli `href`/`src` (URL Shopify) non vengono alterati oltre l'escape delle virgolette.
- `buildProductCardHtml(card)`: markup card = quello del mockup v3 (`.ag-card` > `.ag-imgwrap` img + h3 nome + p descrizione + "Ideale se cerchi:" con `bullets.join("<br>")` preceduti da "✓ " + `.ag-btn` "Scopri {nome}"). Se `imageUrl` null → salta il blocco immagine.

### 3. Schema payload — `src/lib/blog/schema.ts`

Aggiungere campo opzionale al `blogArticleSchema`:
```ts
productCards: z.object({
  main: z.object({ nome: z.string(), descrizione: z.string(), bullets: z.array(z.string()), url: z.string(), imageUrl: z.string().nullable() }).nullable(),
  related: z.array(z.object({ nome: z.string(), descrizione: z.string(), bullets: z.array(z.string()), url: z.string(), imageUrl: z.string().nullable() })),
}).optional(),
```
(Claude non lo genera; lo popola il runtime dopo la generazione.)

### 4. Risoluzione e salvataggio — `src/lib/blog/runtime.ts`

Nella `persist` (o in un passo dedicato dopo `callClaude`), risolvere e iniettare `productCards` nel payload salvato:
- `main` = `Product` dell'idea (`idea.productId`) → `ProductRec`.
- `sameCategory` = `prisma.product.findMany({ where: { categoria: <main.categoria>, attivo: true, NOT: { id: main.id } } })` (se `main` ha categoria).
- `shopifyByHandle` = mappa `handle → { imageUrl, url }` costruita da `fetchProductsWithMetafields()` (già caricato in `loadContext`; passarlo alla persist o rifetchare).
- `payload.productCards = buildProductCards({ main, sameCategory, shopifyByHandle })`.

Se non c'è prodotto collegato → `productCards` assente/`{ main: null, related: [] }` (l'articolo esce senza card).

### 5. Anteprima — `src/app/blog/[id]/page.tsx`

Sostituire il render grezzo:
```tsx
<article className="prose ..." dangerouslySetInnerHTML={{ __html: p.corpoHtml ?? "" }} />
```
con l'HTML assemblato:
```tsx
<div dangerouslySetInnerHTML={{ __html: assembleArticleHtml(p, { headerSrc: c.assets?.[0] ? `/api/assets/${c.assets[0].id}` : null, cards: p.productCards }) }} />
```
(Il tipo del payload nella pagina va esteso con `productCards`.)

### 6. Pubblicazione — `src/lib/blog/publish.ts` (+ deps in `blog/runtime.ts`/route)

- `loadContent` (deps del publish) espone anche `payload` completo (o `productCards`) e i byte della testata.
- Il corpo pubblicato: `bodyHtml = buildArticleBodyHtml(assembleArticleHtml(payload, { headerSrc: <data-URI slim>, cards: payload.productCards }), jsonLd)`.
- Testata slim = immagine generata rimpicciolita a banner (`sharp` → JPEG q78 → `data:image/jpeg;base64,…`), passata come `headerSrc`. **Non** si invia più `imageBase64` come featured image (niente hero del tema).

## Testing

Ambiente vitest = node → solo funzioni pure:
- `product-cards.test.ts`: `benefitsToBullets` (split multi-separatore, cap 3, vuoto → `[]`); `buildProductCards` (esclude il main dai related per handle, cap 3, mappa imageUrl/url da shopifyByHandle, main null gestito).
- `article-html.test.ts`: emette il blocco `<style>` con `.ag-card:hover`; testata solo con `headerSrc`; card principale iniettata a metà (non spezza tag) con link `/products/{handle}`; area finale con N card e link corretti; niente card se `cards` assente; `escapeHtml` neutralizza `<`/`"` nei testi prodotto; contiene il `corpoHtml` originale.

Anteprima, runtime, publish verificati con `npx tsc --noEmit` + smoke: `/blog/[id]` mostra articolo stilizzato con card; il body inviato al publish contiene `.ag-final` e i link `/products/{handle}`.

## File

- **Nuovi:** `src/lib/blog/product-cards.ts`(+test), `src/lib/blog/article-html.ts`(+test)
- **Modificati:** `src/lib/blog/schema.ts` (`productCards` opzionale), `src/lib/blog/runtime.ts` (risolve+salva le card; espone header bytes/payload al publish), `src/app/blog/[id]/page.tsx` (anteprima assemblata), `src/lib/blog/publish.ts` (+ deps: assembla al publish, testata data-URI, no featured image)

## Fuori scope

- Guardrail anti-competitor (feature B, separata).
- Bullet/descrizione generati dall'AI per-articolo (scelto: dati store).
- Selezione correlati via AI (scelto: stessa categoria).
- Rimozione dei file mockup `public/blog-article-sample.html` e `public/blog-sample-v3.html` (verranno eliminati a fine feature; non fanno parte del prodotto).
