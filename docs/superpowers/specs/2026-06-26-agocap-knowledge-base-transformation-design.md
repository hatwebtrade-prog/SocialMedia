# Knowledge Base Transformation — Design

- **Data:** 2026-06-26
- **Contesto:** AGOCAP Content AI Hub. La KB oggi è solo testo (`KnowledgeItem`: tipo/titolo/contenuto/tags/productId), iniettata nei prompt di **testo** (meta/blog/email/brain via `buildKbContext`). NON tocca la generazione immagini/video. L'utente vuole una KB **plurifunzionale** (testo + file: piano editoriale, idee personali, linee guida brand) che **personalizzi tutta la generazione** (testo, immagini, video) con **coerenza di brand**.
- **Stato:** Design approvato in brainstorming.
- **Decisioni:** file con estrazione testo (PDF/DOCX/TXT/MD) + immagini di riferimento; **Profilo Identità Visiva** strutturato, sempre iniettato nei brief immagini/video, pre-compilabile dai file via Claude.
- **Build in 2 fasi:** (A) KB + file + estrazione; (B) Profilo Visivo + iniezione coerenza.

---

## 1. Obiettivo
1. KB **plurifunzionale**: materiale testuale (come oggi, con nuovi tipi) + **file** (documenti con estrazione testo + immagini di riferimento).
2. Il materiale testuale (incl. testo estratto dai file) alimenta i **prompt di testo** (già oggi, esteso ai file).
3. Un **Profilo Identità Visiva** strutturato guida la **generazione immagini/video** (coerenza brand), iniettato nel brief.

---

## 2. Modello dati

### 2.1 `KnowledgeItem` (esteso)
Aggiungere al `KnowledgeType` enum i tipi: `IDEA_PERSONALE`, `PIANO_EDITORIALE`. (Resto invariato.)

### 2.2 `KnowledgeFile` (nuovo)
```prisma
model KnowledgeFile {
  id          String   @id @default(cuid())
  nome        String              // nome file originale
  path        String              // uploads/knowledge/<id>.<ext>
  mimeType    String
  kind        KnowledgeFileKind   // DOCUMENTO | IMMAGINE
  testo       String?             // testo estratto (documenti)
  stato       FileStatus          // IN_CORSO | PRONTO | ERRORE
  errore      String?
  createdAt   DateTime @default(now())
}
enum KnowledgeFileKind { DOCUMENTO IMMAGINE }
enum FileStatus { IN_CORSO PRONTO ERRORE }
```
- Documenti (PDF/DOCX/TXT/MD): testo estratto in `testo`. Immagini (PNG/JPG/WEBP): salvate come riferimento visivo (no estrazione).

### 2.3 `BrandVisualProfile` (nuovo, riga singola)
```prisma
model BrandVisualProfile {
  id                  String   @id @default("default")
  palette             String[] @default([])   // es. ["verde salvia #8FA98A", "bianco caldo"]
  stileFotografico    String?                 // es. "UGC iphone, luce naturale, autentico"
  mood                String?                 // es. "fresco, sano, rassicurante"
  elementiRicorrenti  String?                 // es. "ingredienti naturali, mani, cucina luminosa"
  daEvitare           String?                 // es. "aspetto plasticoso, sfondi clinici, testo in immagine"
  referenceImagePaths String[] @default([])   // riferimenti visivi (da KnowledgeFile IMMAGINE)
  updatedAt           DateTime @updatedAt
}
```
Un solo record (`id: "default"`), upsert.

---

## 3. Estrazione file
- `src/lib/knowledge/extract.ts`: `extractText(buffer, mimeType): Promise<string>`.
  - PDF → `pdf-parse`. DOCX → `mammoth` (raw text). TXT/MD → `buffer.toString("utf-8")`.
  - Funzione pura `pickExtractor(mimeType)` testabile (sceglie il parser/decide kind). Estrazione best-effort: errore → `stato: ERRORE`, `errore` valorizzato, non blocca l'upload.
- Upload: `POST /api/knowledge/files` (multipart o base64) → salva file in `uploads/knowledge/`, crea `KnowledgeFile` `IN_CORSO`, estrae (documenti) → `PRONTO`/`ERRORE`. Immagini → `PRONTO` subito. Serve: `GET /api/knowledge/files/[id]/raw`.

---

## 4. Auto-compilazione Profilo Visivo (Claude)
- `src/lib/knowledge/visual-profile.ts`: `buildVisualProfilePrompt(materials)` + parsing JSON (prompt-enforced + `stripFences` + zod), pattern già usato nel progetto (`claude.messages.create({model:"claude-opus-4-8"})`).
- `POST /api/knowledge/visual-profile/generate`: raccoglie testo (KnowledgeItem + KnowledgeFile.testo) → Claude sintetizza `{palette[], stileFotografico, mood, elementiRicorrenti, daEvitare}` → upsert `BrandVisualProfile` (l'utente poi modifica a mano). Fail-safe (ERROR senza sovrascrivere).
- `GET`/`PUT /api/knowledge/visual-profile`: legge/salva il profilo (editing manuale).

---

## 5. Iniezione coerenza nella generazione

### 5.1 Immagini/Video (il cuore)
- `src/lib/image/brief.ts`: `PromptCtx` += `brandVisual?: string`. In `buildImagePromptFromBrief`:
  - GPT/Gemini: appende un blocco "Coerenza brand Agocap: {palette}; stile {stileFotografico}; mood {mood}; elementi {elementiRicorrenti}." + "Evita: {daEvitare}." nelle negazioni.
  - Higgsfield: appende SOLO i descrittori positivi (palette/stile/mood/elementi) alla frase corta; **niente** `daEvitare` (le negazioni rompono Soul).
- `src/lib/knowledge/brand-context.ts`: `buildBrandVisualContext(profile, provider): string` (puro/testato) — formatta il profilo per il provider.
- `src/lib/image/generate.ts`: `ImageDeps` += `loadBrandVisual?: () => Promise<BrandVisualData | null>`. In `generateImageAsset`: carica il profilo → `ctx.brandVisual = buildBrandVisualContext(profile, provider)`. Runtime implementa `loadBrandVisual` (legge `BrandVisualProfile`). Se assente/null → comportamento attuale.

### 5.2 Testo (meta/blog/email/brain)
- `buildKbContext` riceve anche il testo estratto dai file: in `loadContext` (meta/blog/email/brain runtime) si aggiungono i `KnowledgeFile` con `stato:PRONTO && testo` come ulteriori `KbItem` (`tipo:"DOCUMENTO"`, titolo=nome). Nessun cambio di firma di `buildKbContext` (riceve già `knowledge: KbItem[]`).

---

## 6. UI nuova area `/knowledge` (a sezioni)
- **Materiale testuale**: form (tipo esteso/titolo/contenuto/tags) + lista con elimina (come oggi, riorganizzato).
- **File**: upload (drag&drop o input) per documenti e immagini; lista con stato estrazione (badge IN_CORSO/PRONTO/ERRORE), anteprima immagini, elimina.
- **Identità Visiva**: editor del Profilo (palette come chip, stile/mood/elementi/evita come campi, anteprime immagini di riferimento) + bottone **"Genera dai materiali"** (auto-compila via Claude) + salva.
- Nota UI: spiega che l'Identità Visiva guida automaticamente le immagini/video generati.

---

## 7. Errori / degrade
- Estrazione file KO → `stato:ERRORE`, file comunque salvato; non blocca la KB.
- Profilo assente → generazione come oggi (nessuna coerenza forzata).
- Auto-compilazione Claude KO → ERROR, profilo esistente intatto.
- `buildBrandVisualContext`/`buildImagePromptFromBrief` puri, non lanciano; campi vuoti omessi.

---

## 8. Dipendenze
- `pdf-parse` (PDF→testo), `mammoth` (DOCX→testo). TXT/MD nativo. (Immagini: nessuna lib, solo storage — `sharp` già presente se serve thumbnail.)

---

## 9. Testing
- `pickExtractor(mimeType)` (documento vs immagine, parser scelto). — unit.
- `extractText` per TXT/MD (deterministico). — unit (PDF/DOCX verificati live).
- `buildBrandVisualContext` GPT vs Higgsfield (negazioni solo GPT; positivo per Higgsfield; campi vuoti omessi). — unit.
- `buildImagePromptFromBrief` con `ctx.brandVisual` (incluso nel prompt). — unit.
- Visual-profile JSON parsing (Claude mockato). — unit.
- Kb context include file PRONTO. — unit.
- Gate tsc+build+vitest. **Smoke live**: carico un PDF/TXT → testo estratto; carico immagine → riferimento; "Genera Identità Visiva" → profilo compilato; genero un'immagine → il prompt contiene la coerenza brand (verifico nel prompt salvato sull'asset).

---

## 10. Fuori scope
- Embedding/ricerca semantica (RAG) — qui si inietta testo strutturato, non vettori.
- Passare immagini di riferimento brand come input ai modelli (slot occupato dal prodotto) — i riferimenti contano come guida testuale + reference utente; eventuale secondo riferimento Higgsfield = valutazione futura.
- Versioning del profilo.

---

## 11. Backlog (per writing-plans)
**Fase A — KB + file**
1. Prisma: `KnowledgeFile` + enum, nuovi `KnowledgeType` (IDEA_PERSONALE, PIANO_EDITORIALE) (migrazione).
2. `extract.ts` (`pickExtractor` TDD + `extractText`) + deps pdf-parse/mammoth.
3. Upload route `POST /api/knowledge/files` + estrazione + serve `GET /api/knowledge/files/[id]/raw` + DELETE.
4. KB text prompts includono i file PRONTI (loadContext meta/blog/email/brain).
5. UI sezione File (upload + stato + anteprime).

**Fase B — Profilo Visivo + coerenza**
6. Prisma: `BrandVisualProfile` (migrazione) + GET/PUT route.
7. `buildBrandVisualContext` (TDD) + `PromptCtx.brandVisual` in `buildImagePromptFromBrief` (TDD) + `loadBrandVisual` in generate/runtime.
8. Auto-compilazione: `visual-profile.ts` + `POST /api/knowledge/visual-profile/generate` (Claude).
9. UI sezione Identità Visiva (editor + "Genera dai materiali").
10. Gate + smoke live.

---

## 12. Rischi
| Rischio | Mitigazione |
|---|---|
| Parsing PDF/DOCX fragile | best-effort, stato ERRORE non bloccante; TXT/MD sempre ok |
| Profilo testuale non basta per coerenza visiva forte | descrittori mirati (palette/stile/mood); reference immagini come guida; iterazione |
| Iniezione brand su Higgsfield (negazioni) | solo positivi su Higgsfield, negazioni solo GPT/Gemini |
| KB testo gonfia i prompt | i file molto lunghi: troncare/riassumere il testo estratto in `buildKbContext` (cap caratteri) |
| Upload file grandi | limite dimensione + tipi consentiti nella route |
