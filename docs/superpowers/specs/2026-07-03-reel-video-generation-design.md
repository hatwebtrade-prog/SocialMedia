# Generazione Video Reel (Image→Video, Higgsfield) — Design

**Data:** 2026-07-03
**Branch:** brain-mvp-clean

## Obiettivo

Permettere, sui contenuti Meta di formato **REEL** (ed eventualmente POST), di **generare un video**
animando l'immagine già generata del contenuto (Image→Video) tramite l'API Higgsfield
`/v1/image2video/dop` (modello DoP Turbo). Il movimento/camera è guidato dallo script del reel
(hook + scriptParlato + testoSchermo). v1 = **solo generazione + salvataggio + player**; la
pubblicazione del Reel su Instagram è **fuori scope**.

## Decisioni

- **Provider:** Higgsfield Image→Video (`/v1/image2video/dop`), stessa auth `Key KEY:SECRET` e stesso
  polling `/requests/{id}/status` già usati per le immagini. GPT/OpenAI non ha video API accessibile.
- **Fotogramma di partenza:** l'immagine già generata del contenuto (asset `IMMAGINE` dello slideIndex
  richiesto, o `null` per l'immagine principale). Se non esiste → errore "genera prima l'immagine".
- **Prompt di movimento:** costruito dallo script del reel (`hook`, `scriptParlato`, `testoSchermo`),
  con fallback all'`ideaCreativa`. Niente competitor (scrub già esistente non necessario qui: è un
  prompt di movimento, ma applichiamo comunque `scrubCompetitors` per sicurezza).
- **Sincrono (v1):** la rotta genera e attende (polling fino a ~300s), come già fa la generazione
  immagine (gpt-image-2 ~150s sincrono). UI con spinner/progress. Async/coda = evoluzione futura.
- **Storage:** salvataggio file `.mp4` come asset `tipo = VIDEO` (l'enum esiste già).
- **Serving:** la rotta `/api/assets/[id]` deve restituire il **content-type corretto** in base
  all'estensione del file (`.mp4` → `video/mp4`, altrimenti `image/png`), altrimenti il player non
  funziona.

## Architettura e componenti

### 1. Provider video Higgsfield
`src/lib/image/providers/higgsfield-video.ts`:
- `higgsfieldVideo(imageBuf: Buffer, prompt: string, opts?: { model?: string; deadlineMs?: number }): Promise<Buffer>`
  - Legge `HIGGSFIELD_API_KEY`/`_SECRET` (throw se mancano).
  - `uploadHiggsfieldImage(imageBuf, key, secret)` (già esistente) → URL pubblico del fotogramma.
  - `POST https://platform.higgsfield.ai/v1/image2video/dop` con body
    `{ params: { model: opts.model ?? "turbo", prompt, input_images: [{ type: "image_url", image_url: <url> }] } }`,
    header `Authorization: Key KEY:SECRET`.
  - Poll `https://platform.higgsfield.ai/requests/{id}/status` ogni 3s fino a `completed`
    (deadline default 300s); su `failed/canceled/error/nsfw` → throw.
  - Alla fine scarica `video.url` (mp4) → Buffer (fetch → arrayBuffer). Riusa il pattern di
    `higgsfield.ts` (auth, sleep, download).

### 2. Prompt di movimento (puro, testato)
`src/lib/video/video-prompt.ts`:
- `buildVideoPrompt(input: { hook?; scriptParlato?; testoSchermo?; ideaCreativa? }): string`
  - Combina hook + scriptParlato + (testoSchermo join) o fallback ideaCreativa, e aggiunge una nota
    di movimento cinematografico soft ("movimento di camera fluido, naturale, premium; il prodotto
    resta fedele; nessun testo aggiuntivo generato"). Ritorna stringa non vuota.

### 3. Store video
`src/lib/image/store.ts` (estensione): `saveVideoAssetFile(contentId, assetId, bytes): string` →
scrive `uploads/<contentId>/<assetId>.mp4` e ritorna il path relativo POSIX (specularmente a
`saveAssetFile`). `deleteAssetFile` già gestisce path arbitrari sotto `uploads`.

### 4. Orchestratore
`src/lib/video/generate.ts`:
- `generateVideoAsset(input: { contentId; slideIndex: number|null; prompt?: string }, deps): Promise<{ status: "DONE"|"ERROR"; assetId?; error? }>`
  - deps: `loadStartImage(contentId, slideIndex) → Buffer|null` (legge l'asset IMMAGINE), `loadReel(contentId) → { hook?; scriptParlato?; testoSchermo?; ideaCreativa? }`,
    `callVideo(imageBuf, prompt) → Buffer`, `persistVideo({contentId, slideIndex, prompt, bytes}) → { assetId }`.
  - Flusso: carica start image (se null → ERROR "genera prima l'immagine"); costruisce prompt
    (`input.prompt` o `buildVideoPrompt(loadReel())`); `callVideo`; `persistVideo`; ritorna DONE.
  - Tutto in try/catch → ERROR con messaggio; nessun asset persistito su errore.

### 5. Runtime deps
`src/lib/video/runtime.ts`: `buildVideoDeps()` implementa le deps:
`loadStartImage` (prisma `generatedAsset.findFirst({contentId, slideIndex, tipo: IMMAGINE})` → readFile),
`loadReel` (payload del contenuto), `callVideo` (→ `higgsfieldVideo`), `persistVideo`
(`saveVideoAssetFile` + `generatedAsset.create({tipo: VIDEO, path, prompt, modello: "higgsfield/dop"})`,
rimuovendo un eventuale VIDEO asset precedente dello stesso slideIndex).

### 6. Rotta
`POST /api/meta/contents/[id]/video` — body `{ slideIndex?: number|null; prompt?: string }` →
`generateVideoAsset` → 200 `{assetId}` / 502 su ERROR. Pattern deps-registry come le altre rotte.

### 7. Serving corretto del video
`src/app/api/assets/[id]/route.ts`: content-type in base all'estensione del path
(`.mp4` → `video/mp4`, `.webm` → `video/webm`, default `image/png`).

### 8. UI
`src/app/meta/[id]/page.tsx`: sotto l'immagine (per REEL, e disponibile anche per POST), sezione
**"Video"** con: un `<video controls>` se esiste un asset VIDEO per quello slideIndex; un pulsante
**"Genera video"** (spinner + `GenerationProgress` con estimatedMs ~180000) che chiama la rotta e poi
ricarica il contenuto. Nota UI: "richiede un'immagine già generata".

## Gestione errori
- Nessuna immagine di partenza → ERROR "genera prima l'immagine" (mostrato in UI).
- Higgsfield fallita/nsfw/timeout → ERROR con messaggio; nessun asset creato.
- Chiavi Higgsfield mancanti → ERROR esplicito.

## Test (vitest, funzioni pure + orchestratore con deps mock)
- `buildVideoPrompt`: combina i campi, fallback a ideaCreativa, include la nota di movimento, non vuoto.
- `generateVideoAsset`: DONE quando le deps rispondono; ERROR se `loadStartImage` → null; ERROR se
  `callVideo` throwa (nessun `persistVideo`); passa il prompt corretto a `callVideo`.
- `saveVideoAssetFile`: estensione `.mp4` e path relativo (se testabile senza FS reale → verifica di
  costruzione path; altrimenti coperto da tsc).
- Provider `higgsfieldVideo`, rotta, UI, serving: `tsc --noEmit` + `build` + smoke (no unit test su
  network/route/componenti, come da convenzione).

## Fuori scope (v1)
- Pubblicazione Reel su Instagram (oggi `publish.ts` la blocca esplicitamente).
- Text→Video (non disponibile sulla platform API Higgsfield).
- Audio/voce, sottotitoli bruciati, musica.
- Coda/async persistente (v1 è sincrono con polling, come la generazione immagine attuale).
- Selezione avanzata di modello/motions Higgsfield (usa DoP Turbo di default).
