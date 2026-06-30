# AGOCAP — n8n Meta Auto Publisher

> ⚠️ **PARCHEGGIATO (2026-06-30).** Si è scelto di pubblicare su Meta **direttamente
> dall'app** (l'app ha il Page Access Token e chiama la Graph API), come fa Blog→Shopify.
> Questo workflow n8n resta come alternativa "decoupled" ma **non è usato** dal flusso
> attuale. Vedi `docs/superpowers/plans/2026-06-30-agocap-meta-direct-publish.md`.
>
> **Automazione della pubblicazione diretta** (senza n8n): un cron innesca l'endpoint
> protetto `POST /api/meta/publish/dispatch`, che pubblica i contenuti META `PROGRAMMATO`
> con `dataPrevista <= now`:
> ```
> curl -X POST -H "x-agocap-secret: $AGOCAP_N8N_SECRET" https://<app>/api/meta/publish/dispatch
> ```
> In locale l'app non è raggiungibile da internet: lancia il cron sulla **stessa macchina**
> dell'app (es. Task Scheduler di Windows / cron) verso `http://localhost:8001/...`.

---

Workflow n8n che pubblica i contenuti **Meta** (Facebook Page + Instagram Business)
generati e programmati in AGOCAP Content AI Hub, e riporta lo stato nel programma.

- Istanza: `https://n8n.hatwebtrade.it`
- Workflow id: `P2xZjfos9KAyP5m5` — **AGOCAP - Meta Auto Publisher**
- Sorgenti versionati: `n8n/src/*.js` (nodi Code) + `n8n/agocap-meta-auto-publisher.json` (importabile)
- Rigenera/deploya: `node n8n/build.mjs` (solo file) · `node n8n/build.mjs --deploy` (crea via API)

## Modello: PUSH

```
AGOCAP (contenuto PROGRAMMATO) --push--> Webhook n8n --publish--> Meta
                              <--callback (published / publish_failed)--
```

L'app **spinge** il contenuto al webhook; n8n pubblica e **richiama** l'app.
Il token Meta vive **solo in n8n** (env), l'app non lo conosce mai.

## URL del webhook

Quando il workflow è **attivo**:

```
POST https://n8n.hatwebtrade.it/webhook/agocap-meta-publish
```

(in editor, col pulsante "Listen for test event", l'URL di test è
`/webhook-test/agocap-meta-publish`)

Questo URL va messo in AGOCAP → Impostazioni → Connettori → `n8nWebhookUrl`.

## Variabili ambiente da impostare in n8n

Il workflow legge queste env dall'istanza n8n (NON dall'app):

| Variabile | Esempio | Note |
|-----------|---------|------|
| `AGOCAP_N8N_SECRET` | una stringa lunga casuale | shared secret; stesso valore in AGOCAP → Connettori |
| `META_PAGE_ACCESS_TOKEN` | `EAAB...` | Page Access Token Meta (long-lived) |
| `META_API_VERSION` | `v20.0` | opzionale (default `v20.0`) |

**Self-hosted (Docker):** aggiungi le variabili al servizio n8n e riavvia. Esempio
`docker-compose.yml`:

```yaml
services:
  n8n:
    environment:
      - AGOCAP_N8N_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
      - META_PAGE_ACCESS_TOKEN=EAAB...
      - META_API_VERSION=v20.0
```

Poi `docker compose up -d` (riavvio). Finché `AGOCAP_N8N_SECRET` non è impostato, il
workflow risponde **401** a ogni chiamata (by design).

## Payload che n8n riceve (dal builder lato app)

Header: `x-agocap-secret: <AGOCAP_N8N_SECRET>`

```jsonc
{
  "content_id": "ckxyz...",
  "brand": "Agocap",
  "product": "Soleil",
  "platforms": ["facebook", "instagram"],
  "post_type": "image",            // image | text | carousel | story | reel
  "caption": "Testo del post...",
  "media_url": "https://app/api/assets/AID",     // image/story/reel
  "media_urls": ["https://app/api/assets/A0", "..."], // solo carousel
  "facebook_page_id": "1234567890",
  "instagram_account_id": "1789...",
  "scheduled_at": "2026-07-01T10:30:00+02:00",
  "status_callback_url": "https://app/api/publications/ckxyz.../callback"
}
```

## Callback verso AGOCAP

n8n chiama `status_callback_url` (header `x-agocap-secret`) con:

```jsonc
// successo
{ "content_id":"...", "status":"published", "published_at":"...",
  "facebook_post_id":"...", "instagram_post_id":"..." }

// errore (validazione, dedup, o fallimento Meta)
{ "content_id":"...", "status":"publish_failed", "error_message":"...", "failed_at":"..." }
```

## Comportamento dei nodi

1. **Validate, Auth & Dedup** — verifica `x-agocap-secret`; campi obbligatori
   (`content_id`, `platforms`, `post_type`, `caption`, `status_callback_url` + media/ids
   secondo il tipo); blocca `content_id` duplicati (workflow static data). Esiti:
   - auth KO → `401`, nessun callback (richiesta non fidata) → ramo **drop**
   - validazione/dup KO → `422`/`409` + callback `publish_failed` → ramo **reject_callback**
   - OK → `200` + ramo **publish**
2. **Respond to Webhook** — risponde subito all'app con lo status calcolato.
3. **Route** (Switch) — instrada publish / reject_callback / drop.
4. **Publish to Meta** — pubblica su FB e/o IG (vedi sotto). Non lancia mai: ogni errore
   diventa un callback `publish_failed`.
5. **Callback to AGOCAP** — POST del risultato all'app.

### Formati supportati

| post_type | Facebook | Instagram |
|-----------|----------|-----------|
| `text`    | `/feed` (solo testo) | — (IG richiede media, saltato) |
| `image`   | `/photos` | container IMAGE → publish |
| `carousel`| multi-photo `published=false` + `/feed attached_media` | N container child + container CAROUSEL → publish |
| `story`   | `/photos` | container STORIES → publish |
| `reel`    | — | container REELS (`video_url`) + poll → publish |

⚠️ **Reel/video non testabile**: richiede un `video_url` pubblico; il generatore AGOCAP
non produce ancora asset video. Il ramo è presente ma resta inattivo finché non esiste
una sorgente video.

## Checklist di test (live)

Prerequisiti: env n8n impostate, workflow **attivo**, endpoint callback lato app pronto.

- [ ] Facebook image → post pubblicato + callback `published` con `facebook_post_id`
- [ ] Instagram image → post pubblicato + callback `published` con `instagram_post_id`
- [ ] `media_url` mancante → `422` + callback `publish_failed`
- [ ] Token Meta errato → callback `publish_failed` con messaggio Graph API
- [ ] Stesso `content_id` due volte → secondo tentativo bloccato (`409`)
- [ ] Callback `published` aggiorna lo stato a PUBBLICATO nel programma
- [ ] Callback `publish_failed` aggiorna lo stato a ERRORE nel programma

## Lato app (ancora da implementare)

Vedi `docs/superpowers/specs/2026-06-30-agocap-n8n-meta-publisher-design.md`:
area Connettori in `/impostazioni`, payload builder, trigger push (bottone + dispatch),
endpoint callback `POST /api/publications/[id]/callback`, campi `facebookPostId`/`instagramPostId`.
