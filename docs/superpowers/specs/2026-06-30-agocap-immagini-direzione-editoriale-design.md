# Ottimizzazione immagini + Direzione Editoriale nel Knowledge

Data: 2026-06-30
Stato: design approvato (in attesa di review utente sullo spec)

## Obiettivo

Due feature collegate:

- **A — Ottimizzazione immagini** (Meta + Blog): massima qualità tecnica per ogni
  provider e nessuna rigenerazione inutile.
- **B — Direzione Editoriale**: dare un "filone logico" coerente alla generazione
  dei prompt immagine, alimentandoli con un piano editoriale strutturato (manuale)
  e con piani editoriali caricati come file.

Decisioni prese in brainstorming:

- Le immagini coperte sono **tutte** (Meta post/carosello + Blog immagine in evidenza),
  con la stessa logica di prompt.
- "Ottimizzazione" = qualità del prompt + qualità tecnica output + nessuna
  rigenerazione inutile. **NON** in scope: fallback automatico tra provider, retry
  con backoff, ottimizzazione peso/formato file.
- Il piano editoriale entra **sia** direttamente nei prompt immagine **sia** alimenta
  la generazione automatica dell'Identità Visiva.
- Modellazione scelta: **Direzione Editoriale strutturata** (profilo singleton) +
  tag tipo sui file caricati.

## Stato attuale (mappa del codice)

- I prompt immagine sono guidati **solo** dal `BrandVisualProfile` (singleton
  `id="default"`): palette, stileFotografico, mood, elementiRicorrenti, daEvitare.
  Il knowledge testuale (incl. `PIANO_EDITORIALE`) alimenta i prompt di **testo**
  (Brain/Meta/Blog/Email) ma **non** entra nei prompt immagine.
- `src/lib/image/brief.ts` → `buildImagePromptFromBrief(brief, ctx)` con doppio
  percorso: Higgsfield (solo positivi, lista separata da virgole) vs GPT/Gemini
  (frase strutturata + negazioni). `PromptCtx` ha già `brandVisual?`.
- `src/lib/image/generate.ts` → `generateImageAsset()` carica il `BrandVisualProfile`
  via `deps.loadBrandVisual()` e lo passa come `PromptCtx.brandVisual`.
- `briefDimensions(formato)` ritorna `{ soul, openaiSize }`, ma `openai.ts` **ignora**
  `openaiSize` e usa sempre `"1024x1024"` (bug: verticale/orizzontale non onorati su GPT).
- Provider: GPT `gpt-image-1` (quality `"high"`, size fissa 1024×1024), Gemini
  `gemini-2.5-flash-image` (nessun parametro size), Higgsfield Soul v1
  (quality `"1080p"`, `width_and_height = soulSize`).
- `persistAsset()` fa upsert: cancella sempre l'asset esistente e ne crea uno nuovo
  (nessuna conferma prima di sovrascrivere).
- `KnowledgeFile` ha `kind` (DOCUMENTO/IMMAGINE) ma **non** un `KnowledgeType`: un file
  non può essere etichettato come `PIANO_EDITORIALE`.
- `/knowledge` ha 3 sezioni: `BrandVisualEditor` (Identità Visiva), "Materiale testuale"
  (KnowledgeItem manuali), `KnowledgeFiles` (upload file).

## Parte A — Ottimizzazione immagini

### A1. Onorare il formato su GPT (qualità/correttezza)

- `ProviderOpts` (`src/lib/image/providers/index.ts`) aggiunge `openaiSize?: "1024x1024" | "1024x1536" | "1536x1024"`.
- `generate.ts` calcola `briefDimensions(input.brief?.formato)` → passa sia `soulSize`
  sia `openaiSize` in `opts`.
- `openai.ts` usa `opts?.openaiSize ?? "1024x1024"` sia in `images.generate` sia in
  `images.edit`. Qualità resta `"high"`.
- `generateWithProvider` inoltra `opts` anche a `openaiImage` (oggi non lo riceve).

### A2. Aspect ratio Gemini (best-effort)

- In `geminiImage`, anteporre al prompt una nota di formato derivata da `opts.openaiSize`:
  `1024x1536 → "Formato verticale 9:16."`, `1536x1024 → "Formato orizzontale 16:9."`,
  `1024x1024 → "Formato quadrato 1:1."`. `generateWithProvider` inoltra `opts` anche a
  `geminiImage` (oggi non lo riceve). Nessun cambio di endpoint/API.
- Basso rischio: è solo testo nel prompt; se assente, comportamento invariato.

### A3. Nessuna rigenerazione inutile (conferma sovrascrittura)

- Guard lato UI in `/meta/[id]` e `/blog/[id]`: se per lo slot esiste già un asset
  immagine, il pulsante "(Ri)genera" passa a uno stato di conferma inline
  ("Esiste già un'immagine — clicca di nuovo per sovrascrivere") invece di rigenerare
  subito. Secondo click → procede. **Niente `window.confirm`/dialog nativo.**
- Nessuna modifica al backend `persistAsset` (l'upsert resta); la guardia è solo UX.

Fuori scope esplicito: fallback automatico tra provider, retry con backoff.

## Parte B — Direzione Editoriale → coerenza immagini

### B1. Modello `EditorialDirection` (singleton)

Nuovo modello Prisma, pattern identico a `BrandVisualProfile`:

```prisma
model EditorialDirection {
  id          String   @id @default("default")
  campagna    String?
  periodo     String?
  temi        String?
  tonoVisivo  String?
  daMostrare  String?
  daEvitare   String?
  updatedAt   DateTime @updatedAt
}
```

Semantica: `BrandVisualProfile` = identità visiva **permanente** del brand;
`EditorialDirection` = direzione **editoriale/temporale** corrente (campagna, periodo,
temi e soggetti, tono visivo, cosa mostrare/evitare). I due sono input distinti.

### B2. Tag tipo sui file (`KnowledgeFile.knowledgeType`)

```prisma
model KnowledgeFile {
  // ... campi esistenti ...
  knowledgeType KnowledgeType?   // null = non classificato (default)
}
```

- Un file DOCUMENTO può essere taggato `PIANO_EDITORIALE` (o altri tipi) dopo l'upload.
- Solo i file con `stato = PRONTO`, `kind = DOCUMENTO`, `knowledgeType = PIANO_EDITORIALE`
  contribuiscono al contesto editoriale immagini (vedi B3).

### B3. Iniezione concisa nei prompt immagine

Nuovo file `src/lib/knowledge/editorial-context.ts`:

```ts
export interface EditorialDirectionData {
  campagna?: string | null;
  periodo?: string | null;
  temi?: string | null;
  tonoVisivo?: string | null;
  daMostrare?: string | null;
  daEvitare?: string | null;
}

// `planTexts` = testi estratti da file/voci PIANO_EDITORIALE, già concatenati.
// Cap totale ~700 caratteri per non gonfiare il prompt immagine.
export function buildEditorialImageContext(
  d: EditorialDirectionData,
  planTexts: string,
  provider: ImageProvider,
): string
```

Regole di formattazione (coerenti con `buildBrandVisualContext`):

- **HIGGSFIELD**: solo positivi in lista separata da virgole (campagna, temi,
  tonoVisivo, daMostrare; niente negazioni). I `planTexts` sono compressi a poche
  parole-chiave (cap stretto, es. 200 char) per non rovinare il prompt Soul.
- **GPT/GEMINI**: frase strutturata `Direzione editoriale Agocap: <positivi>.` +
  ` Evita: <daEvitare>.` + eventuale estratto piano (cap ~700 char totali).

Integrazione:

- `PromptCtx` (`brief.ts`) aggiunge `editorial?: string`. In `buildImagePromptFromBrief`
  viene accodato **dopo** `brandVisual` in entrambi i percorsi (Higgsfield: in coda
  alla lista positivi; GPT/Gemini: in coda alla stringa).
- `ImageDeps` aggiunge `loadEditorial?: () => Promise<{ direction: EditorialDirectionData; planTexts: string } | null>`.
- `generate.ts`: se `loadEditorial` presente, carica e costruisce `editorial` via
  `buildEditorialImageContext(...)`, passandolo in `PromptCtx`.
- `runtime.ts` `sharedImageDeps()`: implementa `loadEditorial()` leggendo
  `EditorialDirection` singleton + i testi dei file/voci `PIANO_EDITORIALE`
  (cap per sorgente per restare entro il budget caratteri).

### B4. Alimenta la generazione dell'Identità Visiva

- `POST /api/knowledge/visual-profile/generate` (auto-fill del `BrandVisualProfile`):
  il contesto passato a Claude include anche la `EditorialDirection` e le voci/file
  `PIANO_EDITORIALE`. Le voci `KnowledgeItem` `PIANO_EDITORIALE` sono già caricate da
  `loadKnowledgeKbItems()`; aggiungere esplicitamente la `EditorialDirection` singleton
  al prompt di generazione.

### B5. UI in `/knowledge`

- Nuovo componente `EditorialDirectionEditor` (stile `BrandVisualEditor`): 6 campi
  testuali (`campagna`, `periodo`, `temi`, `tonoVisivo`, `daMostrare`, `daEvitare`) +
  "Salva". API `GET/PUT /api/knowledge/editorial-direction` (upsert singleton `default`).
- `KnowledgeFiles`: per ogni file DOCUMENTO un `<select>` per assegnare il tipo
  (`—` / `PIANO_EDITORIALE` / altri `KNOWLEDGE_TYPES`). API
  `PATCH /api/knowledge/files/[id]` con `{ knowledgeType }`.

## Data flow immagine (finale)

```
brief utente (ImageBrief)
  + BrandVisualProfile  (brand permanente → PromptCtx.brandVisual)
  + EditorialDirection + testi PIANO_EDITORIALE  (direzione temporale → PromptCtx.editorial)
  → buildImagePromptFromBrief(brief, ctx)  (ottimizzato per provider)
  → generateWithProvider(provider, prompt, mockup, { openaiSize, soulSize, styleId, ... })
  → immagine
```

## Error handling

- `loadEditorial()` e il tag file sono **best-effort**: in caso di assenza/errore,
  `PromptCtx.editorial` resta `undefined` e la generazione procede come oggi
  (degradazione pulita, nessun blocco).
- Estrazione testo file invariata (già best-effort con `stato = ERRORE`).
- La conferma di sovrascrittura è solo client-side; nessun nuovo fallimento backend.

## Testing

- `editorial-context.test.ts`: varianti provider (Higgsfield solo positivi vs
  GPT/Gemini con `Evita:`), rispetto del cap caratteri, stringa vuota quando tutto vuoto.
- `brief.test.ts`: con `PromptCtx.editorial` valorizzato, la stringa compare nel prompt
  (sia percorso Higgsfield sia GPT) dopo `brandVisual`.
- Threading `openaiSize`: test su `generateImageAsset` con dep fake che cattura `opts`,
  verificando che `openaiSize` rifletta il `formato` del brief.
- Test esistenti devono restare verdi (suite attuale: 179 test).

## Migrazioni

- `prisma migrate dev` è interattivo e **bloccato** in questa shell non interattiva.
  Procedere come per le migrazioni precedenti: scrivere `migration.sql` a mano
  (nuova tabella `EditorialDirection`; colonna `knowledgeType` su `KnowledgeFile`) +
  `prisma migrate deploy`, poi `prisma generate`.

## Fuori scope (YAGNI)

- Più piani editoriali in parallelo (scelto singleton).
- Fallback automatico tra provider e retry con backoff.
- Ottimizzazione peso/formato file (WebP/compressione/resize a valle).
- Iniezione di immagini di riferimento brand come input al modello (resta testuale).
