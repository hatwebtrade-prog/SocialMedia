# Guardrail anti-competitor (blog) — design

**Data:** 2026-07-01
**Progetto:** AGOCAP Content AI Hub
**Modulo:** Blog generation (`src/lib/blog/*`)

## Contesto e problema

Un articolo blog pubblicato conteneva, nelle FAQ, il nome di un competitor ("natural System") che non deve mai comparire nei contenuti Agocap. La generazione (Claude via `buildBlogPrompt` → `blogArticleSchema.parse`) può includere nomi di concorrenti in qualsiasi campo (corpo, FAQ, ecc.). Serve un guardrail affidabile che impedisca ai nomi competitor di finire nei contenuti generati, incluse le FAQ.

## Decisioni di design (confermate)

1. **Lista competitor:** in un **modulo di codice** (costante), seed con `"natural System"`; estensibile aggiungendo stringhe.
2. **Comportamento su match:** **sostituzione con un termine neutro** (frase leggibile), non rimozione.
3. **Due strati:** istruzione nel prompt (prevenzione) + **scrub post-generazione prima del salvataggio** (garanzia).

## Architettura

### Modulo `src/lib/blog/competitors.ts` (puro, testabile)

```ts
export const COMPETITORS: string[] = ["natural System"];
export const NEUTRAL_REPLACEMENT = "un noto marchio concorrente";

/** Case-insensitive; tollera spazi/trattini variabili tra i token del nome
 *  (es. "natural System" cattura "naturalsystem", "natural-system", "NATURAL  SYSTEM"). */
export function scrubCompetitors(text: string, competitors?: string[], replacement?: string): string;

/** Applica scrubCompetitors a tutti i campi testuali del payload blog. */
export function scrubBlogPayload<T extends BlogPayloadTextFields>(payload: T, competitors?: string[], replacement?: string): T;
```

Dettagli:
- `scrubCompetitors`: per ogni competitor costruisce un regex costruito dai token del nome uniti da `[\s-]*`, con `\b` ai bordi dove sensato, flag `gi`; sostituisce **tutte** le occorrenze con `replacement` (default `NEUTRAL_REPLACEMENT`). I caratteri speciali regex nei token vengono escapati. Se `text` è vuoto/non stringa → ritorna invariato.
- `scrubBlogPayload`: ritorna una copia del payload con lo scrub applicato a: `titoloSeo`, `metaDescription`, `corpoHtml`, `cta`, `keywordPrincipale`, ognuno di `keywordSecondarie[]`, ognuno di `puntiChiave[]`, e per ogni `faq[]` sia `domanda` sia `risposta`. Campi assenti/non-stringa lasciati invariati; `prodotti`/altri campi non testuali non toccati.
  - `BlogPayloadTextFields` è un tipo strutturale con i campi opzionali sopra (compatibile con `BlogArticle`).

### Prompt — `src/lib/blog/prompt.ts`

In `buildBlogPrompt`, nel blocco `# Compito`, aggiungere una riga esplicita:
> `- VIETATO citare marchi o prodotti di aziende concorrenti (es. ${COMPETITORS.join(", ")}) in qualsiasi punto dell'articolo, incluse le FAQ. Parla solo di Agocap e usa termini generici.`

(Import di `COMPETITORS` da `./competitors`.)

### Scrub alla generazione — `src/lib/blog/runtime.ts`

In `buildBlogDeps().callClaude`, dopo `const payload = blogArticleSchema.parse(...)`, applicare:
```ts
const payload = scrubBlogPayload(blogArticleSchema.parse(JSON.parse(stripFences(textBlock.text))));
```
così il `payload` restituito (e poi persistito da `persist`) è già ripulito, a prescindere da eventuali errori del modello. È la garanzia reale del guardrail.

## Testing

Ambiente vitest = node → solo funzioni pure. `src/lib/blog/competitors.test.ts`:
- `scrubCompetitors`: sostituisce case-insensitive ("Natural System", "natural system"); varianti spazi/trattini ("naturalsystem", "natural-system", "natural  system"); occorrenze multiple nella stessa stringa; non altera testo senza competitor; stringa vuota → invariata.
- `scrubBlogPayload`: pulisce `corpoHtml`, `faq[].domanda` e `faq[].risposta`, `puntiChiave[]`, `titoloSeo`, `metaDescription`, `cta`, keyword; lascia intatti `prodotti` e i campi senza match.

Prompt e runtime verificati con `npx tsc --noEmit` (l'iniezione dell'istruzione e lo scrub del payload non alterano le firme pubbliche).

## File

- **Nuovi:** `src/lib/blog/competitors.ts`, `src/lib/blog/competitors.test.ts`
- **Modificati:** `src/lib/blog/prompt.ts` (riga vietato-competitor con `COMPETITORS`), `src/lib/blog/runtime.ts` (scrub del payload in `callClaude`)

## Fuori scope

- UI/DB per gestire la lista (scelto: modulo in codice; la lista si estende aggiungendo stringhe a `COMPETITORS`).
- Scrub retroattivo sui contenuti blog già generati/pubblicati (questo guardrail agisce sulle nuove generazioni; i vecchi si correggono via "Ritira"/rigenera).
- Estensione del guardrail ad altre aree (Meta, email): il modulo `competitors.ts` è riusabile in futuro.
