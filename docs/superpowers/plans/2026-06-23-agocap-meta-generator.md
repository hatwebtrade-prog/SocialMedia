# Meta Generator (fetta C, parte 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Meta (Instagram/Facebook) content generator to AGOCAP Content AI Hub: from an APPROVED idea, generate an editable POST or CAROSELLO draft (text via Claude), generate images on-demand (via OpenAI `gpt-image-1`), review/approve, and view contents in a list and a monthly calendar. No publishing (that is fetta D).

**Architecture:** Builds on the Brain. A new generic `GeneratedContent` table (channel-tagged, JSON payload) + `GeneratedAsset` table for images. Text generation reuses the Brain's proven Claude pattern (`claude.messages.create` → prompt-enforced JSON → strip fences → zod-validate) with injected dependencies for testing. Image generation is an isolated, swappable `ImageGenerator` (OpenAI SDK) that writes files to a persistent `uploads/` volume, served via an API route. UI is Tailwind client components calling the API.

**Tech Stack:** Next.js 15 (App Router, TS), Prisma + PostgreSQL, `@anthropic-ai/sdk` (`claude-opus-4-8`), `openai` SDK (`gpt-image-1`), Vitest. UI text Italian, code English.

**Branch:** `meta-generator` (already created off the Brain code). A local Postgres is reachable via `.env` `DATABASE_URL` (db `agocap`).

---

## File Structure

```
prisma/schema.prisma                      # + enums, GeneratedContent, GeneratedAsset, Idea relation
src/lib/meta/
  enums.ts                                # CONTENT_FORMATS, CONTENT_STATUSES, CANALI, META_PLATFORMS
  schema.ts                               # zod payload schemas (POST / CAROSELLO) + payloadSchemaFor()
  prompt.ts                               # buildMetaPrompt()
  generate.ts                             # generateMetaContent() pipeline + injected-deps types
  runtime.ts                              # buildMetaDeps() (Claude + Prisma wiring)
src/lib/image/
  openai.ts                               # getOpenAI() + IMAGE_MODEL
  prompt.ts                               # buildImagePrompt()
  generate.ts                             # generateImage() pipeline + injected-deps types
  store.ts                                # saveAssetFile() / asset path helpers
src/app/api/meta/
  generate/route.ts                       # POST  (+ deps-registry.ts seam)
  generate/deps-registry.ts
  contents/route.ts                       # GET list
  contents/[id]/route.ts                  # GET / PATCH / DELETE
  contents/[id]/image/route.ts            # POST generate image (+ deps-registry.ts seam)
  contents/[id]/image/deps-registry.ts
  validators.ts                           # zod: updateContent, generateInput, imageInput
src/app/api/assets/[id]/route.ts          # GET serve image file
src/app/meta/page.tsx                     # Dashboard Meta (list + filters)
src/app/meta/calendario/page.tsx          # Calendar view
src/app/meta/genera/page.tsx              # Generate-from-idea
src/app/meta/[id]/page.tsx                # Content detail / edit
src/components/meta-content-table.tsx     # list client component
src/components/meta-calendar.tsx          # calendar client component
src/components/nav.tsx                     # + "Area Meta" link (modify)
src/app/ideas/[id]/page.tsx               # + "Genera contenuto Meta" button (modify)
Dockerfile, docker-compose.yml, .env.example  # uploads volume + OPENAI_API_KEY (modify)
```

---

## Task 1: Prisma schema — content/asset models + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and models to `prisma/schema.prisma`**

Append these enums (after the existing `RunStatus` enum):
```prisma
enum Canale {
  META
  TIKTOK
  BLOG
}

enum ContentFormat {
  POST
  CAROSELLO
}

enum ContentStatus {
  BOZZA
  DA_APPROVARE
  APPROVATO
  PROGRAMMATO
  PUBBLICATO
}

enum AssetType {
  IMMAGINE
  VIDEO
}
```

Add these two models (after the `Idea` model):
```prisma
model GeneratedContent {
  id            String          @id @default(cuid())
  ideaId        String
  idea          Idea            @relation(fields: [ideaId], references: [id], onDelete: Cascade)
  canale        Canale
  formato       ContentFormat
  piattaforme   Platform[]      @default([])
  status        ContentStatus   @default(BOZZA)
  dataPrevista  DateTime?
  payload       Json            @default("{}")
  promptUsato   String          @default("")
  modello       String          @default("")
  inputTokens   Int             @default(0)
  outputTokens  Int             @default(0)
  outputGrezzo  Json            @default("{}")
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  assets        GeneratedAsset[]

  @@index([status])
  @@index([canale])
  @@index([dataPrevista])
  @@index([ideaId])
}

model GeneratedAsset {
  id         String           @id @default(cuid())
  contentId  String
  content    GeneratedContent @relation(fields: [contentId], references: [id], onDelete: Cascade)
  slideIndex Int?
  tipo       AssetType        @default(IMMAGINE)
  prompt     String           @default("")
  modello    String           @default("")
  path       String
  createdAt  DateTime         @default(now())

  @@index([contentId])
}
```

Add the inverse relation field to the existing `Idea` model (inside the `model Idea { ... }` block, alongside the other relation fields):
```prisma
  contenuti              GeneratedContent[]
```

- [ ] **Step 2: Validate the schema**

Run: `npx prisma validate`
Expected: "The schema at prisma\schema.prisma is valid".

- [ ] **Step 3: Create and apply the migration**

Run: `npx prisma migrate dev --name meta_content`
Expected: creates `prisma/migrations/<ts>_meta_content/` and applies it; "Your database is now in sync". If the DB is unreachable, report BLOCKED with the exact error.

- [ ] **Step 4: Regenerate the client**

Run: `npx prisma generate`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: GeneratedContent + GeneratedAsset models and migration"
```

---

## Task 2: Meta enums + payload zod schema

**Files:**
- Create: `src/lib/meta/enums.ts`, `src/lib/meta/schema.ts`
- Test: `src/lib/meta/schema.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/meta/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { payloadSchemaFor } from "@/lib/meta/schema";

describe("payloadSchemaFor", () => {
  it("validates a POST payload", () => {
    const v = payloadSchemaFor("POST").parse({
      caption: "Caption di prova",
      ideaCreativa: "Foto del prodotto su sfondo naturale",
      hashtags: ["#magnesio", "#benessere"],
      cta: "Scopri di più",
    });
    expect(v.caption).toBe("Caption di prova");
  });

  it("requires 3-10 slides for CAROSELLO", () => {
    const schema = payloadSchemaFor("CAROSELLO");
    expect(() =>
      schema.parse({ caption: "c", ideaCreativa: "i", hashtags: [], cta: "x", slides: [{ testo: "a" }] }),
    ).toThrow();
    const ok = schema.parse({
      caption: "c", ideaCreativa: "i", hashtags: [], cta: "x",
      slides: [{ testo: "1" }, { testo: "2" }, { testo: "3" }],
    });
    expect(ok.slides).toHaveLength(3);
  });

  it("rejects a POST payload missing caption", () => {
    expect(() => payloadSchemaFor("POST").parse({ ideaCreativa: "i", hashtags: [], cta: "x" })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/meta/schema.test.ts`
Expected: FAIL — cannot resolve `@/lib/meta/schema`.

- [ ] **Step 3: Create the enums module**

`src/lib/meta/enums.ts`:
```ts
export const CANALI = ["META", "TIKTOK", "BLOG"] as const;
export const CONTENT_FORMATS = ["POST", "CAROSELLO"] as const;
export const CONTENT_STATUSES = ["BOZZA", "DA_APPROVARE", "APPROVATO", "PROGRAMMATO", "PUBBLICATO"] as const;
// Meta targets reuse the Platform enum values relevant to Meta
export const META_PLATFORMS = ["INSTAGRAM", "FACEBOOK"] as const;

export type ContentFormatValue = (typeof CONTENT_FORMATS)[number];
export type ContentStatusValue = (typeof CONTENT_STATUSES)[number];
export type MetaPlatformValue = (typeof META_PLATFORMS)[number];
```

- [ ] **Step 4: Create the payload schema module**

`src/lib/meta/schema.ts`:
```ts
import { z } from "zod";
import type { ContentFormatValue } from "./enums";

export const postPayloadSchema = z.object({
  caption: z.string().min(1),
  ideaCreativa: z.string().min(1),
  hashtags: z.array(z.string()),
  cta: z.string(),
});

export const caroselloPayloadSchema = postPayloadSchema.extend({
  slides: z.array(z.object({ testo: z.string().min(1) })).min(3).max(10),
});

export function payloadSchemaFor(formato: ContentFormatValue) {
  return formato === "CAROSELLO" ? caroselloPayloadSchema : postPayloadSchema;
}

export type PostPayload = z.infer<typeof postPayloadSchema>;
export type CaroselloPayload = z.infer<typeof caroselloPayloadSchema>;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/meta/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/meta/enums.ts src/lib/meta/schema.ts src/lib/meta/schema.test.ts
git commit -m "feat: Meta content enums and payload zod schemas"
```

---

## Task 3: Meta prompt builder

**Files:**
- Create: `src/lib/meta/prompt.ts`
- Test: `src/lib/meta/prompt.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/meta/prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildMetaPrompt } from "@/lib/meta/prompt";

describe("buildMetaPrompt", () => {
  it("includes the idea, KB context, platforms, and POST fields", () => {
    const p = buildMetaPrompt({
      kbContext: "## Prodotti Agocap\n- Magnesio Supremo",
      idea: { titolo: "Magnesio e sonno", descrizione: "Educational sul magnesio", category: "EDUCATIONAL" },
      formato: "POST",
      piattaforme: ["INSTAGRAM"],
    });
    expect(p).toContain("Magnesio e sonno");
    expect(p).toContain("Magnesio Supremo");
    expect(p.toLowerCase()).toContain("instagram");
    expect(p.toLowerCase()).toContain("caption");
  });

  it("asks for the requested number of slides for CAROSELLO", () => {
    const p = buildMetaPrompt({
      kbContext: "x",
      idea: { titolo: "t", descrizione: "d", category: "BEAUTY" },
      formato: "CAROSELLO",
      piattaforme: ["INSTAGRAM", "FACEBOOK"],
      numeroSlide: 6,
    });
    expect(p.toLowerCase()).toContain("slide");
    expect(p).toContain("6");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/meta/prompt.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement the prompt builder**

`src/lib/meta/prompt.ts`:
```ts
import type { ContentFormatValue, MetaPlatformValue } from "./enums";

export interface MetaPromptIdea {
  titolo: string;
  descrizione: string;
  category: string;
}

export interface MetaPromptArgs {
  kbContext: string;
  idea: MetaPromptIdea;
  formato: ContentFormatValue;
  piattaforme: MetaPlatformValue[];
  numeroSlide?: number;
}

export function buildMetaPrompt(args: MetaPromptArgs): string {
  const { kbContext, idea, formato, piattaforme, numeroSlide = 5 } = args;
  const piattaformeTxt = piattaforme.join(" e ");

  const campiPost = `- caption: testo del post (italiano), coerente col tono di voce
- ideaCreativa: descrizione del concept visivo (cosa mostrare nell'immagine)
- hashtags: array di hashtag pertinenti
- cta: call to action`;

  const campi =
    formato === "CAROSELLO"
      ? `${campiPost}
- slides: array di esattamente ${numeroSlide} slide, ognuna { "testo": "..." } (testo della slide)`
      : campiPost;

  const forma =
    formato === "CAROSELLO"
      ? `{"caption":"...","ideaCreativa":"...","hashtags":["..."],"cta":"...","slides":[{"testo":"..."}]}`
      : `{"caption":"...","ideaCreativa":"...","hashtags":["..."],"cta":"..."}`;

  return `Sei un social media specialist per Agocap (integratori, benessere, beauty, salute naturale).

Crea un contenuto ${formato} per ${piattaformeTxt}, partendo da questa idea approvata:
Titolo: ${idea.titolo}
Descrizione: ${idea.descrizione}
Categoria: ${idea.category}

# Knowledge base Agocap (tono di voce, prodotti)
${kbContext}

# Campi richiesti
${campi}

Rispondi esclusivamente con un oggetto JSON valido della forma ${forma}, senza testo prima o dopo, senza markdown.`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/meta/prompt.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/meta/prompt.ts src/lib/meta/prompt.test.ts
git commit -m "feat: Meta prompt builder"
```

---

## Task 4: Meta text-generation pipeline (Claude mocked)

**Files:**
- Create: `src/lib/meta/generate.ts`
- Test: `src/lib/meta/generate.test.ts`

This mirrors the Brain's `runBrainstorm`: a fail-safe pipeline with injected deps. On any failure it returns `{status:"ERROR"}` and creates no content.

- [ ] **Step 1: Write the failing test**

`src/lib/meta/generate.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { generateMetaContent } from "@/lib/meta/generate";

function makeDeps(overrides = {}) {
  return {
    loadContext: vi.fn().mockResolvedValue({
      idea: { titolo: "T", descrizione: "D", category: "EDUCATIONAL" },
      kbContext: "kb",
    }),
    callClaude: vi.fn().mockResolvedValue({
      payload: { caption: "c", ideaCreativa: "i", hashtags: ["#x"], cta: "vai" },
      promptUsato: "P",
      modello: "claude-opus-4-8",
      inputTokens: 10,
      outputTokens: 20,
      rawOutput: { any: "thing" },
    }),
    persist: vi.fn().mockResolvedValue({ contentId: "content_1" }),
    ...overrides,
  };
}

describe("generateMetaContent", () => {
  it("returns DONE with the new content id on success", async () => {
    const deps = makeDeps();
    const res = await generateMetaContent(
      { ideaId: "idea_1", formato: "POST", piattaforme: ["INSTAGRAM"] },
      deps as any,
    );
    expect(res.status).toBe("DONE");
    expect(res.contentId).toBe("content_1");
    expect(deps.persist).toHaveBeenCalledOnce();
  });

  it("returns ERROR and persists nothing when Claude throws", async () => {
    const deps = makeDeps({ callClaude: vi.fn().mockRejectedValue(new Error("API down")) });
    const res = await generateMetaContent(
      { ideaId: "idea_1", formato: "POST", piattaforme: ["INSTAGRAM"] },
      deps as any,
    );
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("API down");
    expect(deps.persist).not.toHaveBeenCalled();
  });

  it("returns ERROR when the idea is not approved (loadContext throws)", async () => {
    const deps = makeDeps({ loadContext: vi.fn().mockRejectedValue(new Error("Idea non approvata")) });
    const res = await generateMetaContent(
      { ideaId: "idea_1", formato: "POST", piattaforme: ["INSTAGRAM"] },
      deps as any,
    );
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("non approvata");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/meta/generate.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement the pipeline**

`src/lib/meta/generate.ts`:
```ts
import type { ContentFormatValue, MetaPlatformValue } from "./enums";
import type { MetaPromptIdea } from "./prompt";

export interface MetaGenInput {
  ideaId: string;
  formato: ContentFormatValue;
  piattaforme: MetaPlatformValue[];
  numeroSlide?: number;
}

export interface MetaClaudeResult {
  payload: object;
  promptUsato: string;
  modello: string;
  inputTokens: number;
  outputTokens: number;
  rawOutput: unknown;
}

export interface MetaDeps {
  loadContext: (ideaId: string) => Promise<{ idea: MetaPromptIdea; kbContext: string }>;
  callClaude: (args: {
    idea: MetaPromptIdea;
    kbContext: string;
    input: MetaGenInput;
  }) => Promise<MetaClaudeResult>;
  persist: (args: {
    input: MetaGenInput;
    result: MetaClaudeResult;
  }) => Promise<{ contentId: string }>;
}

export interface MetaGenResult {
  status: "DONE" | "ERROR";
  contentId?: string;
  error?: string;
}

export async function generateMetaContent(
  input: MetaGenInput,
  deps: MetaDeps,
): Promise<MetaGenResult> {
  try {
    const { idea, kbContext } = await deps.loadContext(input.ideaId);
    const result = await deps.callClaude({ idea, kbContext, input });
    const { contentId } = await deps.persist({ input, result });
    return { status: "DONE", contentId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/meta/generate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/meta/generate.ts src/lib/meta/generate.test.ts
git commit -m "feat: Meta text-generation pipeline (injected deps, fail-safe)"
```

---

## Task 5: Runtime wiring for Meta text (Claude + Prisma)

**Files:**
- Create: `src/lib/meta/runtime.ts`
- Test: `src/lib/meta/runtime.test.ts`

Reuses the Brain's proven Claude call (`claude.messages.create` → JSON-only → strip fences → zod). Unit-test only the pure helper `stripFences`; the Claude/Prisma wiring is exercised in the end-to-end smoke test (Task 12).

- [ ] **Step 1: Write the failing test**

`src/lib/meta/runtime.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { stripFences } from "@/lib/meta/runtime";

describe("stripFences", () => {
  it("removes ```json fences and trims", () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("returns plain JSON unchanged", () => {
    expect(stripFences('{"a":1}')).toBe('{"a":1}');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/meta/runtime.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement the runtime deps**

`src/lib/meta/runtime.ts`:
```ts
import { prisma } from "@/lib/prisma";
import { getClaude, BRAINSTORM_MODEL } from "@/lib/claude";
import { buildKbContext } from "@/lib/brain/context";
import { buildMetaPrompt } from "./prompt";
import { payloadSchemaFor } from "./schema";
import type { MetaDeps, MetaClaudeResult } from "./generate";

export function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

export function buildMetaDeps(): MetaDeps {
  return {
    loadContext: async (ideaId: string) => {
      const idea = await prisma.idea.findUnique({
        where: { id: ideaId },
        include: { product: true },
      });
      if (!idea) throw new Error("Idea non trovata");
      if (idea.status !== "APPROVATA") throw new Error("Idea non approvata: genera solo da idee APPROVATA");

      const knowledge = await prisma.knowledgeItem.findMany();
      const products = idea.product ? [idea.product] : [];
      const kbContext = buildKbContext({ products, knowledge });
      return {
        idea: { titolo: idea.titolo, descrizione: idea.descrizione, category: idea.category },
        kbContext,
      };
    },

    callClaude: async ({ idea, kbContext, input }): Promise<MetaClaudeResult> => {
      const prompt = buildMetaPrompt({
        kbContext,
        idea,
        formato: input.formato,
        piattaforme: input.piattaforme,
        numeroSlide: input.numeroSlide,
      });
      const claude = getClaude();
      const response = await claude.messages.create({
        model: BRAINSTORM_MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Output AI non conforme");
      }
      const raw = JSON.parse(stripFences(textBlock.text));
      const payload = payloadSchemaFor(input.formato).parse(raw);
      return {
        payload,
        promptUsato: prompt,
        modello: BRAINSTORM_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        rawOutput: response.content,
      };
    },

    persist: async ({ input, result }) => {
      const content = await prisma.generatedContent.create({
        data: {
          ideaId: input.ideaId,
          canale: "META",
          formato: input.formato,
          piattaforme: input.piattaforme,
          status: "BOZZA",
          payload: result.payload as object,
          promptUsato: result.promptUsato,
          modello: result.modello,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          outputGrezzo: (result.rawOutput ?? {}) as object,
        },
      });
      return { contentId: content.id };
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass + typecheck**

Run: `npx vitest run src/lib/meta/runtime.test.ts && npx tsc --noEmit`
Expected: 2 tests PASS; tsc exits 0. If tsc reports `idea.category` is an enum not a string, map it with `String(idea.category)` in `loadContext` and re-run.

- [ ] **Step 5: Commit**

```bash
git add src/lib/meta/runtime.ts src/lib/meta/runtime.test.ts
git commit -m "feat: Meta runtime deps (Claude JSON + Prisma persistence)"
```

---

## Task 6: Image generator (OpenAI) + image prompt builder

**Files:**
- Create: `src/lib/image/openai.ts`, `src/lib/image/prompt.ts`, `src/lib/image/generate.ts`
- Test: `src/lib/image/prompt.test.ts`, `src/lib/image/generate.test.ts`
- Modify: `package.json` (add `openai`)

- [ ] **Step 1: Add the OpenAI dependency**

Run: `npm install openai`
Expected: adds `openai` to dependencies. Record the installed version.

- [ ] **Step 2: Write the failing test for the image prompt builder**

`src/lib/image/prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildImagePrompt } from "@/lib/image/prompt";

describe("buildImagePrompt", () => {
  it("uses the creative idea and adds a brand style suffix", () => {
    const p = buildImagePrompt({ ideaCreativa: "Bottiglia di magnesio su tavolo di legno", slideText: null });
    expect(p).toContain("Bottiglia di magnesio su tavolo di legno");
    expect(p.toLowerCase()).toContain("agocap");
  });
  it("incorporates slide text when provided", () => {
    const p = buildImagePrompt({ ideaCreativa: "concept", slideText: "Slide 1: i benefici" });
    expect(p).toContain("Slide 1: i benefici");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/lib/image/prompt.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 4: Implement the image prompt builder**

`src/lib/image/prompt.ts`:
```ts
export interface ImagePromptArgs {
  ideaCreativa: string;
  slideText: string | null;
}

export function buildImagePrompt({ ideaCreativa, slideText }: ImagePromptArgs): string {
  const base = slideText ? `${ideaCreativa}. ${slideText}` : ideaCreativa;
  return `${base}. Stile fotografico pulito e professionale per il brand Agocap (integratori e benessere naturale): luce naturale, toni caldi, alta qualità, adatto a un post social. Nessun testo sovrimpresso.`;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/lib/image/prompt.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Create the OpenAI client factory**

`src/lib/image/openai.ts`:
```ts
import OpenAI from "openai";

export const IMAGE_MODEL = "gpt-image-1";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) client = new OpenAI(); // reads OPENAI_API_KEY from env
  return client;
}
```

- [ ] **Step 7: Write the failing test for the image pipeline (OpenAI mocked)**

`src/lib/image/generate.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { generateImageAsset } from "@/lib/image/generate";

function makeDeps(overrides = {}) {
  return {
    loadContent: vi.fn().mockResolvedValue({
      ideaCreativa: "concept",
      slideText: null,
    }),
    callOpenAI: vi.fn().mockResolvedValue(Buffer.from("fakepng")),
    persistAsset: vi.fn().mockResolvedValue({ assetId: "asset_1" }),
    ...overrides,
  };
}

describe("generateImageAsset", () => {
  it("returns DONE with the asset id on success", async () => {
    const deps = makeDeps();
    const res = await generateImageAsset({ contentId: "c1", slideIndex: null }, deps as any);
    expect(res.status).toBe("DONE");
    expect(res.assetId).toBe("asset_1");
    expect(deps.callOpenAI).toHaveBeenCalledOnce();
  });

  it("returns ERROR and persists nothing when OpenAI throws", async () => {
    const deps = makeDeps({ callOpenAI: vi.fn().mockRejectedValue(new Error("openai down")) });
    const res = await generateImageAsset({ contentId: "c1", slideIndex: null }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("openai down");
    expect(deps.persistAsset).not.toHaveBeenCalled();
  });
}
);
```

- [ ] **Step 8: Run to verify it fails**

Run: `npx vitest run src/lib/image/generate.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 9: Implement the image pipeline**

`src/lib/image/generate.ts`:
```ts
export interface ImageGenInput {
  contentId: string;
  slideIndex: number | null;
}

export interface ImageDeps {
  loadContent: (contentId: string, slideIndex: number | null) => Promise<{ ideaCreativa: string; slideText: string | null }>;
  callOpenAI: (prompt: string) => Promise<Buffer>;
  persistAsset: (args: { input: ImageGenInput; prompt: string; bytes: Buffer }) => Promise<{ assetId: string }>;
}

export interface ImageGenResult {
  status: "DONE" | "ERROR";
  assetId?: string;
  error?: string;
}

import { buildImagePrompt } from "./prompt";

export async function generateImageAsset(
  input: ImageGenInput,
  deps: ImageDeps,
): Promise<ImageGenResult> {
  try {
    const { ideaCreativa, slideText } = await deps.loadContent(input.contentId, input.slideIndex);
    const prompt = buildImagePrompt({ ideaCreativa, slideText });
    const bytes = await deps.callOpenAI(prompt);
    const { assetId } = await deps.persistAsset({ input, prompt, bytes });
    return { status: "DONE", assetId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 10: Run to verify it passes**

Run: `npx vitest run src/lib/image/generate.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/lib/image/
git commit -m "feat: OpenAI image generator (prompt builder + fail-safe pipeline)"
```

---

## Task 7: Image storage + runtime wiring for images

**Files:**
- Create: `src/lib/image/store.ts`, `src/lib/image/runtime.ts`
- Test: `src/lib/image/store.test.ts`

`store.ts` writes the PNG bytes to `uploads/<contentId>/<assetId>.png` under `process.cwd()` and returns the relative path. `runtime.ts` builds the real `ImageDeps` (OpenAI call + Prisma asset persistence, replacing any prior asset for the same content+slide).

- [ ] **Step 1: Write the failing test for the file store**

`src/lib/image/store.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { rmSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { saveAssetFile, UPLOADS_DIR } from "@/lib/image/store";

const testContentId = "test-content-xyz";

afterAll(() => {
  rmSync(path.join(UPLOADS_DIR, testContentId), { recursive: true, force: true });
});

describe("saveAssetFile", () => {
  it("writes bytes and returns a relative path under uploads", () => {
    const rel = saveAssetFile(testContentId, "asset-abc", Buffer.from("hello"));
    expect(rel).toBe(path.join("uploads", testContentId, "asset-abc.png").replace(/\\/g, "/"));
    const abs = path.join(process.cwd(), rel);
    expect(existsSync(abs)).toBe(true);
    expect(readFileSync(abs).toString()).toBe("hello");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/image/store.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement the store**

`src/lib/image/store.ts`:
```ts
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

/** Writes PNG bytes to uploads/<contentId>/<assetId>.png and returns the repo-relative POSIX path. */
export function saveAssetFile(contentId: string, assetId: string, bytes: Buffer): string {
  const dir = path.join(UPLOADS_DIR, contentId);
  mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, `${assetId}.png`);
  writeFileSync(abs, bytes);
  return path.relative(process.cwd(), abs).replace(/\\/g, "/");
}

/** Deletes a stored file given its repo-relative path. Best-effort. */
export function deleteAssetFile(relPath: string): void {
  const abs = path.join(process.cwd(), relPath);
  if (existsSync(abs)) rmSync(abs, { force: true });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/image/store.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Implement the image runtime deps**

`src/lib/image/runtime.ts`:
```ts
import { prisma } from "@/lib/prisma";
import { getOpenAI, IMAGE_MODEL } from "./openai";
import { saveAssetFile, deleteAssetFile } from "./store";
import type { ImageDeps } from "./generate";

interface MetaPayloadShape {
  ideaCreativa?: string;
  slides?: Array<{ testo?: string }>;
}

export function buildImageRuntimeDeps(): ImageDeps {
  return {
    loadContent: async (contentId, slideIndex) => {
      const content = await prisma.generatedContent.findUniqueOrThrow({ where: { id: contentId } });
      const payload = (content.payload ?? {}) as MetaPayloadShape;
      const ideaCreativa = payload.ideaCreativa ?? "";
      const slideText =
        slideIndex != null && payload.slides?.[slideIndex]?.testo
          ? payload.slides[slideIndex]!.testo!
          : null;
      return { ideaCreativa, slideText };
    },

    callOpenAI: async (prompt) => {
      const client = getOpenAI();
      const res = await client.images.generate({ model: IMAGE_MODEL, prompt, size: "1024x1024" });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error("OpenAI non ha restituito un'immagine");
      return Buffer.from(b64, "base64");
    },

    persistAsset: async ({ input, prompt, bytes }) => {
      // Replace any existing asset for the same content+slide (one current image each)
      const existing = await prisma.generatedAsset.findFirst({
        where: { contentId: input.contentId, slideIndex: input.slideIndex, tipo: "IMMAGINE" },
      });
      if (existing) {
        deleteAssetFile(existing.path);
        await prisma.generatedAsset.delete({ where: { id: existing.id } });
      }
      const asset = await prisma.generatedAsset.create({
        data: {
          contentId: input.contentId,
          slideIndex: input.slideIndex,
          tipo: "IMMAGINE",
          prompt,
          modello: IMAGE_MODEL,
          path: "", // set after we know the id
        },
      });
      const relPath = saveAssetFile(input.contentId, asset.id, bytes);
      await prisma.generatedAsset.update({ where: { id: asset.id }, data: { path: relPath } });
      return { assetId: asset.id };
    },
  };
}
```

- [ ] **Step 6: Verify typecheck + the installed OpenAI SDK shape**

Run: `npx tsc --noEmit`
Expected: exits 0. **If tsc errors on `client.images.generate` params or `res.data[0].b64_json`,** inspect the installed `node_modules/openai` types and adapt minimally to the real API of the installed version (e.g. response field name), then report exactly what you changed. Do NOT guess — verify against the installed SDK (same discipline used for the Anthropic SDK).

- [ ] **Step 7: Commit**

```bash
git add src/lib/image/store.ts src/lib/image/store.test.ts src/lib/image/runtime.ts
git commit -m "feat: image file store + OpenAI/Prisma image runtime deps"
```

---

## Task 8: API — meta validators + generate route

**Files:**
- Create: `src/app/api/meta/validators.ts`, `src/app/api/meta/generate/route.ts`, `src/app/api/meta/generate/deps-registry.ts`
- Test: `src/app/api/meta/validators.test.ts`, `src/app/api/meta/generate/route.test.ts`

- [ ] **Step 1: Write the failing validators test**

`src/app/api/meta/validators.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { generateInputSchema, updateContentSchema } from "@/app/api/meta/validators";

describe("generateInputSchema", () => {
  it("accepts a valid POST request", () => {
    const v = generateInputSchema.parse({ ideaId: "i1", formato: "POST", piattaforme: ["INSTAGRAM"] });
    expect(v.formato).toBe("POST");
  });
  it("rejects empty piattaforme", () => {
    expect(() => generateInputSchema.parse({ ideaId: "i1", formato: "POST", piattaforme: [] })).toThrow();
  });
  it("bounds numeroSlide 3-10", () => {
    expect(() => generateInputSchema.parse({ ideaId: "i1", formato: "CAROSELLO", piattaforme: ["INSTAGRAM"], numeroSlide: 99 })).toThrow();
  });
});

describe("updateContentSchema", () => {
  it("accepts partial updates", () => {
    const v = updateContentSchema.parse({ status: "APPROVATO" });
    expect(v.status).toBe("APPROVATO");
  });
  it("rejects an invalid status", () => {
    expect(() => updateContentSchema.parse({ status: "ZZZ" })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/api/meta/validators.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement the validators**

`src/app/api/meta/validators.ts`:
```ts
import { z } from "zod";
import { CONTENT_FORMATS, CONTENT_STATUSES, META_PLATFORMS } from "@/lib/meta/enums";

export const generateInputSchema = z.object({
  ideaId: z.string().min(1),
  formato: z.enum(CONTENT_FORMATS),
  piattaforme: z.array(z.enum(META_PLATFORMS)).min(1),
  numeroSlide: z.number().int().min(3).max(10).optional(),
});

export const updateContentSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  dataPrevista: z.string().datetime().nullable().optional(),
  piattaforme: z.array(z.enum(META_PLATFORMS)).optional(),
});

export const imageInputSchema = z.object({
  slideIndex: z.number().int().min(0).nullable().optional(),
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/app/api/meta/validators.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Create the deps-registry seam**

`src/app/api/meta/generate/deps-registry.ts`:
```ts
import { generateMetaContent } from "@/lib/meta/generate";

export type DepsFactory = () => { __run?: typeof generateMetaContent } & Record<string, unknown>;

let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) {
  depsFactory = f;
}
export function getDepsFactory(): DepsFactory {
  return depsFactory;
}
```

- [ ] **Step 6: Write the failing route test**

`src/app/api/meta/generate/route.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/meta/generate/route";
import { __setDepsFactory } from "@/app/api/meta/generate/deps-registry";

function req(body: unknown) {
  return new Request("http://test/api/meta/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/meta/generate", () => {
  it("returns 200 with the content id on success", async () => {
    const spy = vi.fn().mockResolvedValue({ status: "DONE", contentId: "c1" });
    __setDepsFactory(() => ({ __run: spy }) as any);
    const res = await POST(req({ ideaId: "i1", formato: "POST", piattaforme: ["INSTAGRAM"] }));
    expect(res.status).toBe(200);
    expect((await res.json()).contentId).toBe("c1");
  });

  it("returns 400 on invalid input", async () => {
    const res = await POST(req({ ideaId: "", formato: "POST", piattaforme: [] }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/app/api/meta/generate/route.test.ts`
Expected: FAIL — cannot resolve route module.

- [ ] **Step 8: Implement the generate route**

`src/app/api/meta/generate/route.ts`:
```ts
import { NextResponse } from "next/server";
import { generateMetaContent } from "@/lib/meta/generate";
import { buildMetaDeps } from "@/lib/meta/runtime";
import { generateInputSchema } from "../validators";
import { getDepsFactory } from "./deps-registry";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const parsed = generateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido", details: parsed.error.flatten() }, { status: 400 });
  }

  const injected = getDepsFactory()();
  const run = injected.__run ?? generateMetaContent;
  const deps = injected.__run ? ({} as never) : buildMetaDeps();

  const result = await run(parsed.data, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
```

- [ ] **Step 9: Run to verify it passes + full suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all suites pass; tsc exits 0.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/meta/validators.ts src/app/api/meta/validators.test.ts src/app/api/meta/generate/
git commit -m "feat: Meta validators + POST /api/meta/generate route"
```

---

## Task 9: API — contents CRUD, image route, asset serving

**Files:**
- Create: `src/app/api/meta/contents/route.ts`, `src/app/api/meta/contents/[id]/route.ts`, `src/app/api/meta/contents/[id]/image/route.ts`, `src/app/api/meta/contents/[id]/image/deps-registry.ts`, `src/app/api/assets/[id]/route.ts`

- [ ] **Step 1: Create the contents list route**

`src/app/api/meta/contents/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const where: Record<string, unknown> = { canale: "META" };
  const status = searchParams.get("status");
  const formato = searchParams.get("formato");
  const platform = searchParams.get("platform");
  if (status) where.status = status;
  if (formato) where.formato = formato;
  if (platform) where.piattaforme = { has: platform };

  const contents = await prisma.generatedContent.findMany({
    where,
    orderBy: [{ dataPrevista: "asc" }, { createdAt: "desc" }],
    include: {
      idea: { select: { titolo: true } },
      assets: { select: { id: true, slideIndex: true } },
    },
  });
  return NextResponse.json(contents);
}
```

- [ ] **Step 2: Create the single-content route**

`src/app/api/meta/contents/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateContentSchema } from "../../validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const content = await prisma.generatedContent.findUnique({
    where: { id },
    include: { idea: { select: { id: true, titolo: true } }, assets: true },
  });
  if (!content) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  return NextResponse.json(content);
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (parsed.data.payload !== undefined) data.payload = parsed.data.payload;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.piattaforme !== undefined) data.piattaforme = parsed.data.piattaforme;
  if (parsed.data.dataPrevista !== undefined) {
    data.dataPrevista = parsed.data.dataPrevista ? new Date(parsed.data.dataPrevista) : null;
  }
  try {
    const content = await prisma.generatedContent.update({ where: { id }, data });
    return NextResponse.json(content);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.generatedContent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    }
    throw err;
  }
}
```

- [ ] **Step 3: Create the image deps-registry seam**

`src/app/api/meta/contents/[id]/image/deps-registry.ts`:
```ts
import { generateImageAsset } from "@/lib/image/generate";

export type DepsFactory = () => { __run?: typeof generateImageAsset } & Record<string, unknown>;

let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) {
  depsFactory = f;
}
export function getDepsFactory(): DepsFactory {
  return depsFactory;
}
```

- [ ] **Step 4: Create the image generation route**

`src/app/api/meta/contents/[id]/image/route.ts`:
```ts
import { NextResponse } from "next/server";
import { generateImageAsset } from "@/lib/image/generate";
import { buildImageRuntimeDeps } from "@/lib/image/runtime";
import { imageInputSchema } from "../../../validators";
import { getDepsFactory } from "./deps-registry";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = imageInputSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  }
  const slideIndex = parsed.data.slideIndex ?? null;

  const injected = getDepsFactory()();
  const run = injected.__run ?? generateImageAsset;
  const deps = injected.__run ? ({} as never) : buildImageRuntimeDeps();

  const result = await run({ contentId: id, slideIndex }, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
```

- [ ] **Step 5: Create the asset-serving route**

`src/app/api/assets/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const asset = await prisma.generatedAsset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  const abs = path.join(process.cwd(), asset.path);
  if (!existsSync(abs)) return NextResponse.json({ error: "File mancante" }, { status: 404 });
  const bytes = readFileSync(abs);
  return new NextResponse(bytes, {
    status: 200,
    headers: { "content-type": "image/png", "cache-control": "private, max-age=60" },
  });
}
```

- [ ] **Step 6: Verify typecheck + full suite + build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc 0; all tests pass; build succeeds (new routes compile). If `new NextResponse(bytes, ...)` type-errors on the Buffer, wrap with `new Uint8Array(bytes)` and re-run.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/meta/contents/ src/app/api/assets/
git commit -m "feat: Meta contents CRUD, image generation route, asset serving"
```

---

## Task 10: UI — Area Meta pages + nav + idea-detail button

**Files:**
- Create: `src/components/meta-content-table.tsx`, `src/components/meta-calendar.tsx`, `src/app/meta/page.tsx`, `src/app/meta/calendario/page.tsx`, `src/app/meta/genera/page.tsx`, `src/app/meta/[id]/page.tsx`
- Modify: `src/components/nav.tsx`, `src/app/ideas/[id]/page.tsx`

No unit tests (verified in Task 12). Gate on `tsc` + `npm run build`.

- [ ] **Step 1: Add the "Area Meta" nav link**

In `src/components/nav.tsx`, add to the `links` array after the Report entry:
```tsx
  { href: "/meta", label: "Area Meta" },
```

- [ ] **Step 2: Create the content table client component**

`src/components/meta-content-table.tsx`:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CONTENT_STATUSES, CONTENT_FORMATS, META_PLATFORMS } from "@/lib/meta/enums";

interface Content {
  id: string;
  formato: string;
  piattaforme: string[];
  status: string;
  dataPrevista: string | null;
  idea?: { titolo: string } | null;
  assets: { id: string }[];
}

export function MetaContentTable() {
  const [items, setItems] = useState<Content[]>([]);
  const [f, setF] = useState({ status: "", formato: "", platform: "" });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (f.status) qs.set("status", f.status);
    if (f.formato) qs.set("formato", f.formato);
    if (f.platform) qs.set("platform", f.platform);
    const res = await fetch(`/api/meta/contents?${qs.toString()}`);
    setItems(await res.json());
    setLoading(false);
  }, [f]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-4 flex gap-3 text-sm">
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="rounded border p-1">
          <option value="">Tutti gli stati</option>
          {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={f.formato} onChange={(e) => setF({ ...f, formato: e.target.value })} className="rounded border p-1">
          <option value="">Tutti i formati</option>
          {CONTENT_FORMATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} className="rounded border p-1">
          <option value="">Tutte le piattaforme</option>
          {META_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {loading ? <p>Caricamento…</p> : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="p-2">Idea</th><th className="p-2">Formato</th><th className="p-2">Piattaforme</th>
              <th className="p-2">Stato</th><th className="p-2">Data prevista</th><th className="p-2">Img</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b hover:bg-neutral-50">
                <td className="p-2"><Link href={`/meta/${c.id}`} className="text-blue-600 hover:underline">{c.idea?.titolo ?? "—"}</Link></td>
                <td className="p-2">{c.formato}</td>
                <td className="p-2">{c.piattaforme.join(", ")}</td>
                <td className="p-2">{c.status}</td>
                <td className="p-2">{c.dataPrevista ? new Date(c.dataPrevista).toLocaleDateString("it-IT") : "—"}</td>
                <td className="p-2">{c.assets.length}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="p-4 text-neutral-500">Nessun contenuto.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the Dashboard Meta page**

`src/app/meta/page.tsx`:
```tsx
import Link from "next/link";
import { MetaContentTable } from "@/components/meta-content-table";

export const dynamic = "force-dynamic";

export default function MetaDashboardPage() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Area Meta</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/meta/calendario" className="rounded border px-3 py-1">Calendario</Link>
          <Link href="/meta/genera" className="rounded bg-blue-600 px-3 py-1 text-white">Genera da idea</Link>
        </div>
      </div>
      <MetaContentTable />
    </div>
  );
}
```

- [ ] **Step 4: Create the calendar client component**

`src/components/meta-calendar.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Content { id: string; status: string; dataPrevista: string | null; idea?: { titolo: string } | null; }

export function MetaCalendar() {
  const [items, setItems] = useState<Content[]>([]);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  useEffect(() => {
    fetch("/api/meta/contents").then((r) => r.json()).then(setItems);
  }, []);

  const first = new Date(cursor.y, cursor.m, 1);
  const startDay = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const byDay = (d: number) =>
    items.filter((c) => {
      if (!c.dataPrevista) return false;
      const dt = new Date(c.dataPrevista);
      return dt.getFullYear() === cursor.y && dt.getMonth() === cursor.m && dt.getDate() === d;
    });

  const monthLabel = first.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const prev = () => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
  const next = () => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));

  return (
    <div>
      <div className="mb-3 flex items-center gap-4">
        <button onClick={prev} className="rounded border px-3 py-1">←</button>
        <span className="font-medium capitalize">{monthLabel}</span>
        <button onClick={next} className="rounded border px-3 py-1">→</button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-neutral-200 text-sm">
        {["Lun","Mar","Mer","Gio","Ven","Sab","Dom"].map((d) => (
          <div key={d} className="bg-neutral-100 p-2 text-center text-neutral-500">{d}</div>
        ))}
        {cells.map((d, i) => (
          <div key={i} className="min-h-24 bg-white p-1 align-top">
            {d && <div className="mb-1 text-xs text-neutral-400">{d}</div>}
            {d && byDay(d).map((c) => (
              <Link key={c.id} href={`/meta/${c.id}`} className="mb-1 block truncate rounded bg-blue-50 px-1 py-0.5 text-xs text-blue-700 hover:bg-blue-100">
                {c.idea?.titolo ?? "Contenuto"}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create the calendar page**

`src/app/meta/calendario/page.tsx`:
```tsx
import Link from "next/link";
import { MetaCalendar } from "@/components/meta-calendar";

export const dynamic = "force-dynamic";

export default function MetaCalendarPage() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendario Meta</h1>
        <Link href="/meta" className="rounded border px-3 py-1 text-sm">Lista</Link>
      </div>
      <MetaCalendar />
    </div>
  );
}
```

- [ ] **Step 6: Create the generate-from-idea page**

`src/app/meta/genera/page.tsx`:
```tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CONTENT_FORMATS, META_PLATFORMS } from "@/lib/meta/enums";

interface Idea { id: string; titolo: string; }

function GeneraInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [form, setForm] = useState({ ideaId: search.get("ideaId") ?? "", formato: "POST", piattaforme: ["INSTAGRAM"] as string[], numeroSlide: 5 });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ideas?status=APPROVATA").then((r) => r.json()).then(setIdeas);
  }, []);

  const togglePlatform = (p: string) =>
    setForm((f) => ({ ...f, piattaforme: f.piattaforme.includes(p) ? f.piattaforme.filter((x) => x !== p) : [...f.piattaforme, p] }));

  const submit = async () => {
    if (!form.ideaId || form.piattaforme.length === 0) { setStatus("Seleziona un'idea e almeno una piattaforma."); return; }
    setBusy(true); setStatus(null);
    const body: Record<string, unknown> = { ideaId: form.ideaId, formato: form.formato, piattaforme: form.piattaforme };
    if (form.formato === "CAROSELLO") body.numeroSlide = Number(form.numeroSlide);
    const res = await fetch("/api/meta/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    setBusy(false);
    if (res.ok && json.contentId) router.push(`/meta/${json.contentId}`);
    else setStatus(`Errore: ${json.error ?? "sconosciuto"}`);
  };

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-2xl font-semibold">Genera contenuto Meta</h1>
      <div className="space-y-3">
        <select className="w-full rounded border p-2" value={form.ideaId} onChange={(e) => setForm({ ...form, ideaId: e.target.value })}>
          <option value="">Scegli un'idea approvata…</option>
          {ideas.map((i) => <option key={i.id} value={i.id}>{i.titolo}</option>)}
        </select>
        <select className="w-full rounded border p-2" value={form.formato} onChange={(e) => setForm({ ...form, formato: e.target.value })}>
          {CONTENT_FORMATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex gap-3 text-sm">
          {META_PLATFORMS.map((p) => (
            <label key={p} className="flex items-center gap-1">
              <input type="checkbox" checked={form.piattaforme.includes(p)} onChange={() => togglePlatform(p)} />{p}
            </label>
          ))}
        </div>
        {form.formato === "CAROSELLO" && (
          <input type="number" min={3} max={10} className="w-full rounded border p-2" value={form.numeroSlide} onChange={(e) => setForm({ ...form, numeroSlide: Number(e.target.value) })} />
        )}
        <button onClick={submit} disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40">{busy ? "Generazione…" : "Genera"}</button>
      </div>
      {status && <p className="mt-4 text-sm">{status}</p>}
    </div>
  );
}

export default function GeneraPage() {
  return <Suspense><GeneraInner /></Suspense>;
}
```

- [ ] **Step 7: Create the content detail/edit page**

`src/app/meta/[id]/page.tsx`:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { CONTENT_STATUSES } from "@/lib/meta/enums";

interface Asset { id: string; slideIndex: number | null; }
interface Content {
  id: string;
  formato: string;
  piattaforme: string[];
  status: string;
  dataPrevista: string | null;
  payload: { caption?: string; ideaCreativa?: string; hashtags?: string[]; cta?: string; slides?: { testo: string }[] };
  modello: string;
  idea?: { id: string; titolo: string } | null;
  assets: Asset[];
}

export default function MetaContentDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Content | null>(null);
  const [busyImg, setBusyImg] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/meta/contents/${id}`);
    setC(await res.json());
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const patch = async (data: Record<string, unknown>) => {
    await fetch(`/api/meta/contents/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    await load();
  };

  const genImage = async (slideIndex: number | null) => {
    setBusyImg(`${slideIndex}`); setMsg(null);
    const res = await fetch(`/api/meta/contents/${id}/image`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slideIndex }) });
    const json = await res.json();
    setBusyImg(null);
    if (res.ok) await load(); else setMsg(`Errore immagine: ${json.error ?? "sconosciuto"}`);
  };

  if (!c) return <p>Caricamento…</p>;
  const assetFor = (slideIndex: number | null) => c.assets.find((a) => a.slideIndex === slideIndex);
  const p = c.payload ?? {};

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">{c.idea?.titolo ?? "Contenuto Meta"}</h1>
      <p className="mb-4 text-sm text-neutral-500">{c.formato} · {c.piattaforme.join(", ")}</p>

      <label className="mb-2 block text-sm">Caption</label>
      <textarea className="mb-3 w-full rounded border p-2" rows={3} defaultValue={p.caption ?? ""} onBlur={(e) => patch({ payload: { ...p, caption: e.target.value } })} />

      <label className="mb-2 block text-sm">Idea creativa (concept immagine)</label>
      <textarea className="mb-3 w-full rounded border p-2" rows={2} defaultValue={p.ideaCreativa ?? ""} onBlur={(e) => patch({ payload: { ...p, ideaCreativa: e.target.value } })} />

      <label className="mb-2 block text-sm">CTA</label>
      <input className="mb-3 w-full rounded border p-2" defaultValue={p.cta ?? ""} onBlur={(e) => patch({ payload: { ...p, cta: e.target.value } })} />

      <p className="mb-3 text-sm text-neutral-600">Hashtag: {(p.hashtags ?? []).join(" ")}</p>

      <div className="mb-4">
        <h2 className="mb-2 font-medium">Immagine principale</h2>
        {assetFor(null) ? <img src={`/api/assets/${assetFor(null)!.id}`} alt="" className="mb-2 w-64 rounded border" /> : <p className="text-sm text-neutral-500">Nessuna immagine.</p>}
        <button onClick={() => genImage(null)} disabled={busyImg === "null"} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-40">{busyImg === "null" ? "Genero…" : "Genera immagine"}</button>
      </div>

      {c.formato === "CAROSELLO" && (p.slides ?? []).map((s, idx) => (
        <div key={idx} className="mb-4 rounded border p-3">
          <p className="mb-2 text-sm font-medium">Slide {idx + 1}</p>
          <textarea className="mb-2 w-full rounded border p-2" rows={2} defaultValue={s.testo} onBlur={(e) => { const slides = [...(p.slides ?? [])]; slides[idx] = { testo: e.target.value }; patch({ payload: { ...p, slides } }); }} />
          {assetFor(idx) ? <img src={`/api/assets/${assetFor(idx)!.id}`} alt="" className="mb-2 w-48 rounded border" /> : null}
          <button onClick={() => genImage(idx)} disabled={busyImg === `${idx}`} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-40">{busyImg === `${idx}` ? "Genero…" : "Genera immagine slide"}</button>
        </div>
      ))}

      <div className="mt-4 flex items-center gap-4 text-sm">
        <label>Stato:&nbsp;
          <select value={c.status} onChange={(e) => patch({ status: e.target.value })} className="rounded border p-1">
            {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Data prevista:&nbsp;
          <input type="date" defaultValue={c.dataPrevista ? c.dataPrevista.slice(0, 10) : ""} onChange={(e) => patch({ dataPrevista: e.target.value ? new Date(e.target.value).toISOString() : null })} className="rounded border p-1" />
        </label>
      </div>
      {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
      <p className="mt-4 text-xs text-neutral-400">Testo generato da {c.modello}</p>
    </div>
  );
}
```

- [ ] **Step 8: Add the "Genera contenuto Meta" button to the idea detail page**

In `src/app/ideas/[id]/page.tsx`, add `import Link from "next/link";` at the top, and inside the returned JSX (after the status `<label>` block) add:
```tsx
      {idea.status === "APPROVATA" && (
        <p className="mb-4">
          <Link href={`/meta/genera?ideaId=${idea.id}`} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Genera contenuto Meta</Link>
        </p>
      )}
```

- [ ] **Step 9: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds. (Note: the detail page uses `<img>`; if the build fails on the Next.js `no-img-element` lint rule, add `{/* eslint-disable-next-line @next/next/no-img-element */}` above each `<img>` tag, or set `images: { unoptimized: true }` — prefer the eslint-disable comments to keep scope minimal.)

- [ ] **Step 10: Commit**

```bash
git add src/components/meta-content-table.tsx src/components/meta-calendar.tsx src/app/meta/ src/components/nav.tsx src/app/ideas/[id]/page.tsx
git commit -m "feat: Area Meta UI (dashboard, calendar, generate, detail) + nav + idea button"
```

---

## Task 11: Docker — uploads volume + OPENAI_API_KEY

**Files:**
- Modify: `.env.example`, `docker-compose.yml`, `Dockerfile`

- [ ] **Step 1: Add OPENAI_API_KEY to `.env.example`**

Append to `.env.example`:
```
OPENAI_API_KEY="sk-..."
```

- [ ] **Step 2: Add the uploads volume + key to `docker-compose.yml`**

In the `app` service `environment:` block add:
```yaml
      OPENAI_API_KEY: "${OPENAI_API_KEY}"
```
Add a `volumes:` entry to the `app` service (so generated images persist across restarts):
```yaml
    volumes:
      - uploads:/app/uploads
```
And add `uploads:` to the top-level `volumes:` block (alongside `pgdata:`):
```yaml
  uploads:
```

- [ ] **Step 3: Ensure the uploads dir exists in the image**

In the `runner` stage of `Dockerfile`, before `EXPOSE 3000`, add:
```dockerfile
RUN mkdir -p /app/uploads
```

- [ ] **Step 4: Validate compose**

Run: `docker compose config`
Expected: exits 0; resolved config shows the `uploads` volume mounted on `app` and `OPENAI_API_KEY` wired.

- [ ] **Step 5: Commit**

```bash
git add .env.example docker-compose.yml Dockerfile
git commit -m "feat: persistent uploads volume and OPENAI_API_KEY for image generation"
```

---

## Task 12: End-to-end verification

**Files:** none — verification only. Requires real `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.

- [ ] **Step 1: Full unit suite + typecheck + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests pass; tsc 0; build succeeds.

- [ ] **Step 2: Ensure DB is migrated and there is an APPROVED idea**

Run: `npx prisma migrate deploy`. Confirm at least one `Idea` with `status=APPROVATA` exists (the Brain smoke test left some; if not, approve one via `PATCH /api/ideas/bulk-status`).

- [ ] **Step 3: Start the dev server with both keys**

Run (background): `ANTHROPIC_API_KEY=... OPENAI_API_KEY=... PORT=8001 npm run dev`. Wait until it responds.

- [ ] **Step 4: Generate a Meta POST from an approved idea**

`POST http://localhost:8001/api/meta/generate` with `{"ideaId":"<approved id>","formato":"POST","piattaforme":["INSTAGRAM"]}`.
Expected: 200 `{"status":"DONE","contentId":"..."}`. Then `GET /api/meta/contents/<id>` shows a payload with caption/ideaCreativa/hashtags/cta and `modello="claude-opus-4-8"`.

- [ ] **Step 5: Generate an image for that content**

`POST http://localhost:8001/api/meta/contents/<id>/image` with `{}`.
Expected: 200 `{"status":"DONE","assetId":"..."}`. Then `GET /api/assets/<assetId>` returns `content-type: image/png` and a non-empty body; a file exists under `uploads/<contentId>/`.

- [ ] **Step 6: Verify the calendar/list and a status change**

`PATCH /api/meta/contents/<id>` with `{"status":"APPROVATO","dataPrevista":"<an ISO date>"}` → 200. `GET /api/meta/contents` includes the content with the asset count = 1.

- [ ] **Step 7: Stop the server. Report results honestly.**

Report: vitest count, build outcome, the exact generate/image/asset responses, and whether the file landed on disk. If the AI keys are unavailable, run steps 1–2 only and report that the live generation requires the user's keys (the unit suite + build still validate the wiring).

---

## Self-Review notes (addressed)

- **Spec coverage:** GeneratedContent/GeneratedAsset + enums (T1); payload schema POST/CAROSELLO (T2); prompt (T3); text pipeline fail-safe (T4) + Claude/Prisma wiring reusing the Brain pattern (T5); OpenAI image generator + prompt + storage replace-existing (T6, T7); validators + all 5 API routes incl. asset serving (T8, T9); Dashboard list + calendar + generate-from-idea + detail with on-demand images + idea-detail button (T10); uploads volume + OPENAI_API_KEY (T11); end-to-end incl. live image (T12). Audit (prompt/model/tokens) stored on content (T5) and on assets (T7). Approved-only gate enforced in `loadContext` (T5) + UI filter to APPROVATA ideas (T10).
- **Type consistency:** `MetaGenInput`/`MetaDeps`/`MetaClaudeResult` defined in T4 and consumed unchanged in T5/T8; `ImageDeps`/`ImageGenInput` in T6 consumed in T7/T9; enum constants from `src/lib/meta/enums.ts` reused across schema/validators/UI; payload field names (`caption`/`ideaCreativa`/`hashtags`/`cta`/`slides[].testo`) identical in schema (T2), prompt (T3), runtime (T5), image runtime (T7), and detail UI (T10).
- **No placeholders:** every code/test step is complete; SDK-shape caveats (OpenAI in T7, Buffer response in T9, img lint in T10) give concrete fallbacks.
