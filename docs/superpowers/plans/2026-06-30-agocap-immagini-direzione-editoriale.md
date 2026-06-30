# Ottimizzazione immagini + Direzione Editoriale — Implementation Plan

> Spec: `docs/superpowers/specs/2026-06-30-agocap-immagini-direzione-editoriale-design.md`
> Esecuzione consigliata: subagent-driven-development (un subagent per task, review tra task). Step in formato checkbox.

## Context

Oggi i prompt delle immagini (Meta + Blog) sono guidati **solo** dal `BrandVisualProfile`; il piano editoriale e i contenuti fondamentali non entrano nei prompt immagine, quindi manca un "filone logico" coerente. Inoltre `gpt-image-1` ignora il formato scelto (genera sempre 1024×1024) e una rigenerazione sovrascrive l'immagine esistente senza conferma.

Questo lavoro: (A) ottimizza le immagini — onora il formato su GPT, dà un hint di aspect a Gemini, e chiede conferma prima di sovrascrivere; (B) introduce una **Direzione Editoriale** strutturata (profilo singleton) + tag tipo sui file caricati, iniettata **direttamente** nei prompt immagine (accanto al BrandVisualProfile) e usata anche per alimentare la generazione automatica dell'Identità Visiva. Esito: immagini coerenti con la direzione editoriale corrente, qualità tecnica corretta, niente rigenerazioni accidentali.

**Fuori scope (YAGNI):** fallback automatico tra provider, retry/backoff, ottimizzazione peso/formato file, più piani editoriali in parallelo, reference image come input al modello.

## Tech Stack / Constraints

- Next.js 15 (App Router) + Prisma/Postgres + Tailwind + zod + vitest. UI in italiano, codice in inglese.
- Model Claude `claude-opus-4-8`. SDK `@anthropic-ai/sdk` 0.70.1 — **structured output via prompt+zod, NON** `output_format`/`output_config`.
- `prisma migrate dev` è **interattivo e bloccato** in questa shell: scrivere `migration.sql` a mano + `prisma migrate deploy` + `prisma generate` (pattern già usato nel repo).
- Suite test attuale verde: **179 test**. Dev server su **porta 3005** (3000/3001 occupate da container shopify-*).
- TDD su moduli puri (logica/prompt/schemi); le pagine/route DB-backed si verificano con **live-smoke** (pattern del repo: route con Claude/OpenAI usano dependency-injection o live-smoke).

---

## PARTE A — Ottimizzazione immagini

### Task A1 — GPT onora il formato (`openaiSize` end-to-end)

**Files:**
- Modify: `src/lib/image/providers/index.ts` (`ProviderOpts` += `openaiSize`; `generateWithProvider` inoltra `opts` a GPT e Gemini, oggi li riceve solo Higgsfield)
- Modify: `src/lib/image/providers/openai.ts` (`openaiImage(prompt, mockup, opts?)`; usa `opts?.openaiSize ?? "1024x1024"` in `images.generate` **e** `images.edit`)
- Modify: `src/lib/image/generate.ts` (calcola `briefDimensions(input.brief?.formato)`; passa `openaiSize` dentro `opts` a `deps.callOpenAI`)
- Test: `src/lib/image/generate.test.ts` (estende lo stile esistente: dep `callOpenAI` fake, ispeziona `mock.calls[0][3]`)

**Interfaces:**
- `ProviderOpts` produce: `{ styleId?: string; soulSize?: string; customReferenceId?: string; openaiSize?: "1024x1024" | "1024x1536" | "1536x1024" }`
- `briefDimensions(formato)` (già esistente in `brief.ts`) ritorna `{ soul, openaiSize }` — riusare, non duplicare.

**Steps (TDD):**
- [ ] Test: in `generate.test.ts`, brief `{ formato: "verticale" }` → `callOpenAI` chiamato con `opts.openaiSize === "1024x1536"`; default (no brief) → `"1024x1024"`.
- [ ] Run → FAIL (openaiSize non passato).
- [ ] Impl: `index.ts` aggiunge `openaiSize` a `ProviderOpts` e passa `opts` a `openaiImage`/`geminiImage`; `openai.ts` usa `opts?.openaiSize`; `generate.ts` mette `openaiSize: briefDimensions(input.brief?.formato).openaiSize` nell'oggetto opts già costruito.
- [ ] Run mirato + full `npx vitest run` → PASS (incl. `providers/index.test.ts` invariato).
- [ ] Commit: `feat(image): honor brief format size on gpt-image-1`.

### Task A2 — Hint aspect ratio per Gemini

**Files:**
- Modify: `src/lib/image/providers/gemini.ts` (`geminiImage(prompt, mockup, opts?)`; helper puro `aspectNote(openaiSize?)` che antepone "Formato verticale 9:16." / "…orizzontale 16:9." / "…quadrato 1:1." al prompt)
- Test: `src/lib/image/providers/gemini-aspect.test.ts` (nuovo, testa solo `aspectNote`)

**Steps (TDD):**
- [ ] Test: `aspectNote("1024x1536") === "Formato verticale 9:16."`, `"1536x1024" → orizzontale 16:9`, `"1024x1024"/undefined → quadrato 1:1`.
- [ ] Run → FAIL.
- [ ] Impl: esporta `aspectNote`; `geminiImage` antepone `aspectNote(opts?.openaiSize)` al `text` del prompt. (`index.ts` già inoltra `opts` a Gemini dal Task A1.)
- [ ] Run + full → PASS.
- [ ] Commit: `feat(image): add aspect-ratio hint to gemini prompt`.

### Task A3 — Conferma inline prima di sovrascrivere (UI Meta + Blog)

**Files:**
- Modify: `src/app/blog/[id]/page.tsx` (~riga 161-167: pulsante immagine)
- Modify: `src/app/meta/[id]/page.tsx` (sezione generazione immagine, analoga)

**Approccio:** stato `confirmOverwrite` (boolean). Se esiste già un asset per lo slot (`c.assets?.[0]` per Blog; per Meta l'asset del post o dello slide corrente) e `confirmOverwrite` è `false`, il primo click NON genera ma imposta `confirmOverwrite=true` e cambia label in "Sovrascrivi immagine? Clicca di nuovo". Secondo click → esegue `genImage()` e resetta `confirmOverwrite`. Nessun `window.confirm`/dialog nativo. Se non esiste immagine, comportamento invariato.

**Steps:**
- [ ] Impl Blog: aggiungi stato + logica al pulsante "Rigenera immagine".
- [ ] Impl Meta: stessa logica per post e per ogni slide del carosello (chiave per-slide se necessario).
- [ ] `npx tsc --noEmit` → 0 errori; `npx vitest run` → 179 verdi.
- [ ] Live-smoke (porta 3005): su un contenuto con immagine, primo click mostra la conferma, secondo rigenera; su contenuto senza immagine genera al primo click.
- [ ] Commit: `feat(image): confirm before overwriting an existing image`.

---

## PARTE B — Direzione Editoriale → coerenza immagini

### Task B1 — Schema: `EditorialDirection` + `KnowledgeFile.knowledgeType`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_editorial_direction/migration.sql` (a mano)

**Schema da aggiungere:**
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
+ su `KnowledgeFile`: `knowledgeType KnowledgeType?` (default null).

**migration.sql (a mano):**
```sql
CREATE TABLE "EditorialDirection" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "campagna" TEXT, "periodo" TEXT, "temi" TEXT,
  "tonoVisivo" TEXT, "daMostrare" TEXT, "daEvitare" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EditorialDirection_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "KnowledgeFile" ADD COLUMN "knowledgeType" "KnowledgeType";
```

**Steps:**
- [ ] Edita `schema.prisma`; scrivi `migration.sql`.
- [ ] `npx prisma migrate deploy` poi `npx prisma generate` → OK.
- [ ] Smoke: `npx prisma studio` o query — tabella presente, colonna presente.
- [ ] Commit: `feat(db): EditorialDirection model + KnowledgeFile.knowledgeType`.

### Task B2 — Modulo puro `editorial-context.ts` (+ test)

**Files:**
- Create: `src/lib/knowledge/editorial-context.ts`
- Test: `src/lib/knowledge/editorial-context.test.ts`

**Interfaces (Produces):**
```ts
export interface EditorialDirectionData {
  campagna?: string | null; periodo?: string | null; temi?: string | null;
  tonoVisivo?: string | null; daMostrare?: string | null; daEvitare?: string | null;
}
export function buildEditorialImageContext(
  d: EditorialDirectionData, planTexts: string, provider: ImageProvider
): string;
```
Regole (specchio di `buildBrandVisualContext`): HIGGSFIELD → solo positivi (`campagna, periodo, temi, tonoVisivo, daMostrare` + planTexts cap **200** char) in lista virgole, niente `daEvitare`. GPT/GEMINI → `Direzione editoriale Agocap: <positivi>.` + ` Evita: <daEvitare>.` + estratto piano, **cap totale ~700** char. Tutto vuoto → stringa vuota.

**Steps (TDD):**
- [ ] Test: Higgsfield = positivi senza "Evita"; GPT contiene "Direzione editoriale" e "Evita:"; cap rispettato; input vuoto → "".
- [ ] Run → FAIL; Impl; Run + full → PASS.
- [ ] Commit: `feat(knowledge): editorial image context builder`.

### Task B3 — Iniezione editoriale nei prompt immagine

**Files:**
- Modify: `src/lib/image/brief.ts` (`PromptCtx` += `editorial?: string`; accodalo **dopo** `brandVisual` in entrambi i percorsi di `buildImagePromptFromBrief`)
- Modify: `src/lib/image/generate.ts` (`ImageDeps` += `loadEditorial?`; carica e costruisce `editorial` via `buildEditorialImageContext`, passandolo in `PromptCtx`)
- Modify: `src/lib/image/runtime.ts` (`sharedImageDeps()` implementa `loadEditorial()`)
- Test: `src/lib/image/brief.test.ts` (editorial nel prompt, entrambi i percorsi)

**Interfaces:**
- Consumes: `buildEditorialImageContext` (B2), `EditorialDirectionData` (B2).
- `ImageDeps.loadEditorial?: () => Promise<{ direction: EditorialDirectionData; planTexts: string } | null>`
- `runtime` `loadEditorial`: legge `prisma.editorialDirection.findUnique({ where: { id: "default" }})` + testi da `KnowledgeItem` (`tipo: "PIANO_EDITORIALE"`) e `KnowledgeFile` (`stato: PRONTO`, `kind: DOCUMENTO`, `knowledgeType: PIANO_EDITORIALE`), concatenati con cap per-sorgente.

**Steps (TDD):**
- [ ] Test brief.ts: `PromptCtx.editorial="X"` → presente nel prompt GPT e nella lista Higgsfield, dopo brandVisual.
- [ ] Run → FAIL; Impl `brief.ts`; Run → PASS.
- [ ] Impl `generate.ts`: dopo `brandVisual`, se `deps.loadEditorial` → carica, costruisci `editorial`, mettilo in `PromptCtx`. Estendi `generate.test.ts` con fake `loadEditorial` (verifica che `editorial` arrivi nel prompt → ispeziona `callOpenAI` arg `prompt`).
- [ ] Impl `runtime.ts` `loadEditorial()`.
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi.
- [ ] Commit: `feat(image): inject editorial direction into image prompts`.

### Task B4 — API + UI Direzione Editoriale in `/knowledge`

**Files:**
- Create: `src/app/api/knowledge/editorial-direction/route.ts` (GET + PUT upsert singleton `default`; zod schema estratto in `src/app/api/knowledge/editorial-direction/validators.ts`)
- Create: `src/components/editorial-direction-editor.tsx` (stile `brand-visual-editor.tsx`: 6 campi textarea + Salva)
- Modify: `src/app/knowledge/page.tsx` (render `<EditorialDirectionEditor />` sopra/accanto a `<BrandVisualEditor />`)
- Test: `src/app/api/knowledge/editorial-direction/validators.test.ts` (schema puro)

**Steps:**
- [ ] Test schema: accetta i 6 campi opzionali; rifiuta tipi errati.
- [ ] Run → FAIL; Impl validators + route (upsert pattern come `visual-profile/route.ts`) + componente + render in page.
- [ ] `npx vitest run` verde; live-smoke (3005): GET vuoto ok, PUT salva, reload mostra i valori.
- [ ] Commit: `feat(knowledge): editorial direction editor + API`.

### Task B5 — Tag tipo sui file (PATCH + select UI)

**Files:**
- Modify: `src/app/api/knowledge/files/[id]/route.ts` (aggiungi `PATCH` con zod `{ knowledgeType: z.enum(KNOWLEDGE_TYPES).nullable() }`)
- Modify: `src/components/knowledge-files.tsx` (per ogni file DOCUMENTO un `<select>` tipo → PATCH; mostra il tag corrente)
- Test: estrai/usa schema zod testabile se utile; altrimenti live-smoke.

**Steps:**
- [ ] Impl PATCH (404 su P2025, come DELETE esistente).
- [ ] Impl select in `knowledge-files.tsx` (opzioni `—` + `KNOWLEDGE_TYPES`; default dal valore corrente).
- [ ] `npx tsc --noEmit` ok; live-smoke: tagga un PDF come `PIANO_EDITORIALE`, ricarica → tag persiste.
- [ ] Commit: `feat(knowledge): tag uploaded files with a knowledge type`.

### Task B6 — La Direzione Editoriale alimenta l'Identità Visiva

**Files:**
- Modify: `src/app/api/knowledge/visual-profile/generate/route.ts` (includi la `EditorialDirection` singleton nel `materiale` passato a `buildVisualProfilePrompt`)

**Steps:**
- [ ] Impl: dopo `loadKnowledgeKbItems()`, carica `editorialDirection` e appendi al `materiale` una sezione `[DIREZIONE_EDITORIALE] …` (le voci/file `PIANO_EDITORIALE` sono già incluse da `loadKnowledgeKbItems`).
- [ ] Live-smoke (richiede ANTHROPIC_API_KEY valida): "Genera dai materiali" produce un profilo coerente con la direzione editoriale. Se la key non è valida, verifica solo che la sezione sia inclusa nel prompt (log) e che l'errore sia pulito (502).
- [ ] Commit: `feat(knowledge): feed editorial direction into visual-profile generation`.

---

## Verifica end-to-end

1. `npx vitest run` → tutti verdi (179 esistenti + nuovi A1/A2/B2/B3/B4).
2. `npx tsc --noEmit` → 0 errori.
3. Live-smoke su porta 3005:
   - `/knowledge`: compila Direzione Editoriale, carica un PDF e taggalo `PIANO_EDITORIALE`.
   - `/blog/[id]` e `/meta/[id]`: genera immagine con un brief verticale → verifica (rete/log) che la size GPT sia `1024x1536` e che il `prompt` salvato sull'asset contenga la direzione editoriale.
   - Rigenera la stessa immagine → appare la conferma di sovrascrittura.
4. Nota credito: la generazione immagine reale richiede credito provider valido (GPT/Gemini/Higgsfield); il provider **MANUAL** resta sempre verificabile. La generazione testo/Identità Visiva richiede `ANTHROPIC_API_KEY` valida (attualmente la key in `.env` è 401 — vedi memoria progetto); in mancanza, il fail-safe deve restare pulito.

## Note di sequenza
- Ordine consigliato: A1 → A2 → A3 → B1 → B2 → B3 → B4 → B5 → B6.
- B3 dipende da B1 (schema) e B2 (context builder). B5 e B6 dipendono da B1.
