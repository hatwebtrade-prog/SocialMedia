# SEOZoom KD Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the SEOZoom keyword pipeline with real keyword difficulty (KD) from SEOZoom's `metrics` action, and make candidate selection difficulty-aware (volume↑ + difficulty↓), so the Brain surfaces genuinely winnable queries.

**Architecture:** Extends the existing SEOZoom source. `discoverKeywords` becomes two-phase: select a larger pool by volume → `enrichDifficulty(pool)` (real KD via `metrics`) → final `selectCandidates` by real opportunity. KD enrichment degrades gracefully (on any `metrics` error it returns the pool with neutral difficulty so the discovery still completes). No DB/UI schema change — `difficolta`/`seoScore` simply become real.

**Tech Stack:** Next.js 15, Prisma/Postgres, `@anthropic-ai/sdk` (`claude-opus-4-8`), SEOZoom REST API (`SEOZOOM_API_KEY`), Vitest.

**Branch:** `seozoom-kd` (off `brain-mvp-clean`). Local Postgres via `.env`.

**Existing code this extends:** `src/lib/seozoom/client.ts` (`fetchKeywords`/`normalizeSeozoom`, base `https://apiv2.seozoom.com/api/v2/keywords/`, auth `?api_key=`, action `related`), `select.ts` (`selectCandidates`, `NormalizedKeyword`), `discover.ts` (`discoverKeywords`, `SeozoomDeps`), `runtime.ts` (`buildSeozoomDeps`, `matchCandidate`).

---

## Task 1: SEOZoom metrics client — fetchDifficulty + normalizeMetrics

**Files:**
- Modify: `src/lib/seozoom/client.ts`
- Test: `src/lib/seozoom/client.test.ts` (add to the existing file)

- [ ] **Step 1: Add a failing test for `normalizeMetrics`**

Append to `src/lib/seozoom/client.test.ts`:
```ts
import { normalizeMetrics } from "@/lib/seozoom/client";

describe("normalizeMetrics", () => {
  it("maps metrics rows to a keyword→KD map (lowercased keys)", () => {
    const m = normalizeMetrics([
      { keyword: "Magnesio Sonno", KD: 42 },
      { keyword: "vitamina c", difficulty: 70 },
    ]);
    expect(m.get("magnesio sonno")).toBe(42);
    expect(m.get("vitamina c")).toBe(70);
  });
  it("skips rows without a keyword or without a numeric KD", () => {
    const m = normalizeMetrics([{ keyword: "x" }, { KD: 5 }, null]);
    expect(m.size).toBe(0);
  });
});
```
(The existing `normalizeSeozoom` tests stay; `normalizeMetrics` is the new export. The top `import` in the test file may need `normalizeMetrics` added — add it to the existing import from `@/lib/seozoom/client`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/seozoom/client.test.ts`
Expected: FAIL — `normalizeMetrics` is not exported.

- [ ] **Step 3: Implement `normalizeMetrics` + `fetchDifficulty` in `client.ts`**

Add to `src/lib/seozoom/client.ts` (after the existing `fetchKeywords`):
```ts
interface MetricRow {
  keyword?: unknown;
  KD?: unknown;
  kd?: unknown;
  difficulty?: unknown;
  difficolta?: unknown;
}

/**
 * Maps SEOZoom `metrics` rows to a Map of lowercased-keyword → KD (0-100).
 * The ONLY code aware of the metrics response shape. Skips rows without a
 * keyword string or without a finite numeric KD.
 */
export function normalizeMetrics(raw: unknown): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(raw)) return map;
  for (const r of raw as MetricRow[]) {
    if (!r || typeof r.keyword !== "string" || !r.keyword.trim()) continue;
    const kdRaw = r.KD ?? r.kd ?? r.difficulty ?? r.difficolta;
    const kd = typeof kdRaw === "string" ? Number(kdRaw) : kdRaw;
    if (typeof kd !== "number" || !Number.isFinite(kd)) continue;
    map.set(r.keyword.trim().toLowerCase(), kd);
  }
  return map;
}

/**
 * Fetches real keyword difficulty (KD) for a batch of keywords via the SEOZoom
 * `metrics` action. Returns a Map of lowercased-keyword → KD.
 *
 * NOTE: the exact `metrics` request shape (batch vs per-keyword, param name,
 * KD field name, units cost, 20-req/min rate limit) MUST be confirmed against
 * the SEOZoom API docs / live response (Task 4). The URL below is the starting
 * point; the smoke test finalizes it. Throws on a non-ok HTTP response so the
 * caller (enrichDifficulty) can degrade.
 */
export async function fetchDifficulty(keywords: string[]): Promise<Map<string, number>> {
  if (keywords.length === 0) return new Map();
  const key = process.env.SEOZOOM_API_KEY;
  if (!key) throw new Error("SEOZOOM_API_KEY mancante");
  const base = SEOZOOM_BASE.replace(/\/$/, "");
  // NOTE: confirm the metrics endpoint + how keywords are passed (batch comma list
  // vs repeated param vs per-keyword) against SEOZoom docs in Task 4.
  const kwParam = encodeURIComponent(keywords.join(","));
  const url = `${base}/?action=metrics&keyword=${kwParam}&db=it&api_key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`SEOZoom metrics HTTP ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json) ? json : (json?.response ?? json?.data ?? json?.keywords ?? []);
  return normalizeMetrics(rows);
}
```

- [ ] **Step 4: Run to verify the normalizer tests pass**

Run: `npx vitest run src/lib/seozoom/client.test.ts && npx tsc --noEmit`
Expected: all normalizer tests pass (existing + 2 new); tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seozoom/client.ts src/lib/seozoom/client.test.ts
git commit -m "feat: SEOZoom metrics client (fetchDifficulty + normalizeMetrics)"
```

---

## Task 2: Two-phase pipeline (pool → enrich → final select)

**Files:**
- Modify: `src/lib/seozoom/discover.ts`
- Test: `src/lib/seozoom/discover.test.ts`

- [ ] **Step 1: Update the failing test for the new pipeline shape**

In `src/lib/seozoom/discover.test.ts`, add `enrichDifficulty` to the `makeDeps` factory (default: passes the keywords through unchanged), and add a test that enrichment changes the final ranking. Add this inside `makeDeps`'s returned object:
```ts
    enrichDifficulty: vi.fn().mockImplementation(async (kws) => kws),
```
And add this new test inside the `describe("discoverKeywords", ...)` block:
```ts
  it("uses enriched difficulty for the final selection", async () => {
    const deps = makeDeps({
      // pool: two keywords; "big" has higher volume but very high difficulty,
      // "easy" has lower volume but very low difficulty
      fetchKeywords: vi.fn().mockResolvedValue([
        { keyword: "big", volume: 5000, difficolta: 50, trend: "stabile" },
        { keyword: "easy", volume: 2000, difficolta: 50, trend: "stabile" },
      ]),
      // enrichment reveals real KD: big is very hard, easy is very easy
      enrichDifficulty: vi.fn().mockImplementation(async (kws: any[]) =>
        kws.map((k) => ({ ...k, difficolta: k.keyword === "big" ? 95 : 5 })),
      ),
      callClaude: vi.fn().mockResolvedValue({
        ideas: [], promptUsato: "P", modello: "claude-opus-4-8", inputTokens: 1, outputTokens: 1, rawOutput: {},
      }),
      persist: vi.fn().mockResolvedValue({ runId: "r", created: 0 }),
    });
    await discoverKeywords({ seeds: ["x"], topN: 1 }, deps as any);
    // enrichDifficulty was called with the volume-selected pool
    expect(deps.enrichDifficulty).toHaveBeenCalledOnce();
    // after enrichment, "easy" (KD 5) beats "big" (KD 95) on opportunity → it is the top candidate sent to Claude
    const candidatesToClaude = (deps.callClaude as any).mock.calls[0][0].candidates;
    expect(candidatesToClaude[0].keyword).toBe("easy");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/seozoom/discover.test.ts`
Expected: FAIL — `deps.enrichDifficulty` is not invoked / not in the type, and the candidate is still "big".

- [ ] **Step 3: Update `discover.ts` — add the dep and the two-phase selection**

In `src/lib/seozoom/discover.ts`:

Add `enrichDifficulty` to `SeozoomDeps` (after `fetchKeywords`):
```ts
  enrichDifficulty: (keywords: NormalizedKeyword[]) => Promise<NormalizedKeyword[]>;
```

Replace the body of the `try` block in `discoverKeywords` (lines that build `fetched`/`candidates` and call Claude/persist) with:
```ts
    const { seeds, kbContext, prodottoNome } = await deps.loadContext(input);
    const fetched = (await Promise.all(seeds.map((s) => deps.fetchKeywords(s)))).flat();

    const POOL_SIZE = 40;
    const pool = selectCandidates(fetched, { topN: POOL_SIZE });
    if (pool.length === 0) throw new Error("Nessuna keyword trovata da SEOZoom per i seed indicati");

    const enriched = await deps.enrichDifficulty(pool);
    const candidates = selectCandidates(enriched, { topN: input.topN ?? 12 });

    const claudeResult = await deps.callClaude({ kbContext, prodottoNome, candidates });
    const { runId, created } = await deps.persist({ input, candidates, claudeResult });
    return { status: "DONE", created, runId };
```
(The `catch` block — recordError + return ERROR — stays unchanged.)

- [ ] **Step 4: Run to verify it passes + full suite**

Run: `npx vitest run src/lib/seozoom/discover.test.ts && npx vitest run && npx tsc --noEmit`
Expected: the new + existing discover tests pass; full suite green; tsc 0. (The existing discover tests already pass `enrichDifficulty` via the updated `makeDeps`, so they keep working.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/seozoom/discover.ts src/lib/seozoom/discover.test.ts
git commit -m "feat: two-phase SEOZoom pipeline (pool -> enrich KD -> difficulty-aware select)"
```

---

## Task 3: Runtime enrichDifficulty (real KD + graceful degrade)

**Files:**
- Modify: `src/lib/seozoom/runtime.ts`
- Test: `src/lib/seozoom/runtime.test.ts` (add to the existing file)

- [ ] **Step 1: Add a failing test for `enrichWithKd` (the pure merge helper)**

Append to `src/lib/seozoom/runtime.test.ts`:
```ts
import { enrichWithKd } from "@/lib/seozoom/runtime";

describe("enrichWithKd", () => {
  const pool = [
    { keyword: "Magnesio Sonno", volume: 1900, difficolta: 50, trend: "stabile" },
    { keyword: "vitamina c", volume: 500, difficolta: 50, trend: "stabile" },
  ];
  it("replaces difficolta with real KD where present (case-insensitive)", () => {
    const kd = new Map<string, number>([["magnesio sonno", 30]]);
    const out = enrichWithKd(pool, kd);
    expect(out[0].difficolta).toBe(30);
    expect(out[1].difficolta).toBe(50); // unchanged when no KD
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/seozoom/runtime.test.ts`
Expected: FAIL — `enrichWithKd` is not exported.

- [ ] **Step 3: Implement `enrichWithKd` + wire `enrichDifficulty` into `buildSeozoomDeps`**

In `src/lib/seozoom/runtime.ts`:

Add the import for `fetchDifficulty` to the existing client import:
```ts
import { fetchKeywords, fetchDifficulty } from "./client";
```

Add the pure helper (near `matchCandidate`):
```ts
/** Returns the pool with `difficolta` replaced by real KD where the keyword has one. */
export function enrichWithKd(
  pool: NormalizedKeyword[],
  kd: Map<string, number>,
): NormalizedKeyword[] {
  return pool.map((k) => {
    const real = kd.get(k.keyword.trim().toLowerCase());
    return typeof real === "number" ? { ...k, difficolta: real } : k;
  });
}
```

Add `enrichDifficulty` to the object returned by `buildSeozoomDeps` (alongside `fetchKeywords`):
```ts
    enrichDifficulty: async (keywords) => {
      try {
        const kd = await fetchDifficulty(keywords.map((k) => k.keyword));
        return enrichWithKd(keywords, kd);
      } catch {
        // Degrade: keep the volume-selected pool with neutral difficulty so the
        // discovery still completes (KD enrichment is best-effort).
        return keywords;
      }
    },
```

- [ ] **Step 4: Run to verify it passes + full suite + typecheck**

Run: `npx vitest run src/lib/seozoom/runtime.test.ts && npx vitest run && npx tsc --noEmit`
Expected: the new helper test + existing `matchCandidate` tests pass; full suite green; tsc 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seozoom/runtime.ts src/lib/seozoom/runtime.test.ts
git commit -m "feat: runtime enrichDifficulty (real KD via metrics, graceful degrade)"
```

---

## Task 4: End-to-end verification + finalize the `metrics` contract

**Files:** possibly `src/lib/seozoom/client.ts` (finalize `fetchDifficulty` URL after live check). Requires real `SEOZOOM_API_KEY` + `ANTHROPIC_API_KEY`.

- [ ] **Step 1: Full suite + typecheck + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 2: Confirm the SEOZoom `metrics` contract live**

Probe the `metrics` action directly to confirm the request shape and KD field. Try the batch form first:
```bash
curl -s "https://apiv2.seozoom.com/api/v2/keywords/?action=metrics&keyword=magnesio,magnesio%20sonno&db=it&api_key=$SEOZOOM_API_KEY" | head -c 1500
```
Report the exact JSON: is it a `{response:[...]}` wrapper? Does each row carry the keyword + a KD/difficulty field (and what's it called)? Does passing multiple comma-separated keywords return multiple rows (batch works), or only one (per-keyword required)?
- If the field name / wrapper differ from `normalizeMetrics`'s aliases (`KD`/`kd`/`difficulty`/`difficolta`) or the row container differs, update `normalizeMetrics` / the `rows` extraction accordingly.
- If the request must be **per-keyword** (batch not supported), change `fetchDifficulty` to loop per keyword. To respect the documented 20-req/min rate limit, also lower `POOL_SIZE` in `discover.ts` from 40 to **15** so a single discovery stays within one rate-limit window. (enrichDifficulty already degrades on a 429, so this is a safety/quality tuning, not a correctness fix.)
- Re-run `npx vitest run` after any change. Report exactly what you confirmed/changed.

- [ ] **Step 3: Start the dev server with both keys**

Run (background): `SEOZOOM_API_KEY=... ANTHROPIC_API_KEY=... PORT=8001 npm run dev`. Wait until it responds.

- [ ] **Step 4: Live discovery and verify real KD drives the result**

`POST http://localhost:8001/api/seozoom/discover` with `{"seeds":["magnesio"],"topN":6}` (timeout ~180s).
Expected: 200 `{"status":"DONE","created":N}`. Then `GET /api/ideas?source=seozoom` → confirm the `difficolta` values are now **real and varied** (not all 50), and the `seoScore` reflects them. Report a few sample ideas with keyword / volumeRicerca / difficolta / seoScore, and confirm `difficolta` is no longer uniformly 50. Report the SEOZoom units consumed if visible.

- [ ] **Step 5: Stop the server. Report honestly.**

Report: suite/build results, the confirmed `metrics` contract (batch vs per-keyword + KD field), any `client.ts`/`POOL_SIZE` change, the discover response, and sample ideas proving difficolta is real. If the `metrics` contract can't be confirmed live, report that the enrichment degrades to neutral (the discovery still works on volume) and that the `metrics` URL needs confirmation before KD is real — do NOT fabricate.

---

## Self-Review notes (addressed)

- **Spec coverage:** `fetchDifficulty` + `normalizeMetrics` via the `metrics` action (T1); two-phase pool→enrich→final-select pipeline with `enrichDifficulty` dep (T2); runtime `enrichDifficulty` calling the real client with graceful degrade + the pure `enrichWithKd` merge (T3); live confirmation of the `metrics` contract + real-KD proof + rate-limit/POOL_SIZE tuning (T4). No DB/UI change (difficolta/seoScore already wired). Degrade-on-error lives inside `enrichDifficulty` (spec §4) so the global pipeline fail-safe is unchanged.
- **Type consistency:** `enrichDifficulty: (NormalizedKeyword[]) => Promise<NormalizedKeyword[]>` defined in `SeozoomDeps` (T2) and implemented in `buildSeozoomDeps` (T3); `normalizeMetrics` returns `Map<string, number>` consumed by `enrichWithKd` (T3); `fetchDifficulty(string[]) => Promise<Map<string, number>>` (T1) used by `enrichDifficulty` (T3); `selectCandidates`/`metricsToSeoScore` reused unchanged with now-real difficulty; `POOL_SIZE` constant local to discover.ts.
- **No placeholders:** every code/test step is complete; the only deliberately-deferred item is the exact `metrics` request URL, handled by an explicit live-confirmation step (T4) with concrete fallbacks (field rename, per-keyword loop, POOL_SIZE 15), not a placeholder.
