# Brain Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen the Brain area: ground AI idea generation in real research (SEOZoom keywords + Google related queries), unify generation in a 3-mode hub, and upgrade the ideas dashboard (channel icons, text search + debounce, skeleton loading).

**Architecture:** New `src/lib/google/` (free Google Suggest related queries, best-effort + degrade). Extend the SEOZoom `discoverKeywords` pipeline with a Google seed-expansion step. New `ChannelIcon` (react-icons). Unified `/genera` hub composing three extracted form components. Dashboard gets a debounced client text filter + skeleton. Backends for Manual (`/api/ideas`) and AI brainstorm (`/api/generate`) unchanged.

**Tech Stack:** Next.js 15, Prisma/Postgres, Tailwind, Vitest, react-icons. UI Italian, code English.

**Branch:** `brain-overhaul` (off `brain-mvp-clean`). Local Postgres via `.env`.

**Current state:** `/generate` (AI brainstorm form → `/api/generate`), `/manual` (manual form → POST `/api/ideas`), `/trend-seo` (renders `ScopriKeyword` component → `/api/seozoom/discover`). `discoverKeywords` (src/lib/seozoom/discover.ts) has deps `loadContext/fetchKeywords/enrichDifficulty/callClaude/persist/recordError` and does seeds→fetchKeywords→pool(15)→enrichDifficulty→select(topN)→Claude→persist. `idea-table.tsx`/`idea-filters.tsx` (Fase 2) show columns incl. Destinazioni (text) + filters status/source/destinazione/category/priorità + bulk actions. `nav.tsx` Brain children: Tutte le idee `/dashboard`, Genera idee `/generate`, Inserimento manuale `/manual`.

---

## Task 1: Google research module (Suggest)

**Files:** Create `src/lib/google/related.ts`; Test `src/lib/google/related.test.ts`

> Honest note: Google Trends-proper needs a fragile token flow that frequently fails from servers. We use **Google Suggest (autocomplete)** — a public, reliable, key-less endpoint returning related search queries — as the Google signal, with degrade to `[]`.

- [ ] **Step 1: Failing test**

`src/lib/google/related.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeSuggest } from "@/lib/google/related";

describe("normalizeSuggest", () => {
  it("extracts the suggestions array (firefox client shape)", () => {
    const raw = ["magnesio", ["magnesio supremo", "magnesio citrato", "magnesio e potassio"]];
    expect(normalizeSuggest(raw)).toEqual(["magnesio supremo", "magnesio citrato", "magnesio e potassio"]);
  });
  it("returns [] for malformed input", () => {
    expect(normalizeSuggest({})).toEqual([]);
    expect(normalizeSuggest(["x"])).toEqual([]);
    expect(normalizeSuggest(["x", [1, "ok", null]])).toEqual(["ok"]);
  });
});
```

- [ ] **Step 2: Run → FAIL, implement**

`src/lib/google/related.ts`:
```ts
/** Parses the Google Suggest (client=firefox) response: [query, [suggestion, ...], ...]. */
export function normalizeSuggest(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length < 2 || !Array.isArray(raw[1])) return [];
  return (raw[1] as unknown[]).filter((x): x is string => typeof x === "string");
}

/** Best-effort related queries from Google Suggest (autocomplete). Degrades to [] on any error. */
export async function fetchGoogleRelated(seed: string): Promise<string[]> {
  if (!seed || !seed.trim()) return [];
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=it&q=${encodeURIComponent(seed)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json();
    return normalizeSuggest(json);
  } catch {
    return [];
  }
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx vitest run src/lib/google/related.test.ts && npx tsc --noEmit`
```bash
git add src/lib/google/
git commit -m "feat: Google related queries module (Suggest, best-effort)"
```

---

## Task 2: Google seed-expansion in the discover pipeline

**Files:** Modify `src/lib/seozoom/discover.ts`, `src/lib/seozoom/runtime.ts`, `src/lib/seozoom/discover.test.ts`

- [ ] **Step 1: Update the discover test**

In `src/lib/seozoom/discover.test.ts`, add to the `makeDeps` returned object:
```ts
    googleRelated: vi.fn().mockResolvedValue([]),
```
Add a new test inside the describe block:
```ts
  it("expands seeds with Google related before fetching keywords", async () => {
    const fetchKeywords = vi.fn().mockResolvedValue([{ keyword: "k", volume: 100, difficolta: 30, trend: "stabile" }]);
    const deps = makeDeps({
      loadContext: vi.fn().mockResolvedValue({ seeds: ["magnesio"], kbContext: "kb" }),
      googleRelated: vi.fn().mockResolvedValue(["magnesio sonno"]),
      fetchKeywords,
    });
    await discoverKeywords({ seeds: ["magnesio"] }, deps as any);
    expect(deps.googleRelated).toHaveBeenCalledWith(["magnesio"]);
    const fetched = fetchKeywords.mock.calls.map((c) => c[0]);
    expect(fetched).toContain("magnesio");
    expect(fetched).toContain("magnesio sonno");
  });
```

- [ ] **Step 2: Run → FAIL, implement**

In `src/lib/seozoom/discover.ts`:
- Add to `SeozoomDeps` (after `fetchKeywords`):
```ts
  googleRelated: (seeds: string[]) => Promise<string[]>;
```
- In `discoverKeywords`, replace the `fetched` computation:
```ts
    const { seeds, kbContext, prodottoNome } = await deps.loadContext(input);
    const related = await deps.googleRelated(seeds);
    const allSeeds = Array.from(new Set([...seeds, ...related]));
    const fetched = (await Promise.all(allSeeds.map((s) => deps.fetchKeywords(s)))).flat();
```
(the rest — pool/enrichDifficulty/select/callClaude/persist — unchanged.)

- Add the runtime dep in `src/lib/seozoom/runtime.ts` (import + dep). Add import:
```ts
import { fetchGoogleRelated } from "@/lib/google/related";
```
Add to the returned deps object:
```ts
    googleRelated: async (seeds) => {
      const all = (await Promise.all(seeds.map((s) => fetchGoogleRelated(s)))).flat();
      const uniq = Array.from(new Set(all.map((s) => s.trim().toLowerCase()))).filter(Boolean);
      return uniq.slice(0, 5);
    },
```

- [ ] **Step 3: Verify + commit**

Run: `npx vitest run src/lib/seozoom/discover.test.ts && npx vitest run && npx tsc --noEmit`
```bash
git add src/lib/seozoom/discover.ts src/lib/seozoom/runtime.ts src/lib/seozoom/discover.test.ts
git commit -m "feat: expand SEOZoom discovery seeds with Google related queries"
```

---

## Task 3: react-icons + ChannelIcon

**Files:** `package.json` (add dep); Create `src/components/channel-icon.tsx`; Test `src/components/channel-icon.test.tsx`

- [ ] **Step 1: Install react-icons**

Run: `npm install react-icons` (then confirm it's in package.json dependencies).

- [ ] **Step 2: Failing test (pure helper)**

`src/components/channel-icon.test.tsx`:
```ts
import { describe, it, expect } from "vitest";
import { isKnownChannel } from "@/components/channel-icon";

describe("isKnownChannel", () => {
  it("recognises channels/platforms", () => {
    ["INSTAGRAM", "FACEBOOK", "TIKTOK", "BLOG", "EMAIL", "META"].forEach((c) => expect(isKnownChannel(c)).toBe(true));
  });
  it("false for unknown", () => {
    expect(isKnownChannel("ZZZ")).toBe(false);
  });
});
```

- [ ] **Step 3: Run → FAIL, implement**

`src/components/channel-icon.tsx`:
```tsx
import { FaInstagram, FaFacebook, FaTiktok, FaBlog, FaEnvelope } from "react-icons/fa";
import type { IconType } from "react-icons";

const ICONS: Record<string, { Icon: IconType; color: string; label: string }> = {
  INSTAGRAM: { Icon: FaInstagram, color: "#E1306C", label: "Instagram" },
  FACEBOOK: { Icon: FaFacebook, color: "#1877F2", label: "Facebook" },
  META: { Icon: FaFacebook, color: "#1877F2", label: "Meta" },
  TIKTOK: { Icon: FaTiktok, color: "#000000", label: "TikTok" },
  BLOG: { Icon: FaBlog, color: "#16a34a", label: "Blog" },
  EMAIL: { Icon: FaEnvelope, color: "#d97706", label: "Email" },
};

export function isKnownChannel(channel: string): boolean {
  return channel in ICONS;
}

export function ChannelIcon({ channel }: { channel: string }) {
  const def = ICONS[channel];
  if (!def) return <span className="text-xs text-neutral-500">{channel}</span>;
  const { Icon, color, label } = def;
  return <Icon title={label} aria-label={label} style={{ color }} className="inline-block" />;
}

export function ChannelIcons({ channels }: { channels: string[] }) {
  if (!channels?.length) return <span className="text-neutral-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {channels.map((c) => <ChannelIcon key={c} channel={c} />)}
    </span>
  );
}
```

- [ ] **Step 4: Verify + commit**

Run: `npx vitest run src/components/channel-icon.test.tsx && npx tsc --noEmit`
```bash
git add package.json package-lock.json src/components/channel-icon.tsx src/components/channel-icon.test.tsx
git commit -m "feat: react-icons + ChannelIcon (social/channel icons)"
```

---

## Task 4: Dashboard — icons + text search (debounced) + skeleton

**Files:** Create `src/lib/brain/search.ts`; Test `src/lib/brain/search.test.ts`; Modify `src/components/idea-table.tsx`, `src/components/idea-filters.tsx`

- [ ] **Step 1: Failing test for the pure match helper**

`src/lib/brain/search.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { matchesText } from "@/lib/brain/search";

describe("matchesText", () => {
  const idea = { titolo: "Magnesio e sonno", keyword: "magnesio notte" };
  it("empty query matches", () => { expect(matchesText(idea, "")).toBe(true); });
  it("matches titolo or keyword, case-insensitive", () => {
    expect(matchesText(idea, "SONNO")).toBe(true);
    expect(matchesText(idea, "notte")).toBe(true);
    expect(matchesText(idea, "vitamina")).toBe(false);
  });
  it("handles null keyword", () => {
    expect(matchesText({ titolo: "X", keyword: null }, "x")).toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL, implement**

`src/lib/brain/search.ts`:
```ts
export function matchesText(idea: { titolo: string; keyword?: string | null }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return idea.titolo.toLowerCase().includes(q) || (idea.keyword ?? "").toLowerCase().includes(q);
}
```

- [ ] **Step 3: idea-filters — add a text search input**

In `src/components/idea-filters.tsx`: add `q: string` to the `Filters` interface and a text input at the start of the filter row:
```tsx
      <input
        value={filters.q}
        onChange={(e) => set("q", e.target.value)}
        placeholder="Cerca per titolo o keyword…"
        className="rounded border p-1"
      />
```
(Keep the existing selects. `set` helper already exists.)

- [ ] **Step 4: idea-table — icons + debounced client search + skeleton**

In `src/components/idea-table.tsx`:
- import `ChannelIcons` from `./channel-icon` and `matchesText` from `@/lib/brain/search`.
- add `q: ""` to the initial `Filters` state.
- The status/source/etc. filters stay server-side (query string). The **text search `q` is client-side**: keep a debounced copy and filter the loaded `ideas` before rendering. Add:
```tsx
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(t);
  }, [filters.q]);
  const visible = ideas.filter((i) => matchesText({ titolo: i.titolo, keyword: i.keyword }, debouncedQ));
```
  Render `visible` instead of `ideas` in the table body. Do NOT put `q` into the server query string (`load` keeps using the other filters only).
- Replace the **Destinazioni** cell content with `<ChannelIcons channels={i.destinazioni ?? []} />`.
- Replace the loading state `{loading ? <p>Caricamento…</p> : ...}` with a **skeleton**: when `loading`, render 5 placeholder rows:
```tsx
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-neutral-100" />)}</div>
      ) : (
        /* existing table, using `visible` */
      )}
```
  Keep all existing columns/bulk actions; only Destinazioni cell + loading + the row source change.

- [ ] **Step 5: Verify + commit**

Run: `npx vitest run src/lib/brain/search.test.ts && npx tsc --noEmit && npm run build`
```bash
git add src/lib/brain/search.ts src/lib/brain/search.test.ts src/components/idea-table.tsx src/components/idea-filters.tsx
git commit -m "feat: dashboard channel icons + debounced text search + skeleton"
```

---

## Task 5: Unified "Genera idee" hub (/genera)

**Files:** Create `src/components/forms/manual-idea-form.tsx`, `src/components/forms/ai-brainstorm-form.tsx`, `src/app/genera/page.tsx`; Modify `src/app/manual/page.tsx`, `src/app/generate/page.tsx` (redirects), `src/components/nav.tsx`. Reuse existing `src/components/scopri-keyword.tsx`.

- [ ] **Step 1: Extract the manual form**

Create `src/components/forms/manual-idea-form.tsx` with the body of the current `/manual` page exported as `ManualIdeaForm` (same logic: posts to `/api/ideas`). (Copy the existing component's state + JSX, name it `ManualIdeaForm`, no `<h1>`.)

- [ ] **Step 2: Extract the AI brainstorm form**

Create `src/components/forms/ai-brainstorm-form.tsx` with the body of the current `/generate` page exported as `AiBrainstormForm` (posts to `/api/generate`). (No `<h1>`.)

- [ ] **Step 3: Create the hub page**

`src/app/genera/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { ManualIdeaForm } from "@/components/forms/manual-idea-form";
import { AiBrainstormForm } from "@/components/forms/ai-brainstorm-form";
import { ScopriKeyword } from "@/components/scopri-keyword";

type Tab = "ricerca" | "ai" | "manuale";
const TABS: { key: Tab; label: string }[] = [
  { key: "ricerca", label: "Ricerca → idee (SEOZoom + Google)" },
  { key: "ai", label: "AI brainstorming" },
  { key: "manuale", label: "Manuale" },
];

export default function GeneraPage() {
  const [tab, setTab] = useState<Tab>("ricerca");
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Genera idee</h1>
      <div className="mb-5 flex gap-2 border-b text-sm">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 ${tab === t.key ? "border-blue-600 font-medium text-blue-700" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "ricerca" && (
        <div>
          <p className="mb-3 text-sm text-neutral-500">Da un seed o un prodotto: query correlate Google + keyword reali SEOZoom (volume/difficoltà) → idee data-driven nel Brain.</p>
          <ScopriKeyword />
        </div>
      )}
      {tab === "ai" && <AiBrainstormForm />}
      {tab === "manuale" && <ManualIdeaForm />}
    </div>
  );
}
```

- [ ] **Step 4: Redirect old pages + nav**

Replace `src/app/generate/page.tsx`:
```tsx
import { redirect } from "next/navigation";
export default function GenerateRedirect() { redirect("/genera"); }
```
Replace `src/app/manual/page.tsx`:
```tsx
import { redirect } from "next/navigation";
export default function ManualRedirect() { redirect("/genera"); }
```
In `src/components/nav.tsx`, update the Brain `children` to:
```tsx
    children: [
      { label: "Tutte le idee", href: "/dashboard" },
      { label: "Genera idee", href: "/genera" },
    ],
```
(remove the `/generate` and `/manual` sub-items; the hub covers both.)

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build ok; `/genera` renders the 3 tabs; `/generate` and `/manual` redirect.
```bash
git add src/components/forms/ src/app/genera/ src/app/generate/page.tsx src/app/manual/page.tsx src/components/nav.tsx
git commit -m "feat: unified Genera idee hub (Ricerca/AI/Manuale tabs) + redirects"
```

---

## Task 6: Gate + smoke

- [ ] **Step 1: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npm run build`. Expected: green. Commit only if a fix was needed.

- [ ] **Step 2: Smoke (DB + SEOZoom + Anthropic keys)**

Start the dev server with keys.
- **Google related (live):** quick probe `node -e` or a temp call — or rely on the discovery smoke below. Report whether Google Suggest returns related queries for "magnesio" from this environment (degrade [] is acceptable).
- **Ricerca→idee:** `POST /api/seozoom/discover {"seeds":["magnesio"],"topN":6}` → DONE with N ideas. Check the dev console: `googleRelated` expanded the seeds (more SEOZoom calls) — or degraded cleanly. `GET /api/ideas?source=seozoom` → ideas with real keyword/volume/difficolta.
- **Dashboard:** open `/dashboard` → Destinazioni shown as **icons**; type in the search box → list filters by titolo/keyword (debounced); reload shows the **skeleton** briefly.
- **Hub:** `/genera` shows 3 tabs (Ricerca→idee / AI brainstorming / Manuale), each form works; `/generate` and `/manual` redirect to `/genera`.

Report: Google related result (or degrade), discover response, and that the dashboard icons/search/skeleton + hub tabs render. Any error verbatim.

- [ ] **Step 3: Stop the server.**

---

## Self-Review notes (addressed)
- **Spec coverage:** Google Suggest module + degrade (T1); Google seed-expansion in discover (T2); react-icons + ChannelIcon (T3); dashboard icons + debounced text search + skeleton (T4); unified /genera hub with 3 modes + redirects + nav (T5); gate+smoke (T6). Google source = free Suggest (honest substitute for fragile Trends); manual + AI backends unchanged.
- **Type consistency:** `fetchGoogleRelated`/`normalizeSuggest` (T1) used by runtime googleRelated dep (T2); `googleRelated` added to `SeozoomDeps` (T2) and implemented in runtime (T2); `matchesText` (T4) used by idea-table; `ChannelIcons` (T3) used by idea-table; `Filters` gains `q` consistently in idea-filters + idea-table (T4); hub reuses `ScopriKeyword` + extracted `ManualIdeaForm`/`AiBrainstormForm`.
- **No placeholders:** all code complete; Google is best-effort with degrade; discover pipeline change is additive (seed expansion) and covered by an updated test; existing manual/AI flows preserved via extraction + redirects.
```
