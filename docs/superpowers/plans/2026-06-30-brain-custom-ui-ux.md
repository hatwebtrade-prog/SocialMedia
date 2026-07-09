# Brain Custom UI/UX ("Natural & Calm") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Brain area (shared shell + `/dashboard`, `/genera`, `/ideas/[id]`) with a reusable "Natural & Calm" design system and a kanban-by-status idea workflow with drag & drop.

**Architecture:** Establish design tokens (Tailwind theme) + fonts (`next/font`) + a small set of presentational primitives in `src/components/ui/`. Build a kanban board over the existing `/api/ideas` endpoints using `@dnd-kit/core` with optimistic status updates. Pure helpers (column mapping, optimistic move, stat formatting) live in `src/lib/brain/kanban.ts` and are unit-tested; visual/component work is verified by typecheck + live-smoke.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS, `next/font/google` (Fraunces + Inter), `react-icons` (Lucide `react-icons/lu`), `@dnd-kit/core`, Vitest (node env, pure-function tests).

## Global Constraints

- UI copy in **Italian**, code/identifiers in **English**.
- Vitest runs in **node** environment — unit tests cover **pure functions only**; do NOT add React-render tests. Components verified via `npx tsc --noEmit` + live-smoke.
- **No** changes to API routes, Prisma schema, or business logic. Reuse `GET /api/ideas`, `PATCH /api/ideas/[id]`, `PATCH /api/ideas/bulk-status`, `PATCH /api/ideas/bulk-destinazioni`.
- Idea statuses (exact): `NUOVA`, `DA_APPROFONDIRE`, `INTERESSANTE`, `APPROVATA`, `SCARTATA`.
- Path alias `@/` → `./src`. Existing tests must stay green (do NOT change `StatusBadge` technical-state classNames `PUBBLICATO`=green / `ERRORE`=red / `INVIATO_A_N8N`=blue — `src/components/status-badge.test.tsx` asserts them).
- Optimistic UI: on API failure, **revert** local state and show a toast — no silent failures.
- Commit after every task. Commit message footer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Design tokens, fonts, global background

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: Tailwind utilities `bg-cream`, `bg-surface`, `text-ink`, `text-ink-soft`, `bg-sage-{50,100,500,700}`, `text-sage-700`, `border-sand-200`, `bg-sand-{50,100}`, `shadow-soft`, `rounded-2xl`; font classes `font-display` (Fraunces) and default `font-sans` (Inter) via CSS vars `--font-fraunces` / `--font-inter`.

- [ ] **Step 1: Add color/shadow/font tokens to Tailwind theme**

Replace `theme.extend` in `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FBF8F1",
        surface: "#FFFFFF",
        ink: { DEFAULT: "#2B2A26", soft: "#6B6760" },
        sage: {
          50: "#F1F4ED", 100: "#E2EAD9", 200: "#C8D6B7", 300: "#A9BE90",
          400: "#88A36C", 500: "#6B8E5A", 600: "#577748", 700: "#4F6B43",
          800: "#3D5234", 900: "#2F3F29",
        },
        sand: {
          50: "#F7F3EA", 100: "#F0EADC", 200: "#E9E3D6", 300: "#D9D0BD",
          400: "#C2B69C", 500: "#A6987A",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(43,42,38,0.04), 0 4px 12px rgba(43,42,38,0.05)",
        lift: "0 2px 4px rgba(43,42,38,0.06), 0 8px 24px rgba(43,42,38,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 2: Set the cream base in globals.css**

Replace the `body` line in `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body { @apply bg-cream text-ink antialiased; }
```

- [ ] **Step 3: Load fonts and apply variables in layout.tsx**

Rewrite `src/app/layout.tsx`:

```tsx
import "./globals.css";
import type { ReactNode } from "react";
import { Inter, Fraunces } from "next/font/google";
import { Sidebar } from "@/components/sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata = { title: "AGOCAP Content AI Hub" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="font-sans">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6 lg:p-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify typecheck + build compiles**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run build`
Expected: build completes (fonts fetch at build time; if the sandbox blocks Google Fonts, note it and verify via `npm run dev` instead — the cream background and serif headings render).

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts src/app/globals.css src/app/layout.tsx
git commit -m "feat(brain-ui): Natural & Calm design tokens + fonts + cream shell"
```

---

### Task 2: UI primitives (`src/components/ui/`)

**Files:**
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/pill.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/segmented-control.tsx`
- Create: `src/components/ui/page-header.tsx`
- Create: `src/components/ui/empty-state.tsx`
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/index.ts`

**Interfaces:**
- Produces:
  - `Button({ variant?: "primary"|"soft"|"ghost"|"danger", size?: "sm"|"md", ...buttonProps })`
  - `Pill({ tone?: "neutral"|"sage"|"amber"|"green"|"sky"|"red"|"stone", children })`
  - `Card({ interactive?: boolean, className?, children, ...divProps })`
  - `SegmentedControl<T extends string>({ options: {value:T,label:string}[], value:T, onChange:(v:T)=>void })`
  - `PageHeader({ title: string, subtitle?: string, actions?: ReactNode })`
  - `EmptyState({ title: string, hint?: string, action?: ReactNode })`
  - `Skeleton({ className? })`
  - barrel re-exports from `index.ts`

- [ ] **Step 1: Button**

`src/components/ui/button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "soft" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-sage-500 text-white hover:bg-sage-600 disabled:opacity-40",
  soft: "bg-sage-50 text-sage-700 hover:bg-sage-100 disabled:opacity-40",
  ghost: "text-ink-soft hover:bg-sand-100 disabled:opacity-40",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-40",
};
const SIZE: Record<Size, string> = { sm: "px-3 py-1 text-sm", md: "px-4 py-2 text-sm" };

export function Button({
  variant = "primary", size = "md", className = "", ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Pill**

`src/components/ui/pill.tsx`:

```tsx
import type { ReactNode } from "react";

export type PillTone = "neutral" | "sage" | "amber" | "green" | "sky" | "red" | "stone";

const TONE: Record<PillTone, string> = {
  neutral: "bg-sand-100 text-ink-soft",
  sage: "bg-sage-100 text-sage-700",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-green-100 text-green-800",
  sky: "bg-sky-100 text-sky-800",
  red: "bg-red-100 text-red-800",
  stone: "bg-stone-200 text-stone-700",
};

export function Pill({ tone = "neutral", className = "", children }: { tone?: PillTone; className?: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[tone]} ${className}`}>{children}</span>;
}
```

- [ ] **Step 3: Card**

`src/components/ui/card.tsx`:

```tsx
import type { HTMLAttributes } from "react";

export function Card({ interactive = false, className = "", ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  const base = "rounded-2xl border border-sand-200 bg-surface shadow-soft";
  const hover = interactive ? "transition hover:-translate-y-0.5 hover:shadow-lift" : "";
  return <div className={`${base} ${hover} ${className}`} {...props} />;
}
```

- [ ] **Step 4: SegmentedControl**

`src/components/ui/segmented-control.tsx`:

```tsx
export function SegmentedControl<T extends string>({
  options, value, onChange, className = "",
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`inline-flex rounded-xl bg-sand-100 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${value === o.value ? "bg-surface text-sage-700 shadow-soft" : "text-ink-soft hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: PageHeader, EmptyState, Skeleton**

`src/components/ui/page-header.tsx`:

```tsx
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
```

`src/components/ui/empty-state.tsx`:

```tsx
import type { ReactNode } from "react";

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-sand-300 px-6 py-10 text-center">
      <p className="font-display text-lg text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

`src/components/ui/skeleton.tsx`:

```tsx
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-sand-100 ${className}`} />;
}
```

- [ ] **Step 6: Barrel export**

`src/components/ui/index.ts`:

```ts
export { Button } from "./button";
export { Pill, type PillTone } from "./pill";
export { Card } from "./card";
export { SegmentedControl } from "./segmented-control";
export { PageHeader } from "./page-header";
export { EmptyState } from "./empty-state";
export { Skeleton } from "./skeleton";
```

- [ ] **Step 7: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui
git commit -m "feat(brain-ui): reusable UI primitives (Button/Pill/Card/Segmented/PageHeader/EmptyState/Skeleton)"
```

---

### Task 3: Restyle StatusBadge + idea-status tones

**Files:**
- Modify: `src/components/status-badge.tsx`
- Test: `src/components/status-badge.test.tsx` (must stay green, unchanged)

**Interfaces:**
- Consumes: `Pill` tones from Task 2 (conceptually; `StatusBadge` keeps its own className map to satisfy the existing test).
- Produces: unchanged exports `badgeStyle(status)`, `StatusBadge({ status })`.

- [ ] **Step 1: Run the existing test to capture the baseline**

Run: `npx vitest run src/components/status-badge.test.tsx`
Expected: PASS (3 describe blocks).

- [ ] **Step 2: Warm the idea-status fills, keep technical states' color words**

In `src/components/status-badge.tsx`, update only the idea-status entries to softer warm fills; **leave** `PUBBLICATO` (green), `ERRORE` (red), `INVIATO_A_N8N` (blue) and the `*_APPROVATO`/publication labels exactly as they are so the test keeps passing. Replace the constants block + idea-status rows:

```ts
const STONE = "bg-stone-200 text-stone-700";
const AMBER = "bg-amber-100 text-amber-800";
const GREEN = "bg-green-100 text-green-800";
const RED = "bg-red-100 text-red-800";
const SKY = "bg-sky-100 text-sky-800";
const BLUE = "bg-blue-100 text-blue-800";
const GRAY = "bg-neutral-100 text-neutral-700";
```

Then in `MAP`, set the idea statuses:

```ts
  NUOVA: { label: "Nuova", className: STONE },
  INTERESSANTE: { label: "Interessante", className: AMBER },
  APPROVATA: { label: "Approvata", className: GREEN },
  SCARTATA: { label: "Scartata", className: RED },
  DA_APPROFONDIRE: { label: "Da approfondire", className: SKY },
```

Leave the publication/technical rows (`BOZZA`, `DA_APPROVARE`, `APPROVATO`, `PROGRAMMATO`, `PUBBLICATO`, `ERRORE`, `NON_INVIATO`, `INVIATO_A_N8N`, `IN_PUBBLICAZIONE`) unchanged. Update the rounded class in `StatusBadge` from `rounded` to `rounded-full`.

- [ ] **Step 3: Run the test to confirm still green**

Run: `npx vitest run src/components/status-badge.test.tsx`
Expected: PASS (asserts `PUBBLICATO`→green, `ERRORE`→red, `INVIATO_A_N8N`→blue, labels unchanged — all preserved).

- [ ] **Step 4: Commit**

```bash
git add src/components/status-badge.tsx
git commit -m "feat(brain-ui): warm idea-status badge tones (technical states unchanged)"
```

---

### Task 4: Sidebar + nav icon map (shared shell)

**Files:**
- Modify: `src/lib/nav/items.ts`
- Create: `src/lib/nav/icons.tsx`
- Modify: `src/components/sidebar.tsx`

**Interfaces:**
- Consumes: `navItems`, `isActive` (existing).
- Produces: `navIcon(key: string): IconType` resolving a Lucide icon component by key; `NavArea.icon` is now a **key string** (e.g. `"home"`, `"brain"`), not an emoji.

- [ ] **Step 1: Swap emoji icon values for keys in items.ts**

In `src/lib/nav/items.ts`, change each `icon:` emoji to a key string. Keep everything else identical:

```ts
  { label: "Home", href: "/", icon: "home" },
  { label: "Brain", href: "/dashboard", icon: "brain", children: [
      { label: "Tutte le idee", href: "/dashboard" },
      { label: "Genera idee", href: "/genera" },
  ] },
  { label: "Trend & SEO", href: "/trend-seo", icon: "trend" },
  { label: "Meta", href: "/meta", icon: "meta" },
  { label: "Blog", href: "/blog", icon: "blog" },
  { label: "TikTok", href: "/tiktok", icon: "tiktok" },
  { label: "Email", href: "/email", icon: "email" },
  { label: "Calendario", href: "/calendario", icon: "calendar" },
  { label: "Pubblicazioni", href: "/pubblicazioni", icon: "publish" },
  { label: "Report", href: "/report", icon: "report" },
  { label: "Knowledge Base", href: "/knowledge", icon: "knowledge" },
  { label: "Impostazioni", href: "/impostazioni", icon: "settings" },
```

- [ ] **Step 2: Create the icon map**

`src/lib/nav/icons.tsx`:

```tsx
import {
  LuHouse, LuBrain, LuTrendingUp, LuInstagram, LuFileText, LuVideo,
  LuMail, LuCalendar, LuRocket, LuChartBar, LuBookOpen, LuSettings, LuCircle,
} from "react-icons/lu";
import type { IconType } from "react-icons";

const ICONS: Record<string, IconType> = {
  home: LuHouse, brain: LuBrain, trend: LuTrendingUp, meta: LuInstagram,
  blog: LuFileText, tiktok: LuVideo, email: LuMail, calendar: LuCalendar,
  publish: LuRocket, report: LuChartBar, knowledge: LuBookOpen, settings: LuSettings,
};

export function navIcon(key: string): IconType {
  return ICONS[key] ?? LuCircle;
}
```

- [ ] **Step 3: Restyle the sidebar with tokens + brandmark + Lucide icons**

Rewrite `src/components/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, isActive } from "@/lib/nav/items";
import { navIcon } from "@/lib/nav/icons";
import { LuLeaf } from "react-icons/lu";

export function Sidebar() {
  const pathname = usePathname() ?? "/";
  return (
    <aside className="w-60 shrink-0 border-r border-sand-200 bg-sand-50 p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <LuLeaf className="text-sage-600" aria-hidden />
        <span className="font-display text-base font-semibold text-ink">AGOCAP</span>
      </div>
      <nav className="space-y-1 text-sm">
        {navItems.map((area) => {
          const active = isActive(pathname, area.href);
          const Icon = navIcon(area.icon);
          return (
            <div key={area.href}>
              <Link
                href={area.href}
                className={`relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition ${active ? "bg-sage-100 font-medium text-sage-700" : "text-ink-soft hover:bg-sand-100"}`}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-sage-500" aria-hidden />}
                <Icon className="shrink-0" aria-hidden />
                <span>{area.label}</span>
              </Link>
              {area.children && active && (
                <div className="ml-8 mt-1 space-y-0.5">
                  {area.children.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      className={`block rounded-lg px-2 py-1 text-xs transition ${pathname === sub.href ? "font-medium text-sage-700" : "text-ink-soft hover:text-ink"}`}
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

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (confirm all `react-icons/lu` names resolve; if any Lucide name is missing in v5, substitute the nearest — e.g. `LuHouse`/`LuChartBar` exist in react-icons 5.x).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nav/items.ts src/lib/nav/icons.tsx src/components/sidebar.tsx
git commit -m "feat(brain-ui): Natural & Calm sidebar with Lucide icons + brandmark"
```

---

### Task 5: Kanban pure helpers + tests

**Files:**
- Create: `src/lib/brain/kanban.ts`
- Test: `src/lib/brain/kanban.test.ts`

**Interfaces:**
- Produces:
  - `type IdeaStatus = "NUOVA"|"DA_APPROFONDIRE"|"INTERESSANTE"|"APPROVATA"|"SCARTATA"`
  - `interface KanbanColumn { status: IdeaStatus; label: string }`
  - `const KANBAN_COLUMNS: KanbanColumn[]` (4 primary, ordered)
  - `const DISCARDED_COLUMN: KanbanColumn`
  - `groupIdeasByStatus<T extends { status: string }>(ideas: T[]): Record<IdeaStatus, T[]>`
  - `applyMove<T extends { id: string; status: string }>(ideas: T[], id: string, status: IdeaStatus): T[]`
  - `formatStat(value: number | null | undefined): string`
  - `formatVolume(value: number | null | undefined): string`

- [ ] **Step 1: Write the failing tests**

`src/lib/brain/kanban.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  KANBAN_COLUMNS, DISCARDED_COLUMN, groupIdeasByStatus, applyMove, formatStat, formatVolume,
} from "@/lib/brain/kanban";

describe("kanban columns", () => {
  it("has 4 primary columns in editorial order, excluding SCARTATA", () => {
    expect(KANBAN_COLUMNS.map((c) => c.status)).toEqual([
      "NUOVA", "DA_APPROFONDIRE", "INTERESSANTE", "APPROVATA",
    ]);
    expect(DISCARDED_COLUMN.status).toBe("SCARTATA");
  });
});

describe("groupIdeasByStatus", () => {
  it("buckets ideas by status and returns empty arrays for empty buckets", () => {
    const g = groupIdeasByStatus([
      { id: "a", status: "NUOVA" },
      { id: "b", status: "APPROVATA" },
      { id: "c", status: "NUOVA" },
    ]);
    expect(g.NUOVA.map((i) => i.id)).toEqual(["a", "c"]);
    expect(g.APPROVATA.map((i) => i.id)).toEqual(["b"]);
    expect(g.INTERESSANTE).toEqual([]);
    expect(g.SCARTATA).toEqual([]);
  });
});

describe("applyMove", () => {
  it("changes the status of the matching idea, leaving others untouched", () => {
    const ideas = [{ id: "a", status: "NUOVA" }, { id: "b", status: "NUOVA" }];
    const next = applyMove(ideas, "a", "APPROVATA");
    expect(next.find((i) => i.id === "a")!.status).toBe("APPROVATA");
    expect(next.find((i) => i.id === "b")!.status).toBe("NUOVA");
    expect(ideas[0].status).toBe("NUOVA"); // original not mutated
  });
});

describe("formatStat / formatVolume", () => {
  it("formats null/undefined as em dash", () => {
    expect(formatStat(null)).toBe("—");
    expect(formatStat(undefined)).toBe("—");
    expect(formatStat(72)).toBe("72");
  });
  it("formats volume compactly above 1000", () => {
    expect(formatVolume(950)).toBe("950");
    expect(formatVolume(1900)).toBe("1.9k");
    expect(formatVolume(12000)).toBe("12k");
    expect(formatVolume(null)).toBe("—");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/brain/kanban.test.ts`
Expected: FAIL ("Cannot find module '@/lib/brain/kanban'" / exports undefined).

- [ ] **Step 3: Implement the helpers**

`src/lib/brain/kanban.ts`:

```ts
export type IdeaStatus = "NUOVA" | "DA_APPROFONDIRE" | "INTERESSANTE" | "APPROVATA" | "SCARTATA";

export interface KanbanColumn { status: IdeaStatus; label: string }

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { status: "NUOVA", label: "Nuove" },
  { status: "DA_APPROFONDIRE", label: "Da approfondire" },
  { status: "INTERESSANTE", label: "Interessanti" },
  { status: "APPROVATA", label: "Approvate" },
];

export const DISCARDED_COLUMN: KanbanColumn = { status: "SCARTATA", label: "Scartate" };

const ALL: IdeaStatus[] = [...KANBAN_COLUMNS.map((c) => c.status), DISCARDED_COLUMN.status];

export function groupIdeasByStatus<T extends { status: string }>(ideas: T[]): Record<IdeaStatus, T[]> {
  const out = Object.fromEntries(ALL.map((s) => [s, [] as T[]])) as Record<IdeaStatus, T[]>;
  for (const idea of ideas) {
    if (idea.status in out) out[idea.status as IdeaStatus].push(idea);
  }
  return out;
}

export function applyMove<T extends { id: string; status: string }>(ideas: T[], id: string, status: IdeaStatus): T[] {
  return ideas.map((i) => (i.id === id ? { ...i, status } : i));
}

export function formatStat(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : String(value);
}

export function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/brain/kanban.test.ts`
Expected: PASS (all 4 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/brain/kanban.ts src/lib/brain/kanban.test.ts
git commit -m "feat(brain-ui): kanban pure helpers (columns, grouping, optimistic move, stat formatting) + tests"
```

---

### Task 6: Toast helper + dnd-kit dependency

**Files:**
- Create: `src/components/ui/toast.tsx`
- Modify: `src/components/ui/index.ts`
- Modify: `package.json` (via install)

**Interfaces:**
- Produces: `ToastProvider({ children })` wrapping context; `useToast(): { show: (msg: string, tone?: "ok"|"error") => void }`.

- [ ] **Step 1: Install @dnd-kit/core**

Run: `npm install @dnd-kit/core`
Expected: adds `@dnd-kit/core` to dependencies, no peer-dep errors against React 19.

- [ ] **Step 2: Create the toast provider/hook**

`src/components/ui/toast.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Tone = "ok" | "error";
interface ToastItem { id: number; msg: string; tone: Tone }
interface ToastApi { show: (msg: string, tone?: Tone) => void }

const Ctx = createContext<ToastApi | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((msg: string, tone: Tone = "ok") => {
    const id = nextId++;
    setItems((p) => [...p, { id, msg, tone }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 2500);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={`rounded-xl px-4 py-2 text-sm text-white shadow-lift ${t.tone === "error" ? "bg-red-600" : "bg-sage-600"}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(Ctx) ?? { show: () => {} };
}
```

- [ ] **Step 3: Export from barrel**

Add to `src/components/ui/index.ts`:

```ts
export { ToastProvider, useToast } from "./toast";
```

- [ ] **Step 4: Mount ToastProvider in layout**

In `src/app/layout.tsx`, wrap the shell. Import `{ ToastProvider }` from `@/components/ui` and wrap the `<div className="flex min-h-screen">…</div>` so it becomes:

```tsx
        <ToastProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 p-6 lg:p-8">
              <div className="mx-auto max-w-6xl">{children}</div>
            </main>
          </div>
        </ToastProvider>
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/ui/toast.tsx src/components/ui/index.ts src/app/layout.tsx
git commit -m "feat(brain-ui): toast provider/hook + add @dnd-kit/core"
```

---

### Task 7: IdeaCard component

**Files:**
- Create: `src/components/brain/idea-card.tsx`

**Interfaces:**
- Consumes: `Card`, `Pill` (Task 2); `formatStat`, `formatVolume` (Task 5); `ChannelIcons` (existing `@/components/channel-icon`).
- Produces: `KanbanIdea` interface + `IdeaCard({ idea, selected, onToggleSelect })`:
  - `interface KanbanIdea { id; titolo; category; status; priority; seoScore; keyword?; volumeRicerca?; difficolta?; destinazioni?; product?: { nome } | null; source?: { key } | null }`
  - `IdeaCard({ idea: KanbanIdea, selected: boolean, onToggleSelect: (id: string) => void })`

- [ ] **Step 1: Implement IdeaCard**

`src/components/brain/idea-card.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Card, Pill } from "@/components/ui";
import { ChannelIcons } from "@/components/channel-icon";
import { formatStat, formatVolume } from "@/lib/brain/kanban";

export interface KanbanIdea {
  id: string;
  titolo: string;
  category: string;
  status: string;
  priority: number;
  seoScore: number;
  keyword?: string | null;
  volumeRicerca?: number | null;
  difficolta?: number | null;
  destinazioni?: string[];
  product?: { nome: string } | null;
  source?: { key: string } | null;
}

const SOURCE_LABEL: Record<string, string> = { "ai-brainstorming": "AI", manuale: "Manuale", seozoom: "SEOZoom" };

export function IdeaCard({ idea, selected, onToggleSelect }: { idea: KanbanIdea; selected: boolean; onToggleSelect: (id: string) => void }) {
  return (
    <Card interactive className={`p-3 ${selected ? "ring-2 ring-sage-400" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Pill tone="sage">P{idea.priority}</Pill>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(idea.id)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Seleziona idea"
        />
      </div>
      <Link href={`/ideas/${idea.id}`} className="block font-display text-sm font-semibold leading-snug text-ink hover:text-sage-700 line-clamp-2">
        {idea.titolo}
      </Link>
      {idea.keyword && <div className="mt-2"><Pill tone="neutral">{idea.keyword}</Pill></div>}
      <div className="mt-2 text-xs text-ink-soft">
        SEO {formatStat(idea.seoScore)} · vol {formatVolume(idea.volumeRicerca)} · KD {formatStat(idea.difficolta)}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <ChannelIcons channels={idea.destinazioni ?? []} />
        <span className="text-[11px] text-ink-soft">{idea.source ? (SOURCE_LABEL[idea.source.key] ?? idea.source.key) : ""}</span>
      </div>
      {idea.product && <div className="mt-1 text-[11px] text-ink-soft">📦 {idea.product.nome}</div>}
    </Card>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/brain/idea-card.tsx
git commit -m "feat(brain-ui): IdeaCard for kanban"
```

---

### Task 8: KanbanColumn (droppable) + KanbanBoard (dnd context)

**Files:**
- Create: `src/components/brain/kanban-column.tsx`
- Create: `src/components/brain/kanban-board.tsx`

**Interfaces:**
- Consumes: `@dnd-kit/core` (`DndContext`, `useDroppable`, `useDraggable`, `DragEndEvent`); `KANBAN_COLUMNS`, `DISCARDED_COLUMN`, `groupIdeasByStatus`, `applyMove`, `IdeaStatus` (Task 5); `IdeaCard`, `KanbanIdea` (Task 7); `EmptyState`, `Pill` (Task 2); `useToast` (Task 6).
- Produces:
  - `KanbanColumn({ column, ideas, selected, onToggleSelect })` — a droppable column rendering draggable `IdeaCard`s.
  - `KanbanBoard({ ideas, onChange, selected, onToggleSelect, showDiscarded })` where `onChange(nextIdeas: KanbanIdea[])` is called after an optimistic move and `props.persist?: (id, status) => Promise<boolean>`.

  Final signature used by the dashboard:
  `KanbanBoard({ ideas, setIdeas, selected, onToggleSelect, showDiscarded, persist })`
  - `ideas: KanbanIdea[]`, `setIdeas: (updater: (prev: KanbanIdea[]) => KanbanIdea[]) => void`
  - `persist: (id: string, status: IdeaStatus) => Promise<boolean>`

- [ ] **Step 1: Implement the droppable column with draggable cards**

`src/components/brain/kanban-column.tsx`:

```tsx
"use client";

import { useDroppable, useDraggable } from "@dnd-kit/core";
import type { KanbanColumn as Column } from "@/lib/brain/kanban";
import { IdeaCard, type KanbanIdea } from "./idea-card";
import { EmptyState, Pill } from "@/components/ui";

function DraggableCard({ idea, selected, onToggleSelect }: { idea: KanbanIdea; selected: boolean; onToggleSelect: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: idea.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50" : ""} {...listeners} {...attributes}>
      <IdeaCard idea={idea} selected={selected} onToggleSelect={onToggleSelect} />
    </div>
  );
}

export function KanbanColumn({ column, ideas, selected, onToggleSelect }: {
  column: Column; ideas: KanbanIdea[]; selected: Set<string>; onToggleSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="font-display text-sm font-semibold text-ink">{column.label}</span>
        <Pill tone="neutral">{ideas.length}</Pill>
      </div>
      <div ref={setNodeRef} className={`flex min-h-32 flex-1 flex-col gap-3 rounded-2xl p-2 transition ${isOver ? "bg-sage-50 ring-2 ring-sage-200" : "bg-sand-50/50"}`}>
        {ideas.map((idea) => (
          <DraggableCard key={idea.id} idea={idea} selected={selected.has(idea.id)} onToggleSelect={onToggleSelect} />
        ))}
        {ideas.length === 0 && <EmptyState title="Vuota" hint="Nessuna idea qui." />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement the board with DnD context + optimistic persist**

`src/components/brain/kanban-board.tsx`:

```tsx
"use client";

import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { KANBAN_COLUMNS, DISCARDED_COLUMN, groupIdeasByStatus, applyMove, type IdeaStatus } from "@/lib/brain/kanban";
import { KanbanColumn } from "./kanban-column";
import type { KanbanIdea } from "./idea-card";
import { useToast } from "@/components/ui";

const VALID = new Set<string>([...KANBAN_COLUMNS.map((c) => c.status), DISCARDED_COLUMN.status]);

export function KanbanBoard({ ideas, setIdeas, selected, onToggleSelect, showDiscarded, persist }: {
  ideas: KanbanIdea[];
  setIdeas: (updater: (prev: KanbanIdea[]) => KanbanIdea[]) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  showDiscarded: boolean;
  persist: (id: string, status: IdeaStatus) => Promise<boolean>;
}) {
  const { show } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const grouped = groupIdeasByStatus(ideas);
  const columns = showDiscarded ? [...KANBAN_COLUMNS, DISCARDED_COLUMN] : KANBAN_COLUMNS;

  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const target = e.over ? String(e.over.id) : null;
    if (!target || !VALID.has(target)) return;
    const current = ideas.find((i) => i.id === id);
    if (!current || current.status === target) return;
    const previous = current.status;
    setIdeas((prev) => applyMove(prev, id, target as IdeaStatus));
    const ok = await persist(id, target as IdeaStatus);
    if (!ok) {
      setIdeas((prev) => applyMove(prev, id, previous as IdeaStatus));
      show("Spostamento non riuscito, ripristinato.", "error");
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((col) => (
          <KanbanColumn key={col.status} column={col} ideas={grouped[col.status]} selected={selected} onToggleSelect={onToggleSelect} />
        ))}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/brain/kanban-column.tsx src/components/brain/kanban-board.tsx
git commit -m "feat(brain-ui): kanban board + droppable columns with optimistic dnd-kit moves"
```

---

### Task 9: Dashboard page — kanban default + table toggle + toolbar

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Rewrite: `src/components/idea-table.tsx` (extract data/selection logic into a board-aware container)
- Modify: `src/components/idea-filters.tsx` (restyle to tokens; no API change)

**Interfaces:**
- Consumes: `KanbanBoard` (Task 8), `KanbanIdea`/`IdeaCard` (Task 7), `IdeaStatus` (Task 5), `PageHeader`/`SegmentedControl`/`Button`/`Skeleton`/`EmptyState`/`useToast` (Tasks 2,6), `IdeaFilters` (existing), `StatusBadge`, `ChannelIcons`, `matchesText` (existing), `DESTINAZIONI` (existing).
- Produces: `IdeaWorkspace` client component rendering toolbar + kanban/table; `DashboardPage` renders `<PageHeader/> + <IdeaWorkspace/>`.

- [ ] **Step 1: Build the IdeaWorkspace container**

Rewrite `src/components/idea-table.tsx` as `IdeaWorkspace` (keep filename to minimize churn, export `IdeaWorkspace`). It owns: fetch (`GET /api/ideas` with the existing query params), debounced text filter (`matchesText`), selection set, bulk actions (`bulk-status`, `bulk-destinazioni`), the `view` toggle persisted to `localStorage["brain.view"]`, and a `persist(id, status)` calling `PATCH /api/ideas/[id]`. Render `KanbanBoard` for `view==="kanban"` and the restyled table for `view==="table"`.

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { IdeaFilters, type Filters } from "./idea-filters";
import { StatusBadge } from "./status-badge";
import { ChannelIcons } from "@/components/channel-icon";
import { matchesText } from "@/lib/brain/search";
import { DESTINAZIONI } from "@/lib/brain/enums";
import { KanbanBoard } from "@/components/brain/kanban-board";
import type { KanbanIdea } from "@/components/brain/idea-card";
import type { IdeaStatus } from "@/lib/brain/kanban";
import { Button, SegmentedControl, Skeleton, EmptyState, useToast } from "@/components/ui";

type View = "kanban" | "table";

export function IdeaWorkspace() {
  const { show } = useToast();
  const [ideas, setIdeas] = useState<KanbanIdea[]>([]);
  const [filters, setFilters] = useState<Filters>({ q: "", status: "", category: "", platform: "", source: "", destinazione: "", priorita: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destSel, setDestSel] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [view, setView] = useState<View>("kanban");
  const [showDiscarded, setShowDiscarded] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("brain.view") : null;
    if (saved === "table" || saved === "kanban") setView(saved);
  }, []);
  const changeView = (v: View) => { setView(v); window.localStorage.setItem("brain.view", v); };

  useEffect(() => { const t = setTimeout(() => setDebouncedQ(filters.q), 300); return () => clearTimeout(t); }, [filters.q]);

  const { status, category, platform, source, destinazione, priorita } = filters;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (category) qs.set("category", category);
      if (platform) qs.set("platform", platform);
      if (source) qs.set("source", source);
      if (destinazione) qs.set("destinazione", destinazione);
      if (priorita) qs.set("priority", priorita);
      const res = await fetch(`/api/ideas?${qs.toString()}`);
      const data = await res.json();
      setIdeas(Array.isArray(data) ? data : []);
      setSelected(new Set());
    } catch { setIdeas([]); } finally { setLoading(false); }
  }, [status, category, platform, source, destinazione, priorita]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleDest = (d: string) => setDestSel((p) => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n; });

  const persist = useCallback(async (id: string, s: IdeaStatus): Promise<boolean> => {
    try {
      const res = await fetch(`/api/ideas/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: s }) });
      return res.ok;
    } catch { return false; }
  }, []);

  const bulkStatus = async (s: string) => {
    if (selected.size === 0) return;
    await fetch("/api/ideas/bulk-status", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [...selected], status: s }) });
    show("Stato aggiornato.");
    await load();
  };
  const bulkDestinazioni = async () => {
    if (selected.size === 0 || destSel.size === 0) return;
    await fetch("/api/ideas/bulk-destinazioni", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [...selected], destinazioni: [...destSel] }) });
    setDestSel(new Set());
    show("Canali assegnati.");
    await load();
  };

  const visible = ideas.filter((i) => matchesText({ titolo: i.titolo, keyword: i.keyword }, debouncedQ));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <IdeaFilters filters={filters} onChange={setFilters} />
        <div className="flex items-center gap-2">
          {view === "kanban" && (
            <label className="flex items-center gap-1.5 text-xs text-ink-soft">
              <input type="checkbox" checked={showDiscarded} onChange={(e) => setShowDiscarded(e.target.checked)} /> Mostra scartate
            </label>
          )}
          <SegmentedControl<View> options={[{ value: "kanban", label: "Kanban" }, { value: "table", label: "Tabella" }]} value={view} onChange={changeView} />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-sand-50 p-2 text-sm">
          <Button size="sm" onClick={() => bulkStatus("APPROVATA")}>Approva ({selected.size})</Button>
          <Button size="sm" variant="danger" onClick={() => bulkStatus("SCARTATA")}>Scarta</Button>
          <Button size="sm" variant="soft" onClick={() => bulkStatus("INTERESSANTE")}>Interessante</Button>
          <span className="ml-2 text-ink-soft">Assegna a canali:</span>
          {DESTINAZIONI.map((d) => (
            <label key={d} className="flex items-center gap-1"><input type="checkbox" checked={destSel.has(d)} onChange={() => toggleDest(d)} />{d}</label>
          ))}
          <Button size="sm" variant="soft" onClick={bulkDestinazioni} disabled={destSel.size === 0}>Assegna</Button>
        </div>
      )}

      {loading ? (
        <div className="flex gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-72" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState title="Nessuna idea" hint="Genera nuove idee dal Brain." action={<Link href="/genera"><Button>Genera idee</Button></Link>} />
      ) : view === "kanban" ? (
        <KanbanBoard ideas={visible} setIdeas={setIdeas} selected={selected} onToggleSelect={toggle} showDiscarded={showDiscarded} persist={persist} />
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-sand-200 text-left text-ink-soft">
              <th className="p-2"></th><th className="p-2">Titolo</th><th className="p-2">Categoria</th><th className="p-2">Destinazioni</th><th className="p-2">Keyword</th><th className="p-2">SEO</th><th className="p-2">Prio</th><th className="p-2">Stato</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((i) => (
              <tr key={i.id} className="border-b border-sand-100 hover:bg-sand-50">
                <td className="p-2"><input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} /></td>
                <td className="p-2"><Link href={`/ideas/${i.id}`} className="text-sage-700 hover:underline">{i.titolo}</Link></td>
                <td className="p-2">{i.category}</td>
                <td className="p-2"><ChannelIcons channels={i.destinazioni ?? []} /></td>
                <td className="p-2">{i.keyword ?? "—"}</td>
                <td className="p-2">{i.seoScore}</td>
                <td className="p-2">{i.priority}</td>
                <td className="p-2"><StatusBadge status={i.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Restyle idea-filters to tokens**

In `src/components/idea-filters.tsx`, replace control classes with the new look: inputs/selects use `rounded-xl border border-sand-200 bg-surface px-3 py-1.5 text-sm`. Do NOT change `Filters` shape, prop names, option values, or the query params they map to.

- [ ] **Step 3: Update the dashboard page to use PageHeader + IdeaWorkspace**

Rewrite `src/app/dashboard/page.tsx`:

```tsx
import Link from "next/link";
import { IdeaWorkspace } from "@/components/idea-table";
import { PageHeader, Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Brain — Idee"
        subtitle="Sposta le idee tra le colonne per cambiarne lo stato editoriale."
        actions={<Link href="/genera"><Button>+ Genera idee</Button></Link>}
      />
      <IdeaWorkspace />
    </div>
  );
}
```

- [ ] **Step 4: Verify typecheck + existing tests**

Run: `npx tsc --noEmit`
Expected: no errors (note: `idea-table.tsx` now exports `IdeaWorkspace`, not `IdeaTable`; confirm no other importer references `IdeaTable` — only `dashboard/page.tsx` did).
Run: `npm run test`
Expected: PASS (all suites, including kanban + status-badge).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx src/components/idea-table.tsx src/components/idea-filters.tsx
git commit -m "feat(brain-ui): kanban dashboard with view toggle, toolbar, restyled table fallback"
```

---

### Task 10: Restyle `/genera`

**Files:**
- Modify: `src/app/genera/page.tsx`
- Modify: `src/components/import-products-button.tsx` (restyle only)

**Interfaces:**
- Consumes: `PageHeader`, `SegmentedControl`, `Card` (Task 2).
- Produces: restyled `GeneraPage` (tabs → SegmentedControl; forms in Cards). Form component internals unchanged.

- [ ] **Step 1: Rewrite genera page with PageHeader + SegmentedControl + Cards**

`src/app/genera/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ManualIdeaForm } from "@/components/forms/manual-idea-form";
import { AiBrainstormForm } from "@/components/forms/ai-brainstorm-form";
import { ScopriKeyword } from "@/components/scopri-keyword";
import { ImportProductsButton } from "@/components/import-products-button";
import { PageHeader, SegmentedControl, Card } from "@/components/ui";

type Tab = "ricerca" | "ai" | "manuale";

export default function GeneraPage() {
  const [tab, setTab] = useState<Tab>("ricerca");
  return (
    <div>
      <PageHeader title="Genera idee" subtitle="Ricerca data-driven, brainstorming AI o inserimento manuale." actions={<ImportProductsButton />} />
      <SegmentedControl<Tab>
        className="mb-5"
        options={[{ value: "ricerca", label: "Ricerca → idee" }, { value: "ai", label: "AI brainstorming" }, { value: "manuale", label: "Manuale" }]}
        value={tab}
        onChange={setTab}
      />
      <Card className="p-5">
        {tab === "ricerca" && (
          <div>
            <p className="mb-3 text-sm text-ink-soft">Da un seed o un prodotto: query correlate Google + keyword reali SEOZoom (volume/difficoltà) → idee data-driven nel Brain.</p>
            <ScopriKeyword />
          </div>
        )}
        {tab === "ai" && <AiBrainstormForm />}
        {tab === "manuale" && <ManualIdeaForm />}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Restyle the import-products button**

In `src/components/import-products-button.tsx`, swap its `<button>` classes to match the `soft` Button look (`rounded-xl bg-sage-50 px-4 py-2 text-sm font-medium text-sage-700 hover:bg-sage-100`). Keep its logic/handlers intact.

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/genera/page.tsx src/components/import-products-button.tsx
git commit -m "feat(brain-ui): restyle /genera (segmented tabs + cards)"
```

---

### Task 11: Restyle idea detail (`/ideas/[id]`) — two-column

**Files:**
- Modify: `src/app/ideas/[id]/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Card`, `Button`, `Pill`, `useToast` (Tasks 2,6); `IDEA_STATUSES`, `DESTINAZIONI` (existing).
- Produces: restyled two-column detail; same PATCH behavior on `/api/ideas/[id]`.

- [ ] **Step 1: Rewrite the detail page in two columns with toast autosave**

`src/app/ideas/[id]/page.tsx` (keep the `Idea` interface and `patch` logic; change `setSaved` UX to `useToast().show("Salvato")` and lay out two columns):

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { IDEA_STATUSES, DESTINAZIONI } from "@/lib/brain/enums";
import { PageHeader, Card, Button, Pill, useToast } from "@/components/ui";

interface Idea {
  id: string; titolo: string; descrizione: string; category: string; status: string; note: string | null;
  seoScore: number; viralityScore: number; priority: number; piattaformeConsigliate: string[]; destinazioni: string[];
  product?: { nome: string } | null; generationRun?: { id: string; modello: string; promptUsato: string } | null;
}

export default function IdeaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { show } = useToast();
  const [idea, setIdea] = useState<Idea | null>(null);

  useEffect(() => { fetch(`/api/ideas/${id}`).then((r) => r.json()).then(setIdea); }, [id]);

  const patch = async (data: Partial<Idea>) => {
    const res = await fetch(`/api/ideas/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    if (res.ok) { setIdea(await res.json()); show("Salvato"); } else { show("Salvataggio non riuscito", "error"); }
  };

  if (!idea) return <p className="text-ink-soft">Caricamento…</p>;
  return (
    <div>
      <PageHeader title={idea.titolo} subtitle={`Categoria ${idea.category}`} actions={<Link href="/dashboard"><Button variant="ghost">← Idee</Button></Link>} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <p className="text-ink">{idea.descrizione}</p>
          </Card>
          <Card className="p-5">
            <label className="mb-2 block text-sm font-medium text-ink">Note</label>
            <textarea className="w-full rounded-xl border border-sand-200 bg-surface p-3 text-sm" rows={5} defaultValue={idea.note ?? ""} onBlur={(e) => patch({ note: e.target.value })} />
          </Card>
          {idea.status === "APPROVATA" && (
            <Card className="p-5">
              <p className="mb-3 font-display text-lg text-ink">Genera contenuto</p>
              <div className="flex flex-wrap gap-2">
                {idea.destinazioni?.includes("META") && <Link href={`/meta/genera?ideaId=${idea.id}`}><Button>Contenuto Meta</Button></Link>}
                {idea.destinazioni?.includes("BLOG") && <Link href={`/blog/genera?ideaId=${idea.id}`}><Button>Articolo Blog</Button></Link>}
                {(idea.destinazioni?.includes("TIKTOK") || idea.destinazioni?.includes("EMAIL")) && <Pill tone="neutral">TikTok/Email: generatore in arrivo</Pill>}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <label className="mb-1 block text-sm font-medium text-ink">Stato</label>
            <select value={idea.status} onChange={(e) => patch({ status: e.target.value })} className="w-full rounded-xl border border-sand-200 bg-surface p-2 text-sm">
              {IDEA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[["SEO", idea.seoScore], ["Viral", idea.viralityScore], ["Prio", idea.priority]].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-sand-50 p-2">
                  <div className="font-display text-lg text-ink">{v as number}</div>
                  <div className="text-[11px] text-ink-soft">{k as string}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <span className="mb-2 block text-sm font-medium text-ink">Destinazioni editoriali</span>
            <div className="flex flex-wrap gap-2">
              {DESTINAZIONI.map((d) => {
                const checked = idea.destinazioni?.includes(d) ?? false;
                return (
                  <button
                    key={d}
                    onClick={() => patch({ destinazioni: checked ? (idea.destinazioni ?? []).filter((x) => x !== d) : [...(idea.destinazioni ?? []), d] })}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${checked ? "bg-sage-500 text-white" : "bg-sand-100 text-ink-soft hover:bg-sand-200"}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            {idea.product && <p className="mt-3 text-xs text-ink-soft">Prodotto: {idea.product.nome}</p>}
            {idea.piattaformeConsigliate?.length > 0 && <p className="mt-1 text-xs text-ink-soft">Piattaforme: {idea.piattaformeConsigliate.join(", ")}</p>}
          </Card>
          {idea.generationRun && <p className="px-1 text-xs text-ink-soft">Generata dall'AI ({idea.generationRun.modello})</p>}
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/ideas/[id]/page.tsx"
git commit -m "feat(brain-ui): two-column idea detail with stat tiles + pill destinazioni + toast"
```

---

### Task 12: Full verification + live smoke

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: PASS (all suites green, including `kanban.test.ts` and `status-badge.test.ts`).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; production build succeeds.

- [ ] **Step 3: Live smoke (manual)**

Run: `npm run dev`, then verify in the browser:
- Sidebar shows Lucide icons + AGOCAP brandmark, sage active state, cream background.
- `/dashboard` renders 4 kanban columns with real ideas; **drag a card** to another column → it stays; **reload** → status persisted (PATCH worked). "Mostra scartate" reveals the Scartate column. Toggle to **Tabella** → restyled table; reload page → view preference remembered.
- Select cards → bulk action bar appears; "Assegna a canali" works; toast shows.
- `/genera` → segmented tabs switch the form inside a card; destination pills/checkboxes work; "Importa prodotti" styled.
- `/ideas/[id]` → two columns; change status/destinazioni → "Salvato" toast; APPROVATA shows generate-content actions.

- [ ] **Step 4: Final commit (if any polish applied)**

```bash
git add -A
git commit -m "chore(brain-ui): polish after live smoke"
```

---

## Self-Review

**Spec coverage:**
- Design tokens/fonts/shadow → Task 1 ✓
- UI primitives → Task 2 ✓
- Warmed status badge → Task 3 ✓
- Sidebar + Lucide nav + brandmark → Task 4 ✓
- Kanban helpers (column map, optimistic move, formatting) → Task 5 ✓
- Toast + dnd-kit dep → Task 6 ✓
- IdeaCard → Task 7 ✓
- Kanban board/column + optimistic PATCH + revert → Task 8 ✓
- Dashboard kanban default + view toggle (localStorage) + Mostra scartate + restyled table + bulk actions → Task 9 ✓
- `/genera` restyle (segmented + cards + pill channels) → Task 10 ✓
- Idea detail two-column + stat tiles + pill destinazioni + autosave toast + generate-content actions → Task 11 ✓
- No API/schema change; reuse existing endpoints → honored throughout (only GET/PATCH/bulk reused) ✓
- Testing (unit pure helpers + live smoke; existing tests green) → Tasks 5, 9, 12 ✓

**Placeholder scan:** No "TBD"/"add error handling"/"similar to" — optimistic-revert behavior is shown in full (Task 8), filter/import restyle steps name exact class strings. ✓

**Type consistency:** `KanbanIdea` defined in Task 7 and consumed in Tasks 8–9; `IdeaStatus` from Task 5 used in Tasks 8–9; `persist(id, status)` signature identical in Tasks 8 and 9; `setIdeas` updater signature identical in Tasks 8 and 9; `IdeaWorkspace` export named consistently in Tasks 9 (def) and dashboard import. ✓
