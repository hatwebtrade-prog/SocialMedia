# Editorial OS — Area Email (generatore newsletter/promo/educational) — Design

- **Data:** 2026-06-24
- **Sotto-progetto:** Editorial OS — completamento aree: **Email generator**
- **Riferimento:** master (sez. 7, 11, 12)
- **Dipende da:** pattern generatore (Meta/Blog), Shopify read (`fetchProductsWithMetafields`), Brain (Idea + destinazioni)
- **Stato:** Design approvato in brainstorming, in attesa di review utente

---

## 1. Obiettivo
Rendere l'area **Email** funzionante: da un'idea approvata con destinazione **EMAIL**, generare contenuti email
(**Newsletter / Promo / Educational**) rivedibili e programmabili. L'**invio reale** (Klaviyo/n8n) resta alla
fase pubblicazioni — qui si produce il contenuto.

### Decisioni di brainstorming
- Tre formati: **NEWSLETTER**, **PROMO_EMAIL**, **EDUCAZIONALE**.
- Le **PROMO** collegano i **prodotti Agocap** via metafield Shopify (lettura), come il Blog.
- Nessuna immagine auto in MVP.

---

## 2. Modello dati
- `Canale` += **`EMAIL`** (oggi META/TIKTOK/BLOG).
- `ContentFormat` += **`NEWSLETTER`**, **`PROMO_EMAIL`**, **`EDUCAZIONALE`**.
- `src/lib/email/enums.ts`: `EMAIL_FORMATS = ["NEWSLETTER","PROMO_EMAIL","EDUCAZIONALE"] as const` + tipo.
- Migrazione `email_channel_formats` (additiva).
- Riuso `GeneratedContent` (canale EMAIL, formato = tipo email, status BOZZA→…, `payload`).

---

## 3. Payload email
```
{ oggetto: string, preheader: string, corpoHtml: string, cta: string, prodotti: [{handle,titolo,url}] }
```
`prodotti` valorizzato solo per **PROMO_EMAIL** (dai metafield Shopify); vuoto per newsletter/educational.

---

## 4. Pipeline (`src/lib/email/`)
Rispecchia Blog/Meta (deps iniettate, fail-safe):
1. **loadContext(ideaId, formato)** — Idea (deve essere **APPROVATA**) + KB; se `formato === PROMO_EMAIL`,
   **prodotti+metafield da Shopify** (read-only, **degrada** a [] se Shopify KO).
2. **callClaude({ kbContext, idea, formato, prodotti })** — `buildEmailPrompt` con tono per tipo:
   - NEWSLETTER: informativa/valore, sezioni, brand voice.
   - PROMO_EMAIL: orientata vendita, offerta, prodotti pertinenti con CTA/link reali.
   - EDUCAZIONALE: educazione su un tema, soft CTA.
   → JSON `emailSchema` validato zod.
3. **persist** — `GeneratedContent` canale EMAIL, formato, status BOZZA, payload, prompt/modello/token.

---

## 5. API
| Metodo | Endpoint | Scopo |
|---|---|---|
| POST | `/api/email/generate` | `{ ideaId, formato }` → pipeline → `{ status, contentId? }` (502 su ERROR) |
| GET | `/api/email/contents` | lista canale EMAIL (filtro stato) |
| GET/PATCH/DELETE | `/api/email/contents/[id]` | dettaglio / aggiorna stato / elimina |

Seam deps-registry come gli altri generatori.

---

## 6. UI
- **`/email`** (sostituisce placeholder): lista email (oggetto, idea, tipo, stato badge) + "Genera da idea".
- **`/email/genera`**: scegli idea APPROVATA con destinazione EMAIL (`GET /api/ideas?status=APPROVATA&destinazione=EMAIL`) + **formato** (Newsletter/Promo/Educational) → POST. Accetta `?ideaId`.
- **`/email/[id]`**: dettaglio (oggetto, preheader, anteprima `corpoHtml`, cta, eventuali prodotti) + workflow stati + badge pubblicazione (read-only).

---

## 7. Gestione errori / fuori scope
- Fail-safe (ERROR senza contenuto parziale); Shopify KO in promo → degrada (niente prodotti, loggato).
- Idea non APPROVATA → errore.
- **Fuori scope:** invio reale (Klaviyo/n8n) → fase Pubblicazioni; flussi Klaviyo; immagini.

---

## 8. Testing
Unit: `emailSchema` (valida; rifiuta oggetto/corpoHtml mancanti); `buildEmailPrompt` per i 3 tipi (tono + JSON; prodotti solo in promo); pipeline `generateEmail` con deps mockate (DONE; degrade Shopify in promo; ERROR su Claude). Route `/api/email/generate` (seam, 400/502). Gate tsc+build. Smoke: genero una NEWSLETTER e una PROMO (con prodotti reali) da idee approvate con destinazione EMAIL.

---

## 9. Backlog
1. Prisma: `Canale += EMAIL`, `ContentFormat += NEWSLETTER/PROMO_EMAIL/EDUCAZIONALE`; `EMAIL_FORMATS`.
2. `emailSchema` + `buildEmailPrompt` (TDD).
3. Pipeline `generateEmail` (TDD) + runtime `buildEmailDeps` (loadContext+Shopify-se-promo, callClaude, persist).
4. API: validators + `/api/email/generate` + `/api/email/contents` (+[id]).
5. UI: `/email` lista, `/email/genera`, `/email/[id]`.
6. Gate + smoke.

---

## 10. Rischi
| Rischio | Impatto | Mitigazione |
|---|---|---|
| Nuovo canale/format enum | basso | additivi, non distruttivi |
| Shopify in promo | basso | degrade come nel Blog |
| corpoHtml email | basso | anteprima controllata; sanitizzazione lato invio (n8n/futuro) |
