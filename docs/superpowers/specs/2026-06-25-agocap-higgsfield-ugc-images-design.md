# Higgsfield UGC Images — Design (sotto-progetto 1)

- **Data:** 2026-06-25
- **Contesto:** AGOCAP Content AI Hub — generazione immagini. Higgsfield "legge male" i prompt perché NON è prompt-driven come GPT/Gemini: è **preset/style-driven**. Va pilotato in modo dedicato.
- **Stato:** Design approvato dall'utente in brainstorming.
- **Sotto-progetto 2 (separato):** Higgsfield video (image-to-video con motion preset) per TikTok/Reels — spec successiva.

---

## 1. Obiettivo
Far produrre a Higgsfield immagini **UGC super-realistiche** (look autentico phone/selfie), usando il suo meccanismo nativo: **stile (style_id) + prompt corto positivo in inglese**, con il prodotto come riferimento. GPT/Gemini restano invariati (gestiscono bene i prompt ricchi e l'image-edit pixel-fedele del mockup).

## 2. Ricerca Higgsfield (verificata dal vivo, da preservare)
- Auth generazione: header `Authorization: Key {HIGGSFIELD_API_KEY}:{HIGGSFIELD_API_SECRET}`. Auth v1 (upload/liste): header `hf-api-key` + `hf-secret`.
- **Generazione Soul (v1, style-driven):** `POST https://platform.higgsfield.ai/v1/text2image/soul` con body `{ "params": { prompt, width_and_height, style_id, quality } }`.
  - `prompt` (richiesto) — breve, positivo, **inglese**, niente negazioni.
  - `width_and_height` (richiesto) enum: `1152x2048`,`2048x1152`,`2048x1536`,`1536x2048`,`1344x2016`,`2016x1344`,`960x1696`,`1536x1536`,`1536x1152`,`1696x960`,`1152x1536`,`1088x1632`,`1632x1088`,`1120x1680`,`1680x1120`,`2048x2048`. Default UGC verticale **`1152x2048`**; quadrato **`1536x1536`**.
  - `style_id` (UUID) — uno dei 106 stili Soul.
  - `quality` enum: `720p`|`1080p` → default `1080p`.
  - (opzionali, da SDK: `custom_reference_id`, `custom_reference_strength`, `batch_size`, `seed`.)
- **Stili:** `GET /v1/text2image/soul-styles` (auth hf-api-key/hf-secret) → 106 stili `{id,name,description,preview_url}`. Stili UGC reali: Realistic, iPhone, 0.5 Selfie, DigitalCam, RingSelfie, Elevator Mirror, Street view, Tokyo Streetstyle, 2000s Cam, afterparty cam, ecc.
- **Riferimento soggetto/prodotto (SoulId):** `POST /v1/custom-references` con `{name, input_images:[{type:"image_url", image_url}]}` → SoulId async (`status: not_ready→queued→in_progress→completed`); poi in generazione `custom_reference_id` + `custom_reference_strength`.
- **Upload immagine (presigned S3):** `POST /files/generate-upload-url` (hf-api-key/hf-secret) `{content_type:"image/png"}` → `{upload_url, public_url}`; poi `PUT {upload_url}` byte (content-type image/png); usare `public_url`.
- **Risposta async generazione:** POST → `{status:"queued", request_id, status_url}`; poll `GET {status_url}` (auth `Authorization: Key …`) fino a `status:"completed"` → `images[0].url`; scaricare. Stati: queued/in_progress/completed/failed/nsfw/canceled.
- **Reference v2 alternativo:** `POST /higgsfield-ai/soul/reference` con `input_images:[{type:"image_url",image_url}]` (già funzionante, ma senza style_id). Il path **v1** è quello con gli stili.

## 3. Componenti

### 3.1 Modulo Higgsfield (riscrittura `src/lib/image/providers/higgsfield.ts`)
- `listSoulStyles(): Promise<SoulStyle[]>` — GET soul-styles (hf-api-key/hf-secret), normalizza a `{id,name,previewUrl}`. Cache in-memory (lista quasi statica).
- `higgsfieldImage(prompt, mockup?, opts?)` dove `opts = { styleId?: string }`:
  - `POST /v1/text2image/soul` con `params:{ prompt, width_and_height (default 1152x2048 o 1536x1536), style_id (opts.styleId ?? default UGC "iPhone"/"Realistic"), quality:"1080p" }`.
  - Se `mockup`: ottieni un riferimento prodotto (vedi 3.3) e aggiungi `custom_reference_id` (+ strength) **oppure** input_images, secondo l'esito della verifica in 3.3.
  - Poll dello `status_url` (riusa la logica esistente) → download.
- Mantengo upload presigned (`uploadToHiggsfield`) per ottenere `public_url` quando serve un'immagine ospitata.

### 3.2 Prompt director (inglese, UGC, positivo)
- `buildHiggsfieldPrompt(ideaCreativa, slideText?, productName?): Promise<string>` — usa Claude (`claude-opus-4-8`, prompt-enforced) per produrre una **descrizione fotografica UGC breve in inglese** (1-2 frasi, positiva, niente negazioni, niente parole "slide/collage/text"). Es. output: *"casual iPhone selfie of a young woman holding a magnesium supplement bottle in a bright kitchen, natural daylight, authentic candid vibe"*.
- Fail-safe: se Claude non risponde, fallback deterministico = `ideaCreativa` tradotto minimale/usato così com'è, troncato e ripulito (niente negazioni). Mai bloccante.
- Per GPT/Gemini si continua a usare `buildImagePrompt` attuale (prompt ricco italiano). Il director è **specifico Higgsfield**.

### 3.3 Riferimento prodotto (fedeltà mockup) — da confermare in build
- Approccio primario: **SoulId per prodotto**, in cache. Nuovo campo `Product.higgsfieldSoulId String?`. Flusso: se il prodotto non ha un SoulId → crea via `/v1/custom-references` dal mockup (upload → public_url → create → poll completed) → salva l'id; in generazione passa `custom_reference_id` + `custom_reference_strength`.
- ⚠️ Verifica in build: quanto fedelmente Soul mantiene un **packaging prodotto** (SoulId è pensato soprattutto per volti/soggetti). Se la fedeltà è scarsa, fallback a **input_images** sul path reference; se nessuno dei due tiene il packaging, documentare che per il prodotto **pixel-perfect** si usa GPT image-edit, e Higgsfield resta per il look UGC.

### 3.4 API + UI
- `GET /api/higgsfield/soul-styles` → ritorna gli stili (cache). 502 su errore (degrade a lista vuota lato UI).
- `imageInputSchema` += `styleId?: string` (passato alla generazione Higgsfield). Le route Meta/Blog image inoltrano `styleId`.
- UI Meta `/meta/[id]` e Blog `/blog/[id]`: quando `provider === "HIGGSFIELD"`, mostra un **selettore stile** (carica `/api/higgsfield/soul-styles`, mostra nome + anteprima, ricercabile). `styleId` inviato nella generazione. Il blocco prodotto + spunta resta. Per gli altri provider nulla cambia.

## 4. Dati / migrazioni
- `Product.higgsfieldSoulId String?` (cache SoulId per prodotto). Migrazione additiva (nullable), via SQL hand-authored + `prisma migrate deploy` (migrate dev è interattivo in questo shell).

## 5. Errori / degrade
- soul-styles KO → UI senza anteprime/menu vuoto, generazione con stile di default.
- Claude director KO → fallback deterministico.
- SoulId creation KO/timeout → fallback a generazione senza riferimento (solo stile+prompt) con messaggio chiaro.
- Generazione: errori Higgsfield (HTTP/credit/nsfw/timeout) → `status:"ERROR"` con messaggio (fail-safe esistente).

## 6. Testing
- `listSoulStyles` normalizer (parse risposta → {id,name,previewUrl}) — unit con fetch mockato.
- `buildHiggsfieldPrompt` fallback deterministico (Claude mockato): output breve, senza negazioni/"slide". — unit.
- `imageInputSchema` accetta `styleId`. — unit.
- Provider: width_and_height/quality/style_id presenti nel body (fetch mockato) e mockup → ramo riferimento. — unit.
- Gate tsc+build+vitest. **Smoke live** (credito ok): carico stili (106), genero immagine Higgsfield con stile "iPhone" + prompt corto EN → immagine UGC realistica; con prodotto → riferimento applicato; verifico niente testo/slide.

## 7. Fuori scope (qui)
- Video image-to-video / motion preset (sotto-progetto 2).
- Modifiche a GPT/Gemini (restano invariati).
- Selezione avanzata multi-immagine/batch.

## 8. Backlog (per writing-plans)
1. `listSoulStyles` + `GET /api/higgsfield/soul-styles` (cache) (TDD normalizer; live verify 106).
2. Riscrittura provider Higgsfield → `/v1/text2image/soul` (style_id, width_and_height, quality) + poll (TDD body shape).
3. `buildHiggsfieldPrompt` director (Claude + fallback) (TDD fallback).
4. `Product.higgsfieldSoulId` + riferimento prodotto (SoulId/upload) con verifica fedeltà (live).
5. `imageInputSchema.styleId` + route Meta/Blog inoltrano styleId.
6. UI selettore stile (Meta + Blog) con anteprime.
7. Gate + smoke live.

## 9. Rischi
| Rischio | Mitigazione |
|---|---|
| SoulId non mantiene il packaging prodotto | verifica live; fallback input_images; GPT-edit per pixel-perfect |
| Prompt italiano/negazioni rompono Soul | director inglese positivo, niente negazioni |
| 106 stili: lista lunga in UI | ricerca + anteprime; default UGC |
| Claude director aggiunge latenza/costo | fallback deterministico; 1-2 frasi, output piccolo |
| width_and_height/quality enum cambiano | enum verificati live; centralizzati in costanti |
