# Editorial OS — Fase 1 (Navigazione + Home) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AGOCAP Content AI Hub clearly navigable: replace the cramped top-nav with a left **sidebar grouped by editorial areas**, add a **Home dashboard** with per-area summary cards + upcoming-calendar preview, introduce **colored status badges**, promote SEOZoom to a **Trend & SEO** area, and add **"coming soon" placeholders** for TikTok/Email/Calendario/Pubblicazioni/Impostazioni. NO data-model changes; existing Brain/Meta/Blog pages keep working.

**Architecture:** Pure UI/navigation phase. New `Sidebar` in the root layout (driven by a single `navItems` source + a tested `isActive` helper). New `/api/home/summary` aggregates counts from existing data via a tested pure `summarize()` (route does the Prisma queries; shaping is unit-tested). Home + placeholders are pages; Trend & SEO reuses the existing Scopri-keyword UI extracted into a component.

**Tech Stack:** Next.js 15 (App Router, TS), Prisma/Postgres, Tailwind, Vitest. UI Italian, code English.

**Branch:** `editorial-os-phase1` (off `brain-mvp-clean`). Local Postgres via `.env`.

**Reuse:** root `src/app/layout.tsx` (currently renders `<Nav/>` + `<main>`); `src/components/nav.tsx` (to be replaced by `Sidebar`); `src/app/brain/scopri/page.tsx` (Scopri UI to extract).

---

## File Structure
```
src/components/status-badge.tsx        # StatusBadge + badgeStyle (pure)
src/lib/nav/items.ts                   # navItems + isActive (pure)
src/components/sidebar.tsx             # left sidebar (client, usePathname)
src/app/layout.tsx                     # MODIFY: sidebar + main flex layout
src/lib/home/summary.ts                # summarize() (pure) + types
src/app/api/home/summary/route.ts      # GET aggregation
src/components/summary-card.tsx        # reusable area card
src/app/page.tsx                       # Home dashboard (replaces any existing root)
src/components/scopri-keyword.tsx      # extracted Scopri UI (reused)
src/app/trend-seo/page.tsx             # Trend & SEO area (renders ScopriKeyword)
src/app/brain/scopri/page.tsx          # MODIFY: redirect to /trend-seo
src/components/coming-soon.tsx         # placeholder component
src/app/tiktok/page.tsx                # placeholder
src/app/email/page.tsx                 # placeholder
src/app/calendario/page.tsx            # placeholder
src/app/pubblicazioni/page.tsx         # placeholder
src/app/impostazioni/page.tsx          # placeholder
```

---

## Task 1: StatusBadge + badgeStyle

**Files:** Create `src/components/status-badge.tsx`; Test `src/components/status-badge.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/status-badge.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { badgeStyle } from "@/components/status-badge";

describe("badgeStyle", () => {
  it("maps known states to a label + classes", () => {
    expect(badgeStyle("APPROVATA").label).toBe("Approvata");
    expect(badgeStyle("PUBBLICATO").className).toContain("green");
    expect(badgeStyle("ERRORE").className).toContain("red");
  });
  it("falls back for unknown states", () => {
    const b = badgeStyle("XYZ");
    expect(b.label).toBe("XYZ");
    expect(b.className).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/status-badge.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/components/status-badge.tsx`:
```tsx
interface BadgeDef { label: string; className: string; }

const GREEN = "bg-green-100 text-green-800";
const AMBER = "bg-amber-100 text-amber-800";
const RED = "bg-red-100 text-red-800";
const BLUE = "bg-blue-100 text-blue-800";
const GRAY = "bg-neutral-100 text-neutral-700";

const MAP: Record<string, BadgeDef> = {
  NUOVA: { label: "Nuova", className: GRAY },
  INTERESSANTE: { label: "Interessante", className: AMBER },
  APPROVATA: { label: "Approvata", className: GREEN },
  SCARTATA: { label: "Scartata", className: RED },
  DA_APPROFONDIRE: { label: "Da approfondire", className: BLUE },
  BOZZA: { label: "Bozza", className: GRAY },
  DA_APPROVARE: { label: "Da approvare", className: AMBER },
  APPROVATO: { label: "Approvato", className: GREEN },
  PROGRAMMATO: { label: "Programmato", className: BLUE },
  PUBBLICATO: { label: "Pubblicato", className: GREEN },
  ERRORE: { label: "Errore", className: RED },
};

export function badgeStyle(status: string): BadgeDef {
  return MAP[status] ?? { label: status, className: GRAY };
}

export function StatusBadge({ status }: { status: string }) {
  const b = badgeStyle(status);
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${b.className}`}>{b.label}</span>;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/status-badge.test.tsx && npx tsc --noEmit`
Expected: PASS (2 tests); tsc 0.

- [ ] **Step 5: Commit**
```bash
git add src/components/status-badge.tsx src/components/status-badge.test.tsx
git commit -m "feat: StatusBadge + badgeStyle (colored editorial states)"
```

---

## Task 2: navItems + isActive

**Files:** Create `src/lib/nav/items.ts`; Test `src/lib/nav/items.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/nav/items.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { navItems, isActive } from "@/lib/nav/items";

describe("nav", () => {
  it("exposes the editorial areas", () => {
    const labels = navItems.map((a) => a.label);
    expect(labels).toContain("Home");
    expect(labels).toContain("Brain");
    expect(labels).toContain("Trend & SEO");
    expect(labels).toContain("Calendario");
  });
  it("isActive: Home only matches exact /", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/dashboard", "/")).toBe(false);
  });
  it("isActive: area matches its own path and sub-paths", () => {
    expect(isActive("/meta", "/meta")).toBe(true);
    expect(isActive("/meta/genera", "/meta")).toBe(true);
    expect(isActive("/blog", "/meta")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/nav/items.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/nav/items.ts`:
```ts
export interface NavSub { label: string; href: string; }
export interface NavArea { label: string; href: string; icon: string; children?: NavSub[]; }

export const navItems: NavArea[] = [
  { label: "Home", href: "/", icon: "🏠" },
  {
    label: "Brain", href: "/dashboard", icon: "🧠",
    children: [
      { label: "Tutte le idee", href: "/dashboard" },
      { label: "Genera idee", href: "/generate" },
      { label: "Inserimento manuale", href: "/manual" },
    ],
  },
  { label: "Trend & SEO", href: "/trend-seo", icon: "📈" },
  { label: "Meta", href: "/meta", icon: "📱" },
  { label: "Blog", href: "/blog", icon: "✍️" },
  { label: "TikTok", href: "/tiktok", icon: "🎬" },
  { label: "Email", href: "/email", icon: "✉️" },
  { label: "Calendario", href: "/calendario", icon: "🗓️" },
  { label: "Pubblicazioni", href: "/pubblicazioni", icon: "🚀" },
  { label: "Report", href: "/report", icon: "📊" },
  { label: "Knowledge Base", href: "/knowledge", icon: "📚" },
  { label: "Impostazioni", href: "/impostazioni", icon: "⚙️" },
];

/** True when `href` is the current area for `pathname`. Home (/) matches only exactly. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/nav/items.test.ts && npx tsc --noEmit`
Expected: PASS (3 tests); tsc 0.

- [ ] **Step 5: Commit**
```bash
git add src/lib/nav/items.ts src/lib/nav/items.test.ts
git commit -m "feat: navItems + isActive (editorial areas)"
```

---

## Task 3: Sidebar + layout integration

**Files:** Create `src/components/sidebar.tsx`; Modify `src/app/layout.tsx`

- [ ] **Step 1: Create the Sidebar component**

`src/components/sidebar.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, isActive } from "@/lib/nav/items";

export function Sidebar() {
  const pathname = usePathname() ?? "/";
  return (
    <aside className="w-60 shrink-0 border-r bg-neutral-50 p-4">
      <div className="mb-6 px-2 text-sm font-semibold text-neutral-900">AGOCAP Content AI Hub</div>
      <nav className="space-y-1 text-sm">
        {navItems.map((area) => {
          const active = isActive(pathname, area.href);
          return (
            <div key={area.href}>
              <Link
                href={area.href}
                className={`flex items-center gap-2 rounded px-2 py-1.5 ${active ? "bg-blue-600 text-white" : "text-neutral-700 hover:bg-neutral-200"}`}
              >
                <span aria-hidden>{area.icon}</span>
                <span>{area.label}</span>
              </Link>
              {area.children && active && (
                <div className="ml-7 mt-1 space-y-0.5">
                  {area.children.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      className={`block rounded px-2 py-1 text-xs ${pathname === sub.href ? "font-medium text-blue-700" : "text-neutral-600 hover:text-neutral-900"}`}
                    >
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Wire it into the root layout**

Replace `src/app/layout.tsx` with:
```tsx
import "./globals.css";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";

export const metadata = { title: "AGOCAP Content AI Hub" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
```
(The old `src/components/nav.tsx` is now unused; leave it in place — removing it is optional cleanup, not required.)

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds with the sidebar layout.

- [ ] **Step 4: Commit**
```bash
git add src/components/sidebar.tsx src/app/layout.tsx
git commit -m "feat: left sidebar navigation (replaces top nav)"
```

---

## Task 4: Home summary lib + API

**Files:** Create `src/lib/home/summary.ts`, `src/app/api/home/summary/route.ts`; Test `src/lib/home/summary.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/home/summary.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { summarize } from "@/lib/home/summary";

describe("summarize", () => {
  it("shapes idea/content counts and upcoming items", () => {
    const out = summarize({
      ideaCounts: [{ status: "NUOVA", count: 3 }, { status: "APPROVATA", count: 2 }],
      contentCounts: [{ canale: "META", status: "BOZZA", count: 1 }, { canale: "BLOG", status: "PROGRAMMATO", count: 4 }],
      seozoomNuove: 5,
      seozoomApprovate: 1,
      upcoming: [{ id: "c1", canale: "BLOG", dataPrevista: "2026-06-25T09:00:00.000Z", titolo: "Guida al magnesio" }],
    });
    expect(out.idee.perStato.NUOVA).toBe(3);
    expect(out.idee.seozoomNuove).toBe(5);
    expect(out.meta.BOZZA).toBe(1);
    expect(out.blog.PROGRAMMATO).toBe(4);
    expect(out.prossimi[0].titolo).toBe("Guida al magnesio");
    expect(out.prossimi[0].canale).toBe("BLOG");
  });
  it("drops upcoming items without a date", () => {
    const out = summarize({ ideaCounts: [], contentCounts: [], seozoomNuove: 0, seozoomApprovate: 0,
      upcoming: [{ id: "x", canale: "META", dataPrevista: null, titolo: "x" }] });
    expect(out.prossimi).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/home/summary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the lib**

`src/lib/home/summary.ts`:
```ts
export interface UpcomingItem { id: string; canale: string; titolo: string; dataPrevista: string; }
export interface HomeSummary {
  idee: { perStato: Record<string, number>; seozoomNuove: number; seozoomApprovate: number };
  meta: Record<string, number>;
  blog: Record<string, number>;
  prossimi: UpcomingItem[];
}

export interface SummarizeInput {
  ideaCounts: { status: string; count: number }[];
  contentCounts: { canale: string; status: string; count: number }[];
  seozoomNuove: number;
  seozoomApprovate: number;
  upcoming: { id: string; canale: string; dataPrevista: Date | string | null; titolo: string }[];
}

export function summarize(input: SummarizeInput): HomeSummary {
  const perStato: Record<string, number> = {};
  for (const r of input.ideaCounts) perStato[r.status] = r.count;

  const channelMap = (canale: string): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const r of input.contentCounts) if (r.canale === canale) out[r.status] = r.count;
    return out;
  };

  return {
    idee: { perStato, seozoomNuove: input.seozoomNuove, seozoomApprovate: input.seozoomApprovate },
    meta: channelMap("META"),
    blog: channelMap("BLOG"),
    prossimi: input.upcoming
      .filter((u) => u.dataPrevista)
      .map((u) => ({ id: u.id, canale: u.canale, titolo: u.titolo, dataPrevista: new Date(u.dataPrevista as string | Date).toISOString() })),
  };
}
```

- [ ] **Step 4: Run to verify the lib test passes**

Run: `npx vitest run src/lib/home/summary.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement the route**

`src/app/api/home/summary/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { summarize } from "@/lib/home/summary";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const [ideaGroup, contentGroup, seozoomNuove, seozoomApprovate, upcoming] = await Promise.all([
    prisma.idea.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.generatedContent.groupBy({ by: ["canale", "status"], _count: { _all: true } }),
    prisma.idea.count({ where: { status: "NUOVA", source: { key: "seozoom" } } }),
    prisma.idea.count({ where: { status: "APPROVATA", source: { key: "seozoom" } } }),
    prisma.generatedContent.findMany({
      where: { dataPrevista: { gte: startOfToday() } },
      orderBy: { dataPrevista: "asc" },
      take: 10,
      include: { idea: { select: { titolo: true } } },
    }),
  ]);

  const summary = summarize({
    ideaCounts: ideaGroup.map((g) => ({ status: String(g.status), count: g._count._all })),
    contentCounts: contentGroup.map((g) => ({ canale: String(g.canale), status: String(g.status), count: g._count._all })),
    seozoomNuove,
    seozoomApprovate,
    upcoming: upcoming.map((c) => ({
      id: c.id,
      canale: String(c.canale),
      dataPrevista: c.dataPrevista,
      titolo: c.idea?.titolo ?? (c.payload as { titoloSeo?: string } | null)?.titoloSeo ?? "Contenuto",
    })),
  });
  return NextResponse.json(summary);
}
```

- [ ] **Step 6: Verify typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc 0 (if `_count._all` typing complains, use `g._count?._all ?? 0`); full suite green.

- [ ] **Step 7: Commit**
```bash
git add src/lib/home/summary.ts src/lib/home/summary.test.ts src/app/api/home/summary/
git commit -m "feat: home summary aggregation (lib + API)"
```

---

## Task 5: Home dashboard page + SummaryCard

**Files:** Create `src/components/summary-card.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Create the SummaryCard component**

`src/components/summary-card.tsx`:
```tsx
import Link from "next/link";

export function SummaryCard({
  title, icon, rows, ctaHref, ctaLabel, soon,
}: {
  title: string; icon: string; rows: { label: string; value: number | string }[];
  ctaHref: string; ctaLabel: string; soon?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold"><span aria-hidden>{icon}</span>{title}</h2>
        {soon && <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">in arrivo</span>}
      </div>
      <dl className="space-y-1 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between">
            <dt className="text-neutral-500">{r.label}</dt>
            <dd className="font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>
      <Link href={ctaHref} className="mt-3 inline-block text-sm text-blue-600 hover:underline">{ctaLabel} →</Link>
    </div>
  );
}
```

- [ ] **Step 2: Create the Home page**

`src/app/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SummaryCard } from "@/components/summary-card";
import type { HomeSummary } from "@/lib/home/summary";

const n = (v: number | undefined) => v ?? 0;

export default function HomePage() {
  const [s, setS] = useState<HomeSummary | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/home/summary").then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setS).catch(() => setErr(true));
  }, []);

  if (err) return <p className="text-red-600">Impossibile caricare il riepilogo.</p>;
  if (!s) return <p>Caricamento…</p>;

  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Home</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SummaryCard title="Trend & SEO" icon="📈" ctaHref="/trend-seo" ctaLabel="Vai ad Analisi SEO / Trend"
          rows={[{ label: "Idee SEO nuove", value: n(s.idee.seozoomNuove) }, { label: "Idee SEO approvate", value: n(s.idee.seozoomApprovate) }]} />
        <SummaryCard title="Brain — Idee" icon="🧠" ctaHref="/dashboard" ctaLabel="Vai alle Idee"
          rows={[{ label: "Nuove", value: n(s.idee.perStato.NUOVA) }, { label: "Da approfondire", value: n(s.idee.perStato.DA_APPROFONDIRE) }, { label: "Approvate", value: n(s.idee.perStato.APPROVATA) }]} />
        <SummaryCard title="Meta" icon="📱" ctaHref="/meta" ctaLabel="Vai ad Area Meta"
          rows={[{ label: "Bozza", value: n(s.meta.BOZZA) }, { label: "Da approvare", value: n(s.meta.DA_APPROVARE) }, { label: "Approvati", value: n(s.meta.APPROVATO) }, { label: "Programmati", value: n(s.meta.PROGRAMMATO) }]} />
        <SummaryCard title="Blog" icon="✍️" ctaHref="/blog" ctaLabel="Vai ad Area Blog"
          rows={[{ label: "Bozza", value: n(s.blog.BOZZA) }, { label: "Da approvare", value: n(s.blog.DA_APPROVARE) }, { label: "Approvati", value: n(s.blog.APPROVATO) }, { label: "Pubblicati", value: n(s.blog.PUBBLICATO) }]} />
        <SummaryCard title="TikTok" icon="🎬" ctaHref="/tiktok" ctaLabel="Vai ad Area TikTok" soon
          rows={[{ label: "Script", value: 0 }, { label: "Programmati", value: 0 }]} />
        <SummaryCard title="Email" icon="✉️" ctaHref="/email" ctaLabel="Vai ad Area Email" soon
          rows={[{ label: "Newsletter", value: 0 }, { label: "Programmate", value: 0 }]} />
      </div>

      <div className="mt-6 rounded-lg border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold"><span aria-hidden>🗓️</span>Calendario imminente</h2>
          <Link href="/calendario" className="text-sm text-blue-600 hover:underline">Vai al Calendario →</Link>
        </div>
        {s.prossimi.length === 0 ? (
          <p className="text-sm text-neutral-500">Nessun contenuto programmato.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {s.prossimi.map((p) => (
              <li key={p.id} className="flex gap-2">
                <span className="w-48 shrink-0 text-neutral-500">{fmtDay(p.dataPrevista)}</span>
                <span className="rounded bg-neutral-100 px-1.5 text-xs">{p.canale}</span>
                <span>{p.titolo}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds; `/` is the Home.

- [ ] **Step 4: Commit**
```bash
git add src/components/summary-card.tsx src/app/page.tsx
git commit -m "feat: Home dashboard (area summary cards + upcoming calendar)"
```

---

## Task 6: Trend & SEO area (extract Scopri) + redirect

**Files:** Create `src/components/scopri-keyword.tsx`, `src/app/trend-seo/page.tsx`; Modify `src/app/brain/scopri/page.tsx`

- [ ] **Step 1: Extract the Scopri UI into a component**

Create `src/components/scopri-keyword.tsx` with the FULL current body of `src/app/brain/scopri/page.tsx`, but exported as a named component `ScopriKeyword` (same logic, `"use client"`):
```tsx
"use client";

import { useEffect, useState } from "react";

interface Product { id: string; nome: string; }

export function ScopriKeyword() {
  const [products, setProducts] = useState<Product[]>([]);
  const [seedsText, setSeedsText] = useState("");
  const [productId, setProductId] = useState("");
  const [topN, setTopN] = useState(12);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([]));
  }, []);

  const submit = async () => {
    const seeds = seedsText.split(",").map((x) => x.trim()).filter(Boolean);
    if (seeds.length === 0 && !productId) { setStatus("Inserisci almeno un seed oppure scegli un prodotto."); return; }
    const num = Number(topN);
    if (!Number.isInteger(num) || num < 1 || num > 30) { setStatus("Numero risultati non valido (1-30)."); return; }
    setBusy(true); setStatus(null);
    try {
      const body: Record<string, unknown> = { topN: num };
      if (seeds.length > 0) body.seeds = seeds;
      if (productId) body.productId = productId;
      const res = await fetch("/api/seozoom/discover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      setStatus(res.ok ? `Create ${json.created} idee da SEOZoom. Vai alla Dashboard Idee.` : `Errore: ${json.error ?? "sconosciuto"}`);
    } catch {
      setStatus("Errore di rete durante la scoperta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg">
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

- [ ] **Step 2: Create the Trend & SEO page**

`src/app/trend-seo/page.tsx`:
```tsx
import { ScopriKeyword } from "@/components/scopri-keyword";

export default function TrendSeoPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Trend & SEO</h1>
      <p className="mb-4 text-sm text-neutral-500">Analizza keyword reali da SEOZoom (volume, difficoltà) e genera idee che entrano nel Brain.</p>
      <h2 className="mb-2 font-medium">Scopri keyword</h2>
      <ScopriKeyword />
    </div>
  );
}
```

- [ ] **Step 3: Redirect the old Scopri route**

Replace `src/app/brain/scopri/page.tsx` with:
```tsx
import { redirect } from "next/navigation";

export default function ScopriRedirect() {
  redirect("/trend-seo");
}
```

- [ ] **Step 4: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds; `/trend-seo` renders the Scopri UI; `/brain/scopri` redirects.

- [ ] **Step 5: Commit**
```bash
git add src/components/scopri-keyword.tsx src/app/trend-seo/ src/app/brain/scopri/page.tsx
git commit -m "feat: Trend & SEO area (extract Scopri keyword) + redirect old route"
```

---

## Task 7: Placeholder areas

**Files:** Create `src/components/coming-soon.tsx`, `src/app/tiktok/page.tsx`, `src/app/email/page.tsx`, `src/app/calendario/page.tsx`, `src/app/pubblicazioni/page.tsx`, `src/app/impostazioni/page.tsx`

- [ ] **Step 1: Create the ComingSoon component**

`src/components/coming-soon.tsx`:
```tsx
export function ComingSoon({ title, descrizione }: { title: string; descrizione: string }) {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">{title}</h1>
      <div className="rounded-lg border border-dashed bg-neutral-50 p-8 text-center">
        <p className="mb-1 font-medium text-neutral-700">Area in arrivo</p>
        <p className="text-sm text-neutral-500">{descrizione}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the five placeholder pages**

`src/app/tiktok/page.tsx`:
```tsx
import { ComingSoon } from "@/components/coming-soon";
export default function TikTokPage() {
  return <ComingSoon title="TikTok" descrizione="Generazione di script video brevi (hook, parlato, testo a schermo, caption, CTA) da idee approvate. Disponibile in una fase successiva." />;
}
```

`src/app/email/page.tsx`:
```tsx
import { ComingSoon } from "@/components/coming-soon";
export default function EmailPage() {
  return <ComingSoon title="Email Marketing" descrizione="Newsletter, promo, email educazionali e flussi (Klaviyo) da idee approvate. Disponibile in una fase successiva." />;
}
```

`src/app/calendario/page.tsx`:
```tsx
import { ComingSoon } from "@/components/coming-soon";
export default function CalendarioPage() {
  return <ComingSoon title="Calendario Editoriale" descrizione="Vista unica (mese/settimana/agenda) di tutti i contenuti programmati su ogni canale, con assegnazione delle date. Disponibile in una fase successiva." />;
}
```

`src/app/pubblicazioni/page.tsx`:
```tsx
import { ComingSoon } from "@/components/coming-soon";
export default function PubblicazioniPage() {
  return <ComingSoon title="Pubblicazioni" descrizione="Stato tecnico delle pubblicazioni gestite da n8n (programmati, inviati, pubblicati, errori, log). Disponibile in una fase successiva." />;
}
```

`src/app/impostazioni/page.tsx`:
```tsx
import { ComingSoon } from "@/components/coming-soon";
export default function ImpostazioniPage() {
  return <ComingSoon title="Impostazioni" descrizione="Configurazione del sistema. Disponibile in una fase successiva." />;
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds; all five placeholder routes compile.

- [ ] **Step 4: Commit**
```bash
git add src/components/coming-soon.tsx src/app/tiktok/ src/app/email/ src/app/calendario/ src/app/pubblicazioni/ src/app/impostazioni/
git commit -m "feat: placeholder areas (TikTok, Email, Calendario, Pubblicazioni, Impostazioni)"
```

---

## Task 8: Gate + smoke

- [ ] **Step 1: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all unit tests pass; tsc 0; build succeeds. Fix any integration issue; commit only if needed:
```bash
git add -A && git commit -m "chore: editorial OS fase 1 integration fixes"
```

- [ ] **Step 2: Smoke (local, with DB)**

Start the dev server (`PORT=8001 npm run dev`) and verify in a browser:
- Sidebar shows all areas; the active area is highlighted; Brain shows its sub-items when active.
- `/` Home renders the cards with real counts (idee/Meta/Blog), TikTok/Email show "in arrivo", and "Calendario imminente" lists upcoming `dataPrevista` contents (or "Nessun contenuto programmato").
- `/trend-seo` shows the Scopri keyword UI; `/brain/scopri` redirects to it.
- `/tiktok`, `/email`, `/calendario`, `/pubblicazioni`, `/impostazioni` show the "in arrivo" placeholder.
- Existing pages (`/dashboard`, `/generate`, `/manual`, `/meta`, `/blog`, `/report`, `/knowledge`) still load inside the new layout.

Report what renders; capture any console/runtime error verbatim.

---

## Self-Review notes (addressed)
- **Spec coverage:** sidebar grouped areas (T2,T3); Home dashboard with per-area cards + upcoming calendar (T4,T5); colored status badges (T1); Trend & SEO area promoting Scopri keyword + redirect (T6); placeholders for TikTok/Email/Calendario/Pubblicazioni/Impostazioni (T7); no data-model change; gate+smoke (T8). Reuse of existing Brain/Meta/Blog pages preserved (linked from the sidebar; layout-only change).
- **Type consistency:** `HomeSummary`/`SummarizeInput` defined in `summary.ts` (T4), consumed by the route (T4) and the Home page (T5); `navItems`/`isActive` in `items.ts` (T2) consumed by `Sidebar` (T3); `badgeStyle`/`StatusBadge` (T1) available for later phases (not yet wired into existing tables — out of scope, deeper table work is Phase 2).
- **No placeholders-as-gaps:** the "ComingSoon" pages are an intentional deliverable, not unfinished work; every code step is complete. The `_count._all` Prisma typing caveat is noted with a concrete fallback (T4 step 6).
```
