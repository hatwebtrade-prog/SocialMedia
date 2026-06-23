# SEOZoom SEO Source (Brain) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SEOZoom as a real SEO data source for the Brain: from manual seeds or a product/category, fetch real keyword metrics (volume, difficulty, trend), select high-opportunity queries, and have Claude shape them into classified ideas that carry a REAL `seoScore` (computed from the metrics) into the Brain dashboard.

**Architecture:** A new `seozoom` SignalSource. Hybrid pipeline (real SEOZoom data + Claude shaping) reusing the Brain's `Idea`/`GenerationRun`/dedupe and the proven injected-deps + fail-safe + `claude.messages.create` JSON pattern. The exact SEOZoom API shape is isolated behind a `normalizeSeozoom` function so the rest of the pipeline is decoupled. `seoScore` is computed by a pure, tested function — not the AI.

**Tech Stack:** Next.js 15 (App Router, TS), Prisma + PostgreSQL, `@anthropic-ai/sdk` (`claude-opus-4-8`), SEOZoom REST API (`SEOZOOM_API_KEY`), Vitest. UI Italian, code English.

**Branch:** `seozoom-source` (already created off the Brain+Meta code). Local Postgres via `.env` `DATABASE_URL` (db `agocap`).

---

## File Structure

```
prisma/schema.prisma                       # + Idea metric fields; seed seozoom source
prisma/seed.ts                             # + upsert seozoom SignalSource
src/lib/seozoom/
  score.ts                                 # metricsToSeoScore() (pure)
  select.ts                                # NormalizedKeyword type + selectCandidates() (pure)
  client.ts                                # getSeozoom() + normalizeSeozoom() + fetchKeywords()
  schema.ts                                # zod shaping-output schema
  prompt.ts                                # buildShapingPrompt()
  discover.ts                              # discoverKeywords() pipeline + injected-deps types
  runtime.ts                               # buildSeozoomDeps() (SEOZoom + Claude + Prisma)
src/app/api/seozoom/
  validators.ts                            # discover input zod
  discover/route.ts                        # POST  (+ deps-registry.ts seam)
  discover/deps-registry.ts
src/app/brain/scopri/page.tsx              # "Scopri keyword" UI
src/app/api/ideas/route.ts                 # MODIFY: add ?source= filter + include source key
src/components/idea-filters.tsx            # MODIFY: add source select
src/components/idea-table.tsx              # MODIFY: keyword/volume/difficolta columns
src/components/nav.tsx                      # MODIFY: "Scopri keyword" link
.env.example                               # MODIFY: SEOZOOM_API_KEY
docker-compose.yml                         # MODIFY: SEOZOOM_API_KEY env
```

---

## Task 1: Prisma — Idea metric fields + seozoom source

**Files:**
- Modify: `prisma/schema.prisma`, `prisma/seed.ts`

- [ ] **Step 1: Add metric fields to the `Idea` model**

In `prisma/schema.prisma`, inside `model Idea { ... }`, add these four fields (after `tags`):
```prisma
  keyword                String?
  volumeRicerca          Int?
  difficolta             Int?
  trendKeyword           String?
```
And add an index alongside the existing `@@index` lines in `Idea`:
```prisma
  @@index([keyword])
```

- [ ] **Step 2: Seed the `seozoom` SignalSource**

In `prisma/seed.ts`, add a third upsert inside `main()` (after the existing two):
```ts
  await prisma.signalSource.upsert({
    where: { key: "seozoom" },
    update: {},
    create: { key: "seozoom", nome: "SEOZoom", tipo: "API", config: { mercato: "IT", topN: 12 } },
  });
```

- [ ] **Step 3: Validate, migrate, regenerate, seed**

Run:
```bash
npx prisma validate
npx prisma migrate dev --name seozoom_idea_metrics
npx prisma generate
npm run prisma:seed
```
Expected: schema valid; migration `<ts>_seozoom_idea_metrics` created+applied; seed runs; 3 SignalSource rows now exist. If the DB is unreachable, report BLOCKED with the exact error.

- [ ] **Step 4: Verify 3 sources**

Run:
```bash
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.signalSource.findMany({select:{key:true}}).then(r=>{console.log(r.map(x=>x.key).sort().join(','));return p.\$disconnect()})"
```
Expected: `ai-brainstorming,manuale,seozoom`.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: Idea SEO metric fields + seozoom signal source"
```

---

## Task 2: metricsToSeoScore (pure)

**Files:**
- Create: `src/lib/seozoom/score.ts`
- Test: `src/lib/seozoom/score.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/seozoom/score.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { metricsToSeoScore } from "@/lib/seozoom/score";

describe("metricsToSeoScore", () => {
  it("high volume + low difficulty scores 5", () => {
    expect(metricsToSeoScore({ volume: 5000, difficolta: 10 })).toBe(5);
  });
  it("high volume + high difficulty is penalised", () => {
    expect(metricsToSeoScore({ volume: 5000, difficolta: 80 })).toBe(3);
  });
  it("low volume + high difficulty scores 1", () => {
    expect(metricsToSeoScore({ volume: 20, difficolta: 90 })).toBe(1);
  });
  it("clamps within 1-5", () => {
    const v = metricsToSeoScore({ volume: 0, difficolta: 100 });
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/seozoom/score.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/seozoom/score.ts`:
```ts
export interface SeoMetrics {
  volume: number;
  difficolta: number; // 0-100 scale (SEOZoom keyword difficulty)
}

/** Deterministic 1-5 score: volume buckets, penalised by difficulty. */
export function metricsToSeoScore({ volume, difficolta }: SeoMetrics): number {
  let base: number;
  if (volume >= 5000) base = 5;
  else if (volume >= 1000) base = 4;
  else if (volume >= 300) base = 3;
  else if (volume >= 50) base = 2;
  else base = 1;

  if (difficolta >= 70) base -= 2;
  else if (difficolta >= 40) base -= 1;

  return Math.max(1, Math.min(5, base));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/seozoom/score.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/seozoom/score.ts src/lib/seozoom/score.test.ts
git commit -m "feat: metricsToSeoScore (real metrics -> 1-5)"
```

---

## Task 3: NormalizedKeyword + selectCandidates (pure)

**Files:**
- Create: `src/lib/seozoom/select.ts`
- Test: `src/lib/seozoom/select.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/seozoom/select.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { selectCandidates } from "@/lib/seozoom/select";

const kw = (keyword: string, volume: number, difficolta: number, trend = "stabile") => ({ keyword, volume, difficolta, trend });

describe("selectCandidates", () => {
  it("drops zero-volume keywords", () => {
    const r = selectCandidates([kw("a", 0, 10), kw("b", 100, 10)], { topN: 10 });
    expect(r.map((k) => k.keyword)).toEqual(["b"]);
  });

  it("ranks high-volume/low-difficulty first", () => {
    const r = selectCandidates([kw("low", 100, 80), kw("good", 2000, 20)], { topN: 10 });
    expect(r[0].keyword).toBe("good");
  });

  it("gives rising trends a bonus over equal stable ones", () => {
    const r = selectCandidates([kw("stable", 1000, 30, "stabile"), kw("rising", 1000, 30, "in crescita")], { topN: 10 });
    expect(r[0].keyword).toBe("rising");
  });

  it("caps to topN", () => {
    const many = Array.from({ length: 20 }, (_, i) => kw(`k${i}`, 1000 - i, 10));
    expect(selectCandidates(many, { topN: 5 })).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/seozoom/select.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/seozoom/select.ts`:
```ts
export interface NormalizedKeyword {
  keyword: string;
  volume: number;
  difficolta: number;
  trend: string;
}

function isRising(trend: string): boolean {
  return /cresc|salit|rising|up|\+/i.test(trend);
}

function opportunity(k: NormalizedKeyword): number {
  const trendBonus = isRising(k.trend) ? 1.2 : 1;
  return (k.volume / (1 + k.difficolta)) * trendBonus;
}

export function selectCandidates(
  keywords: NormalizedKeyword[],
  { topN = 12 }: { topN?: number } = {},
): NormalizedKeyword[] {
  return keywords
    .filter((k) => k.volume > 0)
    .sort((a, b) => opportunity(b) - opportunity(a))
    .slice(0, topN);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/seozoom/select.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/seozoom/select.ts src/lib/seozoom/select.test.ts
git commit -m "feat: NormalizedKeyword + opportunity-based selectCandidates"
```

---

## Task 4: SEOZoom client + normalizer

**Files:**
- Create: `src/lib/seozoom/client.ts`
- Test: `src/lib/seozoom/client.test.ts`

> ⚠️ **SEOZoom API shape is not known a priori.** The implementer MUST consult the SEOZoom API documentation (WebFetch the SEOZoom API docs, or the user's account API reference) to confirm: the base URL, the auth mechanism (header/query param for `SEOZOOM_API_KEY`), the keyword-research endpoint, and the response field names. The `normalizeSeozoom` function is the single place that maps SEOZoom's raw fields to our `NormalizedKeyword`; adjust ONLY that mapping to the real response. The test below uses a representative raw shape — update the test's sample to match the real response once confirmed, keeping the same assertions on the normalized output.

- [ ] **Step 1: Write the failing test (normalizer)**

`src/lib/seozoom/client.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeSeozoom } from "@/lib/seozoom/client";

describe("normalizeSeozoom", () => {
  it("maps SEOZoom rows to NormalizedKeyword with sensible defaults", () => {
    const raw = [
      { keyword: "magnesio sonno", volume: 1900, kd: 35, trend: "in crescita" },
      { keyword: "magnesio stress", volume: 880 }, // missing kd/trend
    ];
    const out = normalizeSeozoom(raw);
    expect(out[0]).toEqual({ keyword: "magnesio sonno", volume: 1900, difficolta: 35, trend: "in crescita" });
    expect(out[1].keyword).toBe("magnesio stress");
    expect(out[1].volume).toBe(880);
    expect(out[1].difficolta).toBe(50); // default mid difficulty
    expect(out[1].trend).toBe("stabile"); // default
  });

  it("ignores rows without a keyword string", () => {
    expect(normalizeSeozoom([{ volume: 100 }, null, { keyword: "ok", volume: 10 }])).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/seozoom/client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the client + normalizer**

`src/lib/seozoom/client.ts`:
```ts
import type { NormalizedKeyword } from "./select";

// NOTE: confirm base URL + auth + endpoint against the SEOZoom API docs.
const SEOZOOM_BASE = process.env.SEOZOOM_BASE_URL ?? "https://api.seozoom.it";

interface RawRow {
  keyword?: unknown;
  volume?: unknown;
  kd?: unknown;
  difficulty?: unknown;
  difficolta?: unknown;
  trend?: unknown;
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/** Maps SEOZoom raw rows to NormalizedKeyword. The ONLY SEOZoom-format-aware code. */
export function normalizeSeozoom(raw: unknown): NormalizedKeyword[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalizedKeyword[] = [];
  for (const r of raw as RawRow[]) {
    if (!r || typeof r.keyword !== "string" || !r.keyword.trim()) continue;
    out.push({
      keyword: r.keyword.trim(),
      volume: num(r.volume, 0),
      difficolta: num(r.kd ?? r.difficulty ?? r.difficolta, 50),
      trend: typeof r.trend === "string" && r.trend.trim() ? r.trend : "stabile",
    });
  }
  return out;
}

/** Fetches keyword data for a seed from SEOZoom and returns normalized rows. */
export async function fetchKeywords(seed: string): Promise<NormalizedKeyword[]> {
  const key = process.env.SEOZOOM_API_KEY;
  if (!key) throw new Error("SEOZOOM_API_KEY mancante");
  // NOTE: confirm the exact endpoint, query params, and auth header against SEOZoom docs.
  const url = `${SEOZOOM_BASE}/keywords/related?keyword=${encodeURIComponent(seed)}&db=it`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } });
  if (!res.ok) throw new Error(`SEOZoom HTTP ${res.status}`);
  const json = await res.json();
  // NOTE: the array of rows may be nested (e.g. json.data); adjust to the real shape.
  const rows = Array.isArray(json) ? json : (json?.data ?? json?.keywords ?? []);
  return normalizeSeozoom(rows);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/seozoom/client.test.ts`
Expected: PASS (2 tests). (Only the normalizer is unit-tested; `fetchKeywords` HTTP is exercised in the end-to-end smoke test, Task 11.)

- [ ] **Step 5: Verify the SEOZoom API contract**

WebFetch the SEOZoom API documentation and confirm base URL, auth, the keyword endpoint, and response field names. If they differ from the placeholders above, update `SEOZOOM_BASE`, the `fetchKeywords` URL/headers, and the `normalizeSeozoom` field mapping (and the test's sample `raw` rows) to match — keeping the normalized output shape identical. Report exactly what you confirmed/changed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/seozoom/client.ts src/lib/seozoom/client.test.ts
git commit -m "feat: SEOZoom client + normalizer (format-isolated)"
```

---

## Task 5: Shaping schema + prompt builder

**Files:**
- Create: `src/lib/seozoom/schema.ts`, `src/lib/seozoom/prompt.ts`
- Test: `src/lib/seozoom/schema.test.ts`, `src/lib/seozoom/prompt.test.ts`

- [ ] **Step 1: Write the failing schema test**

`src/lib/seozoom/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { shapingOutputSchema } from "@/lib/seozoom/schema";

describe("shapingOutputSchema", () => {
  it("accepts shaped ideas with keyword + classification", () => {
    const v = shapingOutputSchema.parse({
      ideas: [
        { keyword: "magnesio sonno", titolo: "Magnesio e sonno", descrizione: "d", category: "EDUCATIONAL", piattaformeConsigliate: ["BLOG"], motivazione: "m" },
      ],
    });
    expect(v.ideas[0].keyword).toBe("magnesio sonno");
  });
  it("rejects an invalid category", () => {
    expect(() => shapingOutputSchema.parse({ ideas: [{ keyword: "k", titolo: "t", descrizione: "d", category: "ZZZ", piattaformeConsigliate: ["BLOG"], motivazione: "m" }] })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/seozoom/schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schema**

`src/lib/seozoom/schema.ts`:
```ts
import { z } from "zod";
import { IDEA_CATEGORIES, PLATFORMS } from "@/lib/brain/enums";

export const shapedIdeaSchema = z.object({
  keyword: z.string().min(1),
  titolo: z.string().min(1),
  descrizione: z.string(),
  category: z.enum(IDEA_CATEGORIES),
  piattaformeConsigliate: z.array(z.enum(PLATFORMS)).min(1),
  motivazione: z.string(),
});

export const shapingOutputSchema = z.object({
  ideas: z.array(shapedIdeaSchema),
});

export type ShapedIdea = z.infer<typeof shapedIdeaSchema>;
export type ShapingOutput = z.infer<typeof shapingOutputSchema>;
```

- [ ] **Step 4: Run to verify the schema test passes**

Run: `npx vitest run src/lib/seozoom/schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing prompt test**

`src/lib/seozoom/prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildShapingPrompt } from "@/lib/seozoom/prompt";

describe("buildShapingPrompt", () => {
  it("includes candidates, KB, and asks to echo the keyword", () => {
    const p = buildShapingPrompt({
      kbContext: "## Prodotti Agocap\n- Magnesio Supremo",
      prodottoNome: "Magnesio Supremo",
      candidates: [
        { keyword: "magnesio sonno", volume: 1900, difficolta: 35, trend: "in crescita" },
        { keyword: "magnesio stress", volume: 880, difficolta: 40, trend: "stabile" },
      ],
    });
    expect(p).toContain("magnesio sonno");
    expect(p).toContain("1900");
    expect(p).toContain("Magnesio Supremo");
    expect(p.toLowerCase()).toContain("keyword");
    expect(p.toLowerCase()).toContain("json");
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/lib/seozoom/prompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the prompt builder**

`src/lib/seozoom/prompt.ts`:
```ts
import type { NormalizedKeyword } from "./select";

export interface ShapingPromptArgs {
  kbContext: string;
  prodottoNome?: string;
  candidates: NormalizedKeyword[];
}

export function buildShapingPrompt({ kbContext, prodottoNome, candidates }: ShapingPromptArgs): string {
  const lista = candidates
    .map((c) => `- "${c.keyword}" (volume ${c.volume}, difficoltà ${c.difficolta}, trend ${c.trend})`)
    .join("\n");

  return `Sei un esperto di content marketing SEO per Agocap (integratori, benessere, beauty, salute naturale).

Hai questa lista di keyword reali (con metriche da SEOZoom)${prodottoNome ? `, in relazione al prodotto ${prodottoNome}` : ""}:
${lista}

# Knowledge base Agocap (tono di voce, prodotti)
${kbContext}

# Compito
Per OGNI keyword qui sopra, proponi un'idea di contenuto ancorata alla knowledge base. Per ognuna fornisci:
- keyword: la keyword esatta da cui parti (ripetila identica)
- titolo: titolo accattivante in italiano
- descrizione: 1-2 frasi sul contenuto
- category: una tra INTEGRATORI, BEAUTY, BENESSERE, STAGIONALITA, EDUCATIONAL, VENDITA, FAQ, TREND
- piattaformeConsigliate: una o più tra INSTAGRAM, FACEBOOK, TIKTOK, BLOG
- motivazione: perché è rilevante per il target Agocap

Non assegnare punteggi: pensa solo al contenuto.
Rispondi esclusivamente con un oggetto JSON valido della forma {"ideas":[{"keyword":"...","titolo":"...","descrizione":"...","category":"...","piattaformeConsigliate":["..."],"motivazione":"..."}]}, senza testo prima o dopo, senza markdown.`;
}
```

- [ ] **Step 8: Run to verify the prompt test passes + typecheck**

Run: `npx vitest run src/lib/seozoom/prompt.test.ts && npx tsc --noEmit`
Expected: PASS (1 test); tsc exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/lib/seozoom/schema.ts src/lib/seozoom/schema.test.ts src/lib/seozoom/prompt.ts src/lib/seozoom/prompt.test.ts
git commit -m "feat: SEOZoom shaping schema + prompt builder"
```

---

## Task 6: discoverKeywords pipeline (deps injected, fail-safe)

**Files:**
- Create: `src/lib/seozoom/discover.ts`
- Test: `src/lib/seozoom/discover.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/seozoom/discover.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { discoverKeywords } from "@/lib/seozoom/discover";

function makeDeps(overrides = {}) {
  return {
    loadContext: vi.fn().mockResolvedValue({ seeds: ["magnesio"], kbContext: "kb", prodottoNome: undefined }),
    fetchKeywords: vi.fn().mockResolvedValue([
      { keyword: "magnesio sonno", volume: 1900, difficolta: 35, trend: "in crescita" },
      { keyword: "magnesio stress", volume: 880, difficolta: 40, trend: "stabile" },
    ]),
    callClaude: vi.fn().mockResolvedValue({
      ideas: [
        { keyword: "magnesio sonno", titolo: "Magnesio e sonno", descrizione: "d", category: "EDUCATIONAL", piattaformeConsigliate: ["BLOG"], motivazione: "m" },
      ],
      promptUsato: "P", modello: "claude-opus-4-8", inputTokens: 10, outputTokens: 20, rawOutput: {},
    }),
    persist: vi.fn().mockResolvedValue({ runId: "run_1", created: 1 }),
    recordError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("discoverKeywords", () => {
  it("returns DONE with the created count on success", async () => {
    const deps = makeDeps();
    const res = await discoverKeywords({ seeds: ["magnesio"] }, deps as any);
    expect(res.status).toBe("DONE");
    expect(res.created).toBe(1);
    // persist receives candidates (selected from fetched keywords) and the shaped ideas
    const args = (deps.persist as any).mock.calls[0][0];
    expect(args.candidates.length).toBeGreaterThan(0);
    expect(args.claudeResult.ideas).toHaveLength(1);
    expect(deps.recordError).not.toHaveBeenCalled();
  });

  it("records an ERROR run and persists nothing when SEOZoom returns no keywords", async () => {
    const deps = makeDeps({ fetchKeywords: vi.fn().mockResolvedValue([]) });
    const res = await discoverKeywords({ seeds: ["xyz"] }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(deps.persist).not.toHaveBeenCalled();
    expect(deps.recordError).toHaveBeenCalledOnce();
  });

  it("records an ERROR run when Claude throws", async () => {
    const deps = makeDeps({ callClaude: vi.fn().mockRejectedValue(new Error("API down")) });
    const res = await discoverKeywords({ seeds: ["magnesio"] }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(res.error).toContain("API down");
    expect(deps.recordError).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/seozoom/discover.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pipeline**

`src/lib/seozoom/discover.ts`:
```ts
import { selectCandidates, type NormalizedKeyword } from "./select";
import type { ShapingOutput } from "./schema";

export interface DiscoverInput {
  seeds?: string[];
  productId?: string;
  categoria?: string;
  topN?: number;
}

export interface ShapingResult extends ShapingOutput {
  promptUsato: string;
  modello: string;
  inputTokens: number;
  outputTokens: number;
  rawOutput: unknown;
}

export interface SeozoomDeps {
  loadContext: (input: DiscoverInput) => Promise<{ seeds: string[]; kbContext: string; prodottoNome?: string }>;
  fetchKeywords: (seed: string) => Promise<NormalizedKeyword[]>;
  callClaude: (args: { kbContext: string; prodottoNome?: string; candidates: NormalizedKeyword[] }) => Promise<ShapingResult>;
  persist: (args: { input: DiscoverInput; candidates: NormalizedKeyword[]; claudeResult: ShapingResult }) => Promise<{ runId: string; created: number }>;
  recordError: (input: DiscoverInput, message: string) => Promise<void>;
}

export interface DiscoverResult {
  status: "DONE" | "ERROR";
  created: number;
  runId?: string;
  error?: string;
}

export async function discoverKeywords(input: DiscoverInput, deps: SeozoomDeps): Promise<DiscoverResult> {
  try {
    const { seeds, kbContext, prodottoNome } = await deps.loadContext(input);
    const fetched = (await Promise.all(seeds.map((s) => deps.fetchKeywords(s)))).flat();
    const candidates = selectCandidates(fetched, { topN: input.topN ?? 12 });
    if (candidates.length === 0) throw new Error("Nessuna keyword trovata da SEOZoom per i seed indicati");

    const claudeResult = await deps.callClaude({ kbContext, prodottoNome, candidates });
    const { runId, created } = await deps.persist({ input, candidates, claudeResult });
    return { status: "DONE", created, runId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await deps.recordError(input, message);
    } catch {
      // recording the error run failed too; keep the original error
    }
    return { status: "ERROR", created: 0, error: message };
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/seozoom/discover.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/seozoom/discover.ts src/lib/seozoom/discover.test.ts
git commit -m "feat: SEOZoom discover pipeline (injected deps, fail-safe)"
```

---

## Task 7: Runtime wiring (SEOZoom + Claude + Prisma)

**Files:**
- Create: `src/lib/seozoom/runtime.ts`
- Test: `src/lib/seozoom/runtime.test.ts`

Builds the real `SeozoomDeps`. `loadContext` derives seeds from free seeds or a product/category; `callClaude` reuses the proven `claude.messages.create` JSON pattern; `persist` reattaches each shaped idea to its candidate keyword, computes `seoScore`, dedupes, and writes `Idea` + `GenerationRun`. Only the pure helper `matchCandidate` is unit-tested.

- [ ] **Step 1: Write the failing test**

`src/lib/seozoom/runtime.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { matchCandidate } from "@/lib/seozoom/runtime";

const cands = [
  { keyword: "Magnesio Sonno", volume: 1900, difficolta: 35, trend: "in crescita" },
  { keyword: "vitamina c", volume: 500, difficolta: 20, trend: "stabile" },
];

describe("matchCandidate", () => {
  it("matches case-insensitively/trimmed", () => {
    expect(matchCandidate(" magnesio sonno ", cands)?.volume).toBe(1900);
  });
  it("returns null when no candidate matches", () => {
    expect(matchCandidate("sconosciuta", cands)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/seozoom/runtime.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the runtime deps**

`src/lib/seozoom/runtime.ts`:
```ts
import { prisma } from "@/lib/prisma";
import { getClaude, BRAINSTORM_MODEL } from "@/lib/claude";
import { buildKbContext } from "@/lib/brain/context";
import { dedupeIdeas } from "@/lib/brain/dedupe";
import { fetchKeywords } from "./client";
import { buildShapingPrompt } from "./prompt";
import { shapingOutputSchema } from "./schema";
import { metricsToSeoScore } from "./score";
import type { NormalizedKeyword } from "./select";
import type { SeozoomDeps, ShapingResult } from "./discover";

export function matchCandidate(keyword: string, candidates: NormalizedKeyword[]): NormalizedKeyword | null {
  const target = keyword.trim().toLowerCase();
  return candidates.find((c) => c.keyword.trim().toLowerCase() === target) ?? null;
}

function stripFences(text: string): string {
  return text.replace(/^```\w*\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

export function buildSeozoomDeps(): SeozoomDeps {
  return {
    loadContext: async (input) => {
      const knowledge = await prisma.knowledgeItem.findMany();
      let seeds = (input.seeds ?? []).map((s) => s.trim()).filter(Boolean);
      let prodottoNome: string | undefined;
      let products: Awaited<ReturnType<typeof prisma.product.findMany>> = [];

      if (input.productId) {
        const product = await prisma.product.findUnique({ where: { id: input.productId } });
        if (product) {
          products = [product];
          prodottoNome = product.nome;
          if (seeds.length === 0) {
            seeds = [product.nome, product.categoria].filter((x): x is string => !!x);
          }
        }
      } else if (input.categoria && seeds.length === 0) {
        seeds = [input.categoria];
      }

      if (seeds.length === 0) throw new Error("Nessun seed: fornisci termini o un prodotto/categoria");
      const kbContext = buildKbContext({ products, knowledge });
      return { seeds, kbContext, prodottoNome };
    },

    fetchKeywords,

    callClaude: async ({ kbContext, prodottoNome, candidates }): Promise<ShapingResult> => {
      const prompt = buildShapingPrompt({ kbContext, prodottoNome, candidates });
      const claude = getClaude();
      const response = await claude.messages.create({
        model: BRAINSTORM_MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("Output AI non conforme");
      const parsed = shapingOutputSchema.parse(JSON.parse(stripFences(textBlock.text)));
      return {
        ideas: parsed.ideas,
        promptUsato: prompt,
        modello: BRAINSTORM_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        rawOutput: response.content,
      };
    },

    persist: async ({ input, candidates, claudeResult }) => {
      const source = await prisma.signalSource.findUniqueOrThrow({ where: { key: "seozoom" } });
      const existing = (await prisma.idea.findMany({ select: { titolo: true } })).map((i) => i.titolo);
      const fresh = dedupeIdeas(claudeResult.ideas, existing);

      const created = await prisma.$transaction(async (tx) => {
        const run = await tx.generationRun.create({
          data: {
            sourceId: source.id,
            input: input as object,
            promptUsato: claudeResult.promptUsato,
            modello: claudeResult.modello,
            inputTokens: claudeResult.inputTokens,
            outputTokens: claudeResult.outputTokens,
            outputGrezzo: (claudeResult.rawOutput ?? {}) as object,
            status: "DONE",
          },
        });
        if (fresh.length > 0) {
          await tx.idea.createMany({
            data: fresh.map((idea) => {
              const m = matchCandidate(idea.keyword, candidates);
              return {
                titolo: idea.titolo,
                descrizione: idea.descrizione,
                category: idea.category,
                piattaformeConsigliate: idea.piattaformeConsigliate,
                seoScore: m ? metricsToSeoScore({ volume: m.volume, difficolta: m.difficolta }) : 3,
                keyword: idea.keyword,
                volumeRicerca: m?.volume ?? null,
                difficolta: m?.difficolta ?? null,
                trendKeyword: m?.trend ?? null,
                sourceId: source.id,
                generationRunId: run.id,
              };
            }),
          });
        }
        return fresh.length;
      });
      const run = await prisma.generationRun.findFirstOrThrow({ where: { sourceId: source.id }, orderBy: { createdAt: "desc" } });
      return { runId: run.id, created };
    },

    recordError: async (input, message) => {
      const source = await prisma.signalSource.findUniqueOrThrow({ where: { key: "seozoom" } });
      await prisma.generationRun.create({
        data: { sourceId: source.id, input: input as object, status: "ERROR", errore: message },
      });
    },
  };
}
```

> Note: `dedupeIdeas(claudeResult.ideas, existing)` works because `ShapedIdea` has a `titolo` field (the dedupe helper is generic over `{ titolo: string }`).

- [ ] **Step 4: Verify the helper test + typecheck + full suite**

Run: `npx vitest run src/lib/seozoom/runtime.test.ts && npx tsc --noEmit && npx vitest run`
Expected: 2 tests pass; tsc exits 0; full suite green. If tsc flags `idea.category` (enum) vs string in the createMany `category` field, it's fine (category is already a valid `IdeaCategory` literal from the zod enum). If `dedupeIdeas` generic complains, ensure `ShapedIdea` is passed (it has `titolo`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/seozoom/runtime.ts src/lib/seozoom/runtime.test.ts
git commit -m "feat: SEOZoom runtime deps (seeds, Claude shaping, persist with real metrics)"
```

---

## Task 8: API — validators + discover route

**Files:**
- Create: `src/app/api/seozoom/validators.ts`, `src/app/api/seozoom/discover/route.ts`, `src/app/api/seozoom/discover/deps-registry.ts`
- Test: `src/app/api/seozoom/validators.test.ts`, `src/app/api/seozoom/discover/route.test.ts`

- [ ] **Step 1: Write the failing validators test**

`src/app/api/seozoom/validators.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { discoverInputSchema } from "@/app/api/seozoom/validators";

describe("discoverInputSchema", () => {
  it("accepts free seeds", () => {
    expect(discoverInputSchema.parse({ seeds: ["magnesio"] }).seeds).toEqual(["magnesio"]);
  });
  it("accepts a productId", () => {
    expect(discoverInputSchema.parse({ productId: "p1" }).productId).toBe("p1");
  });
  it("rejects when neither seeds nor product/categoria provided", () => {
    expect(() => discoverInputSchema.parse({})).toThrow();
  });
  it("bounds topN", () => {
    expect(() => discoverInputSchema.parse({ seeds: ["x"], topN: 999 })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/api/seozoom/validators.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the validators**

`src/app/api/seozoom/validators.ts`:
```ts
import { z } from "zod";

export const discoverInputSchema = z
  .object({
    seeds: z.array(z.string().min(1)).optional(),
    productId: z.string().min(1).optional(),
    categoria: z.string().min(1).optional(),
    topN: z.number().int().min(1).max(30).optional(),
  })
  .refine(
    (v) => (v.seeds && v.seeds.length > 0) || !!v.productId || !!v.categoria,
    { message: "Fornisci almeno un seed, oppure un prodotto/categoria" },
  );
```

- [ ] **Step 4: Run to verify the validators test passes**

Run: `npx vitest run src/app/api/seozoom/validators.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the deps-registry seam**

`src/app/api/seozoom/discover/deps-registry.ts`:
```ts
import { discoverKeywords } from "@/lib/seozoom/discover";

export type DepsFactory = () => { __run?: typeof discoverKeywords } & Record<string, unknown>;

let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) {
  depsFactory = f;
}
export function getDepsFactory(): DepsFactory {
  return depsFactory;
}
```

- [ ] **Step 6: Write the failing route test**

`src/app/api/seozoom/discover/route.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/seozoom/discover/route";
import { __setDepsFactory } from "@/app/api/seozoom/discover/deps-registry";

function req(body: unknown) {
  return new Request("http://test/api/seozoom/discover", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/seozoom/discover", () => {
  it("returns 200 with created count on success", async () => {
    const spy = vi.fn().mockResolvedValue({ status: "DONE", created: 5, runId: "r1" });
    __setDepsFactory(() => ({ __run: spy }) as any);
    const res = await POST(req({ seeds: ["magnesio"] }));
    expect(res.status).toBe(200);
    expect((await res.json()).created).toBe(5);
  });

  it("returns 400 when neither seeds nor product/categoria", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/app/api/seozoom/discover/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 8: Implement the route**

`src/app/api/seozoom/discover/route.ts`:
```ts
import { NextResponse } from "next/server";
import { discoverKeywords } from "@/lib/seozoom/discover";
import { buildSeozoomDeps } from "@/lib/seozoom/runtime";
import { discoverInputSchema } from "../validators";
import { getDepsFactory } from "./deps-registry";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const parsed = discoverInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido", details: parsed.error.flatten() }, { status: 400 });
  }

  const injected = getDepsFactory()();
  const run = injected.__run ?? discoverKeywords;
  const deps = injected.__run ? ({} as never) : buildSeozoomDeps();

  const result = await run(parsed.data, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
```

- [ ] **Step 9: Verify route test + full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all suites pass; tsc exits 0.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/seozoom/
git commit -m "feat: SEOZoom validators + POST /api/seozoom/discover route"
```

---

## Task 9: UI — Scopri keyword page + dashboard source filter & metric columns

**Files:**
- Create: `src/app/brain/scopri/page.tsx`
- Modify: `src/app/api/ideas/route.ts`, `src/components/idea-filters.tsx`, `src/components/idea-table.tsx`, `src/components/nav.tsx`

- [ ] **Step 1: Add the `source` filter to the ideas list API**

In `src/app/api/ideas/route.ts`, modify the GET handler. Replace its body with:
```ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const where: Record<string, unknown> = {};
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const platform = searchParams.get("platform");
  const productId = searchParams.get("productId");
  const source = searchParams.get("source");
  if (status) where.status = status;
  if (category) where.category = category;
  if (platform) where.piattaformeConsigliate = { has: platform };
  if (productId) where.productId = productId;
  if (source) where.source = { key: source };

  const ideas = await prisma.idea.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: { product: { select: { nome: true } }, source: { select: { key: true } } },
  });
  return NextResponse.json(ideas);
}
```
(Leave the POST handler unchanged.)

- [ ] **Step 2: Add a source select to the filters**

Replace `src/components/idea-filters.tsx` with:
```tsx
"use client";

import { IDEA_STATUSES, IDEA_CATEGORIES, PLATFORMS } from "@/lib/brain/enums";

export interface Filters {
  status: string;
  category: string;
  platform: string;
  source: string;
}

const SOURCES = [
  { key: "", label: "Tutte le sorgenti" },
  { key: "ai-brainstorming", label: "AI" },
  { key: "manuale", label: "Manuale" },
  { key: "seozoom", label: "SEOZoom" },
];

export function IdeaFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  return (
    <div className="mb-4 flex gap-3 text-sm">
      <select value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value })} className="rounded border p-1">
        <option value="">Tutti gli stati</option>
        {IDEA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={filters.category} onChange={(e) => onChange({ ...filters, category: e.target.value })} className="rounded border p-1">
        <option value="">Tutte le categorie</option>
        {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={filters.platform} onChange={(e) => onChange({ ...filters, platform: e.target.value })} className="rounded border p-1">
        <option value="">Tutte le piattaforme</option>
        {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <select value={filters.source} onChange={(e) => onChange({ ...filters, source: e.target.value })} className="rounded border p-1">
        {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: Show keyword/volume/difficoltà columns in the table**

Replace `src/components/idea-table.tsx` with:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { IdeaFilters, type Filters } from "./idea-filters";

interface Idea {
  id: string;
  titolo: string;
  category: string;
  piattaformeConsigliate: string[];
  seoScore: number;
  viralityScore: number;
  priority: number;
  status: string;
  keyword?: string | null;
  volumeRicerca?: number | null;
  difficolta?: number | null;
  product?: { nome: string } | null;
}

export function IdeaTable() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [filters, setFilters] = useState<Filters>({ status: "", category: "", platform: "", source: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filters.status) qs.set("status", filters.status);
    if (filters.category) qs.set("category", filters.category);
    if (filters.platform) qs.set("platform", filters.platform);
    if (filters.source) qs.set("source", filters.source);
    const res = await fetch(`/api/ideas?${qs.toString()}`);
    setIdeas(await res.json());
    setSelected(new Set());
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkStatus = async (status: string) => {
    if (selected.size === 0) return;
    await fetch("/api/ideas/bulk-status", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [...selected], status }),
    });
    await load();
  };

  return (
    <div>
      <IdeaFilters filters={filters} onChange={setFilters} />
      <div className="mb-3 flex gap-2 text-sm">
        <button onClick={() => bulkStatus("APPROVATA")} className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0}>Approva ({selected.size})</button>
        <button onClick={() => bulkStatus("SCARTATA")} className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0}>Scarta</button>
        <button onClick={() => bulkStatus("INTERESSANTE")} className="rounded bg-amber-500 px-3 py-1 text-white disabled:opacity-40" disabled={selected.size === 0}>Interessante</button>
      </div>
      {loading ? <p>Caricamento…</p> : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="p-2"></th>
              <th className="p-2">Titolo</th>
              <th className="p-2">Categoria</th>
              <th className="p-2">Keyword</th>
              <th className="p-2">Vol.</th>
              <th className="p-2">Diff.</th>
              <th className="p-2">SEO</th>
              <th className="p-2">Prio</th>
              <th className="p-2">Stato</th>
            </tr>
          </thead>
          <tbody>
            {ideas.map((i) => (
              <tr key={i.id} className="border-b hover:bg-neutral-50">
                <td className="p-2"><input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} /></td>
                <td className="p-2"><Link href={`/ideas/${i.id}`} className="text-blue-600 hover:underline">{i.titolo}</Link></td>
                <td className="p-2">{i.category}</td>
                <td className="p-2">{i.keyword ?? "—"}</td>
                <td className="p-2">{i.volumeRicerca ?? "—"}</td>
                <td className="p-2">{i.difficolta ?? "—"}</td>
                <td className="p-2">{i.seoScore}</td>
                <td className="p-2">{i.priority}</td>
                <td className="p-2">{i.status}</td>
              </tr>
            ))}
            {ideas.length === 0 && <tr><td colSpan={9} className="p-4 text-neutral-500">Nessuna idea.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add the "Scopri keyword" nav link**

In `src/components/nav.tsx`, add to the `links` array after the "Genera Idee" entry:
```tsx
  { href: "/brain/scopri", label: "Scopri keyword" },
```

- [ ] **Step 5: Create the "Scopri keyword" page**

`src/app/brain/scopri/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

interface Product { id: string; nome: string; }

export default function ScopriPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [seedsText, setSeedsText] = useState("");
  const [productId, setProductId] = useState("");
  const [topN, setTopN] = useState(12);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then(setProducts);
  }, []);

  const submit = async () => {
    const seeds = seedsText.split(",").map((s) => s.trim()).filter(Boolean);
    if (seeds.length === 0 && !productId) {
      setStatus("Inserisci almeno un seed oppure scegli un prodotto.");
      return;
    }
    setBusy(true); setStatus(null);
    const body: Record<string, unknown> = { topN: Number(topN) };
    if (seeds.length > 0) body.seeds = seeds;
    if (productId) body.productId = productId;
    const res = await fetch("/api/seozoom/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);
    setStatus(res.ok ? `Create ${json.created} idee da SEOZoom. Vai alla Dashboard Idee.` : `Errore: ${json.error ?? "sconosciuto"}`);
  };

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-2xl font-semibold">Scopri keyword (SEOZoom)</h1>
      <div className="space-y-3">
        <input className="w-full rounded border p-2" placeholder="Seed liberi separati da virgola (es. magnesio, sonno)" value={seedsText} onChange={(e) => setSeedsText(e.target.value)} />
        <div className="text-sm text-neutral-500">oppure parti da un prodotto:</div>
        <select className="w-full rounded border p-2" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Nessun prodotto</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <input type="number" min={1} max={30} className="w-full rounded border p-2" value={topN} onChange={(e) => setTopN(Number(e.target.value))} />
        <button onClick={submit} disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40">{busy ? "Scopro…" : "Scopri"}</button>
      </div>
      {status && <p className="mt-4 text-sm">{status}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds (the new route + page compile).

- [ ] **Step 7: Commit**

```bash
git add src/app/brain/scopri/page.tsx src/app/api/ideas/route.ts src/components/idea-filters.tsx src/components/idea-table.tsx src/components/nav.tsx
git commit -m "feat: Scopri keyword page + dashboard source filter and metric columns"
```

---

## Task 10: Env + Docker — SEOZOOM_API_KEY

**Files:**
- Modify: `.env.example`, `docker-compose.yml`

- [ ] **Step 1: Add to `.env.example`**

Append:
```
SEOZOOM_API_KEY="AK-..."
```

- [ ] **Step 2: Add to the app service in `docker-compose.yml`**

In the `app` service `environment:` block add:
```yaml
      SEOZOOM_API_KEY: "${SEOZOOM_API_KEY}"
```

- [ ] **Step 3: Validate compose**

Run: `docker compose config`
Expected: exits 0; `SEOZOOM_API_KEY` wired into the app environment. If docker unavailable, validate the YAML by reading and report.

- [ ] **Step 4: Commit**

```bash
git add .env.example docker-compose.yml
git commit -m "feat: SEOZOOM_API_KEY env wiring"
```

---

## Task 11: End-to-end verification

**Files:** none — verification only. Requires real `SEOZOOM_API_KEY` + `ANTHROPIC_API_KEY`, and a confirmed SEOZoom API contract (Task 4 step 5).

- [ ] **Step 1: Full suite + typecheck + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests pass; tsc 0; build succeeds.

- [ ] **Step 2: Migrate**

Run: `npx prisma migrate deploy` then `npm run prisma:seed`. Confirm the `seozoom` source exists.

- [ ] **Step 3: Start the dev server with both keys**

Run (background): `SEOZOOM_API_KEY=... ANTHROPIC_API_KEY=... PORT=8001 npm run dev`. Wait until it responds.

- [ ] **Step 4: Live discovery**

`POST http://localhost:8001/api/seozoom/discover` with `{"seeds":["magnesio"],"topN":8}` (timeout ~150s).
Expected: 200 `{"status":"DONE","created":N}` with N ≥ 1. If SEOZoom returns a 4xx (bad endpoint/auth), the API contract from Task 4 is wrong — fix `client.ts`/`normalizeSeozoom` against the real docs and retry. Report the exact SEOZoom error if it fails.

- [ ] **Step 5: Verify ideas carry real metrics**

`GET http://localhost:8001/api/ideas?source=seozoom` → ideas with non-null `keyword`, `volumeRicerca`, `difficolta`, and a `seoScore` consistent with `metricsToSeoScore`. Confirm a `GenerationRun` (source seozoom) with `status=DONE`, `modello=claude-opus-4-8`, non-zero tokens exists. Open `/brain/scopri` and `/dashboard` in a browser; confirm the SEOZoom ideas show in the table with the keyword/volume/difficoltà columns and the source filter works.

- [ ] **Step 6: Stop the server. Report honestly.**

Report: vitest count, build outcome, the confirmed SEOZoom endpoint/auth, the exact discover response, and a sample idea with its real metrics. If the SEOZoom key/contract is unavailable, run steps 1-2 only and report that live discovery needs the user's key + confirmed API contract (unit suite + build still validate the wiring).

---

## Self-Review notes (addressed)

- **Spec coverage:** Idea metric fields + seozoom source (T1); metricsToSeoScore real-score (T2); opportunity selection (T3); SEOZoom client + format-isolating normalizer + API-contract verification (T4); shaping schema + prompt (T5); fail-safe hybrid pipeline incl. ERROR-run recording + zero-keyword path (T6); runtime wiring deriving seeds from product/category, Claude shaping, persist reattaching metrics + computed seoScore + dedupe + GenerationRun audit (T7); validators (seeds OR product/categoria) + discover route with seam (T8); Scopri keyword page + dashboard source filter + metric columns + nav (T9); env/Docker (T10); live end-to-end (T11). GSC/Trends/Blog explicitly out of scope (roadmap).
- **Type consistency:** `NormalizedKeyword` defined in `select.ts` (T3) and consumed in `client.ts`/`prompt.ts`/`discover.ts`/`runtime.ts`; `SeozoomDeps`/`DiscoverInput`/`ShapingResult` defined in `discover.ts` (T6) and consumed in `runtime.ts` (T7) and the route (T8); `shapingOutputSchema`/`ShapedIdea` (T5) consumed in `runtime.ts`; `metricsToSeoScore`/`SeoMetrics` (T2) consumed in `runtime.ts`; the `source` filter added in T9 matches the `seozoom` source key seeded in T1; `Filters` gains `source` consistently across idea-filters and idea-table (T9).
- **No placeholders:** every code/test step is complete; the SEOZoom-contract uncertainty is handled with an explicit verify-against-docs step (T4 step 5) and a live-failure fallback (T11 step 4), not a placeholder.
