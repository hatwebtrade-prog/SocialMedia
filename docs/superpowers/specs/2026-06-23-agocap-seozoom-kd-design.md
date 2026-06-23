# AGOCAP Content AI Hub — Spec di Design: SEOZoom KD reale (selezione difficoltà-consapevole)

- **Data:** 2026-06-23
- **Sotto-progetto:** Estensione della sorgente SEOZoom — difficoltà keyword (KD) reale via azione `metrics`
- **Dipende da:** Sorgente SEOZoom (già fatta): `src/lib/seozoom/{client,select,discover,runtime,score}.ts`, pipeline `discoverKeywords`, `Idea.difficolta`/`seoScore`
- **Stato:** Design approvato in brainstorming, in attesa di review utente

---

## 1. Contesto e scope

La sorgente SEOZoom attuale usa l'endpoint `related`, che restituisce **volume** ma **non** la difficoltà
keyword (KD). Quindi `difficolta` resta al default neutro (50) e selezione/seoScore sono guidati solo dal
volume. Questa estensione recupera la **KD reale** tramite l'azione **`metrics`** di SEOZoom e la usa per
una **selezione difficoltà-consapevole**, così il sistema fa emergere davvero le query vincibili (volume
alto + difficoltà bassa).

**In scope:** `fetchDifficulty` (azione `metrics`) + normalizer; step di arricchimento KD nel pipeline
(pool per volume → enrich KD → selezione finale per opportunità reale); seoScore da KD reale. Nessun
cambio a DB/UI (la colonna *Difficoltà* mostrerà valori reali; il seoScore rifletterà la KD vera).

**Fuori scope:** GSC/Google Trends (sorgenti future); Blog Shopify (ripreso dopo); cambi di schema.

### Vincoli raccolti in brainstorming
- KD deve influenzare anche la **selezione** (non solo punteggio/display) → pipeline a due fasi
  (pool per volume → enrich → selezione finale).
- KD reale dall'azione **`metrics`** di SEOZoom; contratto (endpoint/params/campi/batch) **verificato dal
  vivo**, come fatto per `related`.
- `poolSize` default **40** (> topN), `topN` resta scelto dall'utente (≤30).
- **Errore `metrics` → degrada**: si mantiene il volume con difficoltà neutra e la scoperta **completa
  comunque** (non si perdono le idee per un problema sul solo arricchimento). Gli altri errori del
  pipeline restano fail-safe → run `ERROR` (invariato).

---

## 2. Pipeline aggiornata (`discoverKeywords`)

```
loadContext (seed + KB)                              [invariato]
  → fetchKeywords per seed → related (volume)        [invariato]
  → selectCandidates(fetched, {topN: poolSize=40})   POOL per volume (difficoltà neutra)
  → enrichDifficulty(pool)                           [NUOVO] metrics → KD reale in difficolta; su errore degrada (neutro)
  → selectCandidates(enriched, {topN})               SELEZIONE FINALE per opportunità reale (volume↑ + difficoltà↓ + trend)
  → callClaude (shaping)                             [invariato]
  → persist → Idea con seoScore da KD reale          [invariato]
```

`selectCandidates` è riusato per entrambe le selezioni (è già: filtra volume>0, ordina per opportunità,
taglia topN). Nella prima passata la difficoltà è neutra → ordina di fatto per volume; nella seconda la
difficoltà è reale → ordina per opportunità reale.

---

## 3. Modifiche concrete

### `src/lib/seozoom/client.ts`
- `fetchDifficulty(keywords: string[]): Promise<Map<string, number>>` — azione **`metrics`** di SEOZoom;
  restituisce keyword→KD (0-100). Preferibilmente **una chiamata batch** per il pool (verificare dal vivo
  se `metrics` accetta liste o richiede chiamate per keyword; adattare).
- `normalizeMetrics(raw)` — mappa il response `metrics` a `Map<keyword, KD>`, leggendo il campo difficoltà
  reale (es. `KD`/`difficulty`); default prudente (50) se assente per una keyword. Unico punto che conosce
  il formato `metrics`.

### `src/lib/seozoom/discover.ts`
- `SeozoomDeps` esteso con `enrichDifficulty: (keywords: NormalizedKeyword[]) => Promise<NormalizedKeyword[]>`.
- Pipeline: aggiungere lo step pool → `enrichDifficulty` → selezione finale; introdurre `poolSize` (40)
  con `topN` finale dall'input.
- Test pipeline aggiornati: `enrichDifficulty` mockato (identità o KD aggiornata); verificare che la
  selezione finale usi la KD arricchita e che un `enrichDifficulty` che lancia **non** faccia fallire la
  run (degrada — la pipeline cattura l'errore di enrich e prosegue con il pool non arricchito).

> Nota: il "degrada su errore metrics" vive **dentro `enrichDifficulty`** (cattura internamente e
> restituisce le keyword invariate) così la pipeline resta semplice e il fail-safe globale invariato.

### `src/lib/seozoom/runtime.ts`
- Implementa `enrichDifficulty` reale: chiama `fetchDifficulty(pool.map(k=>k.keyword))`, fonde la KD nei
  candidati (`difficolta` aggiornata dove presente); **try/catch interno**: su errore logga e ritorna il
  pool invariato (difficoltà neutra). Riusa `matchCandidate`/lowercase per associare KD↔keyword.

### Selezione/punteggio
- `selectCandidates` e `metricsToSeoScore` restano invariati: ora ricevono difficoltà reale.

---

## 4. Gestione errori
- `metrics` fallita / `fetchDifficulty` throw → `enrichDifficulty` cattura, logga, ritorna pool invariato
  (difficoltà neutra 50); la scoperta **completa** con scoring volume-driven. Nessuna idea persa.
- Errori `related`/Claude/persist → run `ERROR` (invariato, fail-safe del pipeline).
- `SEOZOOM_API_KEY` mancante → `fetchKeywords` già lancia (run ERROR prima dell'enrich).

---

## 5. Testing
Unit (nessuna chiamata reale):
- `normalizeMetrics` — mappa un response `metrics` di esempio a `Map<keyword, KD>` (default su campo mancante). `fetch` mockato per `fetchDifficulty`.
- Pipeline `discoverKeywords`: pool→enrich→selezione finale con deps mockate; un caso in cui `enrichDifficulty` cambia l'ordine finale (KD reale promuove una keyword a volume più basso ma difficoltà molto più bassa); un caso in cui `enrichDifficulty` rigetta/è identità → la run resta DONE.
- `enrichDifficulty` (runtime) degrada su errore: con `fetchDifficulty` mockato che lancia, ritorna il pool invariato (test del solo helper se isolabile, altrimenti via pipeline).

Smoke end-to-end con chiave SEOZoom + Claude reali: `POST /api/seozoom/discover {"seeds":["magnesio"]}` →
confermare che `difficolta` sulle idee è **reale e variabile** (non tutto 50) e che il seoScore varia di
conseguenza; verificare la spesa unità ragionevole.

---

## 6. Backlog di sviluppo
1. `fetchDifficulty` + `normalizeMetrics` in client.ts (TDD sul normalizer con fetch mockato; verifica contratto `metrics` dal vivo).
2. `SeozoomDeps.enrichDifficulty` + pipeline pool→enrich→selezione finale in discover.ts (TDD).
3. `enrichDifficulty` runtime (fetchDifficulty + merge KD + degrade su errore) (test helper).
4. Smoke end-to-end con chiavi reali: confermare KD reale + contratto `metrics` + spesa unità.

---

## 7. Rischi
| Rischio | Impatto | Mitigazione |
|---|---|---|
| Contratto `metrics` ignoto (batch? campo KD? unità per chiamata) | medio | normalizer isola il formato; verifica dal vivo prima dello smoke; adattare client |
| Spesa unità SEOZoom (metrics sul pool) | medio | pool limitato (40); una chiamata batch se supportata; ~985k unità disponibili |
| `metrics` non copre tutte le keyword del pool | basso | default neutro per le mancanti; degrade complessivo su errore |
| KD assente anche da `metrics` per alcune keyword | basso | default 50; documentato |

---

## 8. Schema per iniziare
1. Approvazione spec. 2. Piano (writing-plans). 3. Build per task con review a due stadi. 4. Smoke con chiavi reali (confermare KD reale + spesa unità).

> Chiave: `SEOZOOM_API_KEY` (già in env). Da rigenerare se esposta.
