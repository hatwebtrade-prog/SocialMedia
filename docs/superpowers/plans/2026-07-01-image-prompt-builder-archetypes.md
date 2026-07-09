# Prompt builder avanzato immagini (archetipi + fedeltà mockup) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il prompt builder generico con 3 archetipi deterministici (UGC / ADV / Product Hero) in inglese, con regole rigorose di preservazione del packaging quando è presente il mockup, per immagini social AGOCAP pubblicabili.

**Architecture:** Nuovo modulo di funzioni pure `src/lib/image/archetypes.ts` che compone un prompt inglese strutturato (Scene/Subject/Composition/Lighting/Style/Mood/Product placement + blocco `Avoid`). `generate.ts` sceglie il builder archetipo per il provider GPT quando esistono i dati prodotto; altrimenti mantiene il percorso attuale. Runtime, validator, rotta API e UI passano un `archetype` (default `ADV`) e una `headline` opzionale.

**Tech Stack:** Next.js 15 App Router, TypeScript, Zod, Vitest (node env — solo funzioni pure testate a unità), Prisma, `gpt-image-1` via `@openai/openai`.

## Global Constraints

- Modello immagini: **`gpt-image-1`** (invariato). Edit/reference mockup già attivo in `providers/openai.ts`.
- `gpt-image-1` **non ha** `negative_prompt`: la lista negativa va **inglobata** come sezione `Avoid: …` nel testo del prompt.
- Prompt in **inglese**; interfaccia in **italiano**.
- Il nuovo builder si applica **solo a GPT**. Higgsfield/Gemini restano sul percorso attuale.
- **Testo OFF di default**; headline breve (**max 5 parole**) **solo** per l'archetipo `ADV`.
- Archetipo di **default = `ADV`**.
- Test solo su **funzioni pure** (vitest node). Componenti/rotte/runtime verificati con `npx tsc --noEmit` + smoke.
- Commit frequenti; un commit per task.

---

### Task 1: Modulo archetipi (funzioni pure)

**Files:**
- Create: `src/lib/image/archetypes.ts`
- Test: `src/lib/image/archetypes.test.ts`

**Interfaces:**
- Consumes: `ImageBrief` da `src/lib/image/brief.ts` (campi `soggetto`, `ambientazione`, `luce`, `mood`, `stile`, `note`, `formato`).
- Produces:
  - `type ImageArchetype = "UGC" | "ADV" | "PRODUCT_HERO"`
  - `const IMAGE_ARCHETYPES = ["UGC","ADV","PRODUCT_HERO"] as const`
  - `interface ProductPromptData { nome: string; descrizione?: string | null; benefici?: string | null; ingredienti?: string | null; categoria?: string | null }`
  - `interface ArchetypeInputs { product: ProductPromptData; brief?: ImageBrief; hasMockup: boolean; headline?: string | null; formato?: "verticale" | "quadrato" | "orizzontale" }`
  - `interface BuiltPrompt { positive: string; avoid: string; full: string }`
  - `function clampHeadline(headline?: string | null): string`
  - `function buildArchetypePrompt(archetype: ImageArchetype, inputs: ArchetypeInputs): BuiltPrompt`

- [ ] **Step 1: Write the failing test**

Create `src/lib/image/archetypes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildArchetypePrompt, clampHeadline } from "@/lib/image/archetypes";

const product = {
  nome: "Capelli Plus",
  descrizione: "Integratore per capelli con biotina. Rinforza dalla radice.",
  ingredienti: "biotina, zinco",
  categoria: "capelli",
};

describe("buildArchetypePrompt", () => {
  it("includes the product name and is in English", () => {
    const { full } = buildArchetypePrompt("ADV", { product, hasMockup: false });
    expect(full).toContain("Capelli Plus");
    expect(full).toContain("AGOCAP");
    expect(full).toContain("Instagram/Facebook");
  });

  it("includes the mockup fidelity block only when hasMockup", () => {
    const withM = buildArchetypePrompt("ADV", { product, hasMockup: true }).full;
    const without = buildArchetypePrompt("ADV", { product, hasMockup: false }).full;
    expect(withM).toContain("EXACT packaging reference");
    expect(without).not.toContain("EXACT packaging reference");
  });

  it("always appends the Avoid block with key entries", () => {
    const { full, avoid } = buildArchetypePrompt("UGC", { product, hasMockup: true });
    expect(full).toContain("Avoid:");
    expect(avoid).toContain("warped packaging");
    expect(avoid).toContain("unreadable label");
    expect(avoid).toContain("extra fingers");
  });

  it("produces distinct scene/style keywords per archetype", () => {
    const ugc = buildArchetypePrompt("UGC", { product, hasMockup: false }).full;
    const adv = buildArchetypePrompt("ADV", { product, hasMockup: false }).full;
    const hero = buildArchetypePrompt("PRODUCT_HERO", { product, hasMockup: false }).full;
    expect(ugc).toContain("window light");
    expect(adv).toContain("direct-response");
    expect(hero).toContain("white studio");
  });

  it("adds no text by default", () => {
    const { full } = buildArchetypePrompt("PRODUCT_HERO", { product, hasMockup: false });
    expect(full).toContain("no text, letters, words or logos");
  });

  it("includes a short headline only for ADV", () => {
    const adv = buildArchetypePrompt("ADV", { product, hasMockup: false, headline: "Capelli piu forti" }).full;
    const ugc = buildArchetypePrompt("UGC", { product, hasMockup: false, headline: "Capelli piu forti" }).full;
    expect(adv).toContain('"Capelli piu forti"');
    expect(ugc).not.toContain("Capelli piu forti");
    expect(ugc).toContain("no text");
  });

  it("clamps a headline to 5 words", () => {
    expect(clampHeadline("uno due tre quattro cinque sette otto")).toBe("uno due tre quattro cinque");
    const adv = buildArchetypePrompt("ADV", { product, hasMockup: false, headline: "uno due tre quattro cinque otto" }).full;
    expect(adv).toContain('"uno due tre quattro cinque"');
    expect(adv).not.toContain("otto");
  });

  it("maps the format label and uses the archetype default when absent", () => {
    const def = buildArchetypePrompt("UGC", { product, hasMockup: false }).full;
    expect(def).toContain("vertical 4:5");
    const sq = buildArchetypePrompt("UGC", { product, hasMockup: false, formato: "quadrato" }).full;
    expect(sq).toContain("square 1:1");
  });

  it("appends brief overrides and ignores empty ones", () => {
    const { full } = buildArchetypePrompt("ADV", {
      product,
      hasMockup: false,
      brief: { ambientazione: "seaside at sunset", luce: "" },
    });
    expect(full).toContain("seaside at sunset");
  });

  it("lists ingredients for PRODUCT_HERO", () => {
    const { full } = buildArchetypePrompt("PRODUCT_HERO", { product, hasMockup: false });
    expect(full).toContain("biotina, zinco");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/image/archetypes.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/image/archetypes"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/image/archetypes.ts`:

```ts
import type { ImageBrief } from "./brief";

export type ImageArchetype = "UGC" | "ADV" | "PRODUCT_HERO";
export const IMAGE_ARCHETYPES = ["UGC", "ADV", "PRODUCT_HERO"] as const;

export interface ProductPromptData {
  nome: string;
  descrizione?: string | null;
  benefici?: string | null;
  ingredienti?: string | null;
  categoria?: string | null;
}

export interface ArchetypeInputs {
  product: ProductPromptData;
  brief?: ImageBrief;
  hasMockup: boolean;
  headline?: string | null;
  formato?: "verticale" | "quadrato" | "orizzontale";
}

export interface BuiltPrompt {
  positive: string;
  avoid: string;
  full: string;
}

type Formato = NonNullable<ArchetypeInputs["formato"]>;

interface Preset {
  scene: string;
  subject: string;
  composition: string;
  lighting: string;
  style: string;
  mood: string;
  productPlacement: string;
  defaultFormato: Formato;
}

const PRESETS: Record<ImageArchetype, Preset> = {
  UGC: {
    scene: "an everyday real-life setting (home, bathroom shelf or kitchen counter)",
    subject: "a real person naturally holding and using the product, authentic and relatable, not overly commercial",
    composition: "candid smartphone-style framing, product label facing the camera and in focus",
    lighting: "soft natural window light",
    style: "authentic user-generated content, realistic, unpolished but clean",
    mood: "warm, genuine, trustworthy",
    productPlacement: "the product is held naturally in-hand, sharp and clearly readable",
    defaultFormato: "verticale",
  },
  ADV: {
    scene: "a lifestyle background connected to the product benefit, elegant and high-contrast",
    subject: "the product as the dominant hero object",
    composition: "product large on the rule-of-thirds, clean negative space reserved for a short headline",
    lighting: "dramatic soft studio light",
    style: "premium direct-response advertising creative, realistic, trustworthy, not aggressive",
    mood: "confident, aspirational, premium",
    productPlacement: "the product dominates the frame, sharp, front-facing and undistorted",
    defaultFormato: "quadrato",
  },
  PRODUCT_HERO: {
    scene: "a bright clean white studio background with subtle shadows and a nutraceutical atmosphere",
    subject: "the product package standing upright as the hero object",
    composition: "centered product, balanced negative space, minimal layout",
    lighting: "professional softbox lighting, clean highlights, realistic shadows",
    style: "minimal, scientific, premium Italian nutraceutical",
    mood: "reliable, calm, clinical-premium",
    productPlacement: "the product is centered and upright, sharp and perfectly readable",
    defaultFormato: "quadrato",
  },
};

const AVOID =
  "low quality, blurry, pixelated, distorted product, warped packaging, wrong logo, " +
  "unreadable label, fake text, extra text, random letters, duplicated product, " +
  "deformed hands, extra fingers, missing fingers, artificial plastic skin, plastic face, " +
  "unrealistic smile, overexposed, underexposed, messy background, cheap stock photo, " +
  "amateur design, cartoon style, 3d render look, surreal, medical claim, before and after, " +
  "exaggerated results, cluttered composition, oversaturated colors";

const FORMATO_LABEL: Record<Formato, string> = {
  verticale: "vertical 4:5 social format",
  quadrato: "square 1:1 social format",
  orizzontale: "horizontal 1.91:1 social format",
};

/** First sentence (max ~160 chars) of the product description, single line; falls back to category. */
function shortDescription(product: ProductPromptData): string {
  const raw = (product.descrizione ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return (product.categoria ?? "").trim();
  const firstSentence = raw.split(/(?<=[.!?])\s/)[0] ?? raw;
  return firstSentence.length > 160 ? `${firstSentence.slice(0, 157).trim()}…` : firstSentence;
}

/** Appends a non-empty brief override to an archetype default, comma-separated. */
function merge(base: string, override?: string): string {
  const o = (override ?? "").trim();
  return o ? `${base}, ${o}` : base;
}

/** Clamps a headline to at most 5 words. Empty/whitespace → "". */
export function clampHeadline(headline?: string | null): string {
  const words = (headline ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.slice(0, 5).join(" ");
}

function textRule(archetype: ImageArchetype, headline?: string | null): string {
  const clamped = archetype === "ADV" ? clampHeadline(headline) : "";
  if (clamped) {
    return `you may include only this short headline (max 5 words): "${clamped}". No other text anywhere in the image.`;
  }
  return "no text, letters, words or logos other than the product packaging itself.";
}

export function buildArchetypePrompt(archetype: ImageArchetype, inputs: ArchetypeInputs): BuiltPrompt {
  const preset = PRESETS[archetype];
  const b = inputs.brief;
  const formato = inputs.formato ?? preset.defaultFormato;
  const desc = shortDescription(inputs.product);

  const mockupBlock = inputs.hasMockup
    ? "Use the provided product mockup as the EXACT packaging reference. Keep the packaging design, " +
      "colors, logo, proportions and the readable product name IDENTICAL to the original mockup. " +
      "Do NOT redesign the package. Do NOT invent, change or add any text on the label."
    : "";

  const ingredientsLine =
    archetype === "PRODUCT_HERO"
      ? `Around the product show a few elegant natural ingredients related to the formula` +
        `${inputs.product.ingredienti ? `: ${inputs.product.ingredienti.replace(/\s+/g, " ").trim()}` : ""}.`
      : "";

  const lines = [
    "Create a high-end realistic Instagram/Facebook advertising image for the Italian supplement brand AGOCAP. Ready to publish.",
    "Product:",
    desc ? `${inputs.product.nome} — ${desc}` : inputs.product.nome,
    mockupBlock,
    `Scene: ${merge(preset.scene, b?.ambientazione)}`,
    `Main subject: ${merge(preset.subject, b?.soggetto)}`,
    `Composition: ${preset.composition}, ${FORMATO_LABEL[formato]}`,
    `Lighting: ${merge(preset.lighting, b?.luce)}`,
    `Style: ${merge(preset.style, b?.stile)}`,
    `Mood: ${merge(preset.mood, b?.mood)}`,
    `Product placement: ${preset.productPlacement}`,
    ingredientsLine,
    b?.note?.trim() ? `Additional direction: ${b.note.trim()}.` : "",
    "Brand feeling: premium, clean, trustworthy, natural wellness, Italian nutraceutical brand, elegant but accessible.",
    `Text rule: ${textRule(archetype, inputs.headline)}`,
  ].filter((l) => l !== "");

  const positive = lines.join("\n");
  const full = `${positive}\n\nAvoid: ${AVOID}`;
  return { positive, avoid: AVOID, full };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/image/archetypes.test.ts`
Expected: PASS — 10 tests green.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/lib/image/archetypes.ts src/lib/image/archetypes.test.ts
git commit -m "feat(image): deterministic archetype prompt builder (UGC/ADV/Product Hero)"
```

---

### Task 2: Cablaggio in `generate.ts`

**Files:**
- Modify: `src/lib/image/generate.ts`
- Test: `src/lib/image/generate.test.ts`

**Interfaces:**
- Consumes: `buildArchetypePrompt`, `ImageArchetype`, `ProductPromptData` da Task 1.
- Produces (estensione tipi esistenti):
  - `ImageGenInput` += `archetype?: ImageArchetype; headline?: string`
  - `ImageDeps` += `loadProduct?: (productId: string) => Promise<ProductPromptData | null>`
  - Regola di selezione: se `provider === "GPT"` **e** `deps.loadProduct` restituisce un prodotto → prompt = `buildArchetypePrompt(input.archetype ?? "ADV", …).full`; altrimenti percorso attuale.

- [ ] **Step 1: Write the failing test**

Append these tests to `src/lib/image/generate.test.ts` inside the existing `describe("generateImageAsset", …)` block (before its closing `});`):

```ts
  it("builds an archetype prompt for GPT when product data is available", async () => {
    const deps = makeDeps({ loadProduct: vi.fn().mockResolvedValue({ nome: "Capelli Plus" }) });
    await generateImageAsset(
      { contentId: "c1", slideIndex: null, productId: "p1", archetype: "PRODUCT_HERO" },
      deps as any,
    );
    const prompt = (deps.callOpenAI as any).mock.calls[0][0] as string;
    expect(prompt).toContain("AGOCAP");
    expect(prompt).toContain("Capelli Plus");
    expect(prompt).toContain("white studio");
  });

  it("defaults to the ADV archetype when none is given", async () => {
    const deps = makeDeps({ loadProduct: vi.fn().mockResolvedValue({ nome: "X" }) });
    await generateImageAsset({ contentId: "c1", slideIndex: null, productId: "p1" }, deps as any);
    const prompt = (deps.callOpenAI as any).mock.calls[0][0] as string;
    expect(prompt).toContain("direct-response");
  });

  it("does NOT use the archetype builder for Higgsfield", async () => {
    const deps = makeDeps({ loadProduct: vi.fn().mockResolvedValue({ nome: "X" }) });
    await generateImageAsset(
      { contentId: "c1", slideIndex: null, productId: "p1", provider: "HIGGSFIELD" },
      deps as any,
    );
    const prompt = (deps.callOpenAI as any).mock.calls[0][0] as string;
    expect(prompt).not.toContain("Avoid:");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/image/generate.test.ts`
Expected: FAIL — the archetype tests fail (prompt does not contain "AGOCAP"/"direct-response") because `generate.ts` still ignores products.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/image/generate.ts`:

(a) Add the import at the top (after the existing `import { buildImagePrompt } …`):

```ts
import { buildArchetypePrompt, type ImageArchetype, type ProductPromptData } from "./archetypes";
```

(b) Extend `ImageGenInput` — add two fields inside the interface:

```ts
  archetype?: ImageArchetype;
  headline?: string;
```

(c) Extend `ImageDeps` — add one optional dep inside the interface:

```ts
  loadProduct?: (productId: string) => Promise<ProductPromptData | null>;
```

(d) Replace the prompt-building block. Find:

```ts
    const brandProfile = deps.loadBrandVisual ? await deps.loadBrandVisual() : null;
    const brandVisual = brandProfile ? buildBrandVisualContext(brandProfile, input.provider ?? "GPT") : undefined;
    const prompt = input.brief && !isBriefEmpty(input.brief)
      ? buildImagePromptFromBrief(input.brief, { provider: input.provider ?? "GPT", hasMockup: !!mockup, fallback, brandVisual })
      : buildImagePrompt({ ideaCreativa, slideText, hasMockup: !!mockup });
```

Replace it with:

```ts
    const provider = input.provider ?? "GPT";
    const brandProfile = deps.loadBrandVisual ? await deps.loadBrandVisual() : null;
    const brandVisual = brandProfile ? buildBrandVisualContext(brandProfile, provider) : undefined;
    const product = input.productId && deps.loadProduct ? await deps.loadProduct(input.productId) : null;
    let prompt: string;
    if (provider === "GPT" && product) {
      prompt = buildArchetypePrompt(input.archetype ?? "ADV", {
        product,
        brief: input.brief,
        hasMockup: !!mockup,
        headline: input.headline,
        formato: input.brief?.formato,
      }).full;
    } else if (input.brief && !isBriefEmpty(input.brief)) {
      prompt = buildImagePromptFromBrief(input.brief, { provider, hasMockup: !!mockup, fallback, brandVisual });
    } else {
      prompt = buildImagePrompt({ ideaCreativa, slideText, hasMockup: !!mockup });
    }
```

(e) Downstream, replace the two remaining `input.provider ?? "GPT"` / `input.provider` usages so they use the local `provider`. Find:

```ts
    let customReferenceId: string | undefined;
    if (input.provider === "HIGGSFIELD" && input.useMockup && input.productId && deps.ensureHiggsfieldRef) {
      customReferenceId = (await deps.ensureHiggsfieldRef(input.productId)) ?? undefined;
    }
    const bytes = await deps.callOpenAI(prompt, mockup ?? undefined, input.provider, { styleId, soulSize, customReferenceId });
```

Replace with:

```ts
    let customReferenceId: string | undefined;
    if (provider === "HIGGSFIELD" && input.useMockup && input.productId && deps.ensureHiggsfieldRef) {
      customReferenceId = (await deps.ensureHiggsfieldRef(input.productId)) ?? undefined;
    }
    const bytes = await deps.callOpenAI(prompt, mockup ?? undefined, provider, { styleId, soulSize, customReferenceId });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/image/generate.test.ts`
Expected: PASS — all tests green (3 new + existing, including the `ideaCreativa` and `GEMINI` tests which take the fallback path because `loadProduct` is absent in their `makeDeps`).

- [ ] **Step 5: Typecheck + Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
npx tsc --noEmit
git add src/lib/image/generate.ts src/lib/image/generate.test.ts
git commit -m "feat(image): route GPT generation through the archetype prompt builder"
```
Expected: `tsc` prints no errors.

---

### Task 3: Runtime dep `loadProduct`

**Files:**
- Modify: `src/lib/image/runtime.ts`

**Interfaces:**
- Consumes: `ImageDeps.loadProduct` signature from Task 2, `prisma`.
- Produces: concrete `loadProduct` in `sharedImageDeps()` so every runtime deps object (Meta + Blog) supplies it.

- [ ] **Step 1: Add loadProduct to the shared deps**

In `src/lib/image/runtime.ts`, update the `sharedImageDeps` return type to include `"loadProduct"`. Find:

```ts
function sharedImageDeps(): Pick<ImageDeps, "loadMockup" | "callOpenAI" | "persistAsset" | "ensureHiggsfieldRef" | "loadBrandVisual"> {
  return {
    loadMockup: async (productId) => {
```

Replace the signature line and insert the new dep before `loadMockup`:

```ts
function sharedImageDeps(): Pick<ImageDeps, "loadMockup" | "loadProduct" | "callOpenAI" | "persistAsset" | "ensureHiggsfieldRef" | "loadBrandVisual"> {
  return {
    loadProduct: async (productId) => {
      return prisma.product.findUnique({
        where: { id: productId },
        select: { nome: true, descrizione: true, benefici: true, ingredienti: true, categoria: true },
      });
    },

    loadMockup: async (productId) => {
```

- [ ] **Step 2: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: no errors. (`prisma.product.findUnique(...)` returns `Promise<ProductPromptData | null>` — the selected fields match `ProductPromptData`.)

- [ ] **Step 3: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/lib/image/runtime.ts
git commit -m "feat(image): supply product data to the generator via loadProduct runtime dep"
```

---

### Task 4: Validator + rotta API

**Files:**
- Modify: `src/app/api/meta/validators.ts:31-41` (`imageInputSchema`)
- Modify: `src/app/api/meta/contents/[id]/image/route.ts:22`

**Interfaces:**
- Consumes: `ImageGenInput.archetype` / `.headline` from Task 2.
- Produces: request body accepts `archetype` (`"UGC"|"ADV"|"PRODUCT_HERO"`) and `headline` (string), forwarded to `generateImageAsset`.

- [ ] **Step 1: Extend the Zod schema**

In `src/app/api/meta/validators.ts`, inside `imageInputSchema` (after the `ideaCreativa` line, before the closing `});`), add:

```ts
  archetype: z.enum(["UGC", "ADV", "PRODUCT_HERO"]).optional(),
  headline: z.string().optional(),
```

- [ ] **Step 2: Forward the fields in the route**

In `src/app/api/meta/contents/[id]/image/route.ts`, update the `run({ … }, deps)` call to pass the two new fields. Find:

```ts
  const result = await run({ contentId: id, slideIndex, productId: parsed.data.productId, useMockup: parsed.data.useMockup, provider: parsed.data.provider, brief: parsed.data.brief, styleId: parsed.data.styleId, ideaCreativa: parsed.data.ideaCreativa }, deps);
```

Replace with:

```ts
  const result = await run({ contentId: id, slideIndex, productId: parsed.data.productId, useMockup: parsed.data.useMockup, provider: parsed.data.provider, brief: parsed.data.brief, styleId: parsed.data.styleId, ideaCreativa: parsed.data.ideaCreativa, archetype: parsed.data.archetype, headline: parsed.data.headline }, deps);
```

- [ ] **Step 3: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/app/api/meta/validators.ts "src/app/api/meta/contents/[id]/image/route.ts"
git commit -m "feat(image): accept archetype + headline on the image generation endpoint"
```

---

### Task 5: UI — selettore archetipo + headline

**Files:**
- Modify: `src/app/meta/[id]/page.tsx` (state near line 33-35, generator box near line 100-111, `genImage` body line 57-60)

**Interfaces:**
- Consumes: the `archetype`/`headline` request fields from Task 4.
- Produces: user-facing selector; sends `archetype` and (optional) `headline` with every GPT generation.

- [ ] **Step 1: Add component state**

In `src/app/meta/[id]/page.tsx`, after the line `const [brief, setBrief] = useState<Brief>({});` add:

```tsx
  const [archetype, setArchetype] = useState<"UGC" | "ADV" | "PRODUCT_HERO">("ADV");
  const [headline, setHeadline] = useState("");
```

- [ ] **Step 2: Send the fields in genImage**

In the `genImage` function, update the fetch body. Find:

```tsx
      body: JSON.stringify({ slideIndex, productId: v.productId || undefined, useMockup: v.useMockup && !!v.productId, provider, brief, styleId: brief.stile, ideaCreativa: ideaRef.current?.value ?? undefined }),
```

Replace with:

```tsx
      body: JSON.stringify({ slideIndex, productId: v.productId || undefined, useMockup: v.useMockup && !!v.productId, provider, brief, styleId: brief.stile, ideaCreativa: ideaRef.current?.value ?? undefined, archetype, headline: headline.trim() || undefined }),
```

- [ ] **Step 3: Add the selector UI**

In the generator box, find the closing of the provider row and the brief form:

```tsx
        </div>
        <p className="mt-1 text-xs text-neutral-500">Provider e brief valgono per tutte le immagini. Il prodotto si sceglie per singola immagine qui sotto.</p>
        <ImageBriefForm provider={provider} value={brief} onChange={setBrief} />
```

Insert the archetype controls **between** the `</div>` and the `<p>`:

```tsx
        </div>
        {provider === "GPT" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-600">Stile immagine:</span>
            {([
              { k: "UGC", label: "UGC realistico" },
              { k: "ADV", label: "ADV premium" },
              { k: "PRODUCT_HERO", label: "Product Hero" },
            ] as const).map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => setArchetype(o.k)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${archetype === o.k ? "border-sage-500 bg-sage-100 text-sage-700" : "border-neutral-300 text-neutral-600 hover:bg-neutral-100"}`}
              >
                {o.label}
              </button>
            ))}
            {archetype === "ADV" && (
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Headline breve (max 5 parole, opzionale)"
                className="ml-1 min-w-[16rem] flex-1 rounded border p-1 text-xs"
              />
            )}
          </div>
        )}
        <p className="mt-1 text-xs text-neutral-500">Provider e brief valgono per tutte le immagini. Il prodotto si sceglie per singola immagine qui sotto.</p>
        <ImageBriefForm provider={provider} value={brief} onChange={setBrief} />
```

- [ ] **Step 4: Typecheck + build**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit && npm run build`
Expected: `tsc` clean; `next build` completes without errors.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add "src/app/meta/[id]/page.tsx"
git commit -m "feat(image): archetype selector + short headline in the Meta image generator UI"
```

---

### Task 6: Verifica end-to-end

**Files:** nessuna modifica (solo verifica).

- [ ] **Step 1: Full test suite**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run`
Expected: tutti i test verdi (i precedenti + i nuovi di Task 1 e Task 2).

- [ ] **Step 2: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Smoke manuale (dev server già su :3000)**

Apri `http://localhost:3000/meta/<id-di-un-contenuto>`, seleziona provider **GPT**, scegli un archetipo, seleziona un prodotto con mockup e genera una singola immagine. Verifica in `GeneratedAsset.prompt` (o nei log) che il prompt inviato sia in inglese, contenga `AGOCAP`, il blocco `Avoid:` e — con mockup — `EXACT packaging reference`.

- [ ] **Step 4: Nessun commit** (task di sola verifica).

---

## Self-Review

**Spec coverage:**
- Positive prompt inglese → Task 1 (`positive`/`full`). ✓
- Negative prompt → Task 1 (`avoid` inglobato in `full`, per assenza di `negative_prompt` su gpt-image-1). ✓
- Istruzioni specifiche gpt-image-1 + uso obbligatorio mockup come riferimento → blocco `EXACT packaging reference` (Task 1) + edit già attivo in `openai.ts` (invariato). ✓
- 3 varianti automatiche UGC/ADV/Product Hero → `PRESETS` (Task 1), selettore (Task 5). ✓
- Preservazione packaging/logo/colori/proporzioni/nome, no testi inventati → `mockupBlock` (Task 1). ✓
- Dettaglio su scena/soggetto/luce/inquadratura/stile/mood/formato/posizionamento/cosa evitare → righe strutturate + `AVOID` (Task 1). ✓
- Headline ≤ 3-5 parole, testo aggiunto dopo in Canva → `clampHeadline` + `textRule` (Task 1), default no-text. ✓
- Dati prodotto (nome/descrizione/ingredienti) → `ProductPromptData` + `loadProduct` (Task 2/3). ✓
- Default ADV, UI minima, GPT-only, Higgsfield/Gemini invariati → Task 2/5. ✓

**Placeholder scan:** nessun TODO/TBD; ogni step ha codice/comando reale. ✓

**Type consistency:** `ImageArchetype`, `ProductPromptData`, `ArchetypeInputs`, `BuiltPrompt`, `buildArchetypePrompt`, `clampHeadline` coerenti tra Task 1→2→3; `loadProduct` con stessa firma in `ImageDeps` (Task 2) e `sharedImageDeps` (Task 3); enum archetipo identico in `archetypes.ts`, validator (Task 4) e UI (Task 5). ✓
