# Editorial OS — Fase 3: Area Meta (Reel/Story + split IG/FB) — Design

- **Data:** 2026-06-24
- **Sotto-progetto:** Ri-architettura Editorial OS — **Fase 3 di 7** (Area Meta)
- **Riferimento:** master `2026-06-23-agocap-editorial-os-MASTER-riorganizzazione.md` (sez. 4, 16 fase 3)
- **Dipende da:** Generatore Meta esistente (schema/prompt/runtime), `StatusBadge` (Fase 1)
- **Stato:** Design approvato in brainstorming, in attesa di review utente

---

## 1. Obiettivo
Potenziare l'Area Meta: **nuovi formati REEL e STORY** (oltre Post/Carosello), **split Instagram/Facebook**
nella tabella, e rifinitura UI (badge di stato). Reel/Story **strutturati per tipo** (decisione utente). Nessuna
regressione ai formati esistenti.

### Stato attuale rilevante
- `ContentFormat` (Prisma): POST, CAROSELLO, ARTICOLO. `CONTENT_FORMATS` (meta enums): POST, CAROSELLO.
- Payload Meta: POST `{caption, ideaCreativa, hashtags[], cta}`; CAROSELLO = POST + `slides[{testo}]`.
- `buildMetaPrompt` costruisce i campi in base al formato; `payloadSchemaFor` sceglie lo schema; il runtime
  `callClaude` seleziona POST/CAROSELLO.
- **Tabella Meta** (`meta-content-table`) ha GIÀ filtri stato/formato/piattaforma e colonna Piattaforme →
  lo **split IG/FB è già supportato** (filtro piattaforma); il filtro formato includerà REEL/STORY appena
  esteso l'enum.
- L'immagine on-demand usa `payload.ideaCreativa` → funziona per Reel (cover) e Story (visual).

---

## 2. Modello dati
- `ContentFormat` += **`REEL`**, **`STORY`** (Prisma enum). Migrazione `content_format_reel_story`.
- `CONTENT_FORMATS` (meta enums) += `"REEL"`, `"STORY"` → il generatore e i filtri li includono automaticamente.

> `generateInputSchema` usa `z.enum(CONTENT_FORMATS)` → accetterà REEL/STORY senza modifiche.

---

## 3. Payload (strutturati per tipo)
- **REEL** = POST + struttura video:
  ```
  { caption, ideaCreativa, hashtags[], cta, hook, scriptParlato, testoSchermo[] }
  ```
  (hook = aggancio iniziale; scriptParlato = testo parlato; testoSchermo = righe di testo a schermo).
- **STORY** (leggera):
  ```
  { ideaCreativa, testo, cta }
  ```
  (ideaCreativa = visual; testo = overlay; cta).
- `payloadSchemaFor(formato)` esteso ai 4 formati (POST/CAROSELLO/REEL/STORY). Tipi inferiti esportati.

---

## 4. Prompt
`buildMetaPrompt` aggiornato: set di campi e forma JSON specifici per formato:
- POST/CAROSELLO invariati.
- REEL: aggiunge hook, scriptParlato, testoSchermo ai campi POST; forma JSON estesa.
- STORY: campi ideaCreativa/testo/cta; forma JSON dedicata; tono "story breve e diretta".

---

## 5. Runtime
`src/lib/meta/runtime.ts` → `callClaude`: sostituire la selezione `CAROSELLO ? … : POST` con
`payloadSchemaFor(input.formato)` (gestisce i 4 formati). Nessun'altra modifica al wiring (persist, image,
deps invariati). L'immagine on-demand continua a leggere `ideaCreativa`.

---

## 6. UI
- **`meta-content-table`**: la colonna Stato usa `StatusBadge` (badge colorato). Filtri/colonne esistenti
  (stato, formato, piattaforma, Piattaforme, Data prevista, Img) restano: il filtro **formato** ora elenca
  anche REEL/STORY e il filtro **piattaforma** fornisce lo split IG/FB. (Opzionale: colonna Prodotto se
  facilmente disponibile — non bloccante.)
- **Generatore Meta** (`/meta/genera`): il menu formato (basato su `CONTENT_FORMATS`) includerà REEL/STORY
  automaticamente; `numeroSlide` resta condizionato a CAROSELLO.

---

## 7. Fuori scope (fasi successive)
- **Programmazione/assegnazione data** → Fase 5 (Calendario unico).
- **Generazione video** per i Reel (resta uno spike futuro): generiamo concept/script/cover, non il video.
- Pubblicazione → Fase 6 (n8n).

---

## 8. Gestione errori
- Pipeline Meta fail-safe già esistente (ERROR senza contenuto parziale). Validazione zod per formato.
- Formato non valido → 400 (enum).

---

## 9. Testing
Unit:
- `reelPayloadSchema` / `storyPayloadSchema` (accettano payload validi; rifiutano campi mancanti).
- `payloadSchemaFor` ritorna lo schema giusto per i 4 formati.
- `buildMetaPrompt` per REEL (contiene hook/scriptParlato/testoSchermo + JSON) e per STORY (testo/ideaCreativa/cta).
Gate: `npx tsc --noEmit` + `npm run build`. Smoke: generare dal vivo un **REEL** e una **STORY** da un'idea
APPROVATA con destinazione META → contenuti BOZZA con payload corretto + immagine; verificare il filtro
formato e piattaforma nella tabella.

---

## 10. Backlog di sviluppo
1. `ContentFormat` += REEL/STORY (Prisma migrazione) + `CONTENT_FORMATS`.
2. `reelPayloadSchema`/`storyPayloadSchema` + `payloadSchemaFor` esteso (TDD).
3. `buildMetaPrompt` REEL/STORY (TDD).
4. Runtime `callClaude` selezione schema per i 4 formati + `meta-content-table` StatusBadge.
5. Gate + smoke (REEL + STORY dal vivo).

---

## 11. Roadmap successiva
4. Blog workflow + predisposizione n8n. 5. Calendario unico (`EditorialCalendarItem`, viste). 6. Pubblicazioni + endpoint n8n. 7. TikTok + Email generatori.

---

## 12. Rischi
| Rischio | Impatto | Mitigazione |
|---|---|---|
| Selezione schema runtime per 4 formati | basso | `payloadSchemaFor(formato)` unico punto; smoke su REEL+STORY |
| Reel = video non generabile | basso | generiamo concept/script/cover; chiaro in UI; video = spike futuro |
| Payload STORY diverso (no caption/hashtags) | basso | schema dedicato; image gen usa ideaCreativa (presente) |
