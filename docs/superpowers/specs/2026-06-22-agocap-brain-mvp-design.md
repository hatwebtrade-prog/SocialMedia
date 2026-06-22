# AGOCAP CONTENT AI HUB — Spec di Design: MVP "Brain"

- **Data:** 2026-06-22
- **Sotto-progetto:** AI Brain / Superpower Brainstorming (fetta 1 di 6)
- **Stato:** Design approvato in brainstorming, in attesa di review utente

---

## 1. Contesto e decisione di scope

Il progetto completo **AGOCAP CONTENT AI HUB** è un portale interno per ricerca,
generazione, approvazione e pubblicazione automatizzata di contenuti social, TikTok
e blog Shopify. È composto da **6 sottosistemi indipendenti**:

| # | Sottosistema | Ruolo | Dipende da |
|---|---|---|---|
| **A** | Fondamenta + Content Hub | DB, modello contenuto, approvazione, calendario | — |
| **B** | **AI Brain / Superpower Brainstorming** | raccolta trend + motore idee + classificazione | A |
| **C** | Generatori AI (Meta / TikTok / Blog) | idee approvate → contenuti | A, E |
| **D** | Pipeline di pubblicazione | webhook → n8n → Meta/TikTok/Shopify | A, C |
| **E** | Marketing Plan / Brand | tono, font, colori, prodotto del mese | — |
| **F** | Report & Alert | metriche, alert, suggerimenti | tutto |

**Decisione:** non si progetta/costruisce tutto insieme. Si parte da una fetta
verticale. La fetta scelta è il **Brain (B)** più il minimo di fondamenta (A)
necessario a farlo funzionare. Le altre fette avranno ognuna la propria
spec → piano → implementazione.

Il Brain è costruito come motore di idee autonomo: quando in futuro arriveranno
i generatori di contenuti (C), le idee con stato `APPROVATA` saranno già pronte
da passare a valle.

### Vincoli raccolti in brainstorming

- Motore = **AI + sorgenti dati estensibili nel tempo + inserimento manuale**.
- Knowledge base aziendale **sparsa, da consolidare** → l'MVP include un'area KB.
- Hosting: **self-hosted in Docker su AWS Lightsail** (dominio già disponibile).
- Team: **utente + un programmatore** (+ AI per costruire passo-passo).
- **Nessun sistema utenti/login nell'MVP** — single-tenant, focus sul funzionamento.
  In futuro il Brain sarà incapsulato in un programma più grande gestito da un team;
  il DB è progettato perché aggiungere `users`/ruoli dopo non richieda riscritture.
- Lingua dei contenuti e dell'interfaccia: **italiano**.

---

## 2. Obiettivo dell'MVP

Permettere a una persona del team Agocap di:

1. Consolidare la knowledge base aziendale (prodotti, claim, target, tono di voce).
2. Generare batch di idee di contenuto tramite il motore AI "Superpower Brainstorming",
   ancorate alla KB.
3. Inserire idee anche manualmente.
4. Vedere tutte le idee in una dashboard, filtrarle e classificarle.
5. Approvare/scartare le idee (le `APPROVATA` restano pronte per la futura fase di
   generazione contenuti).

**Fuori scope MVP:** generazione contenuti social/TikTok/blog, pubblicazione, n8n,
API Meta/TikTok/Shopify, login/utenti/permessi, calendario editoriale, integrazioni
con fonti dati esterne reali (predisposte ma non implementate).

---

## 3. Stack tecnico

| Livello | Tecnologia | Motivazione |
|---|---|---|
| Frontend + Backend | **Next.js (App Router)** | unico codebase UI + API, semplice da mantenere |
| UI | **Tailwind CSS + shadcn/ui** | estetica Notion/Stripe, componenti pronti |
| Database | **PostgreSQL** | relazionale, robusto, gira in Docker su Lightsail |
| ORM | **Prisma** | schema chiaro, migrazioni, ottimo per AI+programmatore |
| AI | **Claude API (SDK Anthropic)** | motore di generazione idee |
| Deploy | **Docker Compose** (app + postgres) dietro reverse proxy su Lightsail | |

**Nota modelli Claude:** la scelta esatta del modello (es. Sonnet per volume,
Opus per ragionamento più difficile) sarà verificata e fissata in fase di codice,
consultando il riferimento API aggiornato. La generazione nell'MVP è **on-demand**
(l'utente preme "genera"); code/job asincroni si aggiungeranno dopo.

---

## 4. Struttura delle pagine

1. **Dashboard Idee** — il cuore. Tabella + vista kanban per `status`. Filtri per
   categoria, piattaforma consigliata, prodotto, priorità. Colonne di classificazione
   visibili. Selezione multipla con cambio stato in blocco (approva/scarta).
2. **Genera Idee** ("Superpower Brainstorming") — form di input (prodotto / categoria /
   angolo / keyword seed / numero idee) → lancia la pipeline → batch di idee classificate
   che entrano in Dashboard come `NUOVA`.
3. **Inserimento Manuale** — form per aggiungere una singola idea a mano (sorgente `manuale`).
4. **Knowledge Base** — caricamento/incolla di materiali Agocap (prodotti, claim, target,
   tono di voce). È il contesto su cui ragiona l'AI; primo mattone della futura Area Marketing Plan.
5. **Dettaglio Idea** — drawer/pagina per leggere, modificare campi, cambiare stato,
   aggiungere note; mostra il `GenerationRun` di origine se generata dall'AI.
6. **Report (leggero)** — contatori per stato + 2-3 alert base: "poche idee approvate",
   "categoria scoperta", "nessuna idea generata di recente".

---

## 5. Flusso utente

```
[Genera Idee]  ─┐
[Inserisci]    ─┼─►  Idea (status: NUOVA)  ──►  [Dashboard: review/filtra/ordina]
                │                                      │
[Knowledge Base]┘ (alimenta la generazione)            ├─► INTERESSANTE / DA_APPROFONDIRE
                                                       ├─► APPROVATA  ──► (futuro: Generatori C)
                                                       └─► SCARTATA
```

---

## 6. Modello dati

Sei tabelle. Enum fissi in `MAIUSCOLO`.

### `Product`
`id · nome · categoria · descrizione · benefici · ingredienti · target · url · attivo · createdAt`

### `KnowledgeItem`
`id · tipo (INFO_PRODOTTO | BRAND_VOICE | TARGET | CLAIM | LINEA_GUIDA | DOCUMENTO) · titolo · contenuto(text) · tags(string[]) · productId?(FK Product) · createdAt · updatedAt`

### `Idea`  *(entità centrale)*
`id · titolo · descrizione · category(enum) · piattaformeConsigliate(enum[]) · seoScore(int 1-5) · viralityScore(int 1-5) · priority(int 1-5) · status(enum) · productId?(FK) · sourceId(FK SignalSource) · generationRunId?(FK) · note(text?) · tags(string[]) · createdAt · updatedAt`

### `SignalSource`  *(registro estensibilità)*
`id · key(unique) · nome · tipo (AI | MANUALE | API) · config(json) · abilitata(bool) · createdAt`
- Seed iniziale: `ai-brainstorming` (AI), `manuale` (MANUALE).

### `GenerationRun`  *(audit prompt/output AI)*
`id · sourceId(FK) · input(json) · promptUsato(text) · outputGrezzo(json) · modello · inputTokens · outputTokens · status (RUNNING | DONE | ERROR) · errore(text?) · createdAt`

### Enum

- **IdeaStatus:** `NUOVA · INTERESSANTE · APPROVATA · SCARTATA · DA_APPROFONDIRE`
- **IdeaCategory:** `INTEGRATORI · BEAUTY · BENESSERE · STAGIONALITA · EDUCATIONAL · VENDITA · FAQ · TREND`
- **Platform:** `INSTAGRAM · FACEBOOK · TIKTOK · BLOG`

> **Estensione utenti (futura):** si aggiungerà una tabella `User` e un campo
> `createdByUserId?` su `Idea`/`GenerationRun`. Nullable → nessuna migrazione distruttiva.

---

## 7. Motore "Superpower Brainstorming"

Pipeline concettuale, implementata con poche chiamate Claude + logica in codice:

1. **Costruzione contesto** — carica i `KnowledgeItem` rilevanti + il/i `Product`
   selezionati + il tono di voce (`BRAND_VOICE`) in un contesto compatto.
2. **Genera + classifica** — una chiamata Claude con **structured output (JSON)** che
   restituisce un batch di idee già classificate (categoria, piattaforme consigliate,
   `seoScore`, `viralityScore`, `priority`, prodotto collegato). Il prompt incorpora gli
   "angoli" richiesti: educational, soft selling, vendita, FAQ utenti, stagionalità,
   combinazione *prodotto × problema reale del target*, hook virali, rubriche editoriali.
3. **Deduplica** — in codice: scarta idee con titolo troppo simile a `Idea` esistenti
   (normalizzazione + similarità).
4. **Persisti** — crea il `GenerationRun` (con `promptUsato`, `outputGrezzo`, `modello`,
   token) e le `Idea` risultanti in stato `NUOVA`, collegate al run.

### Schema dell'output JSON atteso (per idea)

```json
{
  "titolo": "string",
  "descrizione": "string",
  "category": "INTEGRATORI|BEAUTY|BENESSERE|STAGIONALITA|EDUCATIONAL|VENDITA|FAQ|TREND",
  "piattaformeConsigliate": ["INSTAGRAM|FACEBOOK|TIKTOK|BLOG"],
  "seoScore": 1,
  "viralityScore": 1,
  "priority": 1,
  "prodottoCollegato": "string|null",
  "motivazione": "string"
}
```

---

## 8. Architettura delle sorgenti (estensibile)

Interfaccia unica:

```
interface SignalSource {
  fetchSignals(input): Promise<IdeaDraft[]>
}
```

Implementazioni:
- `AiBrainstormSource` — usa Claude + KB (MVP).
- `ManualSource` — riceve i dati dal form (MVP).
- `ApiSource` futuri (Google Trends, SEO tool, Amazon keyword, ecc.) — si aggiungono
  uno alla volta come nuovi adapter + riga in `SignalSource`. La `config(json)` ospita
  chiavi/parametri API. **Nessuna modifica allo schema.**

Tutte le sorgenti producono `IdeaDraft` normalizzati → diventano `Idea`. La Dashboard
resta identica a prescindere dall'origine.

---

## 9. API interne (Next.js route handlers)

| Metodo | Endpoint | Scopo |
|---|---|---|
| GET/POST | `/api/ideas` | lista (con filtri) / crea idea manuale |
| GET/PATCH/DELETE | `/api/ideas/:id` | dettaglio / modifica / elimina |
| PATCH | `/api/ideas/bulk-status` | cambio stato in blocco |
| POST | `/api/generate` | lancia la pipeline Superpower Brainstorming |
| GET | `/api/generation-runs/:id` | dettaglio run (prompt/output/token) |
| GET/POST | `/api/knowledge` | lista / crea KnowledgeItem |
| PATCH/DELETE | `/api/knowledge/:id` | modifica / elimina |
| GET/POST | `/api/products` | lista / crea prodotto |
| GET | `/api/report/summary` | contatori e alert |

---

## 10. Gestione errori

- **Chiamata Claude fallita / timeout:** il `GenerationRun` va in `status=ERROR` con il
  messaggio in `errore`; nessuna `Idea` parziale viene salvata; l'utente vede un errore
  chiaro con possibilità di ritentare.
- **Output JSON non valido:** validazione con schema; se non conforme, si ritenta una volta,
  poi si registra `ERROR`. (In implementazione si userà lo structured output del modello per
  ridurre i casi di parsing.)
- **KB vuota:** la generazione è consentita ma avvisa "KB vuota → idee meno mirate".
- **Validazione input form:** lato server, errori restituiti in modo leggibile.

---

## 11. Testing

- **Unit:** dedup (similarità titoli), validazione output JSON, costruzione contesto KB,
  mappatura `IdeaDraft → Idea`.
- **Integration:** route API (CRUD idee, KB, prodotti; bulk-status; report summary) con DB di test.
- **Pipeline AI:** test con client Claude **mockato** (output JSON deterministico) per
  verificare persistenza `GenerationRun` + `Idea` e i percorsi di errore. Niente chiamate reali nei test.
- **E2E (leggero):** flusso genera → review in dashboard → approva.

---

## 12. Backlog di sviluppo (MVP)

1. Scaffold Next.js + Tailwind + shadcn/ui + Prisma + Docker Compose (app + postgres).
2. Schema Prisma + migrazioni + seed `SignalSource` (`ai-brainstorming`, `manuale`).
3. CRUD `Product` + pagina/area minimale.
4. CRUD `KnowledgeItem` + pagina **Knowledge Base**.
5. Client Claude + costruzione contesto + chiamata structured output.
6. Pipeline Superpower Brainstorming (genera+classifica → dedup → persisti `GenerationRun`+`Idea`).
7. Pagina **Genera Idee** (form input + lancio + feedback).
8. Pagina **Dashboard Idee** (tabella + filtri + selezione multipla + bulk status).
9. Vista **kanban** per stato.
10. **Dettaglio Idea** (modifica, cambio stato, note, link al GenerationRun).
11. Pagina **Inserimento Manuale**.
12. **Report leggero** (contatori + alert).
13. Test (unit + integration + pipeline mockata).
14. Dockerfile + docker-compose + istruzioni deploy su Lightsail.

---

## 13. Roadmap avanzata (oltre l'MVP)

- **Fette successive** (ognuna con propria spec): E (Marketing Plan/Brand) → C (Generatori
  Meta/TikTok/Blog) → D (pubblicazione via n8n) → F (Report avanzati).
- **Sorgenti dati reali**: aggiunta incrementale di `ApiSource` (Google Trends, tool SEO,
  Amazon keyword, social listening).
- **RAG sulla KB**: embeddings + ricerca semantica quando la KB cresce.
- **Generazione asincrona**: coda job (es. BullMQ/Redis) per batch grandi.
- **Utenti/ruoli/permessi** e incapsulamento nel programma del team.
- **Calendario editoriale** condiviso tra le aree.

---

## 14. Rischi tecnici

| Rischio | Impatto | Mitigazione |
|---|---|---|
| Fonti trend esterne senza API ufficiali (Google Trends, AnswerThePublic, social listening) | alto | escluse dall'MVP; architettura a sorgenti predisposta per aggiungerle dopo, una alla volta |
| Qualità idee dipende dalla KB, oggi sparsa | medio | area KB nell'MVP; avviso se KB vuota; angoli di prompt strutturati |
| Output AI non strutturato/incoerente | medio | structured output + validazione schema + retry + audit in `GenerationRun` |
| API pubblicazione difficili (TikTok/Meta) | alto (fette future) | rinviate; affrontate nelle fette C/D con verifica accessi |
| Costi token su batch grandi | basso/medio | generazione on-demand, batch limitati, scelta modello in base al carico |

---

## 15. Suggerimenti UX/UI

- Estetica **Notion/Stripe**: pulita, tanto spazio bianco, tipografia chiara.
- Dashboard come **comando centrale**: filtri sempre visibili, badge colorati per stato e
  categoria, score mostrati come barre/stelline (1-5).
- **Approvazione rapida**: selezione multipla + azioni in blocco; scorciatoie da tastiera
  per approva/scarta nel dettaglio.
- **Generazione trasparente**: durante il run mostra stato; a fine run evidenzia le nuove idee.
- **KB a basso attrito**: incolla testo libero, l'AI può aiutare a strutturarlo (evoluzione).
- Vista **kanban** per chi ragiona per flusso, **tabella** per chi ragiona per dati.

---

## 16. Schema per iniziare lo sviluppo

1. Approvazione di questa spec.
2. Piano di implementazione dettagliato (skill `writing-plans`).
3. Esecuzione per task del backlog (sez. 12), con checkpoint di review.

> **Prompt interni per ogni area AI:** nell'MVP esiste una sola area AI (Superpower
> Brainstorming). Il prompt completo e i suoi "angoli" verranno definiti e versionati in
> fase di implementazione (step 5-6 del backlog) e salvati ad ogni run in `GenerationRun.promptUsato`.
> I prompt per i generatori Meta/TikTok/Blog appartengono alle fette future C.
