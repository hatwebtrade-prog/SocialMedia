# Brain area — Overhaul (generazione unificata data-driven + UI/UX) — Design

- **Data:** 2026-06-24
- **Sotto-progetto:** Editorial OS — potenziamento area **Brain**
- **Dipende da:** Brain (Idea, /api/generate, dashboard), SEOZoom (`fetchKeywords`, discover), StatusBadge, destinazioni (Fase 2)
- **Stato:** Design approvato in brainstorming, in attesa di review utente

---

## 1. Obiettivo
Rendere l'area Brain più **completa** e **performante**:
1. **Generazione unificata** in un hub con 3 modalità: **Manuale**, **AI brainstorming**, **Ricerca→idee** (data-driven: SEOZoom + Google).
2. La modalità **Ricerca→idee** ancora le idee a **dati reali**: keyword/volume/difficoltà (SEOZoom) + **query correlate Google** (Trends/Suggest, gratis, best-effort).
3. **Dashboard idee** con **iconcine social/canali**, **filtri** migliori (ricerca testo + debounce) e **caricamento** più fluido (skeleton).

### Decisioni di brainstorming
- Fonte Google: **Google Trends/Suggest (gratis)** + SEOZoom (degrade se Google non risponde).
- **Hub unico** "Genera idee" con 3 modalità; `/trend-seo` resta come area di analisi.

---

## 2. Ricerca Google (modulo `src/lib/google/`)
- `fetchGoogleRelated(seed: string): Promise<string[]>` → query correlate per un seed.
  - Strategia best-effort: prova l'endpoint **Google Trends** related/daily; in fallback usa **Google Suggest** (autocomplete `suggestqueries.google.com/complete/search`, pubblico, affidabile, senza chiave). **Degrada a `[]`** su errore/timeout.
  - Nessuna chiave/env. ⚠️ **Onestà:** lo scraping di Trends da server è fragile; il fallback Suggest è il segnale Google robusto. Confermo dal vivo cosa risponde.
- `normalizeSuggest(raw)` puro/testato (estrae le stringhe correlate dalla risposta).

---

## 3. Generazione "Ricerca→idee" (data-driven)
Estende la pipeline SEOZoom `discoverKeywords`:
- nuovo step **espansione seed con Google**: `seeds` → `+ fetchGoogleRelated(seeds)` (degrade) → set ampliato;
- SEOZoom `fetchKeywords` sull'insieme → `selectCandidates` (volume/KD) → Claude shaping → **Idee** con keyword/volume/difficoltà/trend reali (sorgente `seozoom`).
- Così le idee nascono da **ciò che la gente cerca** (Google) + **metriche reali** (SEOZoom).
- Fail-safe + degrade invariati (Google KO o SEOZoom KO non bloccano oltre il dovuto).

> Le modalità **Manuale** (POST `/api/ideas`) e **AI brainstorming** (POST `/api/generate`) restano invariate nel backend; cambia solo la presentazione (hub).

---

## 4. Hub "Genera idee" — `/genera`
Pagina unica con **3 tab**:
- **Manuale** — form idea (riuso `/manual`).
- **AI brainstorming** — form attuale (riuso `/generate`: prodotto/categoria/angolo/seed/count).
- **Ricerca → idee** — seed o prodotto + topN → SEOZoom+Google → idee (riuso `/trend-seo` "Scopri keyword" potenziato).
I tre form diventano **componenti riusabili**. Nav: "Genera idee" → `/genera`; i vecchi percorsi `/generate`,`/manual` reindirizzano all'hub (tab relativa). `/trend-seo` resta per l'analisi.

---

## 5. Dashboard idee — UI/UX
- **Iconcine canali/destinazioni:** componente `ChannelIcon` (libreria `react-icons`: Instagram/Facebook/TikTok + blog/email) usato nelle colonne **Piattaforme** e **Destinazioni** (al posto del testo grezzo), con tooltip.
- **Filtri:** oltre agli esistenti (stato/fonte/destinazione/categoria/priorità), **ricerca testo** su titolo/keyword con **debounce** (300ms) lato client; layout filtri a riga compatta.
- **Performance/feedback:** **skeleton** durante il caricamento (al posto di "Caricamento…"); reset selezione coerente; (paginazione semplice "mostra altri" se >100 — opzionale).
- Resta tutto il resto (badge stato, bulk approva/scarta/assegna a canali).

---

## 6. Dipendenze
- **`react-icons`** (icone social/canali). Nessuna chiave nuova (Google senza chiave).

---

## 7. Errori / fuori scope
- Google best-effort con degrade (mai bloccante). SEOZoom/Claude come oggi.
- Fuori scope: Google Custom Search/SerpAPI (scelta gratis); ricerca a pagamento; paginazione server-side avanzata.

---

## 8. Testing
- `normalizeSuggest` (parser risposta Google Suggest) — unit.
- `fetchGoogleRelated` con `fetch` mockato (fallback + degrade) — unit.
- Pipeline `discoverKeywords` con lo step Google mockato: i seed vengono espansi; Google KO → degrada (solo SEOZoom). 
- `ChannelIcon` (rende l'icona giusta per piattaforma) — unit.
- Filtro ricerca-testo (funzione pura di match) — unit.
Gate tsc+build. Smoke: genero idee in modalità Ricerca→idee (verifico che Google related arricchisca i seed; che le idee abbiano metriche reali); dashboard con iconcine + ricerca testo + skeleton.

---

## 9. Backlog
1. Modulo Google: `fetchGoogleRelated` + `normalizeSuggest` (TDD; live verify).
2. Step Google nel pipeline `discoverKeywords` (espansione seed, degrade) (TDD).
3. `react-icons` + `ChannelIcon` (TDD render).
4. Dashboard idee: iconcine + ricerca testo (debounce) + skeleton (build-gated, helper match testato).
5. Hub `/genera` (3 tab, form estratti in componenti) + nav + redirect `/generate`,`/manual`.
6. Gate + smoke.

---

## 10. Rischi
| Rischio | Impatto | Mitigazione |
|---|---|---|
| Google Trends/Suggest fragile da server | medio | best-effort + degrade a []; Suggest come fallback robusto; verifica live |
| Riorganizzazione pagine generazione | medio | estraggo i form in componenti riusati; redirect dai vecchi path; backend invariato |
| `react-icons` nuova dipendenza | basso | libreria diffusa, tree-shakeable; solo poche icone usate |
| Pipeline discover toccata (ha test) | basso | step Google additivo + degrade; test aggiornati |
