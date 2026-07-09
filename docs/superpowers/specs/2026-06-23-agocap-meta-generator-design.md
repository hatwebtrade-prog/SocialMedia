# AGOCAP Content AI Hub — Spec di Design: Generatore Meta (fetta C, parte 1)

- **Data:** 2026-06-23
- **Sotto-progetto:** Generatori contenuti (fetta C di 6) — primo generatore: **Meta (Instagram/Facebook)**
- **Dipende da:** Brain MVP (fetta B) — modello `Idea`, stato `APPROVATA`, KB, `buildKbContext`, pattern pipeline Claude
- **Stato:** Design approvato in brainstorming, in attesa di review utente

---

## 1. Contesto e scope

La fetta C trasforma le idee **approvate** dal Brain in contenuti veri. Copre 3 generatori
(Meta, TikTok, Blog); come per il Brain, si costruisce **un generatore end-to-end** e poi si
replica. Primo generatore scelto: **Meta**.

**In scope (questa fetta):** generazione testo (caption, idea creativa, hashtag, CTA; slide per
il carosello) via Claude, generazione **immagini on-demand** via OpenAI, revisione/modifica,
approvazione, lista + **calendario** per data prevista.

**Fuori scope:** la **pubblicazione/programmazione** effettiva su Meta (è la fetta D, via n8n);
i generatori TikTok e Blog (fette C successive); la **generazione video** (l'API video OpenAI non
è generalmente disponibile → spike separato, non in questa fetta); polish grafico dedicato.

### Vincoli raccolti in brainstorming
- Primo generatore = **Meta**; formati = **POST + CAROSELLO**; piattaforme = Instagram / Facebook / entrambe.
- 1 bozza per richiesta (con "rigenera"); formato e piattaforme scelti dall'utente.
- Solo da idee con stato `APPROVATA`.
- **Testo via Claude** (`claude-opus-4-8`); **immagini via OpenAI** (`gpt-image-1`), provider separato e sostituibile.
- Immagini **on-demand** (pulsante), non automatiche; salvate su volume persistente; nessun video.
- Vista **lista + calendario** (mensile) per `dataPrevista`.
- Stati contenuto: `BOZZA → DA_APPROVARE → APPROVATO` (`PROGRAMMATO`/`PUBBLICATO` definiti ora ma usati dalla fetta D).
- Audit AI (prompt/output/token/modello) salvato sul contenuto e sugli asset.
- Riuso della KB del Brain (tono di voce `BRAND_VOICE` + prodotto collegato) per ancorare lo stile.

---

## 2. Obiettivo dell'MVP

Permettere a una persona del team di:
1. Partire da un'idea approvata e generare una **bozza Meta** (post o carosello) coerente con tono e prodotto.
2. Modificare i campi testuali, impostare una **data prevista**.
3. Generare **on-demand** un'immagine per il post o per ogni slide del carosello.
4. Far avanzare lo stato fino ad `APPROVATO`.
5. Vedere i contenuti in **lista** (con filtri) e in **calendario**.

---

## 3. Stack — aggiunte

| Cosa | Tecnologia | Note |
|---|---|---|
| Generazione immagini | **OpenAI SDK** (`openai`), modello `gpt-image-1` | provider separato; chiave in `OPENAI_API_KEY` |
| Storage immagini | directory persistente `uploads/` (volume Docker) | servita via route `GET /api/assets/[id]` (compatibile standalone) |

Tutto il resto invariato (Next.js 15 + Prisma/Postgres + Tailwind + `@anthropic-ai/sdk`).
La generazione testo riusa l'approccio del Brain: **JSON guidato da prompt + validazione zod**
(l'SDK Anthropic 0.70.1 non espone `output_config` e l'API rifiuta `output_format` deprecato — vedi
spec del Brain). La generazione immagini usa l'SDK OpenAI **direttamente** (provider diverso da Claude).

---

## 4. Modello dati

### Nuovi enum
- **Canale:** `META · TIKTOK · BLOG` (solo `META` usato ora; gli altri per le fette C successive)
- **ContentFormat:** `POST · CAROSELLO` (Meta; TikTok/Blog aggiungeranno valori)
- **ContentStatus:** `BOZZA · DA_APPROVARE · APPROVATO · PROGRAMMATO · PUBBLICATO` (la fetta C usa i primi 3)
- **AssetType:** `IMMAGINE` (`VIDEO` futuro)

### `GeneratedContent`
`id · ideaId(FK Idea, onDelete Cascade) · canale(Canale) · formato(ContentFormat) · piattaforme(Platform[]) · status(ContentStatus @default BOZZA) · dataPrevista(DateTime?) · payload(Json) · promptUsato(text) · modello(string) · inputTokens(int) · outputTokens(int) · outputGrezzo(Json) · createdAt · updatedAt`
- `@@index([status])`, `@@index([canale])`, `@@index([dataPrevista])`, `@@index([ideaId])`
- `piattaforme` usa l'enum `Platform` esistente (valori `INSTAGRAM`/`FACEBOOK`); entrambe = due valori.

### `GeneratedAsset`
`id · contentId(FK GeneratedContent, onDelete Cascade) · slideIndex(Int?) · tipo(AssetType @default IMMAGINE) · prompt(text) · modello(string) · path(string) · createdAt`
- `@@index([contentId])`. `slideIndex` null = immagine del post; valorizzato = slide del carosello.

### Schema del `payload` (validato da zod)
- **POST:** `{ caption: string, ideaCreativa: string, hashtags: string[], cta: string }`
- **CAROSELLO:** come POST + `slides: [{ testo: string }]` (3–10 slide)

> Su `Idea` si aggiunge la relazione inversa `contenuti GeneratedContent[]`. Nessun'altra modifica al Brain.

---

## 5. Flusso utente

```
Idea (status=APPROVATA)
  └─ "Genera contenuto Meta"  (scegli formato POST/CAROSELLO, piattaforme IG/FB, n. slide)
       └─ Claude → bozza testuale  → GeneratedContent (status=BOZZA) + audit, link all'idea
            ├─ modifica campi (caption, idea creativa, hashtag, CTA, slide)
            ├─ "Genera immagine" (post o per-slide) → OpenAI → GeneratedAsset (file su volume)
            ├─ imposta dataPrevista
            └─ stato → DA_APPROVARE → APPROVATO
                 └─ visibile in Lista e Calendario  (→ futura fetta D: programma/pubblica)
```

---

## 6. Generatore testo (Claude)

Pipeline analoga al Brain, con dipendenze iniettate (testabile con Claude mockato):
1. **Contesto:** `buildKbContext` (riuso) con KB `BRAND_VOICE` + il prodotto collegato all'idea + i dati dell'idea (titolo, descrizione, categoria) + piattaforme scelte (per calibrare il tono IG vs FB).
2. **Prompt + structured JSON:** un prompt Meta che chiede i campi del formato scelto; risposta JSON-only, `JSON.parse` + validazione con lo schema zod del payload (POST o CAROSELLO).
3. **Persisti:** `GeneratedContent` (status `BOZZA`) con `payload`, `promptUsato`, `modello`, token, `outputGrezzo`; collegato all'idea. Fail-safe: errore → nessuna bozza creata, messaggio chiaro (come nel Brain).

Per il carosello il prompt riceve `numeroSlide` (default 5, range 3–10) e deve restituire esattamente quel numero di slide.

---

## 7. Generatore immagini (OpenAI, on-demand)

Modulo `ImageGenerator` isolato (interfaccia `generate(prompt) → bytes`), implementazione OpenAI `gpt-image-1`. Provider sostituibile.

- **Prompt immagine:** costruito da `ideaCreativa` del contenuto + eventuali linee guida visual presenti in KB + uno stile coerente col brand; il prompt usato è salvato in `GeneratedAsset.prompt` per audit.
- **Trigger:** `POST /api/meta/contents/[id]/image` con `slideIndex?` — post (nessun indice) o singola slide. On-demand, mai automatico.
- **Storage:** i byte restituiti (b64) vengono scritti in `uploads/<contentId>/<assetId>.png` su un volume persistente; in `GeneratedAsset.path` si salva il percorso relativo. Le immagini si servono via `GET /api/assets/[id]` (legge il file dal volume) — compatibile col build standalone.
- **Rigenerazione:** ri-generare un'immagine crea un nuovo `GeneratedAsset` (storico) o sostituisce quello esistente per quello `slideIndex` — scelta: **sostituisce** (1 immagine corrente per post/slide), eliminando il file precedente.
- Fail-safe: errore OpenAI o `OPENAI_API_KEY` mancante → nessun asset creato, messaggio d'errore; il contenuto resta intatto; nessun crash.

---

## 8. Pagine (Area Meta)

1. **Dashboard Meta** (`/meta`) — tabella dei contenuti (colonne: titolo idea, formato, piattaforme, stato, data prevista, n. immagini) con filtri stato/formato/piattaforma, ordinabile per data prevista. Toggle **Lista / Calendario**.
2. **Calendario** (`/meta/calendario`) — vista mensile: ogni contenuto appare nel giorno della sua `dataPrevista`; navigazione mese prec./succ.; click → dettaglio. Sola lettura (la data si imposta dal dettaglio).
3. **Genera da idea** (`/meta/genera`) — selettore delle idee `APPROVATA` (riusa `GET /api/ideas?status=APPROVATA`) + opzioni formato/piattaforme/n. slide → genera. (Accessibile anche dal dettaglio idea del Brain con un pulsante "Genera contenuto Meta".)
4. **Dettaglio contenuto** (`/meta/[id]`) — campi editabili (caption, idea creativa, hashtag, CTA; slide per il carosello con anteprima per-slide), **anteprima testo**, immagini con pulsante "Genera immagine" per post/slide, stato (select), data prevista (date picker), link all'idea sorgente, audit AI (modello, run).

---

## 9. API

| Metodo | Endpoint | Scopo |
|---|---|---|
| POST | `/api/meta/generate` | genera bozza testuale da un'idea approvata (ideaId, formato, piattaforme, numeroSlide?) |
| GET | `/api/meta/contents` | lista (filtri stato/formato/piattaforma; ordine per dataPrevista) |
| GET/PATCH/DELETE | `/api/meta/contents/[id]` | dettaglio / modifica (payload, stato, dataPrevista) / elimina |
| POST | `/api/meta/contents/[id]/image` | genera+salva immagine (slideIndex?) |
| GET | `/api/assets/[id]` | serve il file immagine dal volume |

---

## 10. Gestione errori

- **Claude (testo) fallito/timeout/JSON non valido:** nessuna `GeneratedContent` creata; risposta 502 con messaggio; nessuna bozza parziale.
- **OpenAI (immagine) fallito o chiave mancante:** nessun `GeneratedAsset` creato; risposta d'errore leggibile; il contenuto resta; file parziali non lasciati su disco.
- **Validazione input:** lato server con zod; 400 con messaggi chiari. Generazione consentita solo se l'idea è `APPROVATA` (altrimenti 400/409).
- **PATCH/DELETE su id inesistente:** 404 (gestione `P2025` come nel Brain).

---

## 11. Testing

Unit (nessuna chiamata reale a Claude/OpenAI):
- Schema zod payload POST e CAROSELLO (campi, n. slide, rifiuto valori errati).
- Costruttore del prompt immagine (include idea creativa + stile).
- Validatori e transizioni di stato del contenuto; validazione del PATCH (payload/stato/dataPrevista).
- Pipeline testo con **Claude mockato** (deps iniettate): crea contenuto BOZZA + audit; percorso d'errore → nessun contenuto.
- Route immagine con **OpenAI mockato**: salva asset + path; percorso d'errore → nessun asset, nessun file.
- Route `generate` con seam a dipendenze iniettate (riuso del pattern Brain).

Integration/manuale (smoke): generazione testo reale (Claude) + immagine reale (OpenAI) verificata end-to-end con le chiavi, su DB reale (come fatto per il Brain).

---

## 12. Backlog di sviluppo (MVP fetta C — Meta)

1. Migrazione Prisma: enum (Canale/ContentFormat/ContentStatus/AssetType), `GeneratedContent`, `GeneratedAsset`, relazione su `Idea`.
2. Schema zod del payload Meta (POST/CAROSELLO) + tipi condivisi.
3. Validatori contenuto (create da idea, update, transizioni di stato).
4. Prompt builder Meta (per formato/piattaforme).
5. Pipeline testo Meta (contesto → Claude JSON → valida → persisti), deps iniettate + test.
6. Wiring runtime testo (Claude + Prisma).
7. `ImageGenerator` (OpenAI `gpt-image-1`) + builder prompt immagine + storage su volume + route asset.
8. API: `/api/meta/generate`, `/api/meta/contents`, `/api/meta/contents/[id]`, `/api/meta/contents/[id]/image`, `/api/assets/[id]`.
9. Pagina Dashboard Meta (lista + filtri).
10. Vista Calendario.
11. Pagina Genera da idea (+ pulsante dal dettaglio idea del Brain).
12. Dettaglio contenuto (modifica, immagini on-demand, stato, data prevista, audit).
13. Test (unit + pipeline/route mockate).
14. Docker: volume `uploads` + `OPENAI_API_KEY` in env/compose.

---

## 13. Roadmap (oltre questa fetta)

- **Generatori TikTok e Blog** (fette C successive): riusano `GeneratedContent`/`GeneratedAsset`, lista, calendario, approvazione — cambia solo il `payload` (e lo schema zod) e il prompt.
- **Spike video** (OpenAI Sora o altro provider) come `AssetType.VIDEO` quando l'API sarà disponibile.
- **Fetta D — pubblicazione:** stati `PROGRAMMATO`/`PUBBLICATO`, webhook → n8n → Meta; il calendario diventa anche di programmazione.
- **Fetta E — Marketing Plan/Brand:** sostituisce/arricchisce il contesto di stile oggi preso dalla KB.

---

## 14. Rischi tecnici

| Rischio | Impatto | Mitigazione |
|---|---|---|
| API video OpenAI non disponibile | medio | esclusa dalla fetta; spike separato; modello `AssetType` già predisposto |
| Costi immagini (carosello = molte immagini) | medio | generazione **on-demand** per slide, mai automatica; nessuna pre-generazione |
| URL immagini OpenAI effimeri | medio | si salvano i byte su volume persistente, non si conserva l'URL OpenAI |
| Storage su standalone/Lightsail | medio | volume Docker dedicato `uploads/` + route che legge il file; niente dipendenza da `public/` |
| Due provider (Claude + OpenAI) | basso | moduli isolati e sostituibili; chiavi separate in env; fail-safe indipendenti |
| Qualità coerenza tono caption | basso | riuso KB `BRAND_VOICE` + prodotto; sarà rafforzato dalla fetta E |

---

## 15. Schema per iniziare lo sviluppo

1. Approvazione di questa spec.
2. Piano di implementazione dettagliato (skill `writing-plans`).
3. Esecuzione per task del backlog (sez. 12), con review a due stadi come per il Brain.
4. Smoke test end-to-end con chiavi reali (Claude + OpenAI).

> **Chiavi API:** `ANTHROPIC_API_KEY` e `OPENAI_API_KEY` vanno in `.env` (gitignored) e nell'env del container. Da rigenerare se esposte.
