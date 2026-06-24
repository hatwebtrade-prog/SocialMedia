# Editorial OS — Fase 3 (Area Meta: Reel/Story + split IG/FB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add **REEL** and **STORY** Meta formats (structured per type) to the existing Meta generator, finalize the **Instagram/Facebook split** (already supported via the platform filter), and polish the Meta table (colored status badge).

**Architecture:** Extends the proven Meta generator (`schema.ts`/`prompt.ts`/`runtime.ts`, payload `GeneratedContent`). Add two zod payload schemas + extend `payloadSchemaFor`; extend `buildMetaPrompt` with per-format field sets; switch the runtime schema selection to `payloadSchemaFor(input.formato)`. No new pipeline. On-demand image reuses `ideaCreativa` (present in Reel & Story). Scheduling stays Phase 5.

**Tech Stack:** Next.js 15, Prisma/Postgres, `@anthropic-ai/sdk` (`claude-opus-4-8`), Vitest. UI Italian, code English.

**Branch:** `editorial-os-phase3` (off `brain-mvp-clean`). Local Postgres via `.env`.

**Current state (verified):**
- `ContentFormat` (Prisma): POST, CAROSELLO, ARTICOLO. `src/lib/meta/enums.ts` `CONTENT_FORMATS`: POST, CAROSELLO.
- `src/lib/meta/schema.ts`: `postPayloadSchema {caption,ideaCreativa,hashtags[],cta}`, `caroselloPayloadSchema = post + slides[{testo}]`, `payloadSchemaFor` (overloads POST/CAROSELLO).
- `src/lib/meta/prompt.ts`: `buildMetaPrompt` builds campi/forma for POST vs CAROSELLO.
- `src/lib/meta/runtime.ts` `callClaude`: `const schema = input.formato === "CAROSELLO" ? payloadSchemaFor("CAROSELLO") : payloadSchemaFor("POST"); const payload = schema.parse(raw) as object;`
- `src/app/api/meta/validators.ts`: `generateInputSchema { ideaId, formato: z.enum(CONTENT_FORMATS), piattaforme: z.array(z.enum(META_PLATFORMS)).min(1), numeroSlide?: int 3-10 }`.
- `src/components/meta-content-table.tsx`: filters status/formato/platform + columns Idea/Formato/Piattaforme/Stato/Data prevista/Img (status shown as plain text).
- `src/components/status-badge.tsx`: `StatusBadge` (Fase 1).

---

## Task 1: ContentFormat += REEL, STORY

**Files:** Modify `prisma/schema.prisma`, `src/lib/meta/enums.ts`

- [ ] **Step 1: Prisma enum**

In `prisma/schema.prisma`, in `enum ContentFormat`, add REEL and STORY:
```prisma
enum ContentFormat {
  POST
  CAROSELLO
  ARTICOLO
  REEL
  STORY
}
```

- [ ] **Step 2: meta enums**

In `src/lib/meta/enums.ts`, change:
```ts
export const CONTENT_FORMATS = ["POST", "CAROSELLO", "REEL", "STORY"] as const;
```
(`ARTICOLO` is intentionally NOT in `CONTENT_FORMATS` — that's a blog format; the Meta generator only offers POST/CAROSELLO/REEL/STORY.)

- [ ] **Step 3: validate + migrate + generate**

Run:
```bash
npx prisma validate
npx prisma migrate dev --name content_format_reel_story
npx prisma generate
```
Expected: valid; migration created+applied (adds REEL/STORY enum values — non-destructive); client regenerated. If DB unreachable, report BLOCKED with the error. (If a running dev server locks the engine .dll on Windows, the EPERM on rename is harmless — types regenerate fine.)

- [ ] **Step 4: Commit**
```bash
git add prisma/ src/lib/meta/enums.ts
git commit -m "feat: ContentFormat REEL + STORY (Meta formats)"
```

---

## Task 2: Reel/Story payload schemas + payloadSchemaFor

**Files:** Modify `src/lib/meta/schema.ts`; Test `src/lib/meta/schema-reel-story.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/meta/schema-reel-story.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { reelPayloadSchema, storyPayloadSchema, payloadSchemaFor } from "@/lib/meta/schema";

describe("reel/story payloads", () => {
  it("reelPayloadSchema accepts a structured reel", () => {
    const v = reelPayloadSchema.parse({
      caption: "c", ideaCreativa: "i", hashtags: ["#x"], cta: "cta",
      hook: "Aggancio", scriptParlato: "parlato", testoSchermo: ["riga 1", "riga 2"],
    });
    expect(v.hook).toBe("Aggancio");
    expect(v.testoSchermo).toHaveLength(2);
  });
  it("reel rejects a missing hook", () => {
    expect(() => reelPayloadSchema.parse({ caption: "c", ideaCreativa: "i", hashtags: [], cta: "x", scriptParlato: "p", testoSchermo: [] })).toThrow();
  });
  it("storyPayloadSchema accepts a light story", () => {
    const v = storyPayloadSchema.parse({ ideaCreativa: "i", testo: "overlay", cta: "swipe" });
    expect(v.testo).toBe("overlay");
  });
  it("payloadSchemaFor returns the right schema per format", () => {
    expect(payloadSchemaFor("REEL")).toBe(reelPayloadSchema);
    expect(payloadSchemaFor("STORY")).toBe(storyPayloadSchema);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/meta/schema-reel-story.test.ts`
Expected: FAIL — `reelPayloadSchema` not exported.

- [ ] **Step 3: Implement**

In `src/lib/meta/schema.ts`, after `caroselloPayloadSchema`, add:
```ts
export const reelPayloadSchema = postPayloadSchema.extend({
  hook: z.string().min(1),
  scriptParlato: z.string().min(1),
  testoSchermo: z.array(z.string()),
});

export const storyPayloadSchema = z.object({
  ideaCreativa: z.string().min(1),
  testo: z.string().min(1),
  cta: z.string(),
});
```
Replace the `payloadSchemaFor` overloads + impl with:
```ts
export function payloadSchemaFor(formato: "CAROSELLO"): typeof caroselloPayloadSchema;
export function payloadSchemaFor(formato: "REEL"): typeof reelPayloadSchema;
export function payloadSchemaFor(formato: "STORY"): typeof storyPayloadSchema;
export function payloadSchemaFor(formato: "POST"): typeof postPayloadSchema;
export function payloadSchemaFor(formato: ContentFormatValue): z.ZodTypeAny;
export function payloadSchemaFor(formato: ContentFormatValue): z.ZodTypeAny {
  switch (formato) {
    case "CAROSELLO": return caroselloPayloadSchema;
    case "REEL": return reelPayloadSchema;
    case "STORY": return storyPayloadSchema;
    default: return postPayloadSchema;
  }
}
```
And add the inferred types:
```ts
export type ReelPayload = z.infer<typeof reelPayloadSchema>;
export type StoryPayload = z.infer<typeof storyPayloadSchema>;
```

- [ ] **Step 4: Run to verify it passes + existing meta schema test**

Run: `npx vitest run src/lib/meta/ && npx tsc --noEmit`
Expected: new tests pass; any existing `schema.test.ts` still passes (POST/CAROSELLO behavior unchanged); tsc 0.

- [ ] **Step 5: Commit**
```bash
git add src/lib/meta/schema.ts src/lib/meta/schema-reel-story.test.ts
git commit -m "feat: Reel/Story Meta payload schemas + payloadSchemaFor"
```

---

## Task 3: buildMetaPrompt — Reel/Story field sets

**Files:** Modify `src/lib/meta/prompt.ts`; Test `src/lib/meta/prompt-reel-story.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/meta/prompt-reel-story.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildMetaPrompt } from "@/lib/meta/prompt";

const idea = { titolo: "Magnesio e sonno", descrizione: "d", category: "EDUCATIONAL" };

describe("buildMetaPrompt reel/story", () => {
  it("REEL prompt asks for hook/scriptParlato/testoSchermo", () => {
    const p = buildMetaPrompt({ kbContext: "kb", idea, formato: "REEL", piattaforme: ["INSTAGRAM"] });
    expect(p).toContain("hook");
    expect(p).toContain("scriptParlato");
    expect(p).toContain("testoSchermo");
    expect(p).toContain("REEL");
  });
  it("STORY prompt asks for testo overlay + ideaCreativa, JSON only", () => {
    const p = buildMetaPrompt({ kbContext: "kb", idea, formato: "STORY", piattaforme: ["FACEBOOK"] });
    expect(p).toContain("testo");
    expect(p).toContain("ideaCreativa");
    expect(p.toLowerCase()).toContain("json");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/meta/prompt-reel-story.test.ts`
Expected: FAIL — current prompt treats REEL/STORY as POST (no hook/testoSchermo).

- [ ] **Step 3: Implement**

Replace the body of `buildMetaPrompt` in `src/lib/meta/prompt.ts` (keep the signature/interface) with:
```ts
export function buildMetaPrompt(args: MetaPromptArgs): string {
  const { kbContext, idea, formato, piattaforme, numeroSlide = 5 } = args;
  const piattaformeTxt = piattaforme.join(" e ");

  const campiPost = `- caption: testo del post (italiano), coerente col tono di voce
- ideaCreativa: descrizione del concept visivo (cosa mostrare nell'immagine)
- hashtags: array di hashtag pertinenti
- cta: call to action`;

  let campi: string;
  let forma: string;
  switch (formato) {
    case "CAROSELLO":
      campi = `${campiPost}
- slides: array di esattamente ${numeroSlide} slide, ognuna { "testo": "..." } (testo della slide)`;
      forma = `{"caption":"...","ideaCreativa":"...","hashtags":["..."],"cta":"...","slides":[{"testo":"..."}]}`;
      break;
    case "REEL":
      campi = `${campiPost}
- hook: frase d'aggancio iniziale (primi 3 secondi)
- scriptParlato: testo parlato del reel
- testoSchermo: array di brevi testi da sovrimprimere a schermo`;
      forma = `{"caption":"...","ideaCreativa":"...","hashtags":["..."],"cta":"...","hook":"...","scriptParlato":"...","testoSchermo":["..."]}`;
      break;
    case "STORY":
      campi = `- ideaCreativa: concept visivo della story (cosa mostrare)
- testo: testo overlay breve e diretto
- cta: call to action (es. scopri / link in bio)`;
      forma = `{"ideaCreativa":"...","testo":"...","cta":"..."}`;
      break;
    default:
      campi = campiPost;
      forma = `{"caption":"...","ideaCreativa":"...","hashtags":["..."],"cta":"..."}`;
  }

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

- [ ] **Step 4: Run to verify + existing prompt test**

Run: `npx vitest run src/lib/meta/ && npx tsc --noEmit`
Expected: new + existing meta prompt tests pass; tsc 0.

- [ ] **Step 5: Commit**
```bash
git add src/lib/meta/prompt.ts src/lib/meta/prompt-reel-story.test.ts
git commit -m "feat: buildMetaPrompt Reel/Story field sets"
```

---

## Task 4: Runtime schema selection + table StatusBadge

**Files:** Modify `src/lib/meta/runtime.ts`, `src/components/meta-content-table.tsx`

- [ ] **Step 1: Runtime — select schema by format**

In `src/lib/meta/runtime.ts` `callClaude`, replace:
```ts
      const raw = JSON.parse(stripFences(textBlock.text));
      // Cast to "POST" to satisfy overload union; schema chosen at runtime by the function body
      const schema =
        input.formato === "CAROSELLO"
          ? payloadSchemaFor("CAROSELLO")
          : payloadSchemaFor("POST");
      const payload = schema.parse(raw) as object;
```
with:
```ts
      const raw = JSON.parse(stripFences(textBlock.text));
      const payload = payloadSchemaFor(input.formato).parse(raw) as object;
```

- [ ] **Step 2: Table — colored status badge**

In `src/components/meta-content-table.tsx`:
- add the import: `import { StatusBadge } from "@/components/status-badge";`
- replace the status cell `<td className="p-2">{c.status}</td>` with:
```tsx
                <td className="p-2"><StatusBadge status={c.status} /></td>
```

- [ ] **Step 3: Verify full suite + typecheck + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests pass; tsc 0; build succeeds (the Meta generate page formato dropdown now lists REEL/STORY via CONTENT_FORMATS).

- [ ] **Step 4: Commit**
```bash
git add src/lib/meta/runtime.ts src/components/meta-content-table.tsx
git commit -m "feat: Meta runtime schema-by-format + status badge in table"
```

---

## Task 5: Gate + smoke (live Reel + Story)

**Requires** real `ANTHROPIC_API_KEY` + `OPENAI_API_KEY`, and an APPROVATA idea with destinazione META.

- [ ] **Step 1: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npm run build`. Expected: green. Commit only if a fix was needed.

- [ ] **Step 2: Migrate + start server**

`npx prisma migrate deploy`, then start `ANTHROPIC_API_KEY=... OPENAI_API_KEY=... SEOZOOM_API_KEY=... SHOPIFY_* ... PORT=8001 npm run dev`. Wait until ready.

- [ ] **Step 3: Ensure an APPROVATA idea with destinazione META**

`GET /api/ideas?status=APPROVATA&destinazione=META`; if empty, approve one and PATCH `{destinazioni:["META"]}`. Note its id.

- [ ] **Step 4: Live generate a REEL and a STORY**

`POST http://localhost:8001/api/meta/generate` with `{"ideaId":"<id>","formato":"REEL","piattaforme":["INSTAGRAM"]}` (timeout ~150s) → expect 200 `{status:"DONE", contentId}`. Then again with `{"ideaId":"<id>","formato":"STORY","piattaforme":["FACEBOOK"]}`.
Then `GET /api/meta/contents/<contentId>` for each → confirm payload: REEL has `hook`, `scriptParlato`, `testoSchermo[]` (+ caption/hashtags/cta); STORY has `ideaCreativa`, `testo`, `cta`. Report the exact payload field names present.

- [ ] **Step 5: Verify table filter**

`GET /api/meta/contents?formato=REEL` and `?formato=STORY` and `?platform=INSTAGRAM` → return the right rows. Open `/meta` → confirm formato filter lists REEL/STORY, status shows colored badge.

- [ ] **Step 6: Stop the server. Report honestly** — gate results, the REEL & STORY payloads (field names), filter results, any error verbatim. If keys unavailable, run steps 1 only and report that live generation needs keys (unit suite + build still validate).

---

## Self-Review notes (addressed)
- **Spec coverage:** REEL/STORY enum (T1); structured payloads + payloadSchemaFor (T2); per-format prompt (T3); runtime schema-by-format + table badge (T4); gate + live Reel/Story smoke (T5). IG/FB split already provided by the existing platform filter (no new work) — confirmed in smoke. Scheduling deferred to Phase 5.
- **Type consistency:** `CONTENT_FORMATS` extended (T1) → `ContentFormatValue` now includes REEL/STORY, consumed by `payloadSchemaFor` (T2), `buildMetaPrompt` switch (T3), and `runtime.callClaude` (T4); `generateInputSchema`'s `z.enum(CONTENT_FORMATS)` accepts the new formats with no change; `reelPayloadSchema`/`storyPayloadSchema` (T2) selected by `payloadSchemaFor` and parsed in runtime; image runtime keeps reading `ideaCreativa` (present in both new payloads).
- **No placeholders:** every code/test step is complete. Existing POST/CAROSELLO behavior is unchanged (default branch + unchanged schemas).
```
