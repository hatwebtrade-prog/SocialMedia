# Prompt builder avanzato immagini social — Archetipi + fedeltà mockup

**Data:** 2026-07-01
**Progetto:** AGOCAP Content AI Hub
**Modulo:** generazione immagini (`src/lib/image/*`, area Meta)

## Contesto e problema

Il modulo immagini usa provider esterni via API (GPT/`gpt-image-1`, Higgsfield Soul, Gemini). Oggi il prompt builder è generico e in italiano: produce immagini poco realistiche, packaging deformato, testi illeggibili, mockup poco integrato, qualità non pubblicabile su Meta/IG/FB/TikTok.

Il modello resta **`gpt-image-1`** (confermato). Il problema non è il modello ma il **prompt builder** e la **gestione del mockup prodotto**. L'edit/reference col mockup è **già attivo**: `src/lib/image/providers/openai.ts` usa `client.images.edit({ model: "gpt-image-1", image: mockup, ... })` quando il mockup è presente, quindi non rigenera il packaging da zero.

Vincolo tecnico chiave: **`gpt-image-1` non espone un parametro `negative_prompt`**. Il "negative prompt" va quindi inglobato come sezione testuale `Avoid: ...` dentro il prompt.

## Obiettivo

Riprogettare il sistema di prompt per generare immagini social premium, realistiche, coerenti col brand AGOCAP e adatte a campagne, post organici e UGC — con regole rigorose di preservazione del packaging quando è presente il mockup.

## Decisioni di design (confermate)

1. **Generazione**: al click si costruiscono **3 prompt** (uno per archetipo), ma si **renderizza 1 immagine** (l'archetipo selezionato). Gli altri due si generano on-demand cambiando selettore.
2. **Motore**: **template deterministici** con slot (funzioni pure). Nessuna chiamata LLM, nessun costo/latency extra, output prevedibile e testabile.
3. **Scope tipologie**: **solo 3 archetipi** — `UGC`, `ADV`, `PRODUCT_HERO`.
4. **UI minima**: piccolo selettore archetipo per-immagine accanto al bottone "Genera" esistente.
5. **Default archetipo = `ADV`**.
6. **Testo OFF di default**; headline breve (max 3-5 parole) opzionale **solo** su archetipo `ADV`.
7. **Higgsfield/Gemini fuori scope**: restano sul percorso attuale. Il nuovo builder si applica a **GPT** (`gpt-image-1`).
8. **Lingua prompt: inglese** (interfaccia resta italiana).

## Architettura

### Nuovo modulo `src/lib/image/archetypes.ts` (funzioni pure)

```ts
export type ImageArchetype = "UGC" | "ADV" | "PRODUCT_HERO";

export interface ProductPromptData {
  nome: string;
  descrizione?: string | null;
  benefici?: string | null;
  ingredienti?: string | null;
  categoria?: string | null;
}

export interface ArchetypeInputs {
  product: ProductPromptData;
  brief?: import("./brief").ImageBrief;   // override di scena (campi italiani esistenti)
  hasMockup: boolean;
  headline?: string | null;               // usato solo se archetype === "ADV"
  formato?: "verticale" | "quadrato" | "orizzontale";
}

export interface BuiltPrompt {
  positive: string;   // corpo del prompt (senza Avoid)
  avoid: string;      // lista negativa (comma-separated)
  full: string;       // positive + "\n\nAvoid: " + avoid  → ciò che viene inviato all'API
}

export const ARCHETYPES: Record<ImageArchetype, ArchetypePreset>;

export function buildArchetypePrompt(
  archetype: ImageArchetype,
  inputs: ArchetypeInputs,
): BuiltPrompt;
```

`ArchetypePreset` (interno) contiene le stringhe inglesi fisse per: `scene`, `subject`, `composition`, `lighting`, `style`, `mood`, `productPlacement`, `defaultFormato`.

### Struttura del prompt generato (inglese)

```
Create a high-end realistic {IG/FB} advertising image for the Italian
supplement brand AGOCAP. Ready to publish.

Product:
{nome} — {descrizione breve}
[SOLO se hasMockup] Use the provided product mockup as the EXACT packaging
reference. Keep the packaging design, colors, logo, proportions and the
readable product name IDENTICAL to the original mockup. Do NOT redesign the
package. Do NOT invent, change or add any text on the label.

Scene: {archetype.scene}[, {brief.ambientazione}]
Main subject: {archetype.subject}[, {brief.soggetto}]
Composition: {archetype.composition}, {formato-leggibile}
Lighting: {archetype.lighting}[, {brief.luce}]
Style: {archetype.style}[, {brief.stile}]
Mood: {archetype.mood}[, {brief.mood}]
Product placement: {archetype.productPlacement}
Brand feeling: premium, clean, trustworthy, natural wellness, Italian
nutraceutical brand, elegant but accessible.
Text rule: {vedi "Regola testo"}

Avoid: {lista negativa}
```

Note di composizione:
- `descrizione breve` = `product.descrizione` troncata (una frase); se assente, si usa `categoria` o si omette la riga.
- Gli override `brief.*` si **concatenano** al valore d'archetipo (non lo sostituiscono), separati da virgola, solo se non vuoti.
- Il blocco "Product/mockup fidelity" compare **solo** con `hasMockup`.

### I 3 archetipi

| Archetipo | Scene | Subject | Lighting | Style / Mood | Product placement | Formato def. |
|---|---|---|---|---|---|---|
| **UGC** | everyday real setting (home, bathroom, kitchen) | real person holding/using the product, authentic, not overly commercial | soft natural window light | candid but clean, realistic, relatable / warm, genuine | product held naturally, label facing camera, sharp | verticale (4:5) |
| **ADV** | lifestyle background connected to the product benefit, elegant, high contrast | product as dominant hero object | dramatic soft studio light | premium direct-response ad, realistic, trustworthy / confident, aspirational | product large and centered (rule-of-thirds), clear space for a short headline | quadrato (1:1) |
| **PRODUCT_HERO** | bright clean white studio, subtle shadows, nutraceutical atmosphere | product package upright as hero + a few natural ingredients related to the formula around it | professional softbox, clean highlights, realistic shadows | minimal, scientific, premium Italian nutraceutical / reliable, calm | product centered, balanced negative space, minimal layout | quadrato (1:1) |

Per `PRODUCT_HERO`, gli ingredienti mostrati derivano da `product.ingredienti` (se presenti); altrimenti dicitura generica "natural ingredients related to the formula".

### Regola testo

- **Default (UGC, PRODUCT_HERO, e ADV senza headline)**: `Text rule: no text, letters, words or logos other than the product packaging itself.`
- **ADV con `headline` non vuota**: `Text rule: you may include only this short headline (max 5 words): "{headline}". No other text anywhere in the image.`
- Il builder **tronca/valida** la headline a max 5 parole (taglia le eccedenti) per evitare titoli lunghi illeggibili.

### Lista negativa (`avoid`)

Costante unica riusata da tutti gli archetipi:

```
low quality, blurry, pixelated, distorted product, warped packaging, wrong logo,
unreadable label, fake text, extra text, random letters, duplicated product,
deformed hands, extra fingers, missing fingers, artificial plastic skin,
plastic face, unrealistic smile, overexposed, underexposed, messy background,
cheap stock photo, amateur design, cartoon style, 3d render look, surreal,
medical claim, before and after, exaggerated results, cluttered composition,
oversaturated colors
```

### Integrazione `src/lib/image/generate.ts`

- `ImageGenInput` aggiunge: `archetype?: ImageArchetype` (default `"ADV"`), `headline?: string`.
- `ImageDeps` aggiunge: `loadProduct: (productId: string) => Promise<ProductPromptData | null>`.
- Flusso GPT: se `provider` è `GPT` (o non specificato) **e** esiste `productId` con dati prodotto → il prompt si costruisce con `buildArchetypePrompt(archetype ?? "ADV", { product, brief, hasMockup, headline, formato })` e si invia `built.full`.
- Se manca il prodotto o il provider è Higgsfield/Gemini → **percorso attuale invariato** (`buildImagePromptFromBrief` / `buildImagePrompt`).
- Il `formato` viene da `brief.formato`; se assente si usa il `defaultFormato` dell'archetipo. `briefDimensions()` continua a mappare la `size` OpenAI.

### API + UI

- **Rotta immagine** (`src/app/api/meta/contents/[id]/image/route.ts`): il body accetta `archetype` e `headline`; validati in `src/app/api/meta/validators.ts` (enum `["UGC","ADV","PRODUCT_HERO"]`, headline stringa opzionale). Passati a `generateImageAsset`.
- **UI** (`src/app/meta/[id]/page.tsx`): selettore per-immagine (segmented o dropdown) `UGC · ADV · Product Hero`, default ADV, accanto al bottone Genera esistente. Campo headline breve visibile solo quando è selezionato ADV. Nessun'altra modifica di layout.

## Testing

Ambiente vitest = node; si testano **solo funzioni pure** (`archetypes.ts`, `generate.ts` con deps mockate). Componenti verificati con `tsc` + smoke manuale.

`src/lib/image/archetypes.test.ts`:
- output `full` in inglese e contiene il nome prodotto;
- blocco fedeltà-mockup presente **solo** con `hasMockup: true`, assente con `false`;
- `avoid` presente in `full` e contiene voci chiave (`warped packaging`, `unreadable label`, `extra fingers`);
- i 3 archetipi producono keyword di scena/stile **distinte** (es. UGC→"window light", ADV→"direct-response", PRODUCT_HERO→"white studio");
- **testo**: default → frase "no text…"; ADV con headline → include `"{headline}"`; headline > 5 parole → troncata; headline su UGC/PRODUCT_HERO → ignorata;
- `formato` mappa la dicitura corretta; default d'archetipo usato se assente;
- override `brief.*` concatenati e vuoti ignorati.

`src/lib/image/generate.test.ts` (aggiornato):
- con `productId` + provider GPT chiama `loadProduct` e passa `built.full` a `callOpenAI`;
- default archetipo `ADV` quando non specificato;
- provider Higgsfield → percorso invariato (non usa `buildArchetypePrompt`);
- mockup passato a `callOpenAI` quando `useMockup`.

## File

- **Nuovi**: `src/lib/image/archetypes.ts`, `src/lib/image/archetypes.test.ts`
- **Modificati**: `src/lib/image/generate.ts`, `src/lib/image/generate.test.ts`, `src/app/api/meta/contents/[id]/image/route.ts`, `src/app/api/meta/validators.ts`, `src/app/meta/[id]/page.tsx`
- **Invariati**: `src/lib/image/providers/openai.ts` (edit già ok), `src/lib/image/brief.ts` (riuso come override di scena), `src/lib/image/prompt.ts` (fallback legacy)

## Fuori scope (per ora)

- Le 6 tipologie estese (Beauty/Pharma/Educational/Lifestyle come preset separati): il taxonomy si può mappare in seguito sui 3 archetipi.
- Generazione simultanea delle 3 immagini in un click.
- Applicazione del nuovo builder a Higgsfield/Gemini.
- Aggiunta automatica del copy/headline lungo (resta lato Canva/editor).
```
