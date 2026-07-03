# Immagini Social Brandizzate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generare le immagini Meta (post + ogni slide) in stile "post brandizzato" con spunte per-immagine: Includi prodotto, Includi descrizione (testi AI), Includi logo (overlay reale), Influencer (UGC).

**Architecture:** Nuove funzioni pure (placement logo, colore prodotto, prompt template, copy AI) + deps impure nel runtime immagini; `generateImageAsset` per META usa il nuovo prompt template, estrae l'accent color dal prodotto, opzionalmente genera testi via Claude e sovrappone il logo reale. UI Meta con checkbox per-immagine e caricamento logo.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Zod, Prisma, sharp, Vitest (solo funzioni pure).

## Global Constraints

- Tutte le spunte **default OFF**; nessun influencer/persona salvo spunta "Influencer (UGC)".
- L'influencer/persona compare **solo** se `influencer === true`.
- Il logo NON è generato dal prompt: è **sovrapposto** (sharp) usando il file reale caricato.
- Palette costruita attorno al **colore dominante del prodotto**; fallback al brand se assente.
- Testi immagine **sintetizzati dall'AI** (titolo + max 3 bullet brevi, in italiano), solo se `includiDescrizione`.
- Vale per **ogni immagine Meta** (post principale + ciascuna slide), stesso motore `generateImageAsset`.
- Solo canale **Meta** in v1 (il Blog usa `generateImageAsset` ma NON deve cambiare comportamento → gate su `input.social`).
- Test solo su funzioni pure (env node); componenti/route/sharp verificati con `npx tsc --noEmit` + `npm run build`.
- Logo salvato a path fisso `uploads/brand/logo.png` (nessuna migration).
- `escapeHtml`/scrub competitor: i testi AN vanno passati da `scrubCompetitors` (già esistente in `@/lib/blog/competitors`).

---

### Task 1: Logo store + overlay (posizionamento puro + compositing sharp)

**Files:**
- Create: `src/lib/image/logo-store.ts`
- Create: `src/lib/image/logo-overlay.ts`
- Create: `src/lib/image/logo-overlay.test.ts`

**Interfaces:**
- Produces:
  - `saveLogo(bytes: Buffer): string` (ritorna path relativo), `readLogo(): Buffer | null`, `hasLogo(): boolean` — da `logo-store.ts`
  - `logoPlacement(imgW: number, imgH: number, logoRatio: number, opts?: { widthPct?: number; marginPct?: number }): { left: number; top: number; width: number; height: number }` — puro, da `logo-overlay.ts`
  - `overlayLogo(imageBuf: Buffer, logoBuf: Buffer): Promise<Buffer>` — sharp, da `logo-overlay.ts`

- [ ] **Step 1: Write the failing test** — `src/lib/image/logo-overlay.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { logoPlacement } from "@/lib/image/logo-overlay";

describe("logoPlacement", () => {
  it("places the logo top-right respecting width% and margin%", () => {
    // 1000x1000 image, logo 4:1 (ratio=4), width 16% => 160x40, margin 4% => 40
    const p = logoPlacement(1000, 1000, 4, { widthPct: 0.16, marginPct: 0.04 });
    expect(p.width).toBe(160);
    expect(p.height).toBe(40);
    expect(p.left).toBe(1000 - 160 - 40); // 800
    expect(p.top).toBe(40);
  });
  it("uses defaults (16% width, 4% margin) and never returns negative offsets", () => {
    const p = logoPlacement(100, 100, 10);
    expect(p.width).toBe(16);
    expect(p.height).toBe(2); // 16/10 rounded
    expect(p.left).toBeGreaterThanOrEqual(0);
    expect(p.top).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/image/logo-overlay.test.ts`
Expected: FAIL ("logoPlacement is not a function" / module not found).

- [ ] **Step 3: Implement `logo-overlay.ts`**

```ts
import sharp from "sharp";

/** Top-right placement of a logo over an image. logoRatio = logoWidth / logoHeight. Pure. */
export function logoPlacement(
  imgW: number,
  imgH: number,
  logoRatio: number,
  opts?: { widthPct?: number; marginPct?: number },
): { left: number; top: number; width: number; height: number } {
  const widthPct = opts?.widthPct ?? 0.16;
  const marginPct = opts?.marginPct ?? 0.04;
  const width = Math.max(1, Math.round(imgW * widthPct));
  const height = Math.max(1, Math.round(width / (logoRatio || 1)));
  const margin = Math.round(imgW * marginPct);
  const left = Math.max(0, imgW - width - margin);
  const top = Math.max(0, margin);
  return { left, top, width, height };
}

/** Composites the logo onto the image (top-right). Never throws to the caller on a bad logo. */
export async function overlayLogo(imageBuf: Buffer, logoBuf: Buffer): Promise<Buffer> {
  const img = sharp(imageBuf);
  const meta = await img.metadata();
  const imgW = meta.width ?? 1024;
  const imgH = meta.height ?? 1024;
  const logoMeta = await sharp(logoBuf).metadata();
  const ratio = (logoMeta.width ?? 4) / (logoMeta.height ?? 1);
  const p = logoPlacement(imgW, imgH, ratio);
  const resizedLogo = await sharp(logoBuf).resize(p.width, p.height, { fit: "inside" }).png().toBuffer();
  return img.composite([{ input: resizedLogo, left: p.left, top: p.top }]).png().toBuffer();
}
```

- [ ] **Step 4: Implement `logo-store.ts`**

```ts
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { UPLOADS_DIR } from "./store";

const BRAND_DIR = path.join(UPLOADS_DIR, "brand");
const LOGO_ABS = path.join(BRAND_DIR, "logo.png");

/** Persists the brand logo PNG at a fixed path. Returns the repo-relative POSIX path. */
export function saveLogo(bytes: Buffer): string {
  mkdirSync(BRAND_DIR, { recursive: true });
  writeFileSync(LOGO_ABS, bytes);
  return path.relative(process.cwd(), LOGO_ABS).replace(/\\/g, "/");
}

export function hasLogo(): boolean {
  return existsSync(LOGO_ABS);
}

export function readLogo(): Buffer | null {
  try {
    return existsSync(LOGO_ABS) ? readFileSync(LOGO_ABS) : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/image/logo-overlay.test.ts`
Expected: PASS (2 tests). Then `npx tsc --noEmit` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/image/logo-store.ts src/lib/image/logo-overlay.ts src/lib/image/logo-overlay.test.ts
git commit -m "feat(image): brand logo store + top-right overlay (sharp)"
```

---

### Task 2: API caricamento logo

**Files:**
- Create: `src/app/api/brand/logo/route.ts`

**Interfaces:**
- Consumes: `saveLogo`, `hasLogo` (Task 1)
- Produces: `POST /api/brand/logo` body `{ dataUrl: string }` (data URL PNG/JPEG) → `{ ok: true }`; `GET /api/brand/logo` → `{ exists: boolean }`

- [ ] **Step 1: Implement the route** — `src/app/api/brand/logo/route.ts`

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { saveLogo, hasLogo } from "@/lib/image/logo-store";

const schema = z.object({ dataUrl: z.string().min(1) });

export async function GET() {
  return NextResponse.json({ exists: hasLogo() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const m = parsed.data.dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return NextResponse.json({ error: "Formato immagine non valido (serve PNG/JPEG data URL)" }, { status: 400 });
  const bytes = Buffer.from(m[2], "base64");
  saveLogo(bytes);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/brand/logo/route.ts
git commit -m "feat(api): brand logo upload/exists endpoint"
```

---

### Task 3: Colore dominante del prodotto

**Files:**
- Create: `src/lib/image/product-color.ts`
- Create: `src/lib/image/product-color.test.ts`

**Interfaces:**
- Produces: `dominantColorHex(imageBuf: Buffer): Promise<string | null>` — ritorna `#rrggbb` o null.

- [ ] **Step 1: Write the failing test** — `src/lib/image/product-color.test.ts`

```ts
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { dominantColorHex } from "@/lib/image/product-color";

describe("dominantColorHex", () => {
  it("returns the hex of a solid-colour image", async () => {
    const buf = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 20, b: 120 } } }).png().toBuffer();
    const hex = await dominantColorHex(buf);
    expect(hex).toBe("#c81478");
  });
  it("returns null on invalid input", async () => {
    expect(await dominantColorHex(Buffer.from("notanimage"))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/image/product-color.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `product-color.ts`**

```ts
import sharp from "sharp";

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

/** Dominant colour of an image as #rrggbb, via sharp's dominant stat. Null on failure. */
export async function dominantColorHex(imageBuf: Buffer): Promise<string | null> {
  try {
    const { dominant } = await sharp(imageBuf).stats();
    if (!dominant) return null;
    return `#${toHex(dominant.r)}${toHex(dominant.g)}${toHex(dominant.b)}`;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/image/product-color.test.ts`
Expected: PASS. (If sharp's `dominant` rounds to `#c81478` differently, adjust the expected value to sharp's actual output — run once and lock it in.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/image/product-color.ts src/lib/image/product-color.test.ts
git commit -m "feat(image): dominant product colour extraction"
```

---

### Task 4: Copy AI per l'immagine (schema + prompt)

**Files:**
- Create: `src/lib/image/social-copy.ts`
- Create: `src/lib/image/social-copy.test.ts`

**Interfaces:**
- Produces:
  - `socialCopySchema` (zod) → `{ titolo: string; bullets: string[] }`
  - `buildSocialCopyPrompt(args: { titoloIdea: string; testo: string; productName?: string | null }): string`
  - type `SocialCopy = { titolo: string; bullets: string[] }`

- [ ] **Step 1: Write the failing test** — `src/lib/image/social-copy.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { socialCopySchema, buildSocialCopyPrompt } from "@/lib/image/social-copy";

describe("socialCopySchema", () => {
  it("accepts a title and up to 3 bullets", () => {
    const v = socialCopySchema.parse({ titolo: "Biotina", bullets: ["Capelli", "Pelle", "Unghie"] });
    expect(v.bullets).toHaveLength(3);
  });
  it("caps bullets at 3", () => {
    const v = socialCopySchema.parse({ titolo: "X", bullets: ["a", "b", "c", "d", "e"] });
    expect(v.bullets).toHaveLength(3);
  });
});

describe("buildSocialCopyPrompt", () => {
  it("asks for a short italian title and bullets and mentions the product", () => {
    const p = buildSocialCopyPrompt({ titoloIdea: "Biotina per capelli", testo: "benefici", productName: "Biotina Complex 360" });
    expect(p).toContain("Biotina Complex 360");
    expect(p.toLowerCase()).toContain("italiano");
    expect(p).toContain("titolo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/image/social-copy.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `social-copy.ts`**

```ts
import { z } from "zod";

export const socialCopySchema = z.object({
  titolo: z.string().min(1),
  bullets: z.array(z.string().min(1)).transform((b) => b.slice(0, 3)),
});
export type SocialCopy = z.infer<typeof socialCopySchema>;

/** Prompt for Claude to synthesize very short in-image copy (title + up to 3 bullets), in Italian. */
export function buildSocialCopyPrompt(args: { titoloIdea: string; testo: string; productName?: string | null }): string {
  return `Sei un copywriter per social. Genera testi BREVISSIMI in ITALIANO da inserire in un'immagine social.
Idea: ${args.titoloIdea}
Contenuto: ${args.testo}
${args.productName ? `Prodotto: ${args.productName}` : ""}
Regole: 1 "titolo" di massimo 5 parole; "bullets" = massimo 3 voci, ognuna 2-4 parole, concrete e leggibili.
Nessun claim medico, nessun competitor. Rispondi SOLO con JSON: {"titolo":"...","bullets":["...","...","..."]}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/image/social-copy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/image/social-copy.ts src/lib/image/social-copy.test.ts
git commit -m "feat(image): social copy schema + Claude prompt for in-image texts"
```

---

### Task 5: Prompt "post brandizzato" (template)

**Files:**
- Create: `src/lib/image/social-template.ts`
- Create: `src/lib/image/social-template.test.ts`

**Interfaces:**
- Consumes: `SocialCopy` (Task 4)
- Produces: `buildSocialTemplatePrompt(args: SocialTemplateArgs): string` where
  `SocialTemplateArgs = { variant: "MAIN" | "SECONDARY"; influencer: boolean; productName?: string | null; hasMockup: boolean; accentHex?: string | null; copy?: { titolo: string; bullets: string[] } | null; brandVisual?: string | null }`

- [ ] **Step 1: Write the failing test** — `src/lib/image/social-template.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildSocialTemplatePrompt } from "@/lib/image/social-template";

const base = { productName: "Biotina Complex 360", hasMockup: true } as const;

describe("buildSocialTemplatePrompt", () => {
  it("adds a real person only when influencer is true", () => {
    const withInf = buildSocialTemplatePrompt({ ...base, variant: "MAIN", influencer: true });
    const without = buildSocialTemplatePrompt({ ...base, variant: "MAIN", influencer: false });
    expect(withInf).toContain("influencer");
    expect(without).not.toContain("influencer");
    expect(without.toLowerCase()).toContain("nessuna persona");
  });
  it("uses the accent colour when provided", () => {
    const p = buildSocialTemplatePrompt({ ...base, variant: "MAIN", influencer: false, accentHex: "#c81478" });
    expect(p).toContain("#c81478");
  });
  it("renders the copy title/bullets when provided, else forbids text", () => {
    const withCopy = buildSocialTemplatePrompt({ ...base, variant: "MAIN", influencer: false, copy: { titolo: "3 Peculiarità", bullets: ["Capelli", "Pelle"] } });
    expect(withCopy).toContain("3 Peculiarità");
    expect(withCopy).toContain("Capelli");
    const noCopy = buildSocialTemplatePrompt({ ...base, variant: "SECONDARY", influencer: false });
    expect(noCopy.toLowerCase()).toContain("nessun testo");
  });
  it("MAIN is richer than SECONDARY", () => {
    const main = buildSocialTemplatePrompt({ ...base, variant: "MAIN", influencer: false });
    const sec = buildSocialTemplatePrompt({ ...base, variant: "SECONDARY", influencer: false });
    expect(main).toContain("titolo grande");
    expect(sec).toContain("sobria");
  });
  it("always forbids collage and fake brands", () => {
    const p = buildSocialTemplatePrompt({ ...base, variant: "MAIN", influencer: false });
    expect(p.toLowerCase()).toContain("non un collage");
    expect(p.toLowerCase()).toContain("nessun logo inventato");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/image/social-template.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `social-template.ts`**

```ts
export interface SocialTemplateArgs {
  variant: "MAIN" | "SECONDARY";
  influencer: boolean;
  productName?: string | null;
  hasMockup: boolean;
  accentHex?: string | null;
  copy?: { titolo: string; bullets: string[] } | null;
  brandVisual?: string | null;
}

export function buildSocialTemplatePrompt(args: SocialTemplateArgs): string {
  const accent = args.accentHex?.trim()
    ? `Palette costruita attorno al colore del prodotto ${args.accentHex.trim()} (usalo come colore dominante di sfondo/accenti).`
    : "Palette pulita e naturale coerente col brand.";
  const person = args.influencer
    ? "Includi un influencer/persona reale, sorridente, che tiene il prodotto in mano in modo naturale (stile UGC premium)."
    : "NESSUNA persona, nessun volto: composizione grafica elegante del prodotto (packshot) con forme, icone e spazio.";
  const product = args.hasMockup
    ? "Usa il prodotto fornito come riferimento ESATTO del packaging: identico a etichetta, colori, logo e testo; non ridisegnarlo."
    : "";
  const richness =
    args.variant === "MAIN"
      ? "Layout ricco: titolo grande e leggibile in alto, prodotto in evidenza, eventuali icone circolari con brevi benefici."
      : "Layout sobria e minimale: un solo concetto, meno elementi, molto respiro.";
  const copyBlock = args.copy
    ? `Testi da inserire nell'immagine (leggibili, italiano): titolo "${args.copy.titolo}"; punti: ${args.copy.bullets.map((b) => `"${b}"`).join(", ")}.`
    : "Nessun testo, scritte o lettere nell'immagine.";
  const brand = args.brandVisual?.trim() ? `Stile visivo del brand: ${args.brandVisual.trim()}.` : "";
  return [
    "Crea un'immagine grafica premium per un post Instagram/Facebook del brand di integratori AGOCAP. Pronta da pubblicare.",
    args.productName ? `Prodotto: ${args.productName}.` : "",
    product,
    person,
    richness,
    accent,
    copyBlock,
    brand,
    "Genera UNA sola immagine, una sola scena: NON un collage, NON una griglia, NON slide multiple.",
    "Non inventare marchi o loghi falsi: nessun logo inventato (il logo reale sarà aggiunto a parte). Fotorealistico e pulito.",
  ]
    .filter((s) => s && s.trim())
    .join(" ");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/image/social-template.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/image/social-template.ts src/lib/image/social-template.test.ts
git commit -m "feat(image): branded social template prompt (influencer opt-in, accent colour, copy)"
```

---

### Task 6: Integrazione runtime + generate.ts + input schema + meta route

**Files:**
- Modify: `src/lib/image/generate.ts` (ImageGenInput, ImageDeps, flusso)
- Modify: `src/lib/image/runtime.ts` (nuove deps: loadLogo, overlayLogo, dominantColor, resolveSocialCopy)
- Modify: `src/app/api/meta/validators.ts` (imageInputSchema)
- Modify: `src/app/api/meta/contents/[id]/image/route.ts` (passa i nuovi campi + `social: true`)
- Modify: `src/lib/image/generate.test.ts` (aggiorna deps mock)

**Interfaces:**
- Consumes: `buildSocialTemplatePrompt` (T5), `socialCopySchema`/`buildSocialCopyPrompt` (T4), `dominantColorHex` (T3), `readLogo`/`hasLogo` (T1), `overlayLogo` (T1).
- Produces: `ImageGenInput` con `includiDescrizione?`, `includiLogo?`, `influencer?`, `social?`.

- [ ] **Step 1: Extend `ImageGenInput`** in `src/lib/image/generate.ts` (after `headline?: string;`):

```ts
  headline?: string;
  /** Meta-only: use the branded social template prompt + toggles below. */
  social?: boolean;
  includiDescrizione?: boolean;
  includiLogo?: boolean;
  influencer?: boolean;
```

- [ ] **Step 2: Extend `ImageDeps`** in the same file (add after `loadProduct?`):

```ts
  resolveSocialCopy?: (contentId: string, slideIndex: number | null, productName?: string | null) => Promise<{ titolo: string; bullets: string[] } | null>;
  dominantColor?: (imageBuf: Buffer) => Promise<string | null>;
  loadLogo?: () => Buffer | null;
  overlayLogo?: (imageBuf: Buffer, logoBuf: Buffer) => Promise<Buffer>;
```

- [ ] **Step 3: Add imports + branch** in `generate.ts`. Add import near the top:

```ts
import { buildSocialTemplatePrompt } from "./social-template";
```

Replace the GPT-archetype `if (provider === "GPT" && product)` branch so the social template wins for Meta. New prompt-selection block:

```ts
    let prompt: string;
    if (input.social && provider === "GPT") {
      const accentHex = mockup && deps.dominantColor ? await deps.dominantColor(mockup) : null;
      const copy =
        input.includiDescrizione && deps.resolveSocialCopy
          ? await deps.resolveSocialCopy(input.contentId, input.slideIndex, product?.nome ?? null)
          : null;
      prompt = buildSocialTemplatePrompt({
        variant: (input.slideIndex ?? 0) === 0 ? "MAIN" : "SECONDARY",
        influencer: !!input.influencer,
        productName: product?.nome ?? null,
        hasMockup: !!mockup,
        accentHex,
        copy,
        brandVisual,
      });
    } else if (provider === "GPT" && product) {
      prompt = buildArchetypePrompt(input.archetype ?? "ADV", {
        product, brandVisual, brief: input.brief, hasMockup: !!mockup,
        headline: input.headline, formato: input.brief?.formato,
        ideaCreativa: slideText ? cleanSlide(slideText) : ideaCreativa,
      }).full;
    } else if (input.brief && !isBriefEmpty(input.brief)) {
      prompt = buildImagePromptFromBrief(input.brief, { provider, hasMockup: !!mockup, fallback, brandVisual });
    } else {
      prompt = buildImagePrompt({ ideaCreativa, slideText, hasMockup: !!mockup, brandVisual });
    }
```

- [ ] **Step 4: Overlay logo after generation** in `generate.ts`. Replace the persist section:

```ts
    let bytes = await deps.callOpenAI(prompt, mockup ?? undefined, provider, { styleId, soulSize, openaiSize, customReferenceId });
    if (input.includiLogo && deps.loadLogo && deps.overlayLogo) {
      const logo = deps.loadLogo();
      if (logo) bytes = await deps.overlayLogo(bytes, logo);
    }
    const { assetId } = await deps.persistAsset({ input, prompt, bytes });
    return { status: "DONE", assetId };
```

- [ ] **Step 5: Implement runtime deps** in `src/lib/image/runtime.ts`. Add imports at top:

```ts
import { readLogo } from "./logo-store";
import { overlayLogo } from "./logo-overlay";
import { dominantColorHex } from "./product-color";
import { socialCopySchema, buildSocialCopyPrompt } from "./social-copy";
import { getClaude, BRAINSTORM_MODEL } from "@/lib/claude";
import { stripFences } from "@/lib/meta/runtime";
import { scrubCompetitors } from "@/lib/blog/competitors";
```

Add to the object returned by `sharedImageDeps()`:

```ts
    loadLogo: () => readLogo(),
    overlayLogo: (imageBuf, logoBuf) => overlayLogo(imageBuf, logoBuf),
    dominantColor: (imageBuf) => dominantColorHex(imageBuf),
    resolveSocialCopy: async (contentId, slideIndex, productName) => {
      const content = await prisma.generatedContent.findUnique({ where: { id: contentId }, include: { idea: true } });
      if (!content) return null;
      const payload = (content.payload ?? {}) as { slides?: { testo: string }[]; caption?: string; ideaCreativa?: string };
      const testo = slideIndex != null ? (payload.slides?.[slideIndex]?.testo ?? "") : (payload.caption ?? payload.ideaCreativa ?? "");
      try {
        const claude = getClaude();
        const res = await claude.messages.create({
          model: BRAINSTORM_MODEL,
          max_tokens: 500,
          messages: [{ role: "user", content: buildSocialCopyPrompt({ titoloIdea: content.idea?.titolo ?? "", testo, productName }) }],
        });
        const block = res.content.find((b) => b.type === "text");
        if (!block || block.type !== "text") return null;
        const parsed = socialCopySchema.parse(JSON.parse(stripFences(block.text)));
        return { titolo: scrubCompetitors(parsed.titolo), bullets: parsed.bullets.map(scrubCompetitors) };
      } catch {
        return null;
      }
    },
```

Note: `stripFences` is exported from `@/lib/meta/runtime` (already used elsewhere). If a circular import arises, copy the 3-line `stripFences` locally into `runtime.ts` instead of importing.

- [ ] **Step 6: Extend `imageInputSchema`** in `src/app/api/meta/validators.ts` (inside the `z.object({...})`):

```ts
  headline: z.string().optional(),
  social: z.boolean().optional(),
  includiDescrizione: z.boolean().optional(),
  includiLogo: z.boolean().optional(),
  influencer: z.boolean().optional(),
```

- [ ] **Step 7: Pass new fields in the Meta image route** — `src/app/api/meta/contents/[id]/image/route.ts`, extend the `run({...})` call:

```ts
  const result = await run({ contentId: id, slideIndex, productId: parsed.data.productId, useMockup: parsed.data.useMockup, provider: parsed.data.provider, brief: parsed.data.brief, styleId: parsed.data.styleId, ideaCreativa: parsed.data.ideaCreativa, archetype: parsed.data.archetype, headline: parsed.data.headline, social: true, includiDescrizione: parsed.data.includiDescrizione, includiLogo: parsed.data.includiLogo, influencer: parsed.data.influencer }, deps);
```

- [ ] **Step 8: Update `generate.test.ts` deps mock** so existing tests keep passing. In `makeDeps`, add:

```ts
    dominantColor: vi.fn().mockResolvedValue("#c81478"),
    loadLogo: vi.fn().mockReturnValue(null),
    overlayLogo: vi.fn(async (b: Buffer) => b),
    resolveSocialCopy: vi.fn().mockResolvedValue({ titolo: "T", bullets: ["a"] }),
```

Add a new test:

```ts
  it("uses the branded social template for Meta (social=true) and overlays the logo when requested", async () => {
    const logo = Buffer.from("logo");
    const deps = makeDeps({ loadProduct: vi.fn().mockResolvedValue({ nome: "Biotina" }), loadMockup: vi.fn().mockResolvedValue(Buffer.from("m")), loadLogo: vi.fn().mockReturnValue(logo), overlayLogo: vi.fn(async () => Buffer.from("withlogo")) });
    const res = await generateImageAsset({ contentId: "c1", slideIndex: 0, productId: "p1", social: true, includiLogo: true, influencer: false }, deps as any);
    expect(res.status).toBe("DONE");
    const prompt = (deps.callOpenAI as any).mock.calls[0][0] as string;
    expect(prompt).toContain("AGOCAP");
    expect(deps.overlayLogo).toHaveBeenCalled();
    expect((deps.persistAsset as any).mock.calls[0][0].bytes.toString()).toBe("withlogo");
  });
```

- [ ] **Step 9: Run tests + typecheck**

Run: `npx vitest run src/lib/image/ && npx tsc --noEmit`
Expected: all image tests PASS; tsc exit 0.

- [ ] **Step 10: Commit**

```bash
git add src/lib/image/generate.ts src/lib/image/runtime.ts src/app/api/meta/validators.ts "src/app/api/meta/contents/[id]/image/route.ts" src/lib/image/generate.test.ts
git commit -m "feat(image): wire branded social template + toggles + logo overlay into Meta image generation"
```

---

### Task 7: UI Meta — spunte per immagine + caricamento logo

**Files:**
- Modify: `src/app/meta/[id]/page.tsx`
- Create: `src/components/logo-uploader.tsx`

**Interfaces:**
- Consumes: `POST/GET /api/brand/logo` (T2), i campi `includiDescrizione`/`includiLogo`/`influencer` inviati a `/api/meta/contents/[id]/image` (T6).

- [ ] **Step 1: Create `src/components/logo-uploader.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";

export function LogoUploader() {
  const [exists, setExists] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/brand/logo").then((r) => r.json()).then((d) => setExists(!!d.exists)).catch(() => setExists(false)); }, []);
  const upload = async (file: File) => {
    setBusy(true);
    const dataUrl = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file); });
    const r = await fetch("/api/brand/logo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dataUrl }) });
    setBusy(false);
    if (r.ok) setExists(true);
  };
  return (
    <div className="text-xs text-ink-soft">
      Logo brand: {exists ? "✓ caricato" : "non caricato"}{" "}
      <label className="cursor-pointer underline">
        {busy ? "carico…" : exists ? "sostituisci" : "carica"}
        <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Extend per-image state** in `src/app/meta/[id]/page.tsx`. Add a separate state map for the new toggles (keeps `ProductMockupValue` untouched):

```tsx
  const [imgOpts, setImgOpts] = useState<Record<string, { includiDescrizione: boolean; includiLogo: boolean; influencer: boolean }>>({});
  const optsFor = (slideIndex: number | null) => imgOpts[keyFor(slideIndex)] ?? { includiDescrizione: false, includiLogo: false, influencer: false };
  const setOptsFor = (slideIndex: number | null, patchObj: Partial<{ includiDescrizione: boolean; includiLogo: boolean; influencer: boolean }>) =>
    setImgOpts((m) => ({ ...m, [keyFor(slideIndex)]: { ...optsFor(slideIndex), ...patchObj } }));
```

- [ ] **Step 3: Send the new flags in `genImage`.** In the `body: JSON.stringify({...})` of `genImage`, append:

```tsx
        includiDescrizione: optsFor(slideIndex).includiDescrizione,
        includiLogo: optsFor(slideIndex).includiLogo,
        influencer: optsFor(slideIndex).influencer,
```

- [ ] **Step 4: Render the checkboxes** next to each generate button (both the main image block and the per-slide block). Add this helper JSX before each `Genera immagine` button, using the right `slideIndex` (`null` for main, `idx` for slides):

```tsx
        <div className="mb-2 flex flex-wrap gap-3 text-xs">
          <label className="flex items-center gap-1"><input type="checkbox" checked={optsFor(SLIDE).includiDescrizione} onChange={(e) => setOptsFor(SLIDE, { includiDescrizione: e.target.checked })} /> Includi descrizione</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={optsFor(SLIDE).includiLogo} onChange={(e) => setOptsFor(SLIDE, { includiLogo: e.target.checked })} /> Includi logo</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={optsFor(SLIDE).influencer} onChange={(e) => setOptsFor(SLIDE, { influencer: e.target.checked })} /> Influencer (UGC)</label>
        </div>
```

Replace `SLIDE` with `null` in the main-image block and with `idx` in the per-slide block.

- [ ] **Step 5: Add the `LogoUploader`** in the "Generatore immagini" header area. Import it:

```tsx
import { LogoUploader } from "@/components/logo-uploader";
```

and render `<LogoUploader />` under the provider select (near line 108).

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc exit 0; build "Compiled successfully". (Do NOT run `npm run build` while `next dev` is running — stop the dev server first to avoid `.next` corruption, then restart it after.)

- [ ] **Step 7: Commit**

```bash
git add src/app/meta/[id]/page.tsx src/components/logo-uploader.tsx
git commit -m "feat(meta-ui): per-image toggles (descrizione/logo/influencer) + brand logo uploader"
```

---

## Self-Review

**Spec coverage:**
- Logo upload/storage/overlay → T1, T2, T7. ✓
- Colore dominante prodotto → T3, used in T6. ✓
- Testi AI → T4, resolved in T6 (runtime). ✓
- Prompt template MAIN/SECONDARY + influencer opt-in → T5, wired T6. ✓
- Spunte per immagine (descrizione/logo/influencer) + default OFF → T6 (schema), T7 (UI). ✓
- Applies to post main + every slide (same engine) → T6 branch uses `slideIndex` for MAIN/SECONDARY; T7 renders toggles on main + slides. ✓
- Solo Meta (gate `input.social`) → T6 route sets `social:true`; blog untouched. ✓
- Logo non dal prompt + accent color + no-collage/no-fake-brand → T5 prompt text. ✓
- Errori: logo assente → nessun overlay (T6 Step 4 guards `if (logo)`); copy AI fallita → null → no text (T6 resolveSocialCopy try/catch); colore fallito → null → fallback palette (T5). ✓

**Placeholder scan:** nessun TBD/TODO; ogni step ha codice reale.

**Type consistency:** `resolveSocialCopy` ritorna `{titolo, bullets}` in T6 coerente con `SocialCopy` (T4) e con `copy` di `SocialTemplateArgs` (T5). `logoPlacement`/`overlayLogo` firme coerenti T1↔T6. `dominantColorHex`→`dominantColor` dep name mapping esplicito in T6 Step 2/5. ✓

**Nota di rischio (non blocca):** il valore esatto atteso in `product-color.test.ts` (`#c81478`) va confermato al primo run (sharp `dominant` può quantizzare); lockare l'output reale.
