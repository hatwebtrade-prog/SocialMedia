# Batch Multigenerazione — Design

**Data:** 2026-07-02
**Branch:** brain-mvp-clean

## Obiettivo

Permettere di selezionare più idee sulla board del Brain e, con un clic, generare in
**background** il **contenuto + immagine per ogni destinazione** (BLOG e META) di ogni idea,
con avanzamento visibile. L'utente può chiudere la pagina: il lavoro prosegue lato server.

Motivazione: oggi la generazione è una-idea-alla-volta, e l'immagine (gpt-image-2 ~150s) è il
collo di bottiglia. Il batch parallelizza per far risparmiare tempo.

## Decisioni approvate

- **Canali:** solo **BLOG** e **META**. EMAIL fuori scope (flusso newsletter diverso).
- **Destinazioni:** per ogni idea si genera per **tutte le sue `destinazioni`** tra BLOG/META.
- **Robustezza:** gira in **background** (chiudibile). Runner in-process + stato su DB.
- **Immagine senza prodotto:** se l'idea non ha un prodotto collegato, genera **solo il
  contenuto** e **salta l'immagine** (task marcato con nota, non è un fallimento).
- **Concorrenza:** cap **3** task in parallelo.
- **Contenuti:** genera sempre **nuove bozze** (`status = BOZZA`), non tocca contenuti esistenti.
- **Immagine segue l'idea:** usa `ideaCreativa = testo dell'idea`, `productId = prodotto
  collegato all'idea`, archetipo default `ADV` (sfrutta il fix già fatto in `buildArchetypePrompt`).

## Architettura

### Meccanismo background (scelta)

L'app è un singolo server Next in esecuzione continua. La rotta `POST /api/batch/generate`:
1. valida l'input e crea i record `BatchJob` + `BatchTask`;
2. **avvia il runner asincrono senza attenderlo** (`void runBatch(jobId)`);
3. risponde subito con `{ batchJobId }`.

Il runner processa i task con un cap di concorrenza (3), riusando i motori esistenti, e aggiorna
lo stato su DB. Poiché il server resta acceso, il lavoro continua anche a pagina chiusa.

**Alternativa scartata:** worker/cron separato o coda esterna (Redis/BullMQ) — più robusto ma
sovradimensionato per un singolo server interno.

**Limite noto:** un riavvio del server a metà lascia i task in `IN_ATTESA`/`IN_CORSO`. Mitigazione:
pulsante **"Riprova non completati"** che ri-accoda i task non `COMPLETATO` di un job.

### Modello dati (2 tabelle nuove + migration)

```prisma
model BatchJob {
  id         String      @id @default(cuid())
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  stato      BatchStato  @default(IN_CORSO)   // IN_CORSO | COMPLETATO | PARZIALE | FALLITO
  totale     Int
  completati Int         @default(0)
  falliti    Int         @default(0)
  tasks      BatchTask[]
}

model BatchTask {
  id         String         @id @default(cuid())
  batchJobId String
  batchJob   BatchJob       @relation(fields: [batchJobId], references: [id], onDelete: Cascade)
  ideaId     String
  idea       Idea           @relation(fields: [ideaId], references: [id], onDelete: Cascade)
  canale     BatchCanale                          // BLOG | META
  stato      BatchTaskStato @default(IN_ATTESA)   // IN_ATTESA | IN_CORSO | COMPLETATO | FALLITO
  contentId  String?                              // GeneratedContent creato
  imageSkipped Boolean      @default(false)       // immagine saltata (idea senza prodotto)
  errore     String?
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
  @@index([batchJobId])
}

enum BatchStato { IN_CORSO COMPLETATO PARZIALE FALLITO }
enum BatchCanale { BLOG META }
enum BatchTaskStato { IN_ATTESA IN_CORSO COMPLETATO FALLITO }
```

`Idea` e `GeneratedContent` restano invariati (nessuna FK inversa obbligatoria; la relazione
`Idea.batchTasks` è opzionale).

### Componenti (file)

Logica pura (testabile, node/vitest):
- `src/lib/batch/plan.ts` — `buildBatchTasks(ideas)`: da `[{id, destinazioni}]` → lista di
  `{ideaId, canale}` per ogni destinazione ∈ {BLOG, META}. Idee senza destinazioni valide → nessun task.
- `src/lib/batch/status.ts` — funzioni pure per le transizioni/riepilogo:
  `rollupJobStato({totale, completati, falliti})` → `IN_CORSO|COMPLETATO|PARZIALE|FALLITO`;
  `mapConcurrency(cap, items)` helper (o si usa un semplice pool).

Runtime (impuro, riusa i motori esistenti):
- `src/lib/batch/runner.ts` — `runBatch(jobId, deps)`: pool con cap 3; per ogni task chiama
  `runTask`. `runTask` genera contenuto (blog o meta) poi immagine (`generateImageAsset`) se il
  prodotto è presente; aggiorna `BatchTask` e i contatori del `BatchJob`; non lancia mai (cattura
  gli errori nel task).
- `src/lib/batch/deps.ts` — costruisce le deps reali (blog gen, meta gen, image gen) per il runner.

API:
- `POST /api/batch/generate` — body `{ ideaIds: string[] }` → crea job+task, avvia runner, ritorna `{ batchJobId }`.
- `GET  /api/batch/[id]` — ritorna job + task (per il polling della UI).
- `POST /api/batch/[id]/retry` — ri-accoda i task non `COMPLETATO` e riavvia il runner.

UI:
- Board Brain: pulsante **"Genera in blocco (N)"** nella barra azioni bulk (accanto a Cestina/Archivia),
  attivo quando ci sono idee selezionate.
- Pannello/toast di avanzamento con **polling** `GET /api/batch/[id]` ogni ~3s: "7/12 completati,
  1 fallito, 2 immagini saltate", link ai contenuti creati, pulsante "Riprova non completati".

## Flusso dati

1. Utente seleziona idee → "Genera in blocco (N)" → `POST /api/batch/generate {ideaIds}`.
2. Server: carica le idee (id + destinazioni + productId), `buildBatchTasks` → task list; crea
   `BatchJob{totale}` + `BatchTask[]`; `void runBatch(jobId)`; risponde `{batchJobId}`.
3. Runner (cap 3): per ogni task
   - `IN_CORSO`;
   - genera contenuto del canale (BLOG → motore blog; META → motore meta) come **BOZZA**, salva `contentId`;
   - se `idea.productId` presente → genera immagine (`generateImageAsset` con `ideaCreativa`=testo
     idea, `productId`, archetipo `ADV`); altrimenti `imageSkipped = true`;
   - `COMPLETATO` (o `FALLITO` con `errore`); aggiorna contatori job.
4. Al termine di tutti i task: `rollupJobStato` → stato finale del job.
5. UI polling mostra avanzamento e, a fine, il riepilogo con i link.

## Gestione errori

- Ogni `runTask` è isolato: un errore marca **solo** quel task `FALLITO` (con messaggio) e non
  blocca gli altri.
- Nessun fallimento silenzioso: gli errori sono persistiti su `BatchTask.errore` e mostrati in UI.
- Immagine saltata (idea senza prodotto) **non** è un errore: `imageSkipped = true`, task
  `COMPLETATO`, evidenziato in UI.
- `POST /api/batch/[id]/retry` ri-accoda i task `IN_ATTESA`/`IN_CORSO`/`FALLITO` (non `COMPLETATO`).
- Input non valido (ideaIds vuoto/inesistenti) → 400.

## Test

Unit (vitest, funzioni pure):
- `buildBatchTasks`: idea con `["BLOG","META"]` → 2 task; con `["EMAIL"]` → 0; ordine stabile;
  più idee → concatenazione corretta.
- `rollupJobStato`: tutti completati → COMPLETATO; alcuni falliti + alcuni completati → PARZIALE;
  tutti falliti → FALLITO; ancora in corso → IN_CORSO.
- pool di concorrenza: non supera il cap; processa tutti gli item.

Runtime/rotte/UI: verificati con `npx tsc --noEmit` + `npm run build` + smoke manuale (nessun
unit test su componenti/route, come da convenzione del progetto).

## Fuori scope (v1)

- Canale EMAIL.
- Ripresa automatica dei job dopo riavvio del server (c'è il retry manuale).
- Selezione di archetipo/brief per-immagine nel batch (usa default `ADV`; la generazione singola
  resta invariata per il fine-tuning).
- Programmazione/scheduling del batch.
