# Editorial OS — Fase 2: Brain ordinato (destinazioni editoriali) — Design

- **Data:** 2026-06-24
- **Sotto-progetto:** Ri-architettura Editorial OS — **Fase 2 di 7** (Brain ordinato)
- **Riferimento:** master `2026-06-23-agocap-editorial-os-MASTER-riorganizzazione.md` (sez. 2, 11, 12, 16 fase 2)
- **Dipende da:** Fase 1 (sidebar, StatusBadge), Brain esistente (Idea, /api/ideas, dashboard)
- **Stato:** Design approvato in brainstorming, in attesa di review utente

---

## 1. Obiettivo
Rendere il **Brain** il vero centro di gestione delle idee: introdurre le **destinazioni editoriali**
(verso quali canali un'idea deve diventare contenuto), una **dashboard idee più ordinata** (colonne + badge
+ filtri estesi) e le **azioni** per assegnare le destinazioni. Mantenere netta la separazione **stati idea**
(NUOVA…) vs **stati contenuto** (BOZZA…). Nessuna regressione alle funzioni esistenti.

### Decisioni di brainstorming
- Assegnazione destinazioni: **bulk** (dashboard) **+ dettaglio** (singola idea).
- **Collegare le aree ora**: le pagine "Genera da idea" di Meta e Blog mostrano solo idee **APPROVATA** con
  la destinazione del canale.

---

## 2. Modello dati
- Nuovo enum Prisma `Destinazione { META  BLOG  TIKTOK  EMAIL }`.
- `Idea.destinazioni Destinazione[] @default([])` (array, non distruttivo).
- `src/lib/brain/enums.ts`: `export const DESTINAZIONI = ["META","BLOG","TIKTOK","EMAIL"] as const` + tipo.
- Migrazione `idea_destinazioni`.

> Stati idea e stati contenuto restano enum separati (già così). Una stessa idea può avere **più**
> destinazioni (es. Blog + Instagram + TikTok).

---

## 3. API
- **`GET /api/ideas`** — aggiungere il filtro `destinazione` (`where.destinazioni = { has: <DEST> }`) e
  `priority` (intero). Filtri esistenti (status/category/platform/productId/source) invariati. La risposta
  include già `destinazioni` (campo scalare) + `product`/`source`.
- **`PATCH /api/ideas/[id]`** — riusa `updateIdeaSchema` (che ora include `destinazioni`), così il dettaglio
  può salvarle.
- **`PATCH /api/ideas/bulk-destinazioni`** (nuovo) — body `{ ids: string[], destinazioni: Destinazione[] }` →
  `updateMany` imposta `destinazioni` sulle idee selezionate. Validatore `bulkDestinazioniSchema`.

---

## 4. UI

### 4.1 Dashboard Idee (Brain) — `idea-table` + `idea-filters`
- **Colonne**: oltre a Titolo/Categoria/Keyword/Vol/Diff/SEO/Prio/Stato → aggiungere **Fonte** (source key:
  AI/Manuale/SEOZoom) e **Destinazioni** (badge dei canali assegnati). Prodotto mostrato dove presente.
- **Badge stato** colorati via `StatusBadge` (riuso Fase 1) nella colonna Stato.
- **Filtri estesi**: stato, **fonte**, **destinazione**, categoria, **priorità** (oltre a piattaforma).
- **Azione bulk "Assegna a canali"**: selezioni una o più idee → scegli i canali (multi-select
  META/BLOG/TIKTOK/EMAIL) → `PATCH /api/ideas/bulk-destinazioni` → ricarica. Convive col bulk-status esistente.

### 4.2 Dettaglio idea — `/ideas/[id]`
- **Multi-select destinazioni** (checkbox META/BLOG/TIKTOK/EMAIL) → `PATCH /api/ideas/[id] { destinazioni }`.
- **Link "Genera contenuto"**: quando l'idea è **APPROVATA**, mostra un link per ciascuna destinazione
  assegnata pertinente: Meta → `/meta/genera?ideaId=…`, Blog → `/blog/genera?ideaId=…` (TikTok/Email non
  ancora generabili → etichetta "in arrivo").

### 4.3 Aree canale — pagine "Genera da idea"
- **Meta** (`/meta/genera`): l'elenco idee usa `GET /api/ideas?status=APPROVATA&destinazione=META`.
- **Blog** (`/blog/genera`): usa `GET /api/ideas?status=APPROVATA&destinazione=BLOG`; inoltre accetta
  `?ideaId=` per pre-selezionare (coerente con Meta).

---

## 5. Gestione errori
- Validatori zod su tutte le mutazioni (400 su input non valido); `bulk-destinazioni` con `ids` non vuoti.
- PATCH idea inesistente → 404 (P2025, già gestito).
- Filtri GET tolleranti a valori non validi (ignorati).

---

## 6. Testing
Unit:
- `bulkDestinazioniSchema` / `updateIdeaSchema` con `destinazioni` (accetta validi; rifiuta canale errato).
- `GET /api/ideas` filtro `destinazione` (where `has`) — test del costruttore where se isolabile, altrimenti via route mock.
- `PATCH /api/ideas/bulk-destinazioni` (route): updateMany chiamato con i giusti ids/destinazioni; 400 su ids vuoti.
Gate: `npx tsc --noEmit` + `npm run build` (tutte le pagine compilano). Smoke: assegno destinazioni a un'idea (bulk e da dettaglio), filtro per destinazione, verifico che `/meta/genera` e `/blog/genera` mostrino solo le idee con quella destinazione.

---

## 7. Backlog di sviluppo (Fase 2)
1. Prisma: enum `Destinazione` + `Idea.destinazioni[]` + migrazione; `DESTINAZIONI` in `enums.ts`.
2. Validatori: `destinazioni` in `manualIdeaSchema`/`updateIdeaSchema` + `bulkDestinazioniSchema` (TDD).
3. API: filtro `destinazione`/`priority` in `GET /api/ideas` + route `PATCH /api/ideas/bulk-destinazioni` (TDD).
4. UI dettaglio idea: multi-select destinazioni + link genera per destinazione.
5. UI dashboard: `idea-filters` (destinazione+priorità) + `idea-table` (colonne Fonte/Destinazioni + StatusBadge + azione bulk "Assegna a canali").
6. Aree: `/meta/genera` e `/blog/genera` filtrano per destinazione; `/blog/genera` accetta `?ideaId`.
7. Gate + smoke.

---

## 8. Roadmap successiva
3. Meta (Instagram/Facebook separati, Reel/Story). 4. Blog workflow + predisposizione n8n. 5. Calendario unico (`EditorialCalendarItem`). 6. Pubblicazioni + endpoint n8n. 7. TikTok + Email generatori.

---

## 9. Rischi
| Rischio | Impatto | Mitigazione |
|---|---|---|
| Migrazione array enum | basso | `@default([])`, non distruttiva; idee esistenti restano [] |
| `idea-table`/`idea-filters` già modificati in fette precedenti | basso | estendo i componenti esistenti, non riscrivo |
| Coerenza canale↔destinazione (META vs INSTAGRAM/FACEBOOK) | basso | destinazione è a livello canale (META/BLOG/…); le piattaforme IG/FB restano sul contenuto (Fase 3) |
