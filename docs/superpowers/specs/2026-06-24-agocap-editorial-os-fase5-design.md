# Editorial OS — Fase 5: Calendario editoriale unico — Design

- **Data:** 2026-06-24
- **Sotto-progetto:** Ri-architettura Editorial OS — **Fase 5 di 7** (Calendario unico)
- **Riferimento:** master (sez. 8, 12, 16 fase 5)
- **Dipende da:** GeneratedContent (status, dataPrevista, canale), StatusBadge
- **Stato:** Design approvato in brainstorming, in attesa di review utente

---

## 1. Obiettivo
Un **calendario editoriale unico** che mostra i contenuti programmati di **tutti i canali** (Meta/Blog/TikTok/Email),
distinti per colore, con viste **mese/settimana/agenda**, filtri, una sezione **"da programmare"** e
**assegnazione/spostamento data** (campo data + click — niente drag&drop in questa fase). La programmazione vive
in una **tabella dedicata** `EditorialCalendarItem` che rispecchia `dataPrevista`/stato sul contenuto.

### Decisioni di brainstorming
- Interazione: **campo data + click** (drag&drop rimandato).
- Sincronizzazione: **EditorialCalendarItem dedicato + mirror** di `GeneratedContent.dataPrevista` e `status=PROGRAMMATO`.

---

## 2. Modello dati
```prisma
model EditorialCalendarItem {
  id           String            @id @default(cuid())
  contentId    String            @unique
  content      GeneratedContent  @relation(fields: [contentId], references: [id], onDelete: Cascade)
  scheduledAt  DateTime
  channel      Canale
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  @@index([scheduledAt])
  @@index([channel])
}
```
`GeneratedContent` riceve la back-relation `calendarItem EditorialCalendarItem?`. Migrazione
`editorial_calendar_item` (additiva). `channel` è denormalizzato (dal `canale` del contenuto) per filtro/colore.

> **Una sola programmazione per contenuto** (`contentId @unique`). `scheduledAt` è la fonte dedicata; l'API
> mantiene allineati `content.dataPrevista` e `content.status` (PROGRAMMATO ↔ APPROVATO).

---

## 3. API (`src/app/api/calendar/`)
- `GET /api/calendar?from=&to=&channel=&status=` → item nel range `[from,to]` (per `scheduledAt`), con info
  contenuto; filtri opzionali canale (su `channel`) e stato (su `content.status`). Ritorna voci mappate:
  `{ id, contentId, scheduledAt, channel, status, titolo, href }` (titolo = `payload.titoloSeo` per BLOG,
  altrimenti `idea.titolo`; href = `/meta/<id>` o `/blog/<id>`).
- `POST /api/calendar` `{ contentId, scheduledAt }` → in transazione: upsert `EditorialCalendarItem`
  (per `contentId`, con `channel = content.canale`) + update contenuto `{ status: PROGRAMMATO, dataPrevista: scheduledAt }`.
- `PATCH /api/calendar/[id]` `{ scheduledAt }` → sposta: update item.scheduledAt + content.dataPrevista (stato invariato).
- `DELETE /api/calendar/[id]` → rimuove: elimina item + contenuto `{ status: APPROVATO, dataPrevista: null }`.
- `GET /api/calendar/unscheduled` → contenuti `status=APPROVATO` senza `calendarItem` → `{ id, canale, titolo }`
  (sezione "da programmare").

Validatori zod: `calendarAssignSchema { contentId, scheduledAt: datetime }`, `calendarMoveSchema { scheduledAt: datetime }`.

---

## 4. Logica/Helper (`src/lib/calendar/`, puri e testati)
- `channelColor(channel)` → classi Tailwind (META blu, BLOG verde, TIKTOK viola, EMAIL ambra; default grigio).
- `contentHref(channel, contentId)` → `/meta/<id>` (META) · `/blog/<id>` (BLOG) · altrimenti `#` (TikTok/Email: nessun dettaglio ancora).
- `toCalendarEntry(item)` → mappa l'item+contenuto nella voce per la UI (titolo/href/status).

---

## 5. UI — `/calendario` (sostituisce il placeholder)
Componente `CalendarBoard` (client):
- **Switch vista**: Mese / Settimana / Agenda. Navigazione mese precedente/successivo.
- **Mese**: griglia 7×N (riuso della logica del calendario Meta), ogni contenuto come pill **colorata per canale**, link al dettaglio.
- **Settimana**: 7 colonne (lun-dom) della settimana corrente del cursore.
- **Agenda**: lista raggruppata per giorno; ogni voce ha **campo data** per spostare + bottone **rimuovi**.
- **Filtri**: canale, stato (badge nelle voci agenda).
- **Sidebar "Contenuti approvati da programmare"**: lista degli APPROVATO senza data; per ognuno un campo data + **"Programma"** (POST).
- **Legenda** colori canale.

> Recupero gli item del mese visibile (per Mese/Agenda) e della settimana (per Settimana) via `GET /api/calendar`
> con `from`/`to`; la sidebar via `GET /api/calendar/unscheduled`. Robusta a errori (stato vuoto, no crash).

---

## 6. Coerenza con l'esistente
- Home "calendario imminente" e calendario Meta leggono `dataPrevista`: restano coerenti perché l'API
  programmazione la aggiorna in mirror. (Il calendario Meta resta; `/calendario` è quello unico nuovo.)

## 7. Fuori scope
- Drag&drop (futuro). Pubblicazione automatica n8n → Fase 6. Generatori TikTok/Email → Fase 7 (i loro contenuti
  appariranno nel calendario quando esisteranno).

---

## 8. Testing
Unit (puri/route con prisma mockato):
- `channelColor`, `contentHref`, `toCalendarEntry` (mappa titolo BLOG vs idea; href per canale).
- `calendarAssignSchema`/`calendarMoveSchema`.
- `POST /api/calendar` (upsert item + update content in transazione — prisma mockato; verifica chiamate); `DELETE` (elimina + ripristina APPROVATO).
Gate: `npx tsc --noEmit` + `npm run build`. Smoke: assegno una data a un contenuto APPROVATO dalla sidebar →
appare nel mese, il contenuto diventa PROGRAMMATO e `dataPrevista` è valorizzata; sposto la data dall'agenda;
rimuovo → torna in "da programmare".

---

## 9. Backlog di sviluppo
1. Prisma `EditorialCalendarItem` + back-relation + migrazione.
2. Helper `channelColor`/`contentHref`/`toCalendarEntry` + validatori (TDD).
3. API `GET /api/calendar`, `GET /api/calendar/unscheduled`, `POST`, `PATCH`, `DELETE` (TDD route su POST/DELETE).
4. UI `CalendarBoard` (mese/settimana/agenda, filtri, sidebar da-programmare, riprogramma/rimuovi) + pagina `/calendario`.
5. Gate + smoke.

---

## 10. Roadmap successiva
6. Pubblicazioni + endpoint n8n (legge i PROGRAMMATO/calendar item, pubblica, aggiorna publicationStatus). 7. TikTok + Email generatori.

---

## 11. Rischi
| Rischio | Impatto | Mitigazione |
|---|---|---|
| Doppia fonte (item vs dataPrevista) | medio | scrittura in transazione nell'API; item = fonte, dataPrevista = mirror; un solo punto di scrittura |
| UI calendario corposa | medio | viste incrementali, riuso griglia Meta, range per mese; niente drag&drop |
| Contenuti TikTok/Email senza dettaglio | basso | href `#` finché non esistono i generatori (Fase 7); nessun contenuto di quei canali ora |
| Fuso orario date | basso | salvo `scheduledAt` ISO; visualizzo in locale it-IT; confronto per giorno su data locale |
