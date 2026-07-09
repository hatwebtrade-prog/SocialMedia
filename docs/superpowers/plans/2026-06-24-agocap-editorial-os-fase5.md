# Editorial OS — Fase 5 (Calendario editoriale unico) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A unified editorial calendar at `/calendario` (month/week/agenda views, channel-colored) backed by a dedicated `EditorialCalendarItem` table. Assigning a date schedules a content (mirrors `dataPrevista` + sets status PROGRAMMATO); moving/removing updates it. A "da programmare" sidebar lists approved-but-undated content. Date-input + click (no drag&drop).

**Architecture:** Dedicated `EditorialCalendarItem` (one per content, `@unique`); the assign/move/delete API writes the item AND mirrors `GeneratedContent.dataPrevista`/`status` in a transaction (so Home + Meta calendar keep working). Pure tested helpers (`channelColor`/`contentHref`/`toCalendarEntry`). Client `CalendarBoard` fetches `/api/calendar` for the visible range + `/api/calendar/unscheduled`.

**Tech Stack:** Next.js 15, Prisma/Postgres, Tailwind, Vitest. UI Italian, code English.

**Branch:** `editorial-os-phase5` (off `brain-mvp-clean`). Local Postgres via `.env`.

**Current state:** `GeneratedContent { canale (Canale), status (ContentStatus), dataPrevista, payload, idea }`. `Canale = META|TIKTOK|BLOG`. `/calendario` is a ComingSoon placeholder (replace it). `src/components/status-badge.tsx` exports `StatusBadge`. Meta calendar at `/meta/calendario` stays.

---

## Task 1: Prisma — EditorialCalendarItem

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add the model + back-relation**

Add the model:
```prisma
model EditorialCalendarItem {
  id           String            @id @default(cuid())
  contentId    String            @unique
  content      GeneratedContent  @relation(fields: [contentId], references: [id], onDelete: Cascade)
  scheduledAt  DateTime
  channel      Canale
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  @@index([scheduledAt])
  @@index([channel])
}
```
In `model GeneratedContent { ... }`, add the back-relation (near `assets`):
```prisma
  calendarItem  EditorialCalendarItem?
```

- [ ] **Step 2: validate + migrate + generate**
```bash
npx prisma validate
npx prisma migrate dev --name editorial_calendar_item
npx prisma generate
npx tsc --noEmit
```
Expected: valid; migration applied (additive); tsc 0. If DB unreachable, report BLOCKED.

- [ ] **Step 3: Commit**
```bash
git add prisma/
git commit -m "feat: EditorialCalendarItem model"
```

---

## Task 2: Calendar helpers + validators

**Files:** Create `src/lib/calendar/helpers.ts`, `src/app/api/calendar/validators.ts`; Test `src/lib/calendar/helpers.test.ts`, `src/app/api/calendar/validators.test.ts`

- [ ] **Step 1: Write the failing helper test**

`src/lib/calendar/helpers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { channelColor, contentHref, toCalendarEntry } from "@/lib/calendar/helpers";

describe("calendar helpers", () => {
  it("channelColor differs per channel and falls back", () => {
    expect(channelColor("META")).toContain("blue");
    expect(channelColor("BLOG")).toContain("green");
    expect(channelColor("ZZZ")).toContain("neutral");
  });
  it("contentHref points to the channel detail", () => {
    expect(contentHref("META", "c1")).toBe("/meta/c1");
    expect(contentHref("BLOG", "c1")).toBe("/blog/c1");
    expect(contentHref("EMAIL", "c1")).toBe("#");
  });
  it("toCalendarEntry uses titoloSeo for blog, idea title otherwise", () => {
    const blog = toCalendarEntry({ id: "i1", contentId: "c1", scheduledAt: "2026-06-25T00:00:00.000Z", channel: "BLOG", content: { status: "PROGRAMMATO", payload: { titoloSeo: "Guida" }, idea: { titolo: "Idea X" } } });
    expect(blog.titolo).toBe("Guida");
    expect(blog.href).toBe("/blog/c1");
    expect(blog.status).toBe("PROGRAMMATO");
    const meta = toCalendarEntry({ id: "i2", contentId: "c2", scheduledAt: "2026-06-25T00:00:00.000Z", channel: "META", content: { status: "PROGRAMMATO", payload: {}, idea: { titolo: "Idea Y" } } });
    expect(meta.titolo).toBe("Idea Y");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/calendar/helpers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

`src/lib/calendar/helpers.ts`:
```ts
export function channelColor(channel: string): string {
  switch (channel) {
    case "META": return "bg-blue-100 text-blue-800";
    case "BLOG": return "bg-green-100 text-green-800";
    case "TIKTOK": return "bg-purple-100 text-purple-800";
    case "EMAIL": return "bg-amber-100 text-amber-800";
    default: return "bg-neutral-100 text-neutral-700";
  }
}

export function contentHref(channel: string, contentId: string): string {
  if (channel === "META") return `/meta/${contentId}`;
  if (channel === "BLOG") return `/blog/${contentId}`;
  return "#";
}

export interface CalendarEntry {
  id: string;
  contentId: string;
  scheduledAt: string;
  channel: string;
  status: string;
  titolo: string;
  href: string;
}

interface RawItem {
  id: string;
  contentId: string;
  scheduledAt: Date | string;
  channel: string;
  content: { status: string; payload: unknown; idea: { titolo: string } | null };
}

export function toCalendarEntry(item: RawItem): CalendarEntry {
  const titolo = (item.content.payload as { titoloSeo?: string } | null)?.titoloSeo ?? item.content.idea?.titolo ?? "Contenuto";
  return {
    id: item.id,
    contentId: item.contentId,
    scheduledAt: new Date(item.scheduledAt).toISOString(),
    channel: item.channel,
    status: item.content.status,
    titolo,
    href: contentHref(item.channel, item.contentId),
  };
}
```

- [ ] **Step 4: Write + pass the validators test**

`src/app/api/calendar/validators.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { calendarAssignSchema, calendarMoveSchema } from "@/app/api/calendar/validators";

describe("calendar validators", () => {
  it("assign requires contentId + ISO datetime", () => {
    expect(calendarAssignSchema.parse({ contentId: "c1", scheduledAt: "2026-06-25T00:00:00.000Z" }).contentId).toBe("c1");
    expect(() => calendarAssignSchema.parse({ contentId: "c1", scheduledAt: "nope" })).toThrow();
  });
  it("move requires ISO datetime", () => {
    expect(() => calendarMoveSchema.parse({ scheduledAt: "2026-06-25" })).toThrow();
  });
});
```
`src/app/api/calendar/validators.ts`:
```ts
import { z } from "zod";

export const calendarAssignSchema = z.object({
  contentId: z.string().min(1),
  scheduledAt: z.string().datetime(),
});

export const calendarMoveSchema = z.object({
  scheduledAt: z.string().datetime(),
});
```

- [ ] **Step 5: Run both test files + tsc**

Run: `npx vitest run src/lib/calendar/helpers.test.ts src/app/api/calendar/validators.test.ts && npx tsc --noEmit`
Expected: all pass; tsc 0.

- [ ] **Step 6: Commit**
```bash
git add src/lib/calendar/helpers.ts src/lib/calendar/helpers.test.ts src/app/api/calendar/validators.ts src/app/api/calendar/validators.test.ts
git commit -m "feat: calendar helpers (color/href/entry) + validators"
```

---

## Task 3: Calendar API (GET range, unscheduled, POST/PATCH/DELETE)

**Files:** Create `src/app/api/calendar/route.ts`, `src/app/api/calendar/unscheduled/route.ts`, `src/app/api/calendar/[id]/route.ts`; Test `src/app/api/calendar/route.test.ts`

- [ ] **Step 1: GET + POST route**

`src/app/api/calendar/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCalendarEntry } from "@/lib/calendar/helpers";
import { calendarAssignSchema } from "./validators";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const channel = searchParams.get("channel");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.scheduledAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  }
  if (channel) where.channel = channel;
  if (status) where.content = { status };

  const items = await prisma.editorialCalendarItem.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: { content: { select: { status: true, payload: true, idea: { select: { titolo: true } } } } },
  });
  return NextResponse.json(items.map(toCalendarEntry));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = calendarAssignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const { contentId, scheduledAt } = parsed.data;

  const content = await prisma.generatedContent.findUnique({ where: { id: contentId } });
  if (!content) return NextResponse.json({ error: "Contenuto non trovato" }, { status: 404 });

  const when = new Date(scheduledAt);
  const item = await prisma.$transaction(async (tx) => {
    const it = await tx.editorialCalendarItem.upsert({
      where: { contentId },
      update: { scheduledAt: when, channel: content.canale },
      create: { contentId, scheduledAt: when, channel: content.canale },
    });
    await tx.generatedContent.update({ where: { id: contentId }, data: { status: "PROGRAMMATO", dataPrevista: when } });
    return it;
  });
  return NextResponse.json(item, { status: 201 });
}
```

- [ ] **Step 2: unscheduled route**

`src/app/api/calendar/unscheduled/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const contents = await prisma.generatedContent.findMany({
    where: { status: "APPROVATO", calendarItem: null },
    orderBy: { createdAt: "desc" },
    include: { idea: { select: { titolo: true } } },
  });
  return NextResponse.json(
    contents.map((c) => ({
      id: c.id,
      canale: String(c.canale),
      titolo: (c.payload as { titoloSeo?: string } | null)?.titoloSeo ?? c.idea?.titolo ?? "Contenuto",
    })),
  );
}
```

- [ ] **Step 3: PATCH/DELETE route**

`src/app/api/calendar/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calendarMoveSchema } from "../validators";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = calendarMoveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const when = new Date(parsed.data.scheduledAt);
  try {
    const item = await prisma.$transaction(async (tx) => {
      const it = await tx.editorialCalendarItem.update({ where: { id }, data: { scheduledAt: when } });
      await tx.generatedContent.update({ where: { id: it.contentId }, data: { dataPrevista: when } });
      return it;
    });
    return NextResponse.json(item);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const item = await prisma.editorialCalendarItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await tx.editorialCalendarItem.delete({ where: { id } });
    await tx.generatedContent.update({ where: { id: item.contentId }, data: { status: "APPROVATO", dataPrevista: null } });
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Write the failing route test**

`src/app/api/calendar/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const txMock = {
  editorialCalendarItem: { upsert: vi.fn().mockResolvedValue({ id: "cal1", contentId: "c1" }) },
  generatedContent: { update: vi.fn().mockResolvedValue({}) },
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    generatedContent: { findUnique: vi.fn().mockResolvedValue({ id: "c1", canale: "BLOG" }) },
    editorialCalendarItem: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(txMock)),
  },
}));

import { POST } from "@/app/api/calendar/route";
import { prisma } from "@/lib/prisma";

function req(body: unknown) {
  return new Request("http://test/api/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/calendar", () => {
  beforeEach(() => vi.clearAllMocks());
  it("schedules: upserts item + sets content PROGRAMMATO + dataPrevista", async () => {
    const res = await POST(req({ contentId: "c1", scheduledAt: "2026-06-25T00:00:00.000Z" }));
    expect(res.status).toBe(201);
    expect(txMock.editorialCalendarItem.upsert).toHaveBeenCalled();
    expect(txMock.generatedContent.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1" }, data: expect.objectContaining({ status: "PROGRAMMATO" }) }));
  });
  it("404 when content missing", async () => {
    (prisma.generatedContent.findUnique as any).mockResolvedValueOnce(null);
    const res = await POST(req({ contentId: "x", scheduledAt: "2026-06-25T00:00:00.000Z" }));
    expect(res.status).toBe(404);
  });
  it("400 on invalid input", async () => {
    const res = await POST(req({ contentId: "c1", scheduledAt: "nope" }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 5: Run + full suite + tsc + build**

Run: `npx vitest run src/app/api/calendar/route.test.ts && npx vitest run && npx tsc --noEmit && npm run build`
Expected: route tests pass; full suite green; tsc 0; build succeeds.

- [ ] **Step 6: Commit**
```bash
git add src/app/api/calendar/
git commit -m "feat: calendar API (range GET, unscheduled, schedule/move/remove)"
```

---

## Task 4: CalendarBoard UI + /calendario page

**Files:** Create `src/components/calendar-board.tsx`; Modify `src/app/calendario/page.tsx`

- [ ] **Step 1: Create the CalendarBoard component**

`src/components/calendar-board.tsx`:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { channelColor, type CalendarEntry } from "@/lib/calendar/helpers";
import { StatusBadge } from "@/components/status-badge";
import { CONTENT_STATUSES } from "@/lib/meta/enums";

type View = "mese" | "settimana" | "agenda";
const CHANNELS = ["META", "BLOG", "TIKTOK", "EMAIL"];
const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

interface Unscheduled { id: string; canale: string; titolo: string; }

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
const startOfWeek = (d: Date) => { const x = new Date(d); const D = (x.getDay() + 6) % 7; x.setDate(x.getDate() - D); x.setHours(0, 0, 0, 0); return x; };
const endOfWeek = (d: Date) => { const s = startOfWeek(d); const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23, 59, 59); return e; };
const ymd = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const sameDay = (iso: string, d: Date) => { const x = new Date(iso); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate(); };

export function CalendarBoard() {
  const [view, setView] = useState<View>("mese");
  const [cursor, setCursor] = useState(() => new Date());
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<CalendarEntry[]>([]);
  const [unscheduled, setUnscheduled] = useState<Unscheduled[]>([]);

  const [from, to] = view === "settimana" ? [startOfWeek(cursor), endOfWeek(cursor)] : [startOfMonth(cursor), endOfMonth(cursor)];

  const loadItems = useCallback(async () => {
    const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    if (channel) qs.set("channel", channel);
    if (status) qs.set("status", status);
    try {
      const res = await fetch(`/api/calendar?${qs.toString()}`);
      const d = await res.json();
      setItems(Array.isArray(d) ? d : []);
    } catch { setItems([]); }
  }, [from, to, channel, status]);

  const loadUnscheduled = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar/unscheduled");
      const d = await res.json();
      setUnscheduled(Array.isArray(d) ? d : []);
    } catch { setUnscheduled([]); }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { loadUnscheduled(); }, [loadUnscheduled]);

  const refresh = () => { loadItems(); loadUnscheduled(); };

  const schedule = async (contentId: string, date: string) => {
    if (!date) return;
    await fetch("/api/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, scheduledAt: new Date(date).toISOString() }) });
    refresh();
  };
  const move = async (id: string, date: string) => {
    if (!date) return;
    await fetch(`/api/calendar/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ scheduledAt: new Date(date).toISOString() }) });
    refresh();
  };
  const remove = async (id: string) => {
    await fetch(`/api/calendar/${id}`, { method: "DELETE" });
    refresh();
  };

  const step = (dir: number) => setCursor((c) => {
    const n = new Date(c);
    if (view === "settimana") n.setDate(n.getDate() + dir * 7);
    else n.setMonth(n.getMonth() + dir);
    return n;
  });

  const label = view === "settimana"
    ? `Settimana del ${startOfWeek(cursor).toLocaleDateString("it-IT", { day: "numeric", month: "long" })}`
    : cursor.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  const Pill = ({ e }: { e: CalendarEntry }) => (
    <Link href={e.href} className={`mb-1 block truncate rounded px-1 py-0.5 text-xs ${channelColor(e.channel)}`} title={`${e.channel} · ${e.titolo}`}>
      {e.titolo}
    </Link>
  );

  // Month grid
  const renderMese = () => {
    const first = startOfMonth(cursor);
    const startDay = (first.getDay() + 6) % 7;
    const days = endOfMonth(cursor).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    return (
      <div className="grid grid-cols-7 gap-px bg-neutral-200 text-sm">
        {GIORNI.map((g) => <div key={g} className="bg-neutral-100 p-2 text-center text-neutral-500">{g}</div>)}
        {cells.map((d, i) => {
          const dayDate = d ? new Date(cursor.getFullYear(), cursor.getMonth(), d) : null;
          return (
            <div key={i} className="min-h-24 bg-white p-1 align-top">
              {d && <div className="mb-1 text-xs text-neutral-400">{d}</div>}
              {dayDate && items.filter((e) => sameDay(e.scheduledAt, dayDate)).map((e) => <Pill key={e.id} e={e} />)}
            </div>
          );
        })}
      </div>
    );
  };

  // Week columns
  const renderSettimana = () => {
    const s = startOfWeek(cursor);
    const days = Array.from({ length: 7 }, (_, i) => { const x = new Date(s); x.setDate(s.getDate() + i); return x; });
    return (
      <div className="grid grid-cols-7 gap-px bg-neutral-200 text-sm">
        {days.map((d, i) => (
          <div key={i} className="min-h-40 bg-white p-1">
            <div className="mb-1 text-xs text-neutral-500">{GIORNI[i]} {d.getDate()}</div>
            {items.filter((e) => sameDay(e.scheduledAt, d)).map((e) => <Pill key={e.id} e={e} />)}
          </div>
        ))}
      </div>
    );
  };

  // Agenda list (group by day)
  const renderAgenda = () => {
    if (items.length === 0) return <p className="text-sm text-neutral-500">Nessun contenuto programmato in questo mese.</p>;
    return (
      <div className="space-y-2 text-sm">
        {items.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 border-b py-2">
            <span className="w-28 shrink-0 text-neutral-500">{new Date(e.scheduledAt).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })}</span>
            <span className={`rounded px-1.5 text-xs ${channelColor(e.channel)}`}>{e.channel}</span>
            <Link href={e.href} className="text-blue-600 hover:underline">{e.titolo}</Link>
            <StatusBadge status={e.status} />
            <input type="date" defaultValue={ymd(e.scheduledAt)} onChange={(ev) => move(e.id, ev.target.value)} className="ml-auto rounded border p-0.5 text-xs" />
            <button onClick={() => remove(e.id)} className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">Rimuovi</button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {(["mese", "settimana", "agenda"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded px-3 py-1 capitalize ${view === v ? "bg-blue-600 text-white" : "border"}`}>{v}</button>
          ))}
          <button onClick={() => step(-1)} className="ml-2 rounded border px-2 py-1">←</button>
          <span className="font-medium capitalize">{label}</span>
          <button onClick={() => step(1)} className="rounded border px-2 py-1">→</button>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="ml-3 rounded border p-1">
            <option value="">Tutti i canali</option>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border p-1">
            <option value="">Tutti gli stati</option>
            {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-neutral-500">
          {CHANNELS.map((c) => <span key={c} className={`rounded px-1.5 py-0.5 ${channelColor(c)}`}>{c}</span>)}
        </div>
        {view === "mese" && renderMese()}
        {view === "settimana" && renderSettimana()}
        {view === "agenda" && renderAgenda()}
      </div>

      <aside className="w-64 shrink-0">
        <h2 className="mb-2 text-sm font-semibold">Da programmare</h2>
        {unscheduled.length === 0 ? <p className="text-sm text-neutral-500">Nessun contenuto approvato da programmare.</p> : (
          <div className="space-y-3 text-sm">
            {unscheduled.map((u) => (
              <div key={u.id} className="rounded border p-2">
                <div className="mb-1"><span className={`mr-1 rounded px-1 text-xs ${channelColor(u.canale)}`}>{u.canale}</span>{u.titolo}</div>
                <input type="date" onChange={(e) => schedule(u.id, e.target.value)} className="w-full rounded border p-0.5 text-xs" />
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Replace the placeholder page**

`src/app/calendario/page.tsx`:
```tsx
import { CalendarBoard } from "@/components/calendar-board";

export const dynamic = "force-dynamic";

export default function CalendarioPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Calendario Editoriale</h1>
      <CalendarBoard />
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds; `/calendario` compiles.

- [ ] **Step 4: Commit**
```bash
git add src/components/calendar-board.tsx src/app/calendario/page.tsx
git commit -m "feat: unified editorial calendar (month/week/agenda + schedule sidebar)"
```

---

## Task 5: Gate + smoke

- [ ] **Step 1: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npm run build`. Expected: green. Commit only if a fix was needed.

- [ ] **Step 2: Smoke (local, with DB)**

`npx prisma migrate deploy`, start `PORT=8001 npm run dev`. Need an APPROVATO content (approve one via `/meta/[id]` or `/blog/[id]` status select, or PATCH). Then:
- `GET /api/calendar/unscheduled` → includes that content.
- `POST /api/calendar {contentId, scheduledAt:<ISO future>}` → 201; then `GET /api/calendar?from=<monthStart>&to=<monthEnd>` includes the entry; `GET /api/meta|blog/contents/<id>` shows `status:"PROGRAMMATO"` and `dataPrevista` set; it's gone from `/api/calendar/unscheduled`.
- `PATCH /api/calendar/<itemId> {scheduledAt:<new ISO>}` → 200, dataPrevista updated.
- `DELETE /api/calendar/<itemId>` → content back to `APPROVATO`, dataPrevista null, back in unscheduled.
- Open `/calendario`: month grid shows the pill (channel-colored); switch Settimana/Agenda; the "Da programmare" sidebar schedules via the date input.

Report the exact responses + any error verbatim.

---

## Self-Review notes (addressed)
- **Spec coverage:** EditorialCalendarItem dedicated table (T1); pure helpers + validators (T2); range GET + unscheduled + schedule/move/remove with dataPrevista+status mirror in a transaction (T3); month/week/agenda views + channel colors + filters + "da programmare" sidebar + date-input scheduling/moving/removing (T4); gate+smoke (T5). Drag&drop and n8n publishing out of scope (later).
- **Type consistency:** `CalendarEntry`/`toCalendarEntry`/`channelColor`/`contentHref` in `helpers.ts` (T2) consumed by the GET route (T3) and `CalendarBoard` (T4); `calendarAssignSchema`/`calendarMoveSchema` (T2) used by POST/PATCH (T3); `StatusBadge` + `CONTENT_STATUSES` reused in the board (T4); `EditorialCalendarItem` `@unique contentId` makes `upsert({where:{contentId}})` valid.
- **No placeholders:** all code complete; transaction keeps item + content in sync (single write path); mirror preserves Home/Meta-calendar reads of `dataPrevista`.
```
