# Immagini social brandizzate (stile template) — Design

**Data:** 2026-07-03
**Branch:** brain-mvp-clean

## Obiettivo

Elevare la generazione immagini dei post/caroselli Meta da "foto pulita" a **post grafico
brandizzato** nello stile del riferimento fornito dall'utente (post "3 PECULIARITÀ DELLA BIOTINA"):
titolo grande, **influencer che tiene il prodotto reale**, icone + brevi testi dei benefici, **logo
del brand**, palette derivata dal **colore del prodotto**.

Aggiungere per ogni immagine **spunte** che controllano cosa includere e concatenano istruzioni al
prompt: **Includi prodotto**, **Includi descrizione** (testi), **Includi logo** (overlay reale),
**Influencer (UGC)**.

**Importante:** le immagini NON devono essere tutte uguali e **NON** devono avere l'influencer di
default. L'influencer/persona compare **solo** se la spunta "Influencer (UGC)" è attiva; altrimenti lo
stile è **sobrio** (prodotto + grafica, senza persona).

## Decisioni approvate

- **Palette:** dal **colore dominante del prodotto** (es. Biotina = magenta), non palette fissa.
- **Testi:** **sintetizzati dall'AI** (titolo + 2-3 bullet brevi) dal contenuto/slide, ottimizzati per
  stare nell'immagine.
- **Influencer/persona:** SOLO se la spunta "Influencer (UGC)" è attiva. Di default niente persona.
- **Slide MAIN (cover, slideIndex 0 o immagine principale del POST):** più "ricca" (titolo grande,
  prodotto in evidenza, icone-benefici, logo). **Slide successive:** più sobrie/neutre. La MAIN è più
  ricca ma **non** implica l'influencer: quello dipende solo dalla spunta.
- **Logo:** file reale **caricato una volta** dall'utente e **sovrapposto** (compositing) all'immagine
  generata quando la spunta è attiva — NON generato dal prompt (gpt inventerebbe un logo falso).

## Architettura e componenti

### 1. Logo del brand — upload + storage + overlay

- **Storage a path fisso** (niente migration): `uploads/brand/logo.png` (dir già gestita da `store.ts`).
- `src/lib/image/logo-store.ts`: `saveLogo(bytes)`, `readLogo(): Buffer | null`, `hasLogo(): boolean`.
- Endpoint `POST /api/brand/logo` (JSON `{ dataUrl }` o multipart) → salva; `GET /api/brand/logo` → `{ exists }`.
- `src/lib/image/logo-overlay.ts`:
  - `logoPlacement(imgW, imgH, logoRatio, { widthPct=0.16, marginPct=0.04 })` → `{ left, top, width, height }`
    (angolo in alto a destra, come il riferimento). **Puro, testato.**
  - `overlayLogo(imageBuf, logoBuf): Promise<Buffer>` — sharp: ridimensiona il logo e lo compone
    (impuro; verificato con tsc/build).

### 2. Colore dominante del prodotto

- `src/lib/image/product-color.ts`: `dominantColorHex(imageBuf): Promise<string>` via `sharp().stats()`
  (o resize 1×1). Usato per dare al prompt l'accent color del post. **Testabile** con un buffer noto.
- Se manca l'immagine prodotto → nessun accent (fallback palette brand).

### 3. Testi AI per l'immagine

- `src/lib/image/social-copy.ts` — funzione pura `buildSocialCopyPrompt(context)` che chiede a Claude
  `{ titolo: string, bullets: string[] (max 3, brevi) }`.
- Runtime: `resolveSocialCopy(deps, content, slideIndex)` chiama Claude una volta per immagine (solo se
  `includiDescrizione`), con schema zod `socialCopySchema`. Testo breve, in italiano, niente competitor
  (riusa `scrubCompetitors`).
- I testi risultanti sono passati al prompt immagine come titolo + bullet da renderizzare.

### 4. Prompt "post brandizzato"

- `src/lib/image/social-template.ts`: `buildSocialTemplatePrompt(args)` dove
  `args = { variant: "MAIN" | "SECONDARY", influencer: boolean, productName, accentHex, copy?: {titolo, bullets}, hasProduct, brandVisual }`.
  - **influencer = true:** aggiunge "influencer reale sorridente che tiene il prodotto" (stile UGC del
    riferimento). **influencer = false (default):** NIENTE persona — composizione grafica del prodotto,
    packshot elegante, icone/elementi, senza volti.
  - **MAIN:** più ricca (titolo grande, prodotto in evidenza, icone-benefici, spazio logo in alto a
    destra), palette attorno a `{accentHex}`. **SECONDARY:** più sobria (meno testo, un concetto, stessa
    palette/famiglia).
  - Regola single-scene / no-collage già esistente riusata. Se `!copy` (Includi descrizione off) →
    "nessun testo nell'immagine".
- Integrazione in `generate.ts`: per META, quando c'è un prodotto e/o si vuole lo stile template, usa
  questo builder al posto dell'archetipo generico. La `MAIN` è `slideIndex === 0` (carosello) o
  l'immagine principale (POST); le altre `SECONDARY`.

### 5. Spunte per immagine (UI + API)

- `imageInputSchema` (+ `ImageGenInput`): aggiunge `includiProdotto?` (di fatto = prodotto selezionato),
  `includiDescrizione?: boolean`, `includiLogo?: boolean`, `influencer?: boolean`.
- UI `meta/[id]/page.tsx`: sotto ogni immagine/slide, checkbox oltre al selettore prodotto esistente:
  **Includi descrizione**, **Includi logo**, **Influencer (UGC)**; + un controllo unico
  **"Carica logo brand"** (mostrato se `GET /api/brand/logo` = `{exists:false}`). Stato per-immagine
  esteso: `{ productId, useMockup, includiDescrizione, includiLogo, influencer }`. Tutte le spunte
  **default OFF** (immagini varie e sobrie salvo scelta esplicita).
- `genImage` invia le nuove flag; il route le passa a `generateImageAsset`.

### 6. Pipeline in `generate.ts`

1. risolve prodotto (immagine reale già auto-agganciata per GPT) e `accentHex` (dal prodotto);
2. se `includiDescrizione` → `resolveSocialCopy` (AI) per titolo+bullet;
3. costruisce il prompt con `buildSocialTemplatePrompt` (MAIN/SECONDARY, `influencer` dalla spunta);
4. genera con gpt-image-2 (mockup prodotto come riferimento);
5. se `includiLogo` e `hasLogo()` → `overlayLogo(bytes, logo)`;
6. persiste.

## Gestione errori

- Nessun logo caricato + `includiLogo` on → genera senza overlay e **avvisa** in UI ("carica prima il logo").
- `resolveSocialCopy` (Claude) fallisce → genera l'immagine **senza testi** (non blocca), con nota.
- `dominantColorHex` fallisce → fallback a palette brand.
- Errori immagine restano gestiti come oggi (status ERROR, nessun asset persistito).

## Test (vitest, funzioni pure)

- `logoPlacement`: posizionamento in alto a destra, rispetto di margine e larghezza %, clamp ≥ 0.
- `dominantColorHex`: buffer a tinta unita nota → hex atteso.
- `buildSocialTemplatePrompt`: `influencer:true` contiene la persona, `influencer:false` NON contiene
  volti/persone; MAIN più ricca vs SECONDARY più sobria; `!copy` → "nessun testo"; include accentHex.
- `socialCopySchema`/`buildSocialCopyPrompt`: struttura e cap dei bullet.
- Runtime/rotte/UI/overlay sharp: `tsc --noEmit` + `build` + smoke.

## Fuori scope (v1)

- Editor grafico manuale delle posizioni testo/logo (il layout lo compone gpt-image + overlay logo).
- Selezione manuale dell'accent color (derivato dal prodotto; override rimandato).
- Font brand specifici nel testo generato (gpt-image usa font propri).
- Applicazione al canale Blog (solo Meta in v1).

## Nota sul realismo del testo in-immagine

gpt-image-2 renderizza il testo ma **non è tipograficamente perfetto** (possibili refusi/kerning). Per
titoli/bullet brevi è accettabile; se serve testo perfetto, l'evoluzione è comporre il testo via overlay
(come il logo) — rimandato a v2.
