# AGOCAP Content AI Hub — Riorganizzazione "Editorial OS" — Fase 1: Navigazione + Home

- **Data:** 2026-06-23
- **Sotto-progetto:** Ri-architettura in chiave Editorial OS — **Fase 1 di 7** (navigazione + Home)
- **Riferimento:** prompt completo di riorganizzazione fornito dall'utente (`AGOCAP_Content_AI_Hub_Riorganizzazione_Prompt_Claude.md`), sez. 1, 11, 14, 16.
- **Stato:** Design approvato in brainstorming, in attesa di review utente

---

## 1. Contesto e obiettivo

L'attuale UI è percepita come **confusionaria**: le voci (Dashboard Idee, Genera Idee, Scopri keyword,
Inserimento Manuale, Knowledge Base, Report, Area Meta, Blog) sembrano funzioni tecniche scollegate e non
raccontano il flusso editoriale `Analisi → Brain → Idee → Contenuti → Calendario → Pubblicazione`.

Il sistema va riorganizzato come **Editorial OS** con aree chiare. La logica fondante è:
`Area Brain = idee` · `Aree canale = contenuti` · `Calendario = programmazione` · `n8n = pubblicazione`.

La ri-architettura è **a fasi** (decisione utente). Questa è la **Fase 1**: rendere il sistema subito
**ben orientabile** tramite una **nuova navigazione a aree** e una **Home dashboard** di riepilogo, **senza
modifiche al modello dati** e **senza rompere le funzioni esistenti** (Brain, Meta, Blog, SEOZoom restano
operative). Le fasi successive aggiungono profondità (destinazioni editoriali, calendario, pubblicazioni, ecc.).

### Decisioni di brainstorming
- Partenza dalla **Fase 1 (Nav + Home)**.
- Calendario: **tabella `EditorialCalendarItem` dedicata** (Fase 5, non in Fase 1).
- **TikTok ed Email**: aree **predisposte** ora (placeholder "in arrivo"), generatori in Fase 7.
- UI italiano, codice inglese; stack invariato (Next.js 15 + Prisma + Tailwind).

---

## 2. Architettura target (visione complessiva — riferimento)

Aree del menu principale (sidebar):
`Home · Brain · Trend & SEO · Meta · Blog · TikTok · Email · Calendario · Pubblicazioni · Report · Impostazioni`.

Mappatura concettuale: **Brain** = raccolta/classificazione/approvazione idee (da AI, SEOZoom, manuale,
trend…); **Trend & SEO** = analisi keyword/opportunità che **alimenta** il Brain; **Meta/Blog/TikTok/Email**
= trasformano idee approvate in contenuti; **Calendario** = programmazione unica multi-canale; **Pubblicazioni**
= stato tecnico n8n. Questa visione completa guida le fasi 2-7; la Fase 1 ne realizza lo **scheletro navigabile**.

---

## 3. Scope della Fase 1

### 3.1 Nuova navigazione — sidebar a aree
- **Layout con sidebar a sinistra** (sostituisce la top-nav attuale `Nav`), pulita ed editoriale, con:
  - voci d'area con icona + etichetta italiana;
  - **sotto-voci** per Brain (Tutte le idee, Genera idee, Inserimento manuale);
  - stato **attivo** evidenziato in base alla route;
  - intestazione "AGOCAP Content AI Hub".
- Applicata via il root `layout.tsx` (la sidebar avvolge tutte le pagine).

Mappatura voci → route (Fase 1, riuso delle pagine esistenti dove ci sono):
| Area | Route | Note |
|---|---|---|
| Home | `/` | nuova dashboard |
| Brain · Tutte le idee | `/dashboard` | esistente |
| Brain · Genera idee | `/generate` | esistente |
| Brain · Inserimento manuale | `/manual` | esistente |
| Trend & SEO | `/trend-seo` | **nuova** pagina che ospita "Scopri keyword" (riusa il componente di `/brain/scopri`); `/brain/scopri` reindirizza qui |
| Meta | `/meta` | esistente |
| Blog | `/blog` | esistente |
| TikTok | `/tiktok` | **placeholder** "in arrivo" |
| Email | `/email` | **placeholder** "in arrivo" |
| Calendario | `/calendario` | **placeholder** "in arrivo" (unico, Fase 5) |
| Pubblicazioni | `/pubblicazioni` | **placeholder** "in arrivo" (Fase 6) |
| Report | `/report` | esistente |
| Knowledge Base | `/knowledge` | esistente (sotto Report o Impostazioni) |
| Impostazioni | `/impostazioni` | **placeholder** |

> Nessuna pagina esistente viene cancellata; restano raggiungibili. Solo `Scopri keyword` viene "promossa"
> ad area **Trend & SEO** (route nuova, contenuto riusato; vecchia route reindirizza).

### 3.2 Home dashboard (`/`)
Pagina iniziale di riepilogo (non una lista idee). Mostra **card per area** con conteggi reali + CTA:
- **Trend & SEO**: nº idee da SEOZoom nuove / approvate → CTA "Vai ad Analisi SEO / Trend".
- **Meta**: contenuti META per stato (bozza / da approvare / approvati non programmati / programmati) → CTA "Vai ad Area Meta".
- **Blog**: articoli per stato (generati / bozza / da approvare / approvati / programmati / pubblicati) → CTA "Vai ad Area Blog".
- **TikTok** ed **Email**: card "in arrivo" (conteggi a 0 / placeholder) → CTA verso le rispettive aree.
- **Calendario imminente**: mini-anteprima dei prossimi contenuti con `dataPrevista` (oggi/prossimi giorni), raggruppati per giorno, con canale e titolo → CTA "Vai al Calendario".
- **Idee**: riepilogo idee per stato (nuove / da approvare / approvate).

Badge di stato **colorati** riusabili (componente `StatusBadge`) per NUOVA/INTERESSANTE/APPROVATA/SCARTATA e
BOZZA/DA_APPROVARE/APPROVATO/PROGRAMMATO/PUBBLICATO.

### 3.3 API di riepilogo
- `GET /api/home/summary` → aggrega conteggi da dati esistenti:
  - idee per stato e per sorgente (incl. `seozoom`);
  - `GeneratedContent` per `canale` × `status`;
  - prossimi contenuti con `dataPrevista` ≥ oggi (limit ~10, per la mini-anteprima calendario).
  - Forma JSON tipizzata, una sola risposta.

### 3.4 Pagine placeholder
`/tiktok`, `/email`, `/calendario`, `/pubblicazioni`, `/impostazioni`: pagina semplice e coerente con titolo
area + messaggio "Area in arrivo — disponibile in una fase successiva", così la navigazione è completa e
ordinata da subito.

---

## 4. Fuori scope (fasi successive)
- **Modello dati**: `Idea.destinazioni[]` (META/BLOG/TIKTOK/EMAIL), `Canale += EMAIL`, nuovi `ContentFormat`
  (REEL/STORY/SCRIPT_VIDEO/NEWSLETTER/PROMO_EMAIL/FLOW_EMAIL), `GeneratedContent` + `publicationStatus`/
  `publicationError`/`publishedAt`, tabella `EditorialCalendarItem`. → **Fase 2 / 5 / 6**.
- Logica calendario unico (viste mese/settimana/agenda, assegnazione data) → **Fase 5**.
- Pubblicazioni + endpoint n8n (`/api/publications/due|success|error`) → **Fase 6**.
- Generatori TikTok ed Email → **Fase 7**.
- Brain: destinazioni editoriali, filtri estesi → **Fase 2**.
- Meta: split Instagram/Facebook, formati Reel/Story → **Fase 3**.

---

## 5. Gestione errori
- `/api/home/summary`: query in parallelo; in caso di errore DB → 500 con messaggio; la Home mostra le card
  con stato "—" se i dati non si caricano (nessun crash).
- Le pagine placeholder sono statiche (nessun errore possibile).

---

## 6. Testing
- `GET /api/home/summary`: test con Prisma mockato → la risposta contiene i conteggi attesi (idee per stato/
  sorgente, contenuti per canale/stato, prossimi contenuti).
- `StatusBadge`: test di rendering del colore/etichetta per alcuni stati chiave.
- Navigazione: test della logica di voce attiva (funzione pura `isActive(pathname, href)`).
- Gate: `npx tsc --noEmit` + `npm run build` (tutte le nuove route + placeholder compilano; sidebar nel layout).
- Smoke manuale: avvio server, verifico Home con dati reali + navigazione tra aree.

---

## 7. Backlog di sviluppo (Fase 1)
1. Componente `StatusBadge` (mappa stato→colore/etichetta) (TDD).
2. Helper `isActive` + dati di navigazione (`navItems`) (TDD).
3. Componente **Sidebar** + integrazione nel root `layout.tsx` (sostituisce `Nav`).
4. `GET /api/home/summary` + validatori/tipi (TDD con Prisma mockato).
5. Componente Home (card di riepilogo + mini-calendario) + pagina `/` (Home).
6. Pagina `/trend-seo` (riusa il componente "Scopri keyword") + redirect da `/brain/scopri`.
7. Pagine placeholder `/tiktok`, `/email`, `/calendario`, `/pubblicazioni`, `/impostazioni`.
8. Gate tsc + build; smoke.

---

## 8. Roadmap (fasi successive)
2. Brain ordinato (destinazioni editoriali, filtri, azioni "invia a canale").
3. Meta (Instagram/Facebook, Reel/Story).
4. Blog (workflow articolo + predisposizione n8n).
5. **Calendario editoriale unico** (tabella `EditorialCalendarItem`, viste mese/settimana/agenda, assegnazione data).
6. **Pubblicazioni** + endpoint n8n (`due/success/error`, log, stati tecnici).
7. **TikTok + Email** generatori.

---

## 9. Rischi
| Rischio | Impatto | Mitigazione |
|---|---|---|
| Cambio layout (sidebar) tocca tutte le pagine | medio | modifica isolata nel root layout; le pagine non cambiano contenuto |
| Spostamento `Scopri keyword` → `/trend-seo` | basso | nuova route che riusa il componente; redirect dalla vecchia |
| Home summary con DB grande | basso | conteggi con `count`/`groupBy`, query parallele |
| Coerenza voci/route | basso | `navItems` unica fonte + `isActive` testato |

---

## 10. Schema per iniziare
1. Approvazione spec. 2. Piano (writing-plans). 3. Build per task, review a due stadi. 4. Smoke. 5. Fase 2.
