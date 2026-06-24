# Editorial OS — Pubblicazioni (Blog→Shopify diretto + endpoint n8n per Meta + area) — Design

- **Data:** 2026-06-24
- **Sotto-progetto:** Editorial OS — completamento aree: **Pubblicazioni**
- **Riferimento:** master (sez. 9, 10)
- **Dipende da:** GeneratedContent + campi pubblicazione (Fase 4), Blog (payload corpoHtml/jsonLd + asset immagine), Calendario (PROGRAMMATO/dataPrevista)
- **Stato:** Design approvato in brainstorming, in attesa di review utente

---

## 1. Obiettivo
Chiudere il loop di pubblicazione, **per canale**:
- **Blog → Shopify**: pubblicazione **diretta dal programma** (token Admin in scrittura).
- **Meta → n8n**: il programma **espone gli endpoint** che n8n consuma; il workflow n8n (generato a parte) pubblica su IG/FB e richiama gli endpoint. (Meta va live solo dopo l'app review — dipendenza utente.)
- **Email → Brevo**: diretto (fetta separata, dopo sblocco IP).
- **Area `/pubblicazioni`**: monitoraggio per stato tecnico di pubblicazione.

### Stato attuale
`GeneratedContent` ha già (Fase 4): `publicationStatus` (NON_INVIATO/INVIATO_A_N8N/IN_PUBBLICAZIONE/PUBBLICATO/ERRORE), `publicationError`, `publishedAt`, `shopifyArticleId`, `shopifyArticleUrl`. Shopify read module esiste (`fetchProductsWithMetafields`).

---

## 2. Blog → Shopify (pubblicazione diretta)
- **Modulo write** `src/lib/shopify/publish.ts` (REST Admin API, header `X-Shopify-Access-Token`):
  - `fetchBlogs()` → `GET /blogs.json` → `[{ id, title, handle }]`.
  - `publishArticle({ blogId, title, bodyHtml, tags, imageBase64?, published })` → `POST /blogs/{blogId}/articles.json`
    con `{ article: { title, body_html, tags, published, image?: { attachment } } }` → ritorna `{ id, handle }`.
- **Azione** `POST /api/blog/contents/[id]/publish` `{ blogId, published? }`:
  - costruisce `body_html` = `payload.corpoHtml` + `<script type="application/ld+json">payload.jsonLd</script>`;
  - allega l'immagine in evidenza (legge il file asset → base64);
  - chiama `publishArticle`; su successo aggiorna il contenuto: `status=PUBBLICATO`, `publicationStatus=PUBBLICATO`,
    `publishedAt`, `shopifyArticleId`, `shopifyArticleUrl` (= `${storeUrl}/blogs/{blogHandle}/{articleHandle}`).
  - errore Shopify → `publicationStatus=ERRORE` + `publicationError` (stato editoriale invariato).
- **UI** (dettaglio blog): se contenuto **APPROVATO**, sezione "Pubblica su Shopify" → scegli **blog** (da `fetchBlogs`) → **Pubblica** (default `published:false` = bozza Shopify, con opzione "pubblica subito").

> ⚠️ Lo smoke crea l'articolo come **bozza/unpublished** (`published:false`) per sicurezza.

---

## 3. Meta → endpoint per n8n
Endpoint protetti da header `x-webhook-secret: ${N8N_WEBHOOK_SECRET}` (401 se manca/errato):
- `GET /api/publications/due` → contenuti `status=PROGRAMMATO`, `dataPrevista <= now`, `publicationStatus ∈ {NON_INVIATO, ERRORE}` → `{ id, canale, formato, payload, assets, dataPrevista }` (tutto ciò che serve a n8n).
- `PATCH /api/publications/[id]/sent` → `publicationStatus = INVIATO_A_N8N`.
- `PATCH /api/publications/[id]/success` `{ url? }` → `publicationStatus = PUBBLICATO`, `status = PUBBLICATO`, `publishedAt`, eventuale url salvato.
- `PATCH /api/publications/[id]/error` `{ error }` → `publicationStatus = ERRORE`, `publicationError`.

> Il **workflow n8n** (Meta) lo genero/importo a parte via l'API n8n quando avrò l'**URL n8n**; pubblicherà solo dopo l'app review Meta.

---

## 4. Area `/pubblicazioni` (sostituisce placeholder)
- `GET /api/publications?publicationStatus=` → lista `GeneratedContent` (con idea/canale/titolo) filtrabile per stato tecnico.
- Vista con tab/filtro: **Programmati (da inviare) / Inviati a n8n / Pubblicati / Errori** + colonna canale, data, eventuale errore. Badge tecnici (riuso StatusBadge).

---

## 5. Config
- Riuso `SHOPIFY_SHOP_DOMAIN`/`SHOPIFY_ADMIN_TOKEN` (richiede **scope scrittura blog** — confermato "già in post") + `SHOPIFY_STORE_URL`.
- Nuovo `N8N_WEBHOOK_SECRET` (per gli endpoint pubblicazioni). Env + Docker.

---

## 6. Errori / sicurezza
- Publish Shopify fail-safe: errore → publicationStatus ERRORE, nessuno stato fasullo.
- Endpoint n8n: secret obbligatorio; input validati zod; P2025 → 404.
- ⚠️ Outward-facing: il publish Shopify scrive davvero → smoke come **bozza**.

---

## 7. Testing
- `src/lib/shopify/publish.ts`: builder del `body_html` (corpoHtml + JSON-LD) puro/testato; `fetchBlogs`/`publishArticle` verificati live (smoke, come bozza). 
- Endpoint pubblicazioni: route test con prisma mockato (secret ok/ko, due, success/error transizioni).
- `GET /api/publications` filtro.
Gate tsc+build. Smoke: pubblico un articolo blog APPROVATO su Shopify **come bozza** (verifico articolo creato + stato PUBBLICATO/Url); chiamo gli endpoint n8n con secret e verifico le transizioni; l'area `/pubblicazioni` mostra gli stati.

---

## 8. Backlog
1. `N8N_WEBHOOK_SECRET` env/docker + helper auth.
2. Shopify publish module `fetchBlogs` + `publishArticle` + `buildArticleBodyHtml` (TDD sul builder; live in smoke).
3. `POST /api/blog/contents/[id]/publish` (publish diretto + aggiorna campi) + deps seam (TDD route mock).
4. Endpoint n8n: `/api/publications/due`, `/[id]/sent`, `/[id]/success`, `/[id]/error` (TDD secret + transizioni).
5. `GET /api/publications` + area `/pubblicazioni` (vista per stato).
6. UI dettaglio blog: sezione "Pubblica su Shopify" (scegli blog + pubblica).
7. Gate + smoke (Shopify bozza + endpoint).

> Passo separato (dopo URL n8n): generare/importare il **workflow n8n Meta** via l'API n8n.

---

## 9. Rischi
| Rischio | Impatto | Mitigazione |
|---|---|---|
| Shopify scrive in produzione | alto | smoke come bozza (`published:false`); azione esplicita lato utente |
| Scope token Shopify (write blog) | medio | confermato "in post"; se manca, errore chiaro |
| Contratto REST blog/articoli/immagine | medio | builder puro testato; endpoint confermati live; modulo isolato |
| Meta dipende da app review | alto | endpoint pronti; workflow n8n preparato; va live quando l'accesso Meta è pronto |
| URL pubblico articolo (handle blog) | basso | da `fetchBlogs` (handle) + handle articolo dalla risposta |
