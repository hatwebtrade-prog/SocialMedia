# AGOCAP Content AI Hub — Spec di Design: Generatore Blog (bozze articoli SEO/GEO)

- **Data:** 2026-06-23
- **Sotto-progetto:** Generatore Blog Shopify — **solo generazione bozze** (fetta C, parte 3)
- **Dipende da:** Brain (Idea), Meta (`GeneratedContent`/`GeneratedAsset`, workflow stati, modulo `image/`), Sorgente SEOZoom (`fetchKeywords`)
- **Stato:** Design approvato in brainstorming, in attesa di review utente

---

## 1. Contesto e scope

Genera **bozze di articoli per blog** SEO + GEO a partire da un'**idea approvata**, da rivedere e approvare
nel portale. L'articolo include: struttura GEO (heading, key takeaways, FAQ, paragrafi citabili), **riferimenti
a prodotti Agocap pertinenti** (con CTA + link) ricavati dai **metafield Shopify**, un'**immagine in evidenza**
(OpenAI) e il **JSON-LD** (Article + FAQPage) costruito in codice. Keyword data-driven: secondarie da **SEOZoom**
se l'idea ha una keyword, altrimenti proposte da Claude.

**In scope:** pipeline di generazione (idea → articolo + immagine → bozza `GeneratedContent` canale BLOG),
lettura **read-only** di prodotti+metafield da Shopify, dati SEO, JSON-LD, UI lista/dettaglio articolo +
workflow stati (riuso Meta).

**Fuori scope (fette successive):**
- **Calendario editoriale** (vedere i contenuti approvati/confermati e assegnare la data → `PROGRAMMATO`).
- **Pubblicazione automatica via n8n** (n8n legge la programmazione e pubblica su Shopify/social). Il nostro
  programma **non** scrive su Shopify in questa fetta: lo usa solo in **lettura** (prodotti/metafield).
- TikTok; GSC/Trends.

### Vincoli
- Da **idea APPROVATA** (stesso pattern idea→genera di Meta).
- Shopify **sola lettura** ora (prodotti+metafield); scrittura/pubblicazione = n8n (fetta D).
- Keyword secondarie: SEOZoom se `idea.keyword` presente, altrimenti Claude.
- Provider isolati e **fail-safe**; passi esterni non essenziali **degradano** (vedi §8): SEOZoom KO → keyword
  da Claude; Shopify prodotti KO → articolo senza riferimenti prodotto (loggato), non si blocca la generazione.
- UI italiano, codice inglese. Output strutturato = JSON guidato da prompt + zod (come Brain/Meta).

---

## 2. Stack — aggiunte

| Cosa | Tecnologia | Note |
|---|---|---|
| Prodotti + metafield | **Shopify Admin API** (REST, sola lettura) | `X-Shopify-Access-Token`; dominio `e1ec06-4.myshopify.com` (da confermare live), versione API confermata live |
| Immagine in evidenza | modulo `image/` esistente (OpenAI `gpt-image-1`) | riuso |
| Keyword secondarie | `fetchKeywords` (SEOZoom `related`) esistente | riuso |

Env nuove: `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ADMIN_TOKEN` (scope lettura prodotti/metafield), opz. `SHOPIFY_STORE_URL` (dominio pubblico per i link prodotto; default `https://<shop>`).

---

## 3. Modello dati

- `ContentFormat` += **`ARTICOLO`** (oltre a POST/CAROSELLO).
- `GeneratedContent` riusato: canale **BLOG**, formato **ARTICOLO**, status **BOZZA**, `payload` JSON, `assets`.
- **Payload BLOG:**
  ```
  {
    keywordPrincipale: string,
    keywordSecondarie: string[],
    intentoRicerca: string,
    titoloSeo: string,
    metaDescription: string,
    puntiChiave: string[],
    corpoHtml: string,                 // HTML con struttura GEO
    faq: [{ domanda: string, risposta: string }],
    cta: string,
    prodotti: [{ handle: string, titolo: string, url: string }],
    jsonLd: string                     // Article + FAQPage, costruito in codice
  }
  ```
- I campi `shopifyArticleId`/`shopifyArticleUrl` NON sono in questa fetta (arriveranno con la pubblicazione n8n).

---

## 4. Pipeline di generazione (`src/lib/blog/`)

Rispecchia Meta (deps iniettate, fail-safe single try/catch → `{status:"ERROR"}`):

1. **loadContext(ideaId)** — carica l'`Idea` (deve essere **APPROVATA**, altrimenti errore) con `keyword`,
   `volumeRicerca`, `difficolta`, `titolo`, `descrizione`, `category`; KB (`buildKbContext`); **prodotti+metafield
   da Shopify** (read-only) → sintesi compatta (nome, categoria, handle/url, metafield chiave: ingredienti,
   posologia, meccanismo_azione, problema/sintomi, descrizione_seo, faq_prodotto…).
2. **loadSeoData(idea)** — `keywordPrincipale` = `idea.keyword` o derivata dal titolo; `keywordSecondarie` =
   SEOZoom `related` (top N) se `idea.keyword` presente, altrimenti `[]` (Claude le proporrà).
3. **callClaude** — `buildBlogPrompt(kbContext, idea, prodottiSummary, seoData)` → JSON articolo validato da
   `blogArticleSchema`. Claude sceglie i **prodotti pertinenti** dal catalogo fornito (con handle/url) e scrive
   CTA+link; se `keywordSecondarie` vuote, le propone lui ed echeggia quelle finali.
4. **buildArticleJsonLd(payload)** — funzione pura → stringa JSON-LD (Article + FAQPage) inserita in `payload.jsonLd`.
5. **generateImage** — riuso modulo `image/`: prompt dall'articolo (titoloSeo) → OpenAI → `saveAssetFile` →
   dati per `GeneratedAsset`.
6. **persist** — crea `GeneratedContent` (BLOG/ARTICOLO/BOZZA, payload completo, prompt/modello/token) +
   `GeneratedAsset` (immagine in evidenza). Ritorna `{ contentId }`.

```
idea APPROVATA
  → loadContext (idea + KB + prodotti/metafield Shopify)
  → loadSeoData (keyword principale + secondarie SEOZoom|—)
  → Claude → articolo {titoloSeo, metaDescription, corpoHtml(GEO), puntiChiave, faq, cta, prodotti[]}
  → JSON-LD (Article+FAQPage) in payload
  → immagine OpenAI → asset
  → persist GeneratedContent BLOG/ARTICOLO BOZZA (+asset)
  → compare nella lista Blog (da rivedere/approvare)
```

---

## 5. Modulo Shopify (sola lettura) `src/lib/shopify/`

- `fetchProductsWithMetafields(): Promise<ShopProduct[]>` — Admin API: prodotti + relativi metafield;
  `ShopProduct = { handle, titolo, url, categoria?, metafields: Record<string,string> }`.
- **Normalizer** `normalizeProducts(raw)` — isola il formato Admin API; `url` = `${storeUrl}/products/${handle}`.
  *(Endpoint/versione/shape e dominio confermati dal vivo, come fatto per SEOZoom; il normalizer è l'unico punto
  che conosce il formato.)*
- Solo lettura: nessuna scrittura/pubblicazione qui.

---

## 6. Schema + prompt articolo (`src/lib/blog/schema.ts`, `prompt.ts`)

- `blogArticleSchema` (zod): `keywordPrincipale`, `keywordSecondarie[]`, `intentoRicerca`, `titoloSeo`,
  `metaDescription` (≤ ~160), `puntiChiave[]`, `corpoHtml`, `faq[{domanda,risposta}]`, `cta`,
  `prodotti[{handle,titolo,url}]`.
- `buildBlogPrompt` — include KB (tono), idea, **catalogo prodotti+metafield** (per scelta pertinente e CTA con
  link veri), dati SEO (keyword principale + eventuali secondarie), e le istruzioni GEO (heading gerarchici,
  blocco "punti chiave", FAQ, paragrafi citabili e fattuali). JSON-only → strip fence → zod.

## 7. JSON-LD (`src/lib/blog/jsonld.ts`)
- `buildArticleJsonLd({ titoloSeo, metaDescription, faq, ... }): string` — costruisce **Article** + **FAQPage**
  (schema.org) come stringa JSON. Pura e testata. Salvata in `payload.jsonLd` (la userà n8n in pubblicazione).

---

## 8. Gestione errori (fail-safe + degrade)
- Idea non trovata / non APPROVATA → ERROR (no creazione).
- **SEOZoom KO** (`loadSeoData`) → degrada: `keywordSecondarie = []`, Claude le propone; generazione prosegue.
- **Shopify prodotti KO** → degrada: genera senza riferimenti prodotto (loggato); l'articolo si crea comunque.
- **Claude / immagine OpenAI KO** → ERROR (questi sono essenziali alla bozza): nessun contenuto parziale.
- Provider isolati; chiavi mancanti → errore esplicito del rispettivo provider.

---

## 9. API
| Metodo | Endpoint | Scopo |
|---|---|---|
| POST | `/api/blog/generate` | body `{ ideaId }` → pipeline → `{ status, contentId?, error? }` (502 su ERROR) |
| GET | `/api/blog/contents` | lista `GeneratedContent` canale BLOG (filtri stato) |
| GET | `/api/blog/contents/[id]` | dettaglio |
| PATCH | `/api/blog/contents/[id]` | aggiorna `status` (BOZZA→DA_APPROVARE→APPROVATO…) — riuso pattern Meta |

Seam deps-registry come Meta/Brain (route esporta solo handler HTTP).

## 10. UI
- **Lista Blog** (`/blog`): articoli BLOG con stato, link al dettaglio.
- **Dettaglio articolo** (`/blog/[id]`): anteprima `corpoHtml` renderizzato + immagine in evidenza + meta
  (titoloSeo, metaDescription, keyword) + prodotti (CTA/link) + FAQ + (collassato) JSON-LD; azioni di **stato**.
- **"Genera articolo blog"**: azione da un'idea APPROVATA (come il flusso Meta) → chiama `/api/blog/generate`.
- Voce **nav** "Blog".

---

## 11. Testing
Unit (nessuna chiamata reale):
- `blogArticleSchema` (accetta articolo valido; rifiuta faq/prodotti malformati).
- `buildBlogPrompt` (include KB, prodotti, dati SEO, istruzioni GEO, JSON-only).
- `buildArticleJsonLd` (Article+FAQPage ben formati; FAQ mappate).
- `normalizeProducts` (mappa un response Admin API di esempio → ShopProduct; url da handle; fetch mockato).
- Pipeline `generateBlogArticle` con deps mockate (Claude/SEOZoom/Shopify/image/persist): crea bozza con payload+jsonLd+asset; **degrade** (SEOZoom KO → secondarie vuote; Shopify KO → prodotti vuoti; run resta DONE); errori essenziali (Claude/immagine KO → ERROR).
- Route `/api/blog/generate` (seam deps; 400 input non valido; 502 su ERROR).

Smoke end-to-end con chiavi reali (Claude + OpenAI + Shopify lettura): `POST /api/blog/generate {ideaId}` su
un'idea APPROVATA → bozza BLOG creata con `corpoHtml`, immagine, prodotti reali (dai metafield) e `jsonLd`;
verifica nel dettaglio `/blog/[id]`.

---

## 12. Backlog di sviluppo (MVP)
1. Migrazione Prisma: `ContentFormat += ARTICOLO`.
2. Modulo Shopify lettura: `fetchProductsWithMetafields` + `normalizeProducts` (TDD sul normalizer; contratto Admin API confermato live).
3. `blogArticleSchema` + `buildBlogPrompt` (TDD).
4. `buildArticleJsonLd` (TDD, puro).
5. `loadSeoData` (keyword principale + secondarie SEOZoom/—) (TDD helper).
6. Pipeline `generateBlogArticle` (deps iniettate, fail-safe + degrade) (TDD con mock).
7. Runtime `buildBlogDeps` (loadContext con Shopify+KB, callClaude, image, persist) — wiring.
8. API `/api/blog/generate` + `/api/blog/contents` (+ `[id]`, PATCH stato) con seam (TDD route).
9. UI: lista `/blog`, dettaglio `/blog/[id]`, azione "Genera articolo blog" da idea approvata, nav.
10. Env/Docker: `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_STORE_URL`.
11. Test (unit + pipeline/route mockate).
12. Smoke end-to-end (Claude + OpenAI + Shopify lettura).

---

## 13. Roadmap (oltre questa fetta)
- **Calendario editoriale** unico (social + blog, distinti): vedere i contenuti approvati/confermati e
  **assegnare la data** (→ `PROGRAMMATO` + `dataPrevista`).
- **Pubblicazione automatica n8n**: n8n legge i `PROGRAMMATO` dal nostro API e pubblica su Shopify (blog,
  con `body_html` = corpoHtml + jsonLd, immagine) / social alla data; segna `PUBBLICATO` (+ `shopifyArticleId/Url`).
- TikTok; GSC/Trends come sorgenti.

---

## 14. Rischi
| Rischio | Impatto | Mitigazione |
|---|---|---|
| Contratto Admin API (prodotti/metafield shape, dominio, versione) | medio | normalizer isola il formato; conferma live; degrade se KO |
| Dominio `e1ec06-4.myshopify.com` da confermare | basso | verifica live; in caso, dominio reale da Impostazioni→Domini |
| Costo immagini OpenAI per articolo | basso | una immagine in evidenza per articolo, on-demand |
| `corpoHtml` lungo / HTML non sicuro | basso | render in anteprima controllato; sanificazione lato pubblicazione (n8n/futuro) |
| Link prodotto (dominio pubblico vs myshopify) | basso | `SHOPIFY_STORE_URL` configurabile; default dal dominio negozio |

---

## 15. Schema per iniziare
1. Approvazione spec. 2. Piano (writing-plans). 3. Build per task, review a due stadi. 4. Smoke con chiavi reali.

> Chiavi: `SHOPIFY_ADMIN_TOKEN` (+ Anthropic/OpenAI/SEOZoom) in `.env` (gitignored). Da rigenerare se esposte.
