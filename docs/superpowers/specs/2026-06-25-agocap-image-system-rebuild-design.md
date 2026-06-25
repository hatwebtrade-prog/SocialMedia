# Image System Rebuild — Design (Spec A)

- **Data:** 2026-06-25
- **Contesto:** AGOCAP Content AI Hub — l'area creazione Meta/Blog "non funziona": (1) la generazione immagine del Blog è dentro la pipeline del testo → se l'immagine fallisce, l'articolo non viene salvato; (2) la costruzione del prompt immagine è una concatenazione fragile (inietta il copy editoriale delle slide, prompt unico per tutte le slide, negazioni che rompono Higgsfield).
- **Stato:** Design approvato in brainstorming.
- **Supersede:** `2026-06-25-agocap-higgsfield-ugc-images-design.md` (la gestione Higgsfield UGC è qui dentro, come "stile" del brief + riscrittura provider).
- **Segue:** Spec B — Content Workspace UX (stato di completamento + filtri liste) — separata.

---

## 1. Obiettivo
Ricostruire il sistema immagini dei contenuti:
1. **Disaccoppiare** la generazione immagine dal testo (Blog): l'articolo si salva sempre; l'immagine è un passo separato/on-demand. (FIX del bug "non funziona".)
2. **Brief immagine a filtri**: sostituire la concatenazione con un brief strutturato (soggetto, ambientazione, luce, inquadratura, mood, stile, formato, "tiene il prodotto") che costruisce un prompt **pulito e specifico per provider**.
3. **Higgsfield gestito nativamente**: stili Soul (UGC) + prompt corto inglese, niente negazioni.
4. Per-slide (caroselli): ogni slide ha il suo brief → immagini diverse e coerenti.

Pattern di riferimento: [AjinND/image-prompt-generator](https://github.com/AjinND/image-prompt-generator) (filtri categoria → prompt).

## 2. Bug fix — disaccoppiare immagine Blog dal testo
- `src/lib/blog/generate.ts`: la pipeline NON chiama più `generateImage` né crea l'asset. Flusso = `loadContext → loadSeoData → callClaude → buildJsonLd → persist(testo)`. L'articolo è salvato (BOZZA) anche senza immagine.
- `src/lib/blog/runtime.ts`: rimuovere `generateImage` dalle deps della pipeline (e il relativo campo in `BlogDeps`); `persist` non crea più il `GeneratedAsset`. Aggiornare i test (`blog/generate.test.ts`) che si aspettavano l'immagine.
- L'immagine Blog si genera dal dettaglio via `POST /api/blog/contents/[id]/image` (già esistente, ora col brief+provider). Risultato: se l'immagine fallisce, l'articolo resta.
- Meta: il testo è già disaccoppiato (immagine on-demand) → nessun cambiamento al flusso testo.

## 3. Brief immagine a filtri

### 3.1 Schema (puro, testabile) — `src/lib/image/brief.ts`
```ts
export interface ImageBrief {
  soggetto?: string;          // es. "donna che tiene il prodotto", "primo piano del prodotto", "flat lay"
  ambientazione?: string;     // es. "cucina luminosa", "bagno spa", "esterno naturale", "studio minimal"
  luce?: string;              // es. "luce naturale morbida", "golden hour", "studio softbox"
  inquadratura?: string;      // es. "primo piano", "medio busto", "figura intera", "dall'alto (flat lay)", "selfie 0.5"
  mood?: string;              // es. "fresco ed energico", "calmo e rilassante", "lusso", "autentico UGC"
  formato?: "verticale" | "quadrato" | "orizzontale"; // → aspect/size per provider
  stile?: string;             // Higgsfield: style_id (UUID). GPT/Gemini: nome stile (es. "fotografico", "editoriale lifestyle")
  tieneProdotto?: boolean;    // persona che tiene/usa il prodotto
  note?: string;              // testo libero aggiuntivo
}
```
- Liste di **preset** (label IT) per ambientazione/luce/inquadratura/mood/formato (costanti curate), più testo libero. Lo **stile** per Higgsfield = i 106 stili dall'API; per GPT/Gemini un set generico curato.

### 3.2 Costruzione prompt per-provider — `buildImagePromptFromBrief(brief, ctx)`
`ctx = { provider: ImageProvider, hasMockup: boolean, productName?: string }`
- **GPT/Gemini**: assembla una frase ricca italiana dai campi presenti (soggetto + ambientazione + luce + inquadratura + mood + note) + direzione fotorealistica + (se hasMockup) "mantieni il prodotto IDENTICO". Le negazioni (no testo/collage) sono ammesse (questi modelli le rispettano).
- **Higgsfield**: frase **breve, positiva, inglese**, SOLO descrizione di scena (soggetto/ambientazione/luce/inquadratura/mood), **niente negazioni**, niente parole tipo "slide/collage/text". Lo `stile` NON va nel testo: è passato come `style_id`. Es.: *"casual iPhone photo of a woman holding a magnesium supplement in a bright kitchen, soft natural light, candid"*.
- Output puro/testato. `formato` → mappa a width_and_height (Higgsfield) / size (GPT/Gemini).
- Fallback: se il brief è vuoto, usa `ideaCreativa` del contenuto come `soggetto` (retrocompatibile).

### 3.3 Integrazione pipeline immagine — `src/lib/image/generate.ts`
- `ImageGenInput` += `brief?: ImageBrief` (e `styleId?` già previsto/da brief.stile).
- `generateImageAsset`: se `input.brief` presente → `prompt = buildImagePromptFromBrief(brief, {provider, hasMockup, productName})`; altrimenti fallback all'attuale `buildImagePrompt(loadContent)`. Per Higgsfield passare `styleId = brief.stile`.
- `loadContent` resta come fonte di fallback (ideaCreativa) e per `productName`.

## 4. Higgsfield nativo (riscrittura provider) — contratto verificato dal vivo
- **Generazione Soul (style-driven):** `POST https://platform.higgsfield.ai/v1/text2image/soul` body `{params:{ prompt, width_and_height, style_id, quality }}`, auth `Authorization: Key {key}:{secret}`.
  - `width_and_height` enum: incl. `1152x2048` (verticale UGC), `1536x1536`/`2048x2048` (quadrato), `2048x1152` (orizzontale). Mappare da `brief.formato`.
  - `quality`: `1080p`. `style_id`: UUID (da `brief.stile`).
  - Async: risposta `{request_id, status_url}` → poll `GET status_url` fino `completed` → `images[0].url` → download (riusa polling esistente). Stati: queued/in_progress/completed/failed/nsfw/canceled.
- **Stili:** `GET /v1/text2image/soul-styles` (auth `hf-api-key`/`hf-secret`) → 106 `{id,name,description,preview_url}`. Esposti via `GET /api/higgsfield/soul-styles` (cache in-memory). Stili UGC: Realistic, iPhone, 0.5 Selfie, DigitalCam, RingSelfie, Elevator Mirror, Street view, Tokyo Streetstyle, ecc.
- **Prodotto (mockup) come riferimento:** upload presigned (`POST /files/generate-upload-url` con `hf-api-key`/`hf-secret` → `{upload_url, public_url}`, poi `PUT` byte) → usare il `public_url`. Opzioni: `custom_reference_id` (SoulId via `POST /v1/custom-references`, in cache su `Product.higgsfieldSoulId`) **oppure** input_images sul path v2 reference. ⚠️ Verificare in build quale tiene meglio il packaging; se nessuno è fedele, documentare che per il prodotto pixel-perfect si usa GPT image-edit.
- Mantenere il provider esistente come fallback (`/higgsfield-ai/soul/standard|reference`) se `v1` non disponibile.

## 5. API + UI

### 5.1 API
- `GET /api/higgsfield/soul-styles` → stili (cache). Degrade a [] su errore.
- `imageInputSchema` (e route Meta+Blog image) += `brief?` (oggetto) e `styleId?`. Validazione zod del brief (tutti opzionali).

### 5.2 UI brief (Meta `/meta/[id]` + Blog `/blog/[id]`)
- Un pannello **"Brief immagine"** con i filtri: select preset (ambientazione, luce, inquadratura, mood, formato), toggle "tiene il prodotto", testo libero (soggetto/note).
- **Stile**: se provider = Higgsfield → selettore dei 106 stili (da `/api/higgsfield/soul-styles`, con anteprime, ricercabile); altrimenti set generico GPT/Gemini.
- Resta: selettore provider, prodotto/mockup + spunta, barra di avanzamento. La generazione invia `{brief, styleId, provider, productId, useMockup, slideIndex}`.
- Carosello: il brief è **per-slide** (ogni slide ha i suoi filtri); default ereditato dal brief generale.
- Anteprima del prompt costruito (read-only) prima di generare, così l'utente vede cosa verrà inviato.

## 6. Dati / migrazioni
- `Product.higgsfieldSoulId String?` (cache SoulId) — additiva, SQL hand-authored + `prisma migrate deploy`.
- Nessun nuovo campo obbligatorio sul contenuto: il brief viaggia con la richiesta; il prompt finale resta salvato su `GeneratedAsset.prompt`. (Opzionale futuro: salvare il brief per riproducibilità.)

## 7. Errori / degrade
- Blog: immagine disaccoppiata → fallimento immagine NON perde l'articolo.
- soul-styles KO → menu vuoto + stile default; brief vuoto → fallback ideaCreativa.
- Higgsfield async/credit/nsfw/timeout → ERROR con messaggio (fail-safe esistente).
- buildImagePromptFromBrief è puro e non lancia; campi mancanti → omessi.

## 8. Testing
- `buildImagePromptFromBrief`: GPT/Gemini (frase ricca con i campi), Higgsfield (frase corta EN, niente negazioni, niente style nel testo), fallback brief vuoto→ideaCreativa, formato→dimensioni. — unit.
- `listSoulStyles` normalizer (fetch mockato). — unit.
- Higgsfield provider: body `/v1/text2image/soul` con style_id/width_and_height/quality (fetch mockato) + poll. — unit.
- Blog generate: pipeline NON chiama più image, persiste testo senza asset. — unit aggiornati.
- `imageInputSchema` accetta brief+styleId. — unit.
- Gate tsc+build+vitest. **Smoke live**: blog generate (solo testo, salvato anche se OpenAI giù); Meta image con brief via GPT (pulito) e via Higgsfield con stile "iPhone" (UGC realistico, niente testo/slide); carosello con brief per-slide.

## 9. Fuori scope (qui)
- Stato di completamento + filtri liste (Spec B).
- Video image-to-video / motion (sotto-progetto video successivo).
- Modifiche al testo/SEO della generazione (solo disaccoppiamento immagine).

## 10. Backlog (per writing-plans)
1. **Bug fix**: disaccoppia immagine Blog dal testo (generate/runtime/test). Smoke: articolo salvato senza immagine.
2. `ImageBrief` + preset costanti + `buildImagePromptFromBrief` per-provider (TDD).
3. Higgsfield: `listSoulStyles` + `GET /api/higgsfield/soul-styles` (cache) (TDD normalizer; live 106).
4. Higgsfield provider → `/v1/text2image/soul` (style_id/width_and_height/quality) + poll; `brief.formato`→dimensioni (TDD body).
5. `Product.higgsfieldSoulId` + riferimento prodotto (upload/SoulId) con verifica fedeltà (live).
6. `imageInputSchema` += brief/styleId; route Meta/Blog inoltrano; `generate.ts` usa il brief (TDD).
7. UI brief a filtri (Meta + Blog) + selettore stile Higgsfield (anteprime) + anteprima prompt; per-slide.
8. Gate + smoke live.

## 11. Rischi
| Rischio | Mitigazione |
|---|---|
| Disaccoppiamento Blog rompe i test/flow esistenti | aggiorno test; il dettaglio Blog ha già il pannello immagine on-demand |
| Brief troppo complesso per l'utente | preset curati + tutti opzionali + anteprima prompt; default sensati |
| Higgsfield SoulId non fedele al prodotto | verifica live; fallback input_images; GPT-edit per pixel-perfect |
| Negazioni/italiano rompono Higgsfield | prompt EN positivo dedicato, stile via style_id |
| Per-slide brief = più stato UI | default ereditato dal brief generale; struttura semplice |
