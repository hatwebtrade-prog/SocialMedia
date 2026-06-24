# Editorial OS — Area Email (generator) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Email area functional: from an APPROVATA idea (destinazione EMAIL), generate Newsletter / Promo / Educational emails (PROMO references Shopify products), reviewable + schedulable. Real sending (Klaviyo/n8n) stays in the publishing phase.

**Architecture:** Mirrors the Blog generator (injected-deps + fail-safe + `claude.messages.create` JSON+zod + `GeneratedContent`). New `EMAIL` channel + 3 email formats. PROMO loads Shopify products read-only (degrades). No image. Reuse `stripFences` (meta/runtime), `getClaude`, `buildKbContext`, `fetchProductsWithMetafields`, `StatusBadge`.

**Tech Stack:** Next.js 15, Prisma/Postgres, `@anthropic-ai/sdk` (`claude-opus-4-8`), Vitest. UI Italian, code English.

**Branch:** `email-generator` (off `brain-mvp-clean`). Local Postgres via `.env`.

**Current state:** `Canale = META|TIKTOK|BLOG`; `ContentFormat = POST|CAROSELLO|ARTICOLO|REEL|STORY`. `/email` is a ComingSoon placeholder. Blog generator (`src/lib/blog/*`, `src/app/api/blog/*`, `src/app/blog/*`) is the closest template. `src/lib/shopify/products.ts` exports `fetchProductsWithMetafields` + `ShopProduct`.

---

## Task 1: Prisma — EMAIL channel + email formats

**Files:** Modify `prisma/schema.prisma`; Create `src/lib/email/enums.ts`

- [ ] **Step 1: Schema enums**

In `prisma/schema.prisma`, `enum Canale` add `EMAIL`:
```prisma
enum Canale {
  META
  TIKTOK
  BLOG
  EMAIL
}
```
`enum ContentFormat` add the three email formats:
```prisma
  NEWSLETTER
  PROMO_EMAIL
  EDUCAZIONALE
```
(append inside the existing `ContentFormat` enum, after STORY).

- [ ] **Step 2: enums const**

`src/lib/email/enums.ts`:
```ts
export const EMAIL_FORMATS = ["NEWSLETTER", "PROMO_EMAIL", "EDUCAZIONALE"] as const;
export type EmailFormatValue = (typeof EMAIL_FORMATS)[number];
```

- [ ] **Step 3: validate + migrate + generate + tsc**
```bash
npx prisma validate
npx prisma migrate dev --name email_channel_formats
npx prisma generate
npx tsc --noEmit
```
Expected: valid; migration applied (additive enum values); tsc 0. If DB unreachable, report BLOCKED.

- [ ] **Step 4: Commit**
```bash
git add prisma/ src/lib/email/enums.ts
git commit -m "feat: EMAIL channel + email content formats"
```

---

## Task 2: Email schema + prompt

**Files:** Create `src/lib/email/schema.ts`, `src/lib/email/prompt.ts`; Test `src/lib/email/schema.test.ts`, `src/lib/email/prompt.test.ts`

- [ ] **Step 1: Failing schema test**

`src/lib/email/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { emailSchema } from "@/lib/email/schema";

const valid = { oggetto: "Sconto magnesio", preheader: "Solo oggi", corpoHtml: "<p>ciao</p>", cta: "Acquista", prodotti: [{ handle: "mg", titolo: "Mg", url: "https://x/products/mg" }] };

describe("emailSchema", () => {
  it("accepts a valid email", () => {
    expect(emailSchema.parse(valid).oggetto).toBe("Sconto magnesio");
  });
  it("rejects empty oggetto/corpoHtml", () => {
    expect(() => emailSchema.parse({ ...valid, oggetto: "" })).toThrow();
    expect(() => emailSchema.parse({ ...valid, corpoHtml: "" })).toThrow();
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npx vitest run src/lib/email/schema.test.ts`

- [ ] **Step 3: Implement schema**

`src/lib/email/schema.ts`:
```ts
import { z } from "zod";

export const emailSchema = z.object({
  oggetto: z.string().min(1),
  preheader: z.string(),
  corpoHtml: z.string().min(1),
  cta: z.string(),
  prodotti: z.array(z.object({ handle: z.string(), titolo: z.string(), url: z.string() })),
});

export type EmailPayload = z.infer<typeof emailSchema>;
```

- [ ] **Step 4: Failing prompt test**

`src/lib/email/prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildEmailPrompt } from "@/lib/email/prompt";

const idea = { titolo: "Magnesio e stress", descrizione: "d", category: "EDUCATIONAL" };

describe("buildEmailPrompt", () => {
  it("PROMO includes the product catalog + JSON shape", () => {
    const p = buildEmailPrompt({ kbContext: "kb", idea, formato: "PROMO_EMAIL", prodotti: [{ handle: "mg", titolo: "Magnesio Supremo", url: "https://x/products/mg", categoria: "Integratori", metafields: { posologia: "1/die" } }] });
    expect(p).toContain("Magnesio Supremo");
    expect(p.toLowerCase()).toContain("vendita");
    expect(p.toLowerCase()).toContain("json");
  });
  it("NEWSLETTER has no catalog and asks for empty prodotti", () => {
    const p = buildEmailPrompt({ kbContext: "kb", idea, formato: "NEWSLETTER", prodotti: [] });
    expect(p).not.toContain("Catalogo prodotti");
    expect(p).toContain("oggetto");
  });
});
```

- [ ] **Step 5: Run → FAIL, then implement prompt**

`src/lib/email/prompt.ts`:
```ts
import type { ShopProduct } from "@/lib/shopify/products";

export interface EmailIdea {
  titolo: string;
  descrizione: string;
  category: string;
}

export interface EmailPromptArgs {
  kbContext: string;
  idea: EmailIdea;
  formato: string;
  prodotti: ShopProduct[];
}

export function buildEmailPrompt({ kbContext, idea, formato, prodotti }: EmailPromptArgs): string {
  const tono =
    formato === "PROMO_EMAIL"
      ? "email promozionale orientata alla vendita (offerta chiara, urgenza misurata, CTA forte)"
      : formato === "EDUCAZIONALE"
        ? "email educativa che porta valore sul tema (consigli pratici e affidabili, soft CTA)"
        : "newsletter informativa periodica (tono di brand, sezioni chiare)";

  const catalogo =
    formato === "PROMO_EMAIL" && prodotti.length
      ? `\n# Catalogo prodotti Agocap (scegli i pertinenti, CTA con link reali)\n` +
        prodotti
          .map((p) => {
            const mf = Object.entries(p.metafields).map(([k, v]) => `${k}: ${v}`).join("; ");
            return `- ${p.titolo} (handle ${p.handle}, url ${p.url})${mf ? ` — ${mf}` : ""}`;
          })
          .join("\n")
      : "";

  const prodottiCampo =
    formato === "PROMO_EMAIL"
      ? `- prodotti: prodotti pertinenti scelti dal catalogo {handle,titolo,url} (vuoto se nessuno; non inventarli)`
      : `- prodotti: array vuoto []`;

  return `Sei un email marketing specialist per Agocap (integratori, benessere, beauty, salute naturale).

Crea una ${tono}, partendo da questa idea approvata:
Titolo: ${idea.titolo}
Descrizione: ${idea.descrizione}
Categoria: ${idea.category}

# Knowledge base Agocap (tono di voce, prodotti)
${kbContext}
${catalogo}

# Campi richiesti
- oggetto: subject line accattivante (italiano)
- preheader: anteprima breve
- corpoHtml: corpo email in HTML semplice (paragrafi/liste; niente <html>/<head>)
- cta: call to action
${prodottiCampo}

Rispondi esclusivamente con un oggetto JSON valido della forma {"oggetto":"...","preheader":"...","corpoHtml":"...","cta":"...","prodotti":[{"handle":"...","titolo":"...","url":"..."}]}, senza testo prima o dopo, senza markdown.`;
}
```

- [ ] **Step 6: Run both + tsc**

Run: `npx vitest run src/lib/email/ && npx tsc --noEmit`
Expected: 4 tests pass; tsc 0.

- [ ] **Step 7: Commit**
```bash
git add src/lib/email/schema.ts src/lib/email/schema.test.ts src/lib/email/prompt.ts src/lib/email/prompt.test.ts
git commit -m "feat: email schema + per-type prompt builder"
```

---

## Task 3: Pipeline + runtime

**Files:** Create `src/lib/email/generate.ts`, `src/lib/email/runtime.ts`; Test `src/lib/email/generate.test.ts`

- [ ] **Step 1: Failing pipeline test**

`src/lib/email/generate.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { generateEmail } from "@/lib/email/generate";

const payload = { oggetto: "O", preheader: "p", corpoHtml: "<p>x</p>", cta: "c", prodotti: [] };

function makeDeps(overrides = {}) {
  return {
    loadContext: vi.fn().mockResolvedValue({ idea: { titolo: "T", descrizione: "d", category: "EDUCATIONAL" }, kbContext: "kb", prodotti: [] }),
    callClaude: vi.fn().mockResolvedValue({ payload, promptUsato: "P", modello: "claude-opus-4-8", inputTokens: 1, outputTokens: 1, rawOutput: {} }),
    persist: vi.fn().mockResolvedValue({ contentId: "c1" }),
    ...overrides,
  };
}

describe("generateEmail", () => {
  it("DONE → persists the email", async () => {
    const deps = makeDeps();
    const res = await generateEmail({ ideaId: "i1", formato: "NEWSLETTER" }, deps as any);
    expect(res.status).toBe("DONE");
    expect(res.contentId).toBe("c1");
    expect((deps.callClaude as any).mock.calls[0][0].formato).toBe("NEWSLETTER");
  });
  it("ERROR when Claude throws (nothing persisted)", async () => {
    const deps = makeDeps({ callClaude: vi.fn().mockRejectedValue(new Error("AI down")) });
    const res = await generateEmail({ ideaId: "i1", formato: "PROMO_EMAIL" }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(deps.persist).not.toHaveBeenCalled();
  });
}
);
```

- [ ] **Step 2: Run → FAIL, implement pipeline**

`src/lib/email/generate.ts`:
```ts
import type { EmailPayload } from "./schema";
import type { EmailIdea } from "./prompt";
import type { ShopProduct } from "@/lib/shopify/products";

export interface EmailGenInput {
  ideaId: string;
  formato: string;
}

export interface EmailClaudeResult {
  payload: EmailPayload;
  promptUsato: string;
  modello: string;
  inputTokens: number;
  outputTokens: number;
  rawOutput: unknown;
}

export interface EmailDeps {
  loadContext: (input: EmailGenInput) => Promise<{ idea: EmailIdea; kbContext: string; prodotti: ShopProduct[] }>;
  callClaude: (args: { idea: EmailIdea; kbContext: string; formato: string; prodotti: ShopProduct[] }) => Promise<EmailClaudeResult>;
  persist: (args: { input: EmailGenInput; result: EmailClaudeResult }) => Promise<{ contentId: string }>;
}

export interface EmailGenResult {
  status: "DONE" | "ERROR";
  contentId?: string;
  error?: string;
}

export async function generateEmail(input: EmailGenInput, deps: EmailDeps): Promise<EmailGenResult> {
  try {
    const { idea, kbContext, prodotti } = await deps.loadContext(input);
    const result = await deps.callClaude({ idea, kbContext, formato: input.formato, prodotti });
    const { contentId } = await deps.persist({ input, result });
    return { status: "DONE", contentId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 3: Implement runtime**

`src/lib/email/runtime.ts`:
```ts
import { prisma } from "@/lib/prisma";
import { getClaude, BRAINSTORM_MODEL } from "@/lib/claude";
import { buildKbContext } from "@/lib/brain/context";
import { stripFences } from "@/lib/meta/runtime";
import { fetchProductsWithMetafields } from "@/lib/shopify/products";
import { buildEmailPrompt, type EmailIdea } from "./prompt";
import { emailSchema } from "./schema";
import type { EmailDeps, EmailClaudeResult } from "./generate";

export function buildEmailDeps(): EmailDeps {
  return {
    loadContext: async (input) => {
      const idea = await prisma.idea.findUnique({ where: { id: input.ideaId } });
      if (!idea) throw new Error("Idea non trovata");
      if (idea.status !== "APPROVATA") throw new Error("Idea non approvata: genera solo da idee APPROVATA");
      const knowledge = await prisma.knowledgeItem.findMany();
      const product = idea.productId ? await prisma.product.findUnique({ where: { id: idea.productId } }) : null;
      const kbContext = buildKbContext({ products: product ? [product] : [], knowledge });

      let prodotti = [] as Awaited<ReturnType<typeof fetchProductsWithMetafields>>;
      if (input.formato === "PROMO_EMAIL") {
        try {
          prodotti = await fetchProductsWithMetafields();
        } catch (err) {
          console.error("Shopify prodotti non disponibili per email promo, genero senza prodotti:", err instanceof Error ? err.message : err);
        }
      }
      const emailIdea: EmailIdea = { titolo: idea.titolo, descrizione: idea.descrizione, category: String(idea.category) };
      return { idea: emailIdea, kbContext, prodotti };
    },

    callClaude: async ({ idea, kbContext, formato, prodotti }): Promise<EmailClaudeResult> => {
      const prompt = buildEmailPrompt({ kbContext, idea, formato, prodotti });
      const claude = getClaude();
      const response = await claude.messages.create({
        model: BRAINSTORM_MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("Output AI non conforme");
      const payload = emailSchema.parse(JSON.parse(stripFences(textBlock.text)));
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
          canale: "EMAIL",
          formato: input.formato as "NEWSLETTER" | "PROMO_EMAIL" | "EDUCAZIONALE",
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

- [ ] **Step 4: Run pipeline test + full suite + tsc**

Run: `npx vitest run src/lib/email/generate.test.ts && npx vitest run && npx tsc --noEmit`
Expected: pass; tsc 0. (If the `formato` cast to the Prisma enum union complains, widen to `as never` or import the generated enum; values are valid.)

- [ ] **Step 5: Commit**
```bash
git add src/lib/email/generate.ts src/lib/email/generate.test.ts src/lib/email/runtime.ts
git commit -m "feat: email generation pipeline + runtime (Shopify products for promo, degrade)"
```

---

## Task 4: API — validators + generate + contents

**Files:** Create `src/app/api/email/validators.ts`, `src/app/api/email/generate/route.ts`, `src/app/api/email/generate/deps-registry.ts`, `src/app/api/email/contents/route.ts`, `src/app/api/email/contents/[id]/route.ts`; Test `src/app/api/email/generate/route.test.ts`

- [ ] **Step 1: Validators**

`src/app/api/email/validators.ts`:
```ts
import { z } from "zod";
import { EMAIL_FORMATS } from "@/lib/email/enums";
import { CONTENT_STATUSES } from "@/lib/meta/enums";

export const emailGenerateSchema = z.object({
  ideaId: z.string().min(1),
  formato: z.enum(EMAIL_FORMATS),
});

export const emailUpdateSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  dataPrevista: z.string().datetime().nullable().optional(),
});
```

- [ ] **Step 2: deps-registry + generate route (mirror Blog)**

`src/app/api/email/generate/deps-registry.ts`:
```ts
import { generateEmail } from "@/lib/email/generate";

export type DepsFactory = () => { __run?: typeof generateEmail } & Record<string, unknown>;

let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) { depsFactory = f; }
export function getDepsFactory(): DepsFactory { return depsFactory; }
```

`src/app/api/email/generate/route.ts`:
```ts
import { NextResponse } from "next/server";
import { generateEmail } from "@/lib/email/generate";
import { buildEmailDeps } from "@/lib/email/runtime";
import { emailGenerateSchema } from "../validators";
import { getDepsFactory } from "./deps-registry";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON non valido" }, { status: 400 }); }
  const parsed = emailGenerateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido", details: parsed.error.flatten() }, { status: 400 });

  const injected = getDepsFactory()();
  const run = injected.__run ?? generateEmail;
  const deps = injected.__run ? ({} as never) : buildEmailDeps();

  const result = await run(parsed.data, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
```

- [ ] **Step 3: contents routes (mirror Blog)**

`src/app/api/email/contents/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const where: Record<string, unknown> = { canale: "EMAIL" };
  const status = searchParams.get("status");
  if (status) where.status = status;
  const contents = await prisma.generatedContent.findMany({
    where,
    orderBy: [{ dataPrevista: "asc" }, { createdAt: "desc" }],
    include: { idea: { select: { titolo: true } } },
  });
  return NextResponse.json(contents);
}
```

`src/app/api/email/contents/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailUpdateSchema } from "../../validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const content = await prisma.generatedContent.findUnique({ where: { id }, include: { idea: { select: { id: true, titolo: true } } } });
  if (!content) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  return NextResponse.json(content);
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = emailUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (parsed.data.payload !== undefined) data.payload = parsed.data.payload;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.dataPrevista !== undefined) data.dataPrevista = parsed.data.dataPrevista ? new Date(parsed.data.dataPrevista) : null;
  try {
    const content = await prisma.generatedContent.update({ where: { id }, data });
    return NextResponse.json(content);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.generatedContent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    throw err;
  }
}
```

- [ ] **Step 4: Route test**

`src/app/api/email/generate/route.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/email/generate/route";
import { __setDepsFactory } from "@/app/api/email/generate/deps-registry";

function req(body: unknown) {
  return new Request("http://test/api/email/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/email/generate", () => {
  it("200 with contentId on success", async () => {
    __setDepsFactory(() => ({ __run: vi.fn().mockResolvedValue({ status: "DONE", contentId: "c1" }) }) as any);
    const res = await POST(req({ ideaId: "i1", formato: "NEWSLETTER" }));
    expect(res.status).toBe(200);
    expect((await res.json()).contentId).toBe("c1");
  });
  it("400 on invalid formato", async () => {
    const res = await POST(req({ ideaId: "i1", formato: "XYZ" }));
    expect(res.status).toBe(400);
  });
  it("502 on ERROR", async () => {
    __setDepsFactory(() => ({ __run: vi.fn().mockResolvedValue({ status: "ERROR", error: "x" }) }) as any);
    const res = await POST(req({ ideaId: "i1", formato: "PROMO_EMAIL" }));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 5: Run + full suite + tsc + build**

Run: `npx vitest run src/app/api/email/generate/route.test.ts && npx vitest run && npx tsc --noEmit && npm run build`
Expected: pass; tsc 0; build ok.

- [ ] **Step 6: Commit**
```bash
git add src/app/api/email/
git commit -m "feat: email validators + generate route + contents API"
```

---

## Task 5: UI — /email list, genera, detail

**Files:** Create `src/components/email-content-table.tsx`, `src/app/email/genera/page.tsx`, `src/app/email/[id]/page.tsx`; Modify `src/app/email/page.tsx`

- [ ] **Step 1: List table**

`src/components/email-content-table.tsx`:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CONTENT_STATUSES } from "@/lib/meta/enums";
import { StatusBadge } from "@/components/status-badge";

interface Content { id: string; status: string; formato: string; payload: { oggetto?: string }; idea?: { titolo: string } | null; }

export function EmailContentTable() {
  const [items, setItems] = useState<Content[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      const res = await fetch(`/api/email/contents?${qs.toString()}`);
      const d = await res.json();
      setItems(Array.isArray(d) ? d : []);
    } catch { setItems([]); } finally { setLoading(false); }
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
          <thead><tr className="border-b text-left text-neutral-500">
            <th className="p-2">Oggetto</th><th className="p-2">Idea</th><th className="p-2">Tipo</th><th className="p-2">Stato</th>
          </tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b hover:bg-neutral-50">
                <td className="p-2"><Link href={`/email/${c.id}`} className="text-blue-600 hover:underline">{c.payload?.oggetto ?? "Email"}</Link></td>
                <td className="p-2">{c.idea?.titolo ?? "—"}</td>
                <td className="p-2">{c.formato}</td>
                <td className="p-2"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="p-4 text-neutral-500">Nessuna email.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: List page (replace placeholder)**

`src/app/email/page.tsx`:
```tsx
import Link from "next/link";
import { EmailContentTable } from "@/components/email-content-table";

export const dynamic = "force-dynamic";

export default function EmailPage() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Email Marketing</h1>
        <Link href="/email/genera" className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Genera email da idea</Link>
      </div>
      <EmailContentTable />
    </div>
  );
}
```

- [ ] **Step 3: Genera page**

`src/app/email/genera/page.tsx`:
```tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EMAIL_FORMATS } from "@/lib/email/enums";

interface Idea { id: string; titolo: string; }

function EmailGeneraInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideaId, setIdeaId] = useState(search.get("ideaId") ?? "");
  const [formato, setFormato] = useState<string>("NEWSLETTER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ideas?status=APPROVATA&destinazione=EMAIL").then((r) => r.json()).then((d) => setIdeas(Array.isArray(d) ? d : [])).catch(() => setIdeas([]));
  }, []);

  const submit = async () => {
    if (!ideaId) { setError("Scegli un'idea approvata."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/email/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ideaId, formato }) });
      const json = await res.json();
      if (res.ok && json.contentId) router.push(`/email/${json.contentId}`);
      else setError(`Errore: ${json.error ?? "sconosciuto"}`);
    } catch { setError("Errore di rete durante la generazione."); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-2xl font-semibold">Genera email</h1>
      <select className="mb-3 w-full rounded border p-2" value={ideaId} onChange={(e) => setIdeaId(e.target.value)}>
        <option value="">Scegli un'idea approvata…</option>
        {ideas.map((i) => <option key={i.id} value={i.id}>{i.titolo}</option>)}
      </select>
      <select className="mb-3 w-full rounded border p-2" value={formato} onChange={(e) => setFormato(e.target.value)}>
        {EMAIL_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <button onClick={submit} disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40">{busy ? "Genero…" : "Genera"}</button>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function EmailGeneraPage() {
  return <Suspense><EmailGeneraInner /></Suspense>;
}
```

- [ ] **Step 4: Detail page**

`src/app/email/[id]/page.tsx`:
```tsx
"use client";

import { useEffect, useState, use } from "react";
import { StatusBadge } from "@/components/status-badge";

interface Content {
  id: string; status: string; formato: string;
  payload: { oggetto?: string; preheader?: string; corpoHtml?: string; cta?: string; prodotti?: { handle: string; titolo: string; url: string }[] };
  publicationStatus?: string;
}

const STATUSES = ["BOZZA", "DA_APPROVARE", "APPROVATO", "PROGRAMMATO", "PUBBLICATO"];

export default function EmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<Content | null>(null);
  const [err, setErr] = useState(false);

  const load = () => fetch(`/api/email/contents/${id}`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setC).catch(() => setErr(true));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (err) return <p className="text-red-600">Impossibile caricare l'email.</p>;
  if (!c) return <p>Caricamento…</p>;
  const p = c.payload ?? {};
  const setStatus = async (status: string) => {
    try { const r = await fetch(`/api/email/contents/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }); if (!r.ok) throw new Error(); await load(); } catch { setErr(true); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">{p.oggetto ?? "Email"}</h1>
      <p className="mb-2 text-sm text-neutral-500">{p.preheader}</p>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="rounded bg-neutral-100 px-2 py-0.5">{c.formato}</span>
        <select value={c.status} onChange={(e) => setStatus(e.target.value)} className="rounded border p-1">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-neutral-500">Pubblicazione:</span>
        <StatusBadge status={c.publicationStatus ?? "NON_INVIATO"} />
      </div>
      <article className="prose mb-4 max-w-none rounded border p-3" dangerouslySetInnerHTML={{ __html: p.corpoHtml ?? "" }} />
      {p.cta && <p className="mb-4 font-medium">{p.cta}</p>}
      {p.prodotti?.length ? (
        <div className="text-sm"><strong>Prodotti</strong>
          <ul className="ml-4 list-disc">{p.prodotti.map((pr) => <li key={pr.handle}><a href={pr.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{pr.titolo}</a></li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Verify tsc + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 0; build succeeds (`/email`, `/email/genera`, `/email/[id]`). (Nav already links Email → `/email`.)

- [ ] **Step 6: Commit**
```bash
git add src/components/email-content-table.tsx src/app/email/
git commit -m "feat: Email area UI (list, genera, detail)"
```

---

## Task 6: Gate + smoke

- [ ] **Step 1: Gate**

Run: `npx vitest run && npx tsc --noEmit && npm run build`. Expected: green. Commit only if a fix was needed.

- [ ] **Step 2: Smoke (needs ANTHROPIC_API_KEY; SHOPIFY_* for promo)**

`npx prisma migrate deploy`, start the dev server with keys. Ensure an APPROVATA idea with destinazione EMAIL (approve one + bulk-destinazioni `["EMAIL"]`, or PATCH the idea). Then:
- `GET /api/ideas?status=APPROVATA&destinazione=EMAIL` → includes it.
- `POST /api/email/generate {ideaId, formato:"NEWSLETTER"}` → 200 DONE; `GET /api/email/contents/<id>` → payload has oggetto/preheader/corpoHtml/cta, prodotti [].
- `POST {ideaId, formato:"PROMO_EMAIL"}` → payload prodotti references real Shopify products (or [] if Shopify degraded — report which).
- `/email` lists them with badges; `/email/[id]` renders subject + HTML preview + cta (+ products for promo).

Report the exact responses + a sample payload + any error verbatim.

---

## Self-Review notes (addressed)
- **Spec coverage:** EMAIL channel + 3 formats (T1); email schema + per-type prompt incl. Shopify catalog for promo (T2); fail-safe pipeline + runtime with promo-only Shopify load + degrade (T3); validators + generate route (seam) + contents API (T4); /email list+genera+detail UI (T5); gate+smoke (T6). Sending via Klaviyo/n8n out of scope (publishing phase).
- **Type consistency:** `EMAIL_FORMATS`/`EmailFormatValue` (T1) used by validators (T4) + genera UI (T5); `EmailPayload` (T2) is `EmailClaudeResult.payload` (T3); `EmailIdea`/`EmailDeps` (T3) consumed by runtime (T3); `ShopProduct` reused from shopify; `stripFences` reused from meta/runtime; `StatusBadge`/`CONTENT_STATUSES` reused in UI.
- **No placeholders:** all code complete; promo-only product load with degrade; existing channels/formats untouched (additive enums).
```
