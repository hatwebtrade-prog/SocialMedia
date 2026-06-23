# AGOCAP Content AI Hub

Portale interno per **ricercare → generare → approvare → (in futuro) pubblicare** contenuti per Agocap
(integratori, benessere, beauty, salute naturale) su Instagram/Facebook, TikTok e blog Shopify, con un
"Brain" AI centrale e n8n come braccio di pubblicazione.

UI in **italiano**, codice/commenti in **inglese**. Self-hosted in Docker.

---

## 1. A che punto siamo (stato delle fette)

Il progetto è diviso in sotto-progetti ("fette"), ciascuno con il suo ciclo spec → piano → build.

| Fetta | Stato | Cosa fa |
|---|---|---|
| **B — Brain** | ✅ Fatto | Genera e classifica idee di contenuto (AI + manuale), dashboard con approvazione |
| **Sorgente SEO — SEOZoom** | ✅ Fatto | Scopre keyword reali (volume + **difficoltà KD reale**) e le trasforma in idee con seoScore reale |
| **C — Generatore Meta** | ✅ Fatto | Da un'idea approvata → post/carosello IG/FB (Claude) + immagini on-demand (OpenAI) + calendario |
| **C — Generatore Blog** | ✅ Fatto (solo generazione) | Da un'idea approvata → bozza articolo SEO/GEO con prodotti via metafield Shopify, immagine, JSON-LD |
| **Calendario editoriale** | ⏳ Prossimo | Vista unica social+blog: vedere i contenuti approvati e assegnare la data (→ PROGRAMMATO) |
| **D — Pubblicazione n8n** | ⏳ Da fare | n8n legge la programmazione e autopubblica su Shopify/social |
| **C — Generatore TikTok** | ⏳ Da fare | |
| **E — Marketing Plan / Brand** | ⏳ Da fare | |
| **F — Report avanzati** | ⏳ Da fare | |

> **Nota:** il programma **non scrive ancora su Shopify**. Shopify è usato in **sola lettura** (prodotti +
> metafield) per arricchire gli articoli. La pubblicazione vera sarà gestita da n8n (fetta D).

Documenti di design e piani dettagliati: cartella [`docs/superpowers/`](docs/superpowers/).

---

## 2. Stack tecnologico

- **Next.js 15** (App Router, TypeScript, `output: standalone`)
- **Prisma + PostgreSQL**
- **Tailwind CSS**
- **@anthropic-ai/sdk** — modello `claude-opus-4-8` (testo/idee/articoli)
- **openai** — modello `gpt-image-1` (immagini)
- **SEOZoom Admin API** (dati keyword) · **Shopify Admin GraphQL API** (prodotti/metafield, sola lettura)
- **Vitest** (test) · **Docker Compose** (db + app)

---

## 3. Prerequisiti

- Node.js 20+
- Docker + Docker Compose (per il deploy/DB) — oppure un PostgreSQL locale
- Le chiavi API (vedi sotto)

---

## 4. Configurazione — variabili d'ambiente

Crea un file `.env` nella radice (è in `.gitignore`, **non** va committato). Parti da `.env.example`:

```bash
cp .env.example .env
```

Variabili:

| Variabile | Obbligatoria | Descrizione |
|---|---|---|
| `DATABASE_URL` | ✅ | Stringa Postgres, es. `postgresql://postgres:postgres@localhost:5432/agocap` |
| `ANTHROPIC_API_KEY` | ✅ | Chiave Anthropic (Claude) — generazione idee/testi/articoli |
| `OPENAI_API_KEY` | ✅ (immagini) | Chiave OpenAI — generazione immagini |
| `SEOZOOM_API_KEY` | per SEOZoom | Chiave API SEOZoom (`AK-...`) |
| `SEOZOOM_BASE_URL` | opz. | Default `https://apiv2.seozoom.com/api/v2/keywords/` |
| `SHOPIFY_SHOP_DOMAIN` | per Blog | Es. `e1ec06-4.myshopify.com` |
| `SHOPIFY_ADMIN_TOKEN` | per Blog | Token Admin API (`shpat_...`), scope lettura prodotti/metafield |
| `SHOPIFY_STORE_URL` | opz. | Dominio pubblico per i link prodotto (default `https://<shop>`) |
| `SHOPIFY_API_VERSION` | opz. | Default `2024-10` |

> ⚠️ **Sicurezza:** le chiavi vanno SOLO nel `.env` / nell'ambiente del container, mai nel codice o in git.
> Se una chiave è stata esposta (es. incollata in chat), **rigenerala**.

---

## 5. Avvio in locale (sviluppo)

```bash
# 1. dipendenze
npm install

# 2. database: applica le migrazioni e popola i dati base (sorgenti, eventuale KB)
npx prisma migrate dev
npm run prisma:seed

# 3. avvia il server di sviluppo (porta 3000 di default; per un'altra porta usa PORT)
npm run dev
#   oppure:  PORT=8001 npm run dev
```

Apri **http://localhost:3000** (o la porta scelta) e parti da `/dashboard`.

Per far funzionare le generazioni servono le chiavi nell'ambiente. In sviluppo puoi metterle nel `.env`
(Next le carica) oppure passarle inline:

```bash
ANTHROPIC_API_KEY=... OPENAI_API_KEY=... SEOZOOM_API_KEY=... \
SHOPIFY_SHOP_DOMAIN=... SHOPIFY_ADMIN_TOKEN=... SHOPIFY_STORE_URL=... \
PORT=8001 npm run dev
```

---

## 6. Avvio con Docker (db + app)

```bash
# assicurati che il .env sia compilato (Compose legge le variabili da lì)
docker compose up -d --build
```

`docker-compose.yml` definisce due servizi: **db** (Postgres con healthcheck + volume `pgdata`) e **app**
(Next standalone, `HOSTNAME=0.0.0.0`, volume `uploads` per le immagini generate). All'avvio applica le
migrazioni e serve l'app.

---

## 7. Script utili

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Server di sviluppo |
| `npm run build` / `npm start` | Build di produzione / avvio |
| `npm test` | Esegue tutti i test (Vitest) |
| `npm run test:watch` | Test in watch |
| `npm run prisma:migrate` | Crea/applica una migrazione (dev) |
| `npm run prisma:seed` | Popola i dati base (sorgenti segnale, ecc.) |
| `npm run db:reset` | **Reset completo** del DB (attenzione: cancella i dati) |
| `npx prisma migrate deploy` | Applica le migrazioni in produzione |

---

## 8. Mappa delle pagine (UI)

Navigazione in alto. Lingua: italiano.

**Brain**
- `/dashboard` — **Dashboard Idee**: tabella con filtri (stato/categoria/piattaforma/sorgente) e colonne keyword/volume/difficoltà; approvazione multipla.
- `/generate` — **Genera Idee** (brainstorming AI).
- `/brain/scopri` — **Scopri keyword** (SEOZoom): seed o prodotto → keyword reali → idee.
- `/manual` — inserimento idea manuale · `/knowledge` — Knowledge Base · `/report` — report.
- `/ideas/[id]` — dettaglio idea.

**Meta (IG/FB)**
- `/meta` — contenuti generati · `/meta/genera` — genera da idea approvata · `/meta/calendario` — calendario · `/meta/[id]` — dettaglio (con immagini).

**Blog**
- `/blog` — lista articoli · `/blog/genera` — genera da idea approvata · `/blog/[id]` — anteprima (HTML, immagine, prodotti, FAQ, JSON-LD) + workflow stati.

---

## 9. Flusso di lavoro tipico

```
1. SCOPRI / GENERA IDEE
   /brain/scopri (SEOZoom)  oppure  /generate (AI)  oppure  /manual
        ↓ (idee con stato NUOVA)
2. APPROVA
   /dashboard → seleziona → Approva  (stato APPROVATA)
        ↓
3. GENERA CONTENUTO da un'idea approvata
   /meta/genera  (post/carosello social)   oppure   /blog/genera  (articolo)
        ↓ (GeneratedContent stato BOZZA)
4. RIVEDI / APPROVA
   /meta/[id] o /blog/[id] → cambia stato (BOZZA → DA_APPROVARE → APPROVATO)
        ↓
5. (PROSSIMO) CALENDARIO + PUBBLICAZIONE n8n
   assegna data (PROGRAMMATO) → n8n pubblica su Shopify/social → PUBBLICATO
```

---

## 10. API principali

| Metodo | Endpoint | Scopo |
|---|---|---|
| GET/POST | `/api/ideas` | lista/crea idee (filtri: status/category/platform/source) |
| PATCH | `/api/ideas/bulk-status` | cambio stato multiplo |
| POST | `/api/generate` | brainstorming idee (Brain) |
| POST | `/api/seozoom/discover` | scoperta keyword → idee (SEOZoom) |
| POST | `/api/meta/generate` | genera contenuto Meta da idea |
| GET/PATCH/DELETE | `/api/meta/contents[/:id]` | contenuti Meta |
| POST | `/api/blog/generate` | genera articolo blog da idea |
| GET/PATCH/DELETE | `/api/blog/contents[/:id]` | articoli blog |
| GET | `/api/assets/[id]` | serve un'immagine generata |
| GET | `/api/products` · `/api/knowledge` | prodotti / knowledge base |

Le pipeline AI usano JSON guidato da prompt validato con **zod**, con pipeline fail-safe (in caso di
errore lo stato è `ERROR`, nessun dato parziale). Le sorgenti esterne non essenziali (SEOZoom, Shopify)
**degradano** senza bloccare la generazione.

---

## 11. Modello dati (sintesi)

- **Product** — catalogo Agocap (sincronizzabile/seed).
- **KnowledgeItem** — tono di voce, brand, regole.
- **SignalSource** — registro sorgenti idee: `ai-brainstorming`, `manuale`, `seozoom` (estensibile: GSC, Trends…).
- **GenerationRun** — audit di ogni generazione (input, prompt, modello, token, output grezzo, stato).
- **Idea** — idea di contenuto: titolo, descrizione, categoria, piattaforme, seoScore, viralityScore, priority, stato (NUOVA/INTERESSANTE/APPROVATA/SCARTATA/DA_APPROFONDIRE) + keyword/volumeRicerca/difficolta/trendKeyword (per le idee SEOZoom).
- **GeneratedContent** — contenuto generato (canale META/TIKTOK/BLOG, formato POST/CAROSELLO/ARTICOLO, status BOZZA→…→PUBBLICATO, `payload` JSON, `dataPrevista`).
- **GeneratedAsset** — asset (immagini) collegati a un contenuto, salvati nel volume `uploads/`.

---

## 12. Test

```bash
npm test          # tutti i test (unit + pipeline/route con provider mockati)
```

I test non fanno chiamate reali alle API: Claude/OpenAI/SEOZoom/Shopify sono mockati. La verifica
end-to-end con chiavi reali si fa avviando il server con le variabili d'ambiente e generando un contenuto.

---

## 13. Roadmap

1. **Calendario editoriale** unico (social + blog distinti) con assegnazione data.
2. **Pubblicazione automatica via n8n** (Shopify blog + social) a partire dalla programmazione.
3. **Generatore TikTok**.
4. **Sorgenti SEO aggiuntive**: Google Search Console, Google Trends.
5. **Marketing Plan/Brand** ed **F — Report** avanzati.
6. (Più avanti) autenticazione/gestione team — l'MVP è single-tenant, senza login.

---

## 14. Struttura del progetto (cartelle chiave)

```
prisma/                      schema, migrazioni, seed
src/app/                     pagine (App Router) + API routes
src/components/              componenti UI (tabelle, calendario, nav…)
src/lib/
  brain/                     pipeline idee (context, dedupe, runtime)
  meta/                      generatore Meta (schema, prompt, generate, runtime)
  blog/                      generatore Blog (schema, prompt, jsonld, generate, runtime)
  seozoom/                   client + selezione/scoring keyword + KD
  shopify/                   lettura prodotti+metafield (GraphQL)
  image/                     generazione/salvataggio immagini (OpenAI)
docs/superpowers/            spec di design + piani di implementazione di ogni fetta
```
