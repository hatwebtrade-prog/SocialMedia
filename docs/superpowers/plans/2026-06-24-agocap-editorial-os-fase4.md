# Editorial OS — Fase 4 (Blog workflow + n8n prep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare `GeneratedContent` for n8n publishing (technical `publicationStatus` + Shopify/published fields, separate from editorial status), and polish the Blog dashboard (status filter, colored badge, keyword/data columns) + show publication status on the article detail.

**Architecture:** Additive data-model change (new `PublicationStatus` enum + 5 nullable/defaulted fields). Reuse `StatusBadge` (Fase 1, extended with the technical states) and the existing `GET /api/blog/contents?status=` filter. No new pipeline; nothing sets `publicationStatus` beyond the default until Phase 6 (n8n).

**Tech Stack:** Next.js 15, Prisma/Postgres, Tailwind, Vitest. UI Italian, code English.

**Branch:** `editorial-os-phase4` (off `brain-mvp-clean`). Local Postgres via `.env`.

**Current state (verified):**
- `GeneratedContent` has `status` (ContentStatus), `dataPrevista`, `payload` (blog payload has `titoloSeo`, `keywordPrincipale`), `assets`. No publication fields yet.
- `GET /api/blog/contents` supports `?status=`, includes `idea`+`assets`, returns `payload`/`dataPrevista`.
- `src/components/status-badge.tsx`: `badgeStyle` MAP has NUOVA/INTERESSANTE/APPROVATA/SCARTATA/DA_APPROFONDIRE/BOZZA/DA_APPROVARE/APPROVATO/PROGRAMMATO/PUBBLICATO/ERRORE.
- `src/lib/meta/enums.ts`: CONTENT_STATUSES, CONTENT_FORMATS, etc.
- `src/components/blog-content-table.tsx`: fetches `/api/blog/contents`, columns Titolo SEO/Idea/Stato (plain).
- `src/app/blog/[id]/page.tsx`: detail with status `<select>` + payload preview.

---

## Task 1: Prisma publication fields + PUBLICATION_STATUSES + StatusBadge

**Files:** Modify `prisma/schema.prisma`, `src/lib/meta/enums.ts`, `src/components/status-badge.tsx`; Test `src/components/status-badge.test.tsx`

- [ ] **Step 1: Add a failing test for the new badge states**

Append to `src/components/status-badge.test.tsx`:
```tsx
describe("badgeStyle publication states", () => {
  it("maps technical publication states", () => {
    expect(badgeStyle("NON_INVIATO").label).toBe("Non inviato");
    expect(badgeStyle("INVIATO_A_N8N").label).toBe("Inviato a n8n");
    expect(badgeStyle("INVIATO_A_N8N").className).toContain("blue");
    expect(badgeStyle("IN_PUBBLICAZIONE").label).toBe("In pubblicazione");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/status-badge.test.tsx`
Expected: FAIL — these states fall back to the raw key, not the Italian label.

- [ ] **Step 3: Extend StatusBadge MAP**

In `src/components/status-badge.tsx`, add to the `MAP` object (before the closing `}`):
```ts
  NON_INVIATO: { label: "Non inviato", className: GRAY },
  INVIATO_A_N8N: { label: "Inviato a n8n", className: BLUE },
  IN_PUBBLICAZIONE: { label: "In pubblicazione", className: AMBER },
```

- [ ] **Step 4: Add the Prisma enum + fields**

In `prisma/schema.prisma`, add a new enum:
```prisma
enum PublicationStatus {
  NON_INVIATO
  INVIATO_A_N8N
  IN_PUBBLICAZIONE
  PUBBLICATO
  ERRORE
}
```
In `model GeneratedContent { ... }`, add (after `outputGrezzo`):
```prisma
  publicationStatus  PublicationStatus  @default(NON_INVIATO)
  publicationError   String?
  publishedAt        DateTime?
  shopifyArticleId   String?
  shopifyArticleUrl  String?
```

- [ ] **Step 5: Add the const to meta enums**

In `src/lib/meta/enums.ts`, append:
```ts
export const PUBLICATION_STATUSES = ["NON_INVIATO", "INVIATO_A_N8N", "IN_PUBBLICAZIONE", "PUBBLICATO", "ERRORE"] as const;
export type PublicationStatusValue = (typeof PUBLICATION_STATUSES)[number];
```

- [ ] **Step 6: Migrate + verify**

Run:
```bash
npx prisma validate
npx prisma migrate dev --name content_publication_fields
npx prisma generate
npx vitest run src/components/status-badge.test.tsx
npx tsc --noEmit
```
Expected: valid; migration applied (non-destructive); badge tests pass; tsc 0. If DB unreachable, report BLOCKED.

- [ ] **Step 7: Commit**
```bash
git add prisma/ src/lib/meta/enums.ts src/components/status-badge.tsx src/components/status-badge.test.tsx
git commit -m "feat: GeneratedContent publication fields + PublicationStatus + badge states"
```

---

## Task 2: Blog dashboard — status filter + badge + columns

**Files:** Modify `src/components/blog-content-table.tsx`

- [ ] **Step 1: Replace the component**

Replace `src/components/blog-content-table.tsx` entirely with:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CONTENT_STATUSES } from "@/lib/meta/enums";
import { StatusBadge } from "@/components/status-badge";

interface Content {
  id: string;
  status: string;
  dataPrevista: string | null;
  payload: { titoloSeo?: string; keywordPrincipale?: string };
  idea?: { titolo: string } | null;
}

export function BlogContentTable() {
  const [items, setItems] = useState<Content[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      const res = await fetch(`/api/blog/contents?${qs.toString()}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-4 flex gap-3 text-sm">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border p-1">
          <option value="">Tutti gli stati</option>
          {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {loading ? <p>Caricamento…</p> : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="p-2">Titolo SEO</th>
              <th className="p-2">Idea</th>
              <th className="p-2">Keyword</th>
              <th className="p-2">Stato</th>
              <th className="p-2">Data prevista</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b hover:bg-neutral-50">
                <td className="p-2"><Link href={`/blog/${c.id}`} className="text-blue-600 hover:underline">{c.payload?.titoloSeo ?? "Articolo"}</Link></td>
                <td className="p-2">{c.idea?.titolo ?? "—"}</td>
                <td className="p-2">{c.payload?.keywordPrincipale ?? "—"}</td>
                <td className="p-2"><StatusBadge status={c.status} /></td>
                <td className="p-2">{c.dataPrevista ? new Date(c.dataPrevista).toLocaleDateString("it-IT") : "—"}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-4 text-neutral-500">Nessun articolo.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds.

- [ ] **Step 3: Commit**
```bash
git add src/components/blog-content-table.tsx
git commit -m "feat: Blog dashboard status filter + badge + keyword/data columns"
```

---

## Task 3: Article detail — publication status (read-only)

**Files:** Modify `src/app/blog/[id]/page.tsx`

- [ ] **Step 1: Add publication status display**

In `src/app/blog/[id]/page.tsx`:
(a) Add the import: `import { StatusBadge } from "@/components/status-badge";`
(b) Add these fields to the `Content` interface (top-level, not under payload):
```tsx
  publicationStatus?: string;
  shopifyArticleUrl?: string | null;
```
(c) In the JSX, right AFTER the editorial status `<select>` block (the one with STATUSES), insert:
```tsx
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-neutral-500">Pubblicazione:</span>
        <StatusBadge status={c.publicationStatus ?? "NON_INVIATO"} />
        {c.shopifyArticleUrl && (
          <a href={c.shopifyArticleUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">apri su Shopify</a>
        )}
      </div>
```
(If the detail page already imports `StatusBadge`, don't duplicate the import.)

- [ ] **Step 2: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds.

- [ ] **Step 3: Commit**
```bash
git add src/app/blog/[id]/page.tsx
git commit -m "feat: article detail shows publication status (read-only)"
```

---

## Task 4: Gate + smoke

- [ ] **Step 1: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all unit tests pass; tsc 0; build succeeds. Commit only if a fix was needed.

- [ ] **Step 2: Smoke (local, with DB)**

`npx prisma migrate deploy`, then start `PORT=8001 npm run dev` (keys optional for this UI-only smoke) and verify:
- `/blog`: status filter works; Stato shows a colored badge; Keyword + Data prevista columns render.
- `GET /api/blog/contents?status=BOZZA` returns only BOZZA articles; each content JSON includes `publicationStatus: "NON_INVIATO"`.
- `/blog/[id]`: shows the editorial status select AND a read-only "Pubblicazione: Non inviato" badge.

Report what renders + any error verbatim.

---

## Self-Review notes (addressed)
- **Spec coverage:** PublicationStatus enum + 5 GeneratedContent fields (T1); PUBLICATION_STATUSES const + StatusBadge technical states (T1); Blog dashboard status filter + badge + keyword/data columns (T2); article detail read-only publication badge + Shopify link (T3); gate+smoke (T4). Editorial status (ContentStatus) vs technical publicationStatus kept distinct. n8n endpoints/scheduling deferred (Phase 5/6).
- **Type consistency:** `PUBLICATION_STATUSES`/`PublicationStatusValue` in meta enums (T1); `publicationStatus` field (Prisma) surfaced read-only in detail (T3) defaulting to NON_INVIATO; `StatusBadge` reused in blog-content-table (T2) and detail (T3); `CONTENT_STATUSES` drives the blog status filter (T2).
- **No placeholders:** every code/test step is complete; the new fields are nullable/defaulted (non-destructive); nothing in this phase writes publicationStatus beyond the default (that's Phase 6).
```
