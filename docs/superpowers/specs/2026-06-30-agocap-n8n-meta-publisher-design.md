# AGOCAP — n8n Meta Auto Publisher (design)

Data: 2026-06-30
Stato: approvato in brainstorming, in attesa di review utente dello spec.

## Obiettivo

Pubblicare automaticamente i contenuti **Meta** (Facebook Page + Instagram Business)
generati e programmati in AGOCAP Content AI Hub, tramite un workflow **n8n**, e
riportare lo stato di pubblicazione nel programma.

Flusso end-to-end:

```
AGOCAP (contenuto APPROVATO → PROGRAMMATO nel Calendario)
   → l'app SPINGE (push) il payload al Webhook n8n
   → n8n valida, deduplica, pubblica su FB/IG
   → n8n richiama l'app (callback) con esito
   → AGOCAP aggiorna publicationStatus (PUBBLICATO / ERRORE)
```

## Decisione architetturale: PUSH (non PULL)

Gli endpoint pull esistenti (`GET /api/publications/due`, `PATCH .../{sent,success,error}`)
erano pensati per un modello in cui **n8n interroga** l'app. Questo design li **supera**
per il canale Meta: è l'**app che chiama n8n** (webhook) quando un contenuto è da pubblicare,
e n8n richiama indietro un unico endpoint di **callback**.

- Gli endpoint pull **restano nel codice** (non li rimuoviamo in questo intervento) ma non
  vengono usati dal giro Meta. Eventuale pulizia/deprecazione in un intervento successivo.
- Il **token Meta** (`META_PAGE_ACCESS_TOKEN`) vive **solo dentro n8n** (env). L'app non lo
  conosce e non lo memorizza mai. L'app invia solo identificatori non segreti
  (`facebook_page_id`, `instagram_account_id`).

## Cosa vive dove

| Dato | Posizione | Segreto? |
|------|-----------|----------|
| `META_PAGE_ACCESS_TOKEN` | env di **n8n** | sì — mai nell'app |
| `META_API_VERSION` (default `v20.0`) | env di n8n | no |
| `AGOCAP_N8N_SECRET` (shared secret) | n8n env **e** app `Setting` | sì |
| n8n webhook URL | app `Setting` | no |
| app public base URL | app `Setting` | no |
| `facebook_page_id` | app `Setting` | no |
| `instagram_account_id` | app `Setting` | no |

## Componenti (3 blocchi)

### Blocco 1 — Area Connettori (`/impostazioni`)

Sostituisce il placeholder `ComingSoon` con un'area di configurazione+monitoraggio del
collegamento n8n.

**Storage** — nuovo model Prisma `Setting` (singleton `id = "default"`):

```prisma
model Setting {
  id                  String   @id @default("default")
  n8nWebhookUrl       String   @default("")
  n8nWebhookSecret    String   @default("")
  appBaseUrl          String   @default("")
  facebookPageId      String   @default("")
  instagramAccountId  String   @default("")
  metaApiVersion      String   @default("v20.0")
  n8nBaseUrl          String   @default("")   // per il ping di health
  lastPushAt          DateTime?
  updatedAt           DateTime @updatedAt
}
```

Helper `src/lib/settings/store.ts`:
- `getSettings()` → carica il singleton (lo crea con default se assente).
- `updateSettings(partial)` → upsert.
- `resolveSecret()` → ritorna `Setting.n8nWebhookSecret` se valorizzato, **fallback** a
  `process.env.N8N_WEBHOOK_SECRET` (retrocompatibilità con `checkWebhookSecret`).

`src/lib/publications/auth.ts checkWebhookSecret` viene aggiornato per confrontare l'header
con `resolveSecret()` (DB-first, env-fallback). Header accettato: sia `x-webhook-secret`
(legacy) sia `x-agocap-secret` (nuovo, usato da n8n nei callback).

**API**:
- `GET /api/settings/connettori` → ritorna i settings (secret mascherato salvo richiesta).
- `PUT /api/settings/connettori` → salva i campi (zod-validati).
- `POST /api/settings/connettori/test` → l'app fa `GET {n8nBaseUrl}/healthz` e ritorna
  `{ ok: boolean, status, ms }`. Unico caso app→n8n, solo per indicatore di stato.

**UI** `/impostazioni`:
- Form configurazione (URL n8n webhook · URL base n8n · secret con "rigenera" · app base URL
  · facebook_page_id · instagram_account_id · meta api version).
- Box "Endpoint che n8n deve chiamare" con URL completo del callback già compilato + header,
  bottoni copia.
- Bottone "Test connessione" → badge verde/rosso + latenza.
- Stato: `lastPushAt`, n° Meta in coda (PROGRAMMATO+NON_INVIATO), esiti recenti
  (riuso `publications-table`).

### Blocco 2 — Lato app: push + payload builder + callback

**Nuovi campi** su `GeneratedContent`:

```prisma
facebookPostId   String?
instagramPostId  String?
```

(`publicationStatus`, `publicationError`, `publishedAt` esistono già da Fase 4.)

**Payload builder** `src/lib/publications/meta-payload.ts` —
`buildMetaPushPayload(content, settings)` produce il JSON che n8n riceve. Mapping dal nostro
modello al contratto del workflow:

```jsonc
{
  "content_id":  "<GeneratedContent.id>",
  "brand":       "Agocap",
  "product":     "<da idea/prodotto se disponibile, else ''>",
  "platforms":   ["facebook","instagram"],   // da piattaforme[] (INSTAGRAM→instagram, FACEBOOK→facebook)
  "post_type":   "image|text|carousel|reel|story",
  "caption":     "<payload.caption  (STORY: payload.testo)>",
  "media_url":   "<{appBaseUrl}/api/assets/{assetId}>",   // image/story/reel
  "media_urls":  ["<url slide 0>", "<url slide 1>", ...], // solo carousel, ordinati per slideIndex
  "facebook_page_id":     "<Setting.facebookPageId>",
  "instagram_account_id": "<Setting.instagramAccountId>",
  "scheduled_at":         "<dataPrevista ISO>",
  "status_callback_url":  "<{appBaseUrl}/api/publications/{id}/callback>"
}
```

Regole `post_type` (da `formato`):
- `POST` con almeno un asset immagine → `image`; `POST` senza asset → `text` (solo Facebook;
  IG richiede media e viene saltato dal workflow).
- `CAROSELLO` → `carousel` (usa `media_urls[]`).
- `STORY` → `story` (immagine; `caption`←`payload.testo`).
- `REEL` → `reel` (**richiede un asset VIDEO**; oggi non prodotto → vedi Limitazioni).

**Trigger push** `src/lib/publications/dispatch.ts`:
- `pushContent(contentId)` — carica il contenuto, verifica
  `canale=META`, `status=PROGRAMMATO`, `publicationStatus ∈ {NON_INVIATO, ERRORE}`
  (anti-doppio-invio lato app), costruisce il payload, fa `POST {n8nWebhookUrl}` con header
  `x-agocap-secret: <secret>`. Su HTTP 2xx → `publicationStatus = INVIATO_A_N8N`,
  stamp `Setting.lastPushAt`. Su errore → `publicationStatus = ERRORE` + `publicationError`.
- `dispatchDue()` — trova tutti i Meta con `status=PROGRAMMATO`,
  `dataPrevista <= now`, `publicationStatus ∈ {NON_INVIATO, ERRORE}` e chiama `pushContent`
  su ciascuno. Ritorna `{ pushed, failed }`.

**API**:
- `POST /api/meta/contents/[id]/publish` → bottone "Pubblica via n8n" (manuale). Chiama
  `pushContent`. Auth: nessuna (route interna dell'app, come le altre `/api/meta/...`).
- `POST /api/publications/dispatch` → chiama `dispatchDue()`. **Auth: `x-agocap-secret`**
  (per essere innescata da cron esterno o Schedule n8n in sicurezza).
- `POST /api/publications/[id]/callback` → **endpoint di callback unificato** chiamato da n8n.
  Auth `x-agocap-secret`. Body:
  ```jsonc
  {
    "content_id": "...",
    "status": "published" | "publish_failed",
    "published_at": "...",          // se published
    "failed_at": "...",             // se failed
    "error_message": "...",         // se failed
    "facebook_post_id": "..." | null,
    "instagram_post_id": "..." | null
  }
  ```
  Effetto: `published` → `status=PUBBLICATO`, `publicationStatus=PUBBLICATO`,
  `publishedAt`, `facebookPostId`/`instagramPostId`. `publish_failed` →
  `publicationStatus=ERRORE`, `publicationError=error_message`.

**Automazione** (scelta "entrambi"): il bottone manuale copre il push immediato; per il
push a data/ora si innesca `POST /api/publications/dispatch` con un **cron** (OS cron sul
Lightsail o uno Schedule node n8n) che fa una `curl` con l'header secret ogni N minuti.
Documentato nelle istruzioni; nessun cron in-process Next.js.

### Blocco 3 — Workflow n8n (`n8n/agocap-meta-auto-publisher.json`)

File JSON importabile + documentazione. Nodi (nomi come da prompt utente):

1. **Webhook - Receive Approved Meta Content** — `POST /agocap-meta-publish`, risponde subito
   (modalità "Respond Immediately"); validazione header `x-agocap-secret` vs
   `$env.AGOCAP_N8N_SECRET` → 401 se errato.
2. **Validate - Required Fields** — Code/IF: presenza di `content_id`, `platforms`,
   `post_type`, `caption`, `status_callback_url`; se `post_type ∈ {image,carousel,reel,story}`
   richiede media (`media_url` o `media_urls`); se `facebook` → `facebook_page_id`;
   se `instagram` → `instagram_account_id`. Fallita → ramo errore.
3. **Dedup - Check Data Store** — n8n Data Store: se `content_id` già presente
   (`publishing`/`published`) → ramo errore "Duplicate publish attempt blocked"; altrimenti
   salva `{content_id, status:"publishing", started_at}`.
4. **Set - Normalize Payload** — normalizza nel formato interno del workflow.
5. **IF - Publish to Facebook** (`platforms` contiene `facebook`):
   - `image` → **Facebook - Publish Image Post** (`/{page_id}/photos`).
   - `text`  → **Facebook - Publish Text Post** (`/{page_id}/feed`).
   - `carousel` → **Facebook - Publish Carousel** (upload N foto `published=false` →
     `/{page_id}/feed` con `attached_media`).
   - `reel`/`story` → vedi Limitazioni.
6. **IF - Publish to Instagram** (`platforms` contiene `instagram`):
   - `image`/`story` → **Instagram - Create Media Container** (`/{ig_id}/media`,
     `media_type=IMAGE|STORIES`) → **Wait/Poll - Container Status** → **Instagram - Publish
     Media** (`/{ig_id}/media_publish`).
   - `carousel` → N container `is_carousel_item=true` → container `media_type=CAROUSEL` →
     publish.
   - `reel` → container `media_type=REELS` con `video_url` → **poll `status_code=FINISHED`**
     → publish.
7. **Merge - Facebook and Instagram Results** — unisce gli esiti (FB/IG `null` se non usati).
8. **AGOCAP Hub - Callback Published** — `POST {callback_url}` con `status:"published"` +
   post id, header `x-agocap-secret`.
9. **Error Handler** (Error Trigger / catch su ogni ramo) — `POST {callback_url}` con
   `status:"publish_failed"` + `error_message`; aggiorna Data Store a `publish_failed`.

**Variabili ambiente n8n**: `AGOCAP_N8N_SECRET`, `META_PAGE_ACCESS_TOKEN`,
`META_API_VERSION` (default `v20.0`).

## Limitazioni note (oneste)

- **REEL / video**: IG Reels richiede un `video_url` pubblico e il container va **pollato**
  fino a `status_code=FINISHED` (non basta un Wait fisso). Il generatore AGOCAP **non produce
  ancora asset video** (parte video/Higgsfield ancora bloccata nel progetto), quindi il ramo
  reel viene **costruito ma resta non testabile** finché non esiste una sorgente video.
  FB Reels usa un upload in 3 step (`/video_reels` start→upload→finish): incluso come nodo
  ma anch'esso non testabile senza video.
- **Story**: supportata come **immagine** IG (`media_type=STORIES`). Le Story Facebook via
  Graph API sono limitate; il ramo FB story non è previsto in questo intervento.
- **Carosello**: immagini sì (gli asset esistono con `slideIndex`).
- Secret in DB in chiaro: accettabile per single-tenant self-hosted (stesso livello dell'env).
- Il ping di health usa `{n8nBaseUrl}/healthz`: richiede che n8n esponga `/healthz`
  (default attivo nelle installazioni n8n).

## Testing

Unit (vitest):
- `checkWebhookSecret` — DB-first, env-fallback, header `x-agocap-secret` e `x-webhook-secret`.
- `buildMetaPushPayload` — mapping per ogni formato (image/text/carousel/story), URL asset
  `{appBaseUrl}/api/assets/{id}`, mapping piattaforme, post_type derivato.
- `settings store` — get crea default, update upsert, `resolveSecret` fallback.
- callback route — `published` e `publish_failed` aggiornano i campi corretti; 401 senza secret.
- dispatch — seleziona solo i Meta due/idonei; `pushContent` rispetta l'anti-doppio-invio.

Checklist manuale (live, lato n8n+Meta — eseguita dall'utente con istruzioni fornite):
- [ ] Pubblicazione Facebook (image)
- [ ] Pubblicazione Instagram (image)
- [ ] Errore `media_url` mancante → callback `publish_failed`
- [ ] Errore token Meta → callback `publish_failed`
- [ ] Doppia pubblicazione stesso `content_id` → bloccata (Data Store + anti-doppio app)
- [ ] Callback `published` aggiorna lo stato a PUBBLICATO + post id
- [ ] Callback `publish_failed` aggiorna lo stato a ERRORE + messaggio

## Out of scope (questo intervento)

- Costruzione/import automatico del workflow via n8n public API (import manuale del JSON).
- Pubblicazione reale di video/reel (manca la sorgente video).
- Rimozione degli endpoint pull legacy.
- Brevo / TikTok / Blog (altri canali).

## Deliverable richiesti dall'utente — dove si trovano

1. Schema nodi n8n → §Blocco 3.
2. Config dettagliata dei nodi → file `n8n/agocap-meta-auto-publisher.json` + README in `n8n/`.
3. Espressioni n8n → nel JSON e nel README.
4. JSON importabile → `n8n/agocap-meta-auto-publisher.json`.
5. Istruzioni di collegamento → `n8n/README.md`.
6. Endpoint lato app → §Blocco 2 (callback, dispatch, publish, settings).
7. Checklist di test → §Testing.
