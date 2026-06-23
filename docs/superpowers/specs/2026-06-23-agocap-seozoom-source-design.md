# AGOCAP Content AI Hub — Spec di Design: Sorgente SEO SEOZoom (Brain)

- **Data:** 2026-06-23
- **Sotto-progetto:** Sorgente dati SEO reale → idee nel Brain (prima fonte: **SEOZoom**)
- **Dipende da:** Brain MVP (fetta B) — `Idea`, `SignalSource` registry, `GenerationRun`, KB, pipeline Claude, dedupe
- **Stato:** Design approvato in brainstorming, in attesa di review utente

---

## 1. Contesto e scope

Il Brain MVP produce idee con un `seoScore` **stimato dall'AI**, non basato su dati reali di domanda
di ricerca. Questa fetta introduce la **prima fonte dati SEO reale** — **SEOZoom** (tool italiano,
l'utente ha già l'abbonamento e l'API) — come nuova **sorgente del Brain**: scopre query ad alto
potenziale (volume, difficoltà, trend reali) e ne ricava **idee classificate con un seoScore REALE**,
che entrano nella dashboard del Brain pronte per l'approvazione e i generatori (Meta/Blog).

**Decisione di ordine:** la fetta Blog Shopify è stata **messa in pausa** per costruire prima questa
sorgente dati, così il Blog (e in generale i contenuti) nascerà data-driven invece che su stime AI.

**In scope:** integrazione SEOZoom come sorgente del Brain (seed manuali o da prodotto/categoria →
keyword reali → selezione → idee classificate con metriche reali), campi metrica su `Idea`, pagina
"Scopri keyword", colonne/filtro in dashboard.

**Fuori scope (fonti successive):** Google Search Console, Google Trends (saranno sorgenti aggiuntive,
stesso pattern); la fetta Blog Shopify (ripresa dopo); qualsiasi pubblicazione.

### Vincoli raccolti in brainstorming
- Fonte: **SEOZoom** prima; **GSC** e **Google Trends** come sorgenti successive.
- Ruolo: **scoperta keyword → idee nel Brain** (idee classificate con seoScore reale).
- Seed: **sia manuale** (termini liberi) **sia da prodotto/categoria** Agocap.
- Pipeline **ibrida**: dati reali SEOZoom + shaping AI (Claude trasforma keyword in idee).
- `seoScore` **calcolato deterministicamente dalle metriche reali** (volume+difficoltà), non dall'AI;
  `viralityScore`/`priority` restano stimati/derivati.
- Riuso di `Idea`/`GenerationRun`/dedupe; SEOZoom è una riga nel registry `SignalSource` (tipo `API`).
- Provider isolato e fail-safe indipendente; chiave in `SEOZOOM_API_KEY` (mai committata).
- Mercato/lingua: **IT**.

---

## 2. Stack — aggiunte

| Cosa | Tecnologia | Note |
|---|---|---|
| Dati keyword SEO | **SEOZoom API** (REST) | chiave in `SEOZOOM_API_KEY`; endpoint/auth/shape verificati sulla doc SEOZoom in fase di build |

Tutto il resto invariato (Next.js 15 + Prisma/Postgres + Tailwind + `@anthropic-ai/sdk` `claude-opus-4-8`).
La generazione idee riusa l'approccio del Brain (JSON guidato da prompt + validazione zod).

> **Nota API SEOZoom:** non conosco a memoria gli endpoint esatti. Un **normalizer** isola la risposta
> SEOZoom dietro una forma normalizzata `{ keyword, volume, difficolta, trend }`, così il resto della
> pipeline è indipendente dal formato reale. Gli endpoint si confermano sulla documentazione SEOZoom
> al momento dell'implementazione (stessa disciplina usata per Anthropic/OpenAI).

---

## 3. Modello dati

### Campi aggiunti a `Idea` (nullable, non distruttivi)
`keyword String?` · `volumeRicerca Int?` · `difficolta Int?` · `trendKeyword String?`
- Valorizzati per le idee da SEOZoom; null per le idee AI/manuali esistenti.
- `seoScore` (Int 1-5 esistente) resta, ma per le idee SEOZoom è **calcolato** dalle metriche.
- Indice opzionale `@@index([keyword])` per ricerche/dedup.

### `SignalSource`
- Seed di una riga `seozoom` (key `seozoom`, nome "SEOZoom", tipo `API`, `config` con parametri non
  segreti: mercato `IT`, `topN` default, soglia difficoltà). La chiave API NON va in `config` (sta in env).

> Nessun'altra modifica al Brain/Meta.

---

## 4. Pipeline "Scopri keyword" (sorgente `seozoom`)

Deps iniettate, fail-safe (single try/catch → run `ERROR`), come `runBrainstorm`:

1. **loadContext(input)** — costruisce i **seed** (dai termini liberi, oppure dai temi del
   prodotto/categoria scelto) + carica la **KB** (tono, prodotto) per il contesto Claude.
2. **fetchKeywords(seed)** — SEOZoom → lista `{ keyword, volume, difficolta, trend }` (mercato IT).
3. **selectCandidates(keywords, {topN})** — punteggio di **opportunità** (volume ⬆ + difficoltà ⬇ +
   bonus trend in crescita), scarta volume 0, prende i top N (default 12).
4. **callClaude(shaping)** — Claude trasforma i candidati in **idee classificate** (titolo, descrizione,
   categoria, piattaforme) ancorate a KB + prodotto, **rimandando la keyword** di origine.
5. **persist** — per ogni idea: aggancia la keyword e le **metriche reali**, calcola `seoScore` con
   `metricsToSeoScore`, crea `Idea` (sorgente `seozoom`); crea `GenerationRun` (audit: input, prompt,
   output grezzo, modello, token); **dedup** vs idee esistenti. Qualsiasi errore → run `ERROR`,
   nessuna idea parziale.

```
Input (seed liberi | prodotto/categoria)
  → loadContext (seed + KB)
  → SEOZoom fetchKeywords → [{keyword,volume,difficolta,trend}]
  → selectCandidates (opportunità) → topN
  → Claude shaping → idee classificate (con keyword di origine)
  → persist: Idea(sorgente seozoom, seoScore=metricsToSeoScore(metriche), keyword/volume/difficolta/trend) + GenerationRun + dedupe
  → compaiono nella Dashboard Idee (status NUOVA)
```

---

## 5. Client SEOZoom (`src/lib/seozoom/`)

- `getSeozoom()` — wrapper con base URL + header autenticazione (`SEOZOOM_API_KEY`).
- `fetchKeywords(seed: string): Promise<NormalizedKeyword[]>` dove
  `NormalizedKeyword = { keyword: string; volume: number; difficolta: number; trend: string }`.
- **Normalizer** `normalizeSeozoom(raw)` — mappa la risposta SEOZoom alla forma normalizzata; è la
  sola parte che conosce il formato reale SEOZoom (testabile con `fetch` mockato). Difficoltà/trend
  assenti → default prudenti (difficoltà media, trend "stabile").

---

## 6. Selezione candidati (funzione pura, testata)

`selectCandidates(keywords, { topN = 12 })`:
- scarta `volume <= 0`;
- `opportunita = f(volume, difficolta, trend)` — monotòna crescente in volume, decrescente in
  difficoltà, con bonus se `trend` indica crescita;
- ordina desc per opportunità, ritorna i primi `topN`.

---

## 7. Mapping seoScore (funzione pura, testata)

`metricsToSeoScore({ volume, difficolta }): number` → intero **1-5 deterministico**:
- bucket di volume (più alto → più alto), **corretto al ribasso** se la difficoltà è alta;
- garantito nell'intervallo 1-5.
Esempi attesi nei test: volume alto + difficoltà bassa → 5; volume basso + difficoltà alta → 1-2.

---

## 8. Shaping AI (Claude)

`buildShapingPrompt({ kbContext, prodotto?, candidates })`:
- riceve i candidati (`keyword`, `volume`, `difficolta`, `trend`) + KB + eventuale prodotto;
- chiede a Claude, **per ogni keyword**, un'idea di contenuto: `keyword` (echo dell'originale),
  `titolo`, `descrizione`, `category` (enum), `piattaformeConsigliate` (enum[]), `motivazione`;
- **non** chiede il seoScore (lo calcoliamo noi dalle metriche reali);
- risposta JSON-only → `JSON.parse` (strip fence) → validata con uno schema zod dedicato.

In `persist`, ogni idea shaped si **riaggancia** alla keyword di origine (per riprendere
volume/difficoltà/trend e calcolare il seoScore). Se Claude restituisce una keyword non presente tra
i candidati, l'idea viene salvata senza metriche (seoScore di default 3) — caso limite gestito.

---

## 9. UI

1. **Pagina "Scopri keyword (SEOZoom)"** (`/brain/scopri`):
   - campo **seed liberi** (testo, separati da virgola) **oppure** selettore **prodotto/categoria**;
   - opzioni: numero risultati (topN);
   - bottone "Scopri" → `POST /api/seozoom/discover` → mostra "Create N idee" + link alla Dashboard.
2. **Dashboard Idee** (esistente, estesa):
   - colonne aggiuntive **Keyword / Volume / Difficoltà** (mostrate quando presenti);
   - **filtro per sorgente** (AI / manuale / SEOZoom);
   - le idee SEOZoom convivono con le altre (stesso flusso di approvazione).
- Link alla pagina "Scopri keyword" dalla nav e/o dalla Dashboard.

---

## 10. API

| Metodo | Endpoint | Scopo |
|---|---|---|
| POST | `/api/seozoom/discover` | esegue la pipeline (body: `{ seeds?: string[], productId?, categoria?, topN? }`) → `{ status, created, runId?, error? }` |

La Dashboard riusa `GET /api/ideas` (con filtro sorgente aggiunto); il selettore prodotto riusa `GET /api/products`.

---

## 11. Gestione errori

- **SEOZoom fallita / `SEOZOOM_API_KEY` mancante / 0 keyword:** run `ERROR` registrato, messaggio
  chiaro, nessuna idea parziale.
- **Shaping Claude fallito / JSON non valido:** run `ERROR`.
- **Validazione input:** seed o prodotto/categoria obbligatori (almeno uno); 400 se mancano entrambi.
- Provider isolati, fail-safe indipendenti (come Brain/Meta).

---

## 12. Testing

Unit (nessuna chiamata reale a SEOZoom/Claude):
- `metricsToSeoScore` — bucket e clamp 1-5 (esempi alto/basso volume × difficoltà).
- `selectCandidates` — scarto volume 0, ordinamento per opportunità, taglio topN, bonus trend.
- `normalizeSeozoom` — mappa una risposta SEOZoom di esempio nella forma normalizzata (default su campi mancanti).
- `buildShapingPrompt` — include candidati, KB, prodotto, e istruzione JSON-only.
- Schema zod dell'output di shaping (idee con keyword/titolo/categoria/piattaforme; rifiuto categoria errata).
- Pipeline `discover` con **SEOZoom + Claude mockati** (deps iniettate): crea idee con metriche agganciate e seoScore calcolato; percorsi d'errore (SEOZoom throw, Claude throw, 0 keyword) → run ERROR, nessuna idea.
- `fetchKeywords` con `fetch` mockato (normalizer end-to-end).

Smoke end-to-end con **chiave SEOZoom + Claude reali**: `POST /api/seozoom/discover {"seeds":["magnesio"]}` → idee reali con volume/difficoltà nella dashboard.

---

## 13. Backlog di sviluppo (MVP)

1. Migrazione Prisma: campi `keyword/volumeRicerca/difficolta/trendKeyword` su `Idea` (+ indice keyword); seed `SignalSource` riga `seozoom`.
2. `metricsToSeoScore` (TDD).
3. `selectCandidates` (TDD).
4. Client SEOZoom + `normalizeSeozoom` + `fetchKeywords` (TDD sul normalizer con fetch mockato; verifica endpoint reali su doc).
5. Schema zod output shaping + `buildShapingPrompt` (TDD).
6. Pipeline `discoverKeywords` (deps iniettate, fail-safe) con SEOZoom+Claude mockati (TDD).
7. Wiring runtime (SEOZoom + Claude + Prisma: loadContext/seeds da prodotto, persist con metriche+seoScore, dedupe).
8. API `POST /api/seozoom/discover` (validatori + seam deps, TDD route).
9. UI pagina "Scopri keyword" + estensione Dashboard (colonne metriche + filtro sorgente) + nav.
10. Env/Docker: `SEOZOOM_API_KEY`.
11. Test (unit + pipeline/route mockate).
12. Smoke end-to-end con chiavi reali.

---

## 14. Roadmap (oltre questa fetta)

- **Google Search Console** come sorgente (query reali del sito: impression/click/posizione) — stesso pattern `SignalSource`.
- **Google Trends** come sorgente (trend emergenti/breakout) — stesso pattern.
- **Ripresa fetta Blog Shopify** (ora data-driven: keyword/idee con metriche reali alimentano l'articolo SEO/GEO).
- Eventuale enrichment retroattivo delle idee AI esistenti con metriche reali.

---

## 15. Rischi tecnici

| Rischio | Impatto | Mitigazione |
|---|---|---|
| API SEOZoom: endpoint/shape ignoti a priori | medio | normalizer che isola il formato; endpoint verificati su doc in build; il resto della pipeline è disaccoppiato |
| Quota/costi chiamate SEOZoom | medio | scoperta on-demand (non automatica), topN limitato, dedup per non rigenerare |
| Definizione di "trend in crescita" dipende dai campi SEOZoom | basso | normalizer mappa il segnale trend; default "stabile" se assente; bonus opportunità tarabile |
| Mapping metriche→seoScore arbitrario | basso | funzione pura testata con esempi; soglie tarabili senza toccare il resto |
| Claude restituisce keyword non tra i candidati | basso | riaggancio per keyword; fallback senza metriche (seoScore default) |
| Due provider in pipeline (SEOZoom + Claude) | basso | moduli isolati, chiavi separate, fail-safe indipendenti |

---

## 16. Schema per iniziare lo sviluppo

1. Approvazione di questa spec.
2. Piano di implementazione dettagliato (skill `writing-plans`).
3. Esecuzione per task del backlog (sez. 13), review a due stadi come per Brain/Meta.
4. Smoke end-to-end con chiave SEOZoom + Claude reali.

> **Chiavi:** `SEOZOOM_API_KEY` (e in seguito le credenziali GSC/Google) in `.env` (gitignored) e env del container. Da rigenerare se esposte.
