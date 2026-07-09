# Editorial OS — Fase 4: Blog workflow + predisposizione n8n — Design

- **Data:** 2026-06-24
- **Sotto-progetto:** Ri-architettura Editorial OS — **Fase 4 di 7** (Blog workflow)
- **Riferimento:** master (sez. 5, 9, 10, 12, 16 fase 4)
- **Dipende da:** Generatore Blog esistente, `StatusBadge` (Fase 1)
- **Stato:** Design approvato in brainstorming, in attesa di review utente

---

## 1. Obiettivo
Allineare il Blog al modello editoriale e **predisporlo a n8n**: dashboard Blog più chiara (badge, filtro stato,
colonne), e **campi tecnici di pubblicazione** sul contenuto (separati dagli stati editoriali) pronti per la
pubblicazione automatica della Fase 6. Nessuna regressione alla generazione esistente.

### Decisioni di brainstorming
- **Aggiungere ora** i campi di pubblicazione su `GeneratedContent` (predisposizione n8n).
- Dashboard Blog = **tabella unica con filtri** (coerente con Meta).

---

## 2. Modello dati (predisposizione pubblicazione — generale su tutti i canali)
- Nuovo enum Prisma `PublicationStatus { NON_INVIATO  INVIATO_A_N8N  IN_PUBBLICAZIONE  PUBBLICATO  ERRORE }`.
- `GeneratedContent` aggiunge:
  - `publicationStatus PublicationStatus @default(NON_INVIATO)`
  - `publicationError String?`
  - `publishedAt DateTime?`
  - `shopifyArticleId String?`
  - `shopifyArticleUrl String?`
- `src/lib/meta/enums.ts`: `export const PUBLICATION_STATUSES = ["NON_INVIATO","INVIATO_A_N8N","IN_PUBBLICAZIONE","PUBBLICATO","ERRORE"] as const` + tipo.
- Migrazione `content_publication_fields` (non distruttiva; default NON_INVIATO sui record esistenti).

> Stati **editoriali** (`ContentStatus`: BOZZA→…→PUBBLICATO) restano distinti dallo stato **tecnico**
> (`publicationStatus`). In Fase 4 il publicationStatus resta al default; lo gestirà n8n in Fase 6.

---

## 3. UI

### 3.1 `StatusBadge` (estensione)
Aggiungere alla mappa label/colore i nuovi stati tecnici: `NON_INVIATO` (grigio "Non inviato"),
`INVIATO_A_N8N` (blu "Inviato a n8n"), `IN_PUBBLICAZIONE` (ambra "In pubblicazione"). `PUBBLICATO`/`ERRORE`
esistono già.

### 3.2 Dashboard Blog (`blog-content-table`)
- **Filtro per stato** (ContentStatus) → `GET /api/blog/contents?status=` (già supportato).
- **Badge colorato** nella colonna Stato (`StatusBadge`).
- **Colonne**: Titolo SEO, Idea, **Keyword** (da `payload.keywordPrincipale`), Stato, **Data prevista**.
- Resta robusta (guardia `Array.isArray`, loading reset) come ora.

### 3.3 Dettaglio articolo (`/blog/[id]`)
- Mantiene il workflow stati editoriali (select BOZZA→…).
- Mostra (read-only) lo **stato di pubblicazione** (`publicationStatus`) come badge + eventuale
  `shopifyArticleUrl` se presente — informativo, popolato da n8n in Fase 6.

---

## 4. Fuori scope (fasi successive)
- Assegnazione data nel **Calendario** → Fase 5.
- **Endpoint n8n** (`/api/publications/due|success|error`) e logica di pubblicazione → Fase 6.

---

## 5. Testing
- `badgeStyle` per i nuovi stati tecnici (label/colore).
- Migrazione applicata; `GET /api/blog/contents?status=APPROVATO` filtra; il contenuto restituisce
  `publicationStatus` di default.
- Gate `npx tsc --noEmit` + `npm run build`. Smoke: dashboard Blog con filtro stato + badge + colonne;
  dettaglio articolo mostra stato editoriale e stato pubblicazione (NON_INVIATO).

---

## 6. Backlog di sviluppo
1. Prisma: `PublicationStatus` enum + 5 campi su `GeneratedContent` + migrazione; `PUBLICATION_STATUSES` const; estendere `StatusBadge` (TDD su badgeStyle).
2. Dashboard Blog: filtro stato + StatusBadge + colonne (keyword, data prevista).
3. Dettaglio articolo: badge stato pubblicazione (read-only) + link Shopify se presente.
4. Gate + smoke.

---

## 7. Roadmap successiva
5. Calendario unico (`EditorialCalendarItem`, viste, assegnazione data). 6. Pubblicazioni + endpoint n8n (popola publicationStatus/shopifyArticleId/Url). 7. TikTok + Email generatori.

---

## 8. Rischi
| Rischio | Impatto | Mitigazione |
|---|---|---|
| Nuovo enum + 5 colonne | basso | tutte nullable/`@default`; migrazione non distruttiva |
| Confusione stato editoriale vs pubblicazione | medio | due campi/badge distinti ed etichette chiare ("Stato" vs "Pubblicazione") |
| `blog-content-table` già robusto | basso | estendo, non riscrivo la logica di fetch |
