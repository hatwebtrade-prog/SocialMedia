# AGOCAP Content AI Hub — Prompt completo per riorganizzazione e implementazione

## Obiettivo generale

Voglio riorganizzare **AGOCAP Content AI Hub** perché l’attuale struttura è troppo confusionaria e sembra costruita per funzioni tecniche separate, invece che come un vero sistema editoriale completo.

Il programma deve diventare una piattaforma interna ordinata per gestire l’intero flusso dei contenuti Agocap:

```text
Analisi → Brain → Approvazione idee → Generazione contenuti → Approvazione contenuti → Calendario editoriale → Pubblicazione tramite n8n
```

Il sistema deve essere pensato come un **Content Hub / Editorial OS** per Agocap, dove il Brain genera e organizza le idee, le aree canale trasformano le idee approvate in contenuti, il calendario pianifica le pubblicazioni e n8n gestisce l’automazione finale.

La separazione fondamentale deve essere questa:

```text
Area Brain = idee
Aree canale = contenuti generati
Calendario = programmazione editoriale
n8n = pubblicazione automatica
```

---

## Problema attuale

L’attuale interfaccia è troppo frammentata e poco leggibile.

Le pagine come:

```text
Dashboard Idee | Genera Idee | Scopri keyword | Inserimento Manuale | Knowledge Base | Report | Area Meta | Blog
```

sembrano funzioni separate, ma non raccontano chiaramente il flusso di lavoro.

Serve invece un’architettura più editoriale, con aree ben distinte:

1. Home Dashboard
2. Area Brain
3. Area Trend & SEO
4. Area Meta
5. Area Blog
6. Area TikTok
7. Area Email Marketing
8. Calendario Editoriale
9. Pubblicazioni
10. Report / Knowledge Base / Impostazioni

---

# 1. Home Dashboard

La Home deve essere la pagina iniziale del sistema.

Non deve essere una semplice lista di idee, ma una dashboard generale che mostra lo stato dell’intero sistema editoriale.

## Obiettivo della Home

La Home deve permettermi di capire subito:

- quali trend SEO sono interessanti;
- quali idee sono nuove o da approvare;
- quali contenuti Meta sono in lavorazione;
- quali articoli Blog sono in lavorazione;
- quali contenuti TikTok o Email sono previsti;
- cosa è già programmato nel calendario;
- cosa manca prima della pubblicazione.

## Sezioni principali della Home

### 1. Analisi Trend / SEOZoom

In questa sezione devo vedere una sintesi delle opportunità SEO.

Elementi da mostrare:

- keyword emergenti;
- volumi di ricerca;
- difficoltà keyword;
- opportunità SEO;
- keyword stagionali;
- prodotti collegati;
- idee generate da keyword;
- numero di idee SEO nuove;
- numero di idee SEO approvate.

Call to action:

```text
Vai ad Analisi SEO / Trend
```

Il click deve portare all’area dedicata Trend & SEO.

---

### 2. Analisi Meta

In questa sezione devo vedere lo stato dei contenuti social Meta.

Elementi da mostrare:

- contenuti Instagram in bozza;
- contenuti Facebook in bozza;
- contenuti Meta da approvare;
- contenuti Meta approvati ma non programmati;
- contenuti Meta programmati;
- prossime pubblicazioni Meta;
- eventuali insight futuri da Meta.

Call to action:

```text
Vai ad Area Meta
```

Il click deve portare all’area Meta.

---

### 3. Analisi Blog

In questa sezione devo vedere lo stato degli articoli blog.

Elementi da mostrare:

- idee blog approvate;
- articoli generati;
- articoli in bozza;
- articoli da approvare;
- articoli approvati ma non programmati;
- articoli programmati;
- articoli pubblicati;
- opportunità SEO collegate al blog.

Call to action:

```text
Vai ad Area Blog
```

Il click deve portare all’area Blog.

---

### 4. Analisi TikTok

Anche se TikTok non è ancora sviluppato, la Home deve prevedere questa sezione per la futura espansione.

Elementi da mostrare:

- idee approvate per TikTok;
- script generati;
- contenuti da approvare;
- contenuti programmati;
- prossime pubblicazioni TikTok.

Call to action:

```text
Vai ad Area TikTok
```

---

### 5. Analisi Email Marketing

Anche questa area deve essere prevista per la futura espansione.

Elementi da mostrare:

- idee approvate per email marketing;
- newsletter in bozza;
- promo in bozza;
- email educazionali;
- flussi Klaviyo;
- email programmate.

Call to action:

```text
Vai ad Area Email Marketing
```

---

### 6. Calendario editoriale imminente

La Home deve mostrare una mini anteprima del calendario.

Esempio:

```text
Oggi
- Instagram Post: Magnesio e stress
- Blog: Guida al magnesio

Domani
- Reel Instagram: 3 segnali di carenza di magnesio
- Email: Promo Mg5
```

Call to action:

```text
Vai al Calendario Editoriale
```

---

# 2. Area Brain

L’Area Brain deve essere il centro del sistema.

Questa area è il **cervello della generazione, raccolta, classificazione e approvazione delle idee**.

Non deve essere confusa con Meta, Blog, TikTok o Email.

Il Brain non serve a pubblicare contenuti. Serve a gestire le idee prima che diventino contenuti.

## Funzione principale del Brain

Nel Brain devono confluire tutte le idee provenienti da:

- AI brainstorming;
- SEOZoom;
- inserimento manuale;
- trend;
- stagionalità;
- competitor;
- FAQ clienti;
- Knowledge Base;
- report interni;
- eventuali altre fonti future.

## Flusso Brain

```text
Idea nuova
↓
Valutazione
↓
Classificazione
↓
Approvazione o scarto
↓
Invio verso una o più aree di destinazione
```

Le destinazioni possono essere:

- Meta;
- TikTok;
- Blog;
- Email marketing.

Una stessa idea deve poter essere destinata anche a più canali.

Esempio:

```text
Idea: “Magnesio e potassio quando prenderlo”
Fonte: SEOZoom
Destinazioni possibili: Blog + Instagram + TikTok
```

## Dashboard Idee nel Brain

La tabella delle idee deve essere molto più ordinata.

Ogni idea dovrebbe avere questi campi:

| Campo | Descrizione |
|---|---|
| Titolo idea | Nome dell’idea |
| Descrizione | Sintesi dell’idea |
| Fonte | SEOZoom, AI, Manuale, Trend, Competitor, Stagionalità, FAQ |
| Destinazione editoriale | Meta, TikTok, Blog, Email marketing |
| Settore / Canale | Meta, TikTok, Blog, Email |
| Categoria | Educational, vendita, stagionalità, FAQ, beauty, benessere |
| Prodotto collegato | Mg5, Drenafit, Soleil, Cistiflor, Collagene, ecc. |
| Keyword | Keyword principale, se presente |
| Volume | Volume di ricerca, se arriva da SEOZoom |
| Difficoltà | Keyword difficulty, se disponibile |
| SEO score | Valutazione SEO |
| Virality score | Potenziale social |
| Priorità | Alta, media, bassa |
| Stato idea | Nuova, interessante, approvata, scartata, da approfondire |
| Azione | Approva, scarta, modifica, genera contenuto |

## Stati delle idee

Gli stati delle idee devono essere distinti dagli stati dei contenuti.

Stati suggeriti per le idee:

```text
NUOVA
INTERESSANTE
APPROVATA
SCARTATA
DA_APPROFONDIRE
```

Solo le idee con stato `APPROVATA` devono poter essere usate per generare contenuti nelle aree canale.

## Filtri Brain

La Dashboard Idee deve avere filtri per:

- stato idea;
- fonte;
- destinazione;
- categoria;
- prodotto;
- keyword;
- priorità;
- canale;
- data creazione.

## Azioni Brain

Dal Brain devo poter:

- generare nuove idee con AI;
- scoprire keyword da SEOZoom;
- inserire idee manualmente;
- approvare una o più idee;
- scartare idee;
- segnare idee come interessanti;
- modificare un’idea;
- assegnare una o più destinazioni editoriali;
- inviare un’idea approvata verso Meta, Blog, TikTok o Email.

---

# 3. Area Trend & SEO

L’Area Trend & SEO deve essere separata dal Brain.

Questa area serve per analizzare keyword, trend e opportunità SEO, soprattutto da SEOZoom.

## Obiettivo dell’area Trend & SEO

Permettermi di individuare opportunità di contenuto partendo da dati SEO reali.

## Funzioni principali

- ricerca keyword da seed;
- ricerca keyword per prodotto;
- analisi volume;
- analisi difficoltà;
- analisi stagionalità;
- suggerimento opportunità;
- generazione idee SEO da keyword;
- invio delle idee generate al Brain.

## Flusso Trend & SEO

```text
Inserisco seed keyword o prodotto
↓
SEOZoom restituisce keyword reali
↓
Il sistema calcola priorità / SEO score
↓
Genero idee SEO
↓
Le idee entrano nel Brain come NUOVE
↓
Le approvo dal Brain
```

Importante: l’area Trend & SEO non deve sostituire il Brain. Deve alimentarlo.

---

# 4. Area Meta

L’Area Meta deve essere separata dal Brain.

Il Brain gestisce le idee. L’Area Meta gestisce i contenuti social generati da idee approvate.

## Obiettivo Area Meta

Trasformare idee approvate in contenuti per Instagram e Facebook.

## Struttura Area Meta

La struttura consigliata è:

```text
Area Meta
├── Dashboard Meta
├── Instagram
├── Facebook
├── Idee approvate per Meta
├── Genera contenuto Meta
├── Contenuti generati
├── Contenuti approvati
├── Programmazione Meta
└── Pubblicati
```

## Divisione Instagram / Facebook

L’Area Meta deve essere divisa chiaramente in:

- Instagram;
- Facebook.

Ogni contenuto può essere destinato a:

- solo Instagram;
- solo Facebook;
- Instagram + Facebook.

## Formati Meta

I contenuti Meta devono poter avere diversi formati:

```text
POST
CAROSELLO
REEL
STORY
```

## Flusso Area Meta

```text
Idea approvata nel Brain
↓
Idea disponibile in Area Meta
↓
Genero contenuto Meta
↓
Scelgo formato: Post / Reel / Carosello / Story
↓
Scelgo piattaforma: Instagram / Facebook / entrambe
↓
Revisiono il contenuto
↓
Approvo il contenuto
↓
Assegno data di pubblicazione
↓
Il contenuto entra nel Calendario Editoriale
↓
n8n pubblica
```

## Tabella contenuti Meta

La tabella Meta deve mostrare:

| Campo | Descrizione |
|---|---|
| Contenuto | Titolo o nome del contenuto |
| Idea di origine | Collegamento all’idea approvata nel Brain |
| Piattaforma | Instagram, Facebook o entrambe |
| Formato | Post, Reel, Carosello, Story |
| Prodotto | Prodotto collegato |
| Stato contenuto | Bozza, da approvare, approvato, programmato, pubblicato |
| Data prevista | Data assegnata nel calendario |
| Asset | Presenza immagine/video |
| Azioni | Apri, modifica, approva, programma, elimina |

## Filtri Meta

Filtri necessari:

- Instagram;
- Facebook;
- formato;
- stato;
- prodotto;
- categoria;
- data prevista;
- idea di origine.

---

# 5. Area Blog

L’Area Blog deve essere autonoma e separata dal Brain.

Il Brain approva l’idea. L’Area Blog genera, revisiona, approva e programma l’articolo.

## Struttura Area Blog

```text
Area Blog
├── Dashboard Blog
├── Idee approvate per Blog
├── Genera articolo
├── Articoli generati
├── Articoli da approvare
├── Articoli approvati
├── Programmazione Blog
└── Pubblicati
```

## Flusso Blog

```text
Idea approvata nel Brain
↓
Idea disponibile in Area Blog
↓
Genero articolo SEO / GEO
↓
Revisiono contenuto
↓
Approvo articolo
↓
Assegno data pubblicazione
↓
L’articolo entra nel Calendario Editoriale
↓
n8n pubblica su Shopify
```

## Campi articolo Blog

Ogni articolo deve avere:

| Campo | Descrizione |
|---|---|
| Titolo articolo | Titolo SEO |
| Idea di origine | Collegamento all’idea nel Brain |
| Keyword principale | Keyword SEO |
| Keyword secondarie | Keyword correlate |
| Prodotto collegato | Prodotto Agocap |
| Stato | Bozza, da approvare, approvato, programmato, pubblicato |
| Data prevista | Data pubblicazione |
| Immagine | Immagine generata o caricata |
| JSON-LD | Se previsto |
| FAQ | Se previste |
| Azioni | Apri, modifica, approva, programma, elimina |

## Shopify

Shopify deve essere usato per il blog come destinazione di pubblicazione.

La logica corretta è:

```text
AGOCAP Brain prepara e programma
↓
n8n legge i contenuti programmati
↓
n8n pubblica su Shopify
↓
Il sistema aggiorna lo stato a PUBBLICATO
```

La pubblicazione diretta da app può essere prevista in futuro, ma per ora la pubblicazione deve essere gestita tramite n8n.

---

# 6. Area TikTok

L’Area TikTok deve essere prevista come area autonoma, anche se non è ancora implementata.

## Struttura Area TikTok

```text
Area TikTok
├── Dashboard TikTok
├── Idee approvate per TikTok
├── Genera script TikTok
├── Script generati
├── Hook
├── Caption
├── CTA
├── Contenuti approvati
├── Programmazione TikTok
└── Pubblicati
```

## Flusso TikTok

```text
Idea approvata nel Brain
↓
Idea disponibile in Area TikTok
↓
Genero script video breve
↓
Genero hook, testo parlato, testo a schermo, caption e CTA
↓
Revisiono
↓
Approvo
↓
Assegno data
↓
Il contenuto entra nel Calendario Editoriale
↓
n8n pubblica o invia al flusso di pubblicazione
```

## Campi contenuto TikTok

Ogni contenuto TikTok deve avere:

- titolo;
- idea di origine;
- hook;
- script parlato;
- testo a schermo;
- caption;
- CTA;
- prodotto collegato;
- stato;
- data prevista;
- eventuale asset video;
- azioni.

---

# 7. Area Email Marketing

L’Area Email Marketing deve essere prevista come destinazione editoriale autonoma.

## Struttura Area Email Marketing

```text
Area Email Marketing
├── Dashboard Email
├── Idee approvate per Email
├── Newsletter
├── Promo
├── Flussi Klaviyo
├── Email educazionali
├── Email generate
├── Email approvate
├── Programmazione Email
└── Inviate / Pubblicate
```

## Tipologie Email

Il sistema deve supportare:

- newsletter;
- email promozionali;
- email educazionali;
- email di prodotto;
- flussi Klaviyo;
- contenuti stagionali;
- email collegate a campagne.

## Flusso Email

```text
Idea approvata nel Brain
↓
Idea disponibile in Area Email Marketing
↓
Genero email
↓
Revisiono
↓
Approvo
↓
Programmo
↓
Il contenuto entra nel Calendario Editoriale
↓
n8n o Klaviyo gestiscono la pubblicazione/invio
```

---

# 8. Calendario Editoriale Unico

Il Calendario Editoriale deve essere un’area separata e unica.

Non deve essere limitato a Meta.

Deve raccogliere tutti i contenuti programmati su tutti i canali:

- Instagram;
- Facebook;
- TikTok;
- Blog;
- Email marketing.

## Obiettivo del Calendario Editoriale

Permettere di vedere e gestire la programmazione complessiva dei contenuti Agocap.

## Viste necessarie

Il calendario deve avere almeno queste viste:

```text
Vista mensile
Vista settimanale
Vista agenda/lista
```

## Esempio vista agenda

```text
Lunedì 24 giugno
- Instagram Post: Magnesio e stress
- Blog: Guida al magnesio
- Email: Promo Mg5

Martedì 25 giugno
- Reel Instagram: 3 segnali di carenza di magnesio
- TikTok: Magnesio in estate
```

## Funzioni Calendario

Dal calendario devo poter:

- vedere i contenuti per giorno;
- vedere i contenuti per settimana;
- vedere i contenuti per mese;
- filtrare per canale;
- filtrare per stato;
- filtrare per prodotto;
- cliccare un contenuto e aprirlo;
- assegnare una data a un contenuto approvato;
- modificare una data;
- spostare un contenuto da un giorno all’altro;
- vedere se il contenuto è bozza, da approvare, approvato, programmato o pubblicato;
- distinguere visivamente i canali.

## Logica calendario

Un contenuto deve entrare nel calendario solo quando ha una `dataPrevista`.

Se un contenuto è approvato ma non ha data, deve apparire in una sezione laterale tipo:

```text
Contenuti approvati da programmare
```

Da lì posso assegnarlo a un giorno.

---

# 9. Pubblicazioni

La pubblicazione deve essere l’ultimo livello del sistema.

Non deve essere confusa con le aree creative.

## Obiettivo Area Pubblicazioni

Monitorare cosa deve essere pubblicato, cosa è stato inviato a n8n, cosa è stato pubblicato e cosa è andato in errore.

## Struttura Area Pubblicazioni

```text
Pubblicazioni
├── Programmati
├── Inviati a n8n
├── Pubblicati
├── Errori
└── Log pubblicazione
```

## Flusso pubblicazione Blog

```text
Contenuto Blog programmato
↓
n8n legge il contenuto
↓
n8n pubblica su Shopify
↓
Il sistema aggiorna lo stato a PUBBLICATO
```

## Flusso pubblicazione Meta

```text
Contenuto Meta programmato
↓
n8n legge il contenuto
↓
n8n pubblica su Instagram/Facebook
↓
Il sistema aggiorna lo stato a PUBBLICATO
```

## Flusso pubblicazione TikTok

```text
Contenuto TikTok programmato
↓
n8n legge il contenuto
↓
n8n pubblica o prepara la pubblicazione
↓
Il sistema aggiorna lo stato a PUBBLICATO
```

## Stati pubblicazione

Servono stati o log tecnici per:

```text
NON_INVIATO
INVIATO_A_N8N
IN_PUBBLICAZIONE
PUBBLICATO
ERRORE
```

Questi stati tecnici possono vivere separati dagli stati editoriali.

---

# 10. Stati dei contenuti

Gli stati delle idee e gli stati dei contenuti devono essere separati.

## Stati idee

```text
NUOVA
INTERESSANTE
APPROVATA
SCARTATA
DA_APPROFONDIRE
```

## Stati contenuti generati

Tutti i contenuti generati per Meta, Blog, TikTok ed Email devono seguire questo flusso:

```text
BOZZA
↓
DA_APPROVARE
↓
APPROVATO
↓
PROGRAMMATO
↓
PUBBLICATO
```

## Regole

- Un contenuto nasce come `BOZZA`.
- Quando è pronto per la revisione diventa `DA_APPROVARE`.
- Quando viene approvato diventa `APPROVATO`.
- Quando gli viene assegnata una data di pubblicazione diventa `PROGRAMMATO`.
- Quando n8n conferma la pubblicazione diventa `PUBBLICATO`.

Se la pubblicazione fallisce, il contenuto può mantenere lo stato editoriale `PROGRAMMATO`, ma avere uno stato tecnico di pubblicazione `ERRORE`.

---

# 11. Nuovo menu consigliato

Il menu attuale deve essere riorganizzato.

## Menu consigliato principale

```text
Home
Brain
Trend & SEO
Meta
Blog
TikTok
Email
Calendario
Pubblicazioni
Report
Impostazioni
```

## Sottomenu Brain

```text
Brain
├── Tutte le idee
├── Genera idee
├── Scopri keyword
├── Inserimento manuale
├── Idee approvate
├── Idee interessanti
└── Idee scartate
```

## Sottomenu Trend & SEO

```text
Trend & SEO
├── Dashboard SEO
├── Ricerca keyword
├── Keyword per prodotto
├── Opportunità SEO
└── Idee generate da SEOZoom
```

## Sottomenu Meta

```text
Meta
├── Dashboard Meta
├── Instagram
├── Facebook
├── Idee approvate per Meta
├── Genera contenuto
├── Contenuti approvati
├── Programmazione
└── Pubblicati
```

## Sottomenu Blog

```text
Blog
├── Dashboard Blog
├── Idee approvate per Blog
├── Genera articolo
├── Articoli generati
├── Articoli approvati
├── Programmazione
└── Pubblicati
```

## Sottomenu TikTok

```text
TikTok
├── Dashboard TikTok
├── Idee approvate per TikTok
├── Genera script
├── Script approvati
├── Programmazione
└── Pubblicati
```

## Sottomenu Email

```text
Email
├── Dashboard Email
├── Idee approvate per Email
├── Newsletter
├── Promo
├── Flussi
├── Programmazione
└── Inviate
```

---

# 12. Modello dati consigliato

La struttura dati deve supportare chiaramente la separazione tra idee e contenuti.

## Idea

L’entità `Idea` rappresenta un’idea editoriale, non un contenuto finale.

Campi consigliati:

```text
id
title
description
source
category
productId
primaryKeyword
secondaryKeywords
searchVolume
keywordDifficulty
seoScore
viralityScore
priority
status
editorialDestinations
createdAt
updatedAt
```

Dove `editorialDestinations` può contenere:

```text
META
BLOG
TIKTOK
EMAIL
```

Una idea può avere più destinazioni.

## GeneratedContent

L’entità `GeneratedContent` rappresenta un contenuto concreto generato da una idea approvata.

Campi consigliati:

```text
id
ideaId
channel
format
platforms
productId
title
payload
status
scheduledAt
publishedAt
publicationStatus
publicationError
createdAt
updatedAt
```

Dove `channel` può essere:

```text
META
BLOG
TIKTOK
EMAIL
```

Dove `format` può essere:

```text
POST
CAROSELLO
REEL
STORY
ARTICOLO
SCRIPT_VIDEO
NEWSLETTER
PROMO_EMAIL
FLOW_EMAIL
```

Dove `platforms` può includere:

```text
INSTAGRAM
FACEBOOK
TIKTOK
SHOPIFY_BLOG
KLAVIYO
```

## GeneratedAsset

Serve per immagini o asset collegati ai contenuti.

Campi consigliati:

```text
id
generatedContentId
type
url
filename
metadata
createdAt
```

## EditorialCalendarItem

Si può decidere se creare una tabella calendario separata o usare direttamente `scheduledAt` su `GeneratedContent`.

Per maggiore ordine, è consigliata una tabella dedicata:

```text
id
generatedContentId
scheduledAt
channel
platforms
status
createdAt
updatedAt
```

---

# 13. Flusso utente completo

## Flusso 1 — da SEOZoom a Blog

```text
1. Vado in Trend & SEO
2. Inserisco una keyword seed o seleziono un prodotto
3. SEOZoom restituisce keyword con volume e difficoltà
4. Genero idee SEO
5. Le idee entrano nel Brain come NUOVE
6. Apro il Brain
7. Approvo l’idea migliore
8. Assegno destinazione: Blog
9. L’idea appare in Area Blog
10. Genero articolo
11. Revisiono articolo
12. Approvo articolo
13. Assegno data pubblicazione
14. L’articolo entra nel Calendario Editoriale
15. n8n pubblica su Shopify
16. Stato: PUBBLICATO
```

## Flusso 2 — da Brain a Meta

```text
1. Genero una nuova idea nel Brain
2. La classifico come Educational
3. La collego al prodotto Mg5
4. La approvo
5. Assegno destinazione: Meta
6. L’idea appare in Area Meta
7. Genero contenuto Instagram/Facebook
8. Scelgo formato: Carosello
9. Revisiono il contenuto
10. Approvo
11. Assegno una data
12. Il contenuto appare nel Calendario
13. n8n pubblica su Instagram/Facebook
14. Stato: PUBBLICATO
```

## Flusso 3 — contenuto approvato ma non programmato

```text
1. Un contenuto viene approvato
2. Non ha ancora una data
3. Deve comparire nella lista “Contenuti approvati da programmare”
4. Dal Calendario assegno una data
5. Lo stato passa a PROGRAMMATO
```

---

# 14. Requisiti UX / UI

## Principi generali

L’interfaccia deve essere:

- pulita;
- ordinata;
- editoriale;
- semplice da capire;
- non tecnica;
- organizzata per flusso;
- coerente tra le varie aree.

## Nomenclatura italiana

La UI deve essere in italiano.

Usare nomi chiari come:

```text
Home
Brain
Trend & SEO
Meta
Blog
TikTok
Email
Calendario Editoriale
Pubblicazioni
Report
Impostazioni
```

Evitare troppe voci tecniche nella navigazione principale.

## Dashboard

Ogni area deve avere una dashboard dedicata:

- Dashboard generale in Home;
- Dashboard Brain;
- Dashboard SEO;
- Dashboard Meta;
- Dashboard Blog;
- Dashboard TikTok;
- Dashboard Email.

## Tabelle

Le tabelle devono essere leggibili, con colonne essenziali e filtri chiari.

Ogni tabella deve evitare confusione tra:

- idea;
- contenuto generato;
- pubblicazione.

## Badge stato

Usare badge colorati per gli stati:

- NUOVA;
- INTERESSANTE;
- APPROVATA;
- SCARTATA;
- BOZZA;
- DA_APPROVARE;
- APPROVATO;
- PROGRAMMATO;
- PUBBLICATO;
- ERRORE.

---

# 15. Requisiti tecnici

## Separazione logica

La codebase deve riflettere la nuova struttura:

```text
src/app/home
src/app/brain
src/app/trend-seo
src/app/meta
src/app/blog
src/app/tiktok
src/app/email
src/app/calendar
src/app/publications
src/app/reports
src/app/settings
```

Oppure, se si preferisce mantenere le route esistenti, bisogna almeno riorganizzare navigazione e contenuti.

## API

Le API devono essere coerenti con le nuove aree.

Esempio:

```text
/api/ideas
/api/ideas/bulk-status
/api/seozoom/discover
/api/meta/contents
/api/blog/contents
/api/tiktok/contents
/api/email/contents
/api/calendar/items
/api/publications
```

## n8n

n8n deve leggere i contenuti con stato `PROGRAMMATO` e data prevista compatibile con il momento di pubblicazione.

Il sistema deve esporre o preparare endpoint/API per:

- recuperare contenuti programmati;
- aggiornare stato a pubblicato;
- registrare errori di pubblicazione;
- salvare log di pubblicazione.

Esempi endpoint futuri:

```text
GET /api/publications/due
PATCH /api/publications/:id/success
PATCH /api/publications/:id/error
```

---

# 16. Roadmap di implementazione consigliata

Implementare per fasi, senza stravolgere tutto insieme.

## Fase 1 — Riorganizzazione navigazione e Home

- Creare nuova Home Dashboard.
- Riorganizzare menu.
- Separare concettualmente Brain, Meta, Blog, Calendario.
- Creare card di riepilogo per le aree principali.

## Fase 2 — Area Brain ordinata

- Migliorare Dashboard Idee.
- Aggiungere destinazioni editoriali.
- Separare chiaramente stati idea da stati contenuto.
- Migliorare filtri e azioni.

## Fase 3 — Area Meta migliorata

- Dividere Instagram e Facebook.
- Mostrare solo contenuti generati da idee approvate.
- Migliorare stati, formati e programmazione.

## Fase 4 — Area Blog migliorata

- Mostrare idee approvate per Blog.
- Migliorare workflow articolo.
- Preparare programmazione per Shopify/n8n.

## Fase 5 — Calendario editoriale unico

- Creare vista mensile.
- Creare vista settimanale.
- Creare vista agenda.
- Mostrare tutti i canali.
- Permettere assegnazione data ai contenuti approvati.

## Fase 6 — Pubblicazioni / n8n

- Creare area Pubblicazioni.
- Creare endpoint per n8n.
- Gestire stati pubblicazione.
- Gestire errori e log.

## Fase 7 — TikTok ed Email Marketing

- Aggiungere generatore TikTok.
- Aggiungere area Email Marketing.
- Collegare entrambi al Brain e al Calendario.

---

# 17. Risultato finale atteso

Il risultato finale deve essere un sistema in cui:

```text
1. La Home mi dà il controllo generale.
2. Il Brain raccoglie e approva tutte le idee.
3. Trend & SEO alimenta il Brain con keyword e opportunità.
4. Meta trasforma idee approvate in contenuti Instagram/Facebook.
5. Blog trasforma idee approvate in articoli Shopify.
6. TikTok trasforma idee approvate in script video brevi.
7. Email trasforma idee approvate in newsletter, promo e flussi.
8. Il Calendario Editoriale gestisce tutte le date.
9. n8n pubblica automaticamente.
10. Report e Pubblicazioni monitorano risultati, errori e stato dei contenuti.
```

La logica deve essere sempre:

```text
Idea → Contenuto → Programmazione → Pubblicazione
```

Non bisogna più confondere:

```text
Idea ≠ Contenuto generato
Contenuto approvato ≠ Contenuto programmato
Contenuto programmato ≠ Contenuto pubblicato
```

---

# 18. Istruzione finale per Claude

Analizza il progetto attuale e implementa questa nuova architettura in modo progressivo.

Prima di modificare il codice:

1. individua le route esistenti;
2. individua i modelli Prisma esistenti;
3. individua gli stati attuali di Idea e GeneratedContent;
4. verifica quali parti possono essere riutilizzate;
5. proponi un piano tecnico di refactoring;
6. procedi per step piccoli e testabili.

Durante l’implementazione mantieni:

- UI in italiano;
- codice e commenti tecnici in inglese;
- compatibilità con l’attuale stack Next.js, Prisma, PostgreSQL e Tailwind;
- separazione tra Brain, contenuti, calendario e pubblicazione;
- pubblicazione finale tramite n8n.

L’obiettivo non è creare nuove funzioni confuse, ma rendere il sistema più chiaro, scalabile e realmente utile per gestire tutto il piano editoriale Agocap.
