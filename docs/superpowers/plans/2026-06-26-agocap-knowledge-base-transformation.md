# Knowledge Base Transformation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the Knowledge Base into a plurifunctional repository (text + uploaded files with text extraction + reference images) and a structured Brand Visual Profile that personalizes all generation (text + images/video) for brand coherence.

**Architecture:** New `KnowledgeFile` (uploaded docs/images, extracted text) and `BrandVisualProfile` (single record). A shared `loadKnowledgeKbItems()` feeds file text into existing text prompts. `buildBrandVisualContext(profile, provider)` injects the visual profile into `buildImagePromptFromBrief` (positives for Higgsfield; negatives only for GPT/Gemini). Built in 2 phases: A (KB+files), B (Visual Profile + coherence).

**Tech Stack:** Next.js 15, Prisma/Postgres, Vitest, `pdf-parse` (PDF→text), `mammoth` (DOCX→text), Claude (`claude-opus-4-8`) for profile auto-fill.

**Branch:** `knowledge-base-transformation` (off `brain-mvp-clean`). Spec: `docs/superpowers/specs/2026-06-26-agocap-knowledge-base-transformation-design.md`.

**Current state:** `KnowledgeItem {tipo:KnowledgeType, titolo, contenuto, tags[], productId?}`. `KnowledgeType { INFO_PRODOTTO, BRAND_VOICE, TARGET, CLAIM, LINEA_GUIDA, DOCUMENTO }`. `/api/knowledge` GET/POST + `[id]` DELETE. `/knowledge` page = simple text form + list. `src/lib/brain/context.ts` `buildKbContext({products, knowledge: KbItem[]})` → text. Runtimes (`src/lib/{meta,blog,email,brain}/runtime.ts`) `loadContext` fetch `prisma.knowledgeItem.findMany()` → map to `KbItem {tipo,titolo,contenuto}` → `buildKbContext`. `src/lib/image/brief.ts` `buildImagePromptFromBrief(brief, ctx:{provider,hasMockup,productName,fallback})`. `src/lib/image/generate.ts` `ImageDeps` + `generateImageAsset` builds `ctx` then `callOpenAI`. `src/lib/image/store.ts` has uploads helpers. Manual image upload uses JSON `{dataUrl}` (`src/lib/image/manual.ts parseDataUrl`).

---

# FASE A — KB + File

## Task 1: Prisma — KnowledgeFile + new types

**Files:** `prisma/schema.prisma`

- [ ] **Step 1:** In `enum KnowledgeType` add two values: `IDEA_PERSONALE` and `PIANO_EDITORIALE`.
- [ ] **Step 2:** Add models + enums:
```prisma
model KnowledgeFile {
  id        String           @id @default(cuid())
  nome      String
  path      String
  mimeType  String
  kind      KnowledgeFileKind
  testo     String?
  stato     FileStatus        @default(IN_CORSO)
  errore    String?
  createdAt DateTime          @default(now())
}

enum KnowledgeFileKind { DOCUMENTO IMMAGINE }
enum FileStatus { IN_CORSO PRONTO ERRORE }
```
- [ ] **Step 3:** `npx prisma validate`. `migrate dev` is interactive here → hand-author `prisma/migrations/20260626100000_knowledge_files/migration.sql`:
```sql
ALTER TYPE "KnowledgeType" ADD VALUE IF NOT EXISTS 'IDEA_PERSONALE';
ALTER TYPE "KnowledgeType" ADD VALUE IF NOT EXISTS 'PIANO_EDITORIALE';
CREATE TYPE "KnowledgeFileKind" AS ENUM ('DOCUMENTO', 'IMMAGINE');
CREATE TYPE "FileStatus" AS ENUM ('IN_CORSO', 'PRONTO', 'ERRORE');
CREATE TABLE "KnowledgeFile" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "kind" "KnowledgeFileKind" NOT NULL,
  "testo" TEXT,
  "stato" "FileStatus" NOT NULL DEFAULT 'IN_CORSO',
  "errore" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeFile_pkey" PRIMARY KEY ("id")
);
```
> Note: `ALTER TYPE ... ADD VALUE` cannot run inside the same transaction as later uses in some Postgres versions; if `migrate deploy` errors on that, split into two migration files (enum values first, then the rest). Run `npx prisma migrate deploy && npx prisma generate`. `npx tsc --noEmit` = 0.
- [ ] **Step 4:** Commit:
```bash
git add prisma/
git commit -m "feat: KnowledgeFile model + IDEA_PERSONALE/PIANO_EDITORIALE types"
```

---

## Task 2: File text extraction

**Files:** Create `src/lib/knowledge/extract.ts`, `src/lib/knowledge/store.ts`; Test `src/lib/knowledge/extract.test.ts`; add deps `pdf-parse`, `mammoth`

- [ ] **Step 1: Install deps** — `npm install pdf-parse mammoth` and `npm install -D @types/pdf-parse` (if available; if not, add a `declare module "pdf-parse"` is unnecessary — pdf-parse ships types via DefinitelyTyped; if types missing, import via `// @ts-expect-error` only as last resort).

- [ ] **Step 2: Failing test** `src/lib/knowledge/extract.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pickFileKind, extractText } from "@/lib/knowledge/extract";

describe("pickFileKind", () => {
  it("classifies images vs documents vs unsupported", () => {
    expect(pickFileKind("image/png")).toBe("IMMAGINE");
    expect(pickFileKind("image/jpeg")).toBe("IMMAGINE");
    expect(pickFileKind("application/pdf")).toBe("DOCUMENTO");
    expect(pickFileKind("text/plain")).toBe("DOCUMENTO");
    expect(pickFileKind("text/markdown")).toBe("DOCUMENTO");
    expect(pickFileKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("DOCUMENTO");
    expect(pickFileKind("application/zip")).toBeNull();
  });
});

describe("extractText (text formats)", () => {
  it("decodes utf-8 for text/plain and markdown", async () => {
    const buf = Buffer.from("# Titolo\nContenuto àèì", "utf-8");
    expect(await extractText(buf, "text/plain", "a.txt")).toContain("Contenuto àèì");
    expect(await extractText(buf, "text/markdown", "a.md")).toContain("Titolo");
  });
});
```

- [ ] **Step 3: Implement** `src/lib/knowledge/extract.ts`:
```ts
export type FileKind = "DOCUMENTO" | "IMMAGINE";

/** Classifies an uploaded file by MIME type; null = unsupported. */
export function pickFileKind(mimeType: string): FileKind | null {
  if (mimeType.startsWith("image/")) return "IMMAGINE";
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "DOCUMENTO";
  }
  return null;
}

/** Extracts plain text from a document buffer (PDF/DOCX/TXT/MD). Throws on parser failure. */
export async function extractText(buffer: Buffer, mimeType: string, filename = ""): Promise<string> {
  if (mimeType === "application/pdf") {
    const pdf = (await import("pdf-parse")).default;
    const data = await pdf(buffer);
    return (data.text ?? "").trim();
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    /\.docx?$/i.test(filename)
  ) {
    const mammoth = await import("mammoth");
    const out = await mammoth.extractRawText({ buffer });
    return (out.value ?? "").trim();
  }
  // text/plain, text/markdown, etc.
  return buffer.toString("utf-8").trim();
}
```

- [ ] **Step 4: Implement** `src/lib/knowledge/store.ts`:
```ts
import path from "node:path";
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";

const DIR = path.join(process.cwd(), "uploads", "knowledge");

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};

export function extFromMime(mimeType: string, nome: string): string {
  if (EXT_BY_MIME[mimeType]) return EXT_BY_MIME[mimeType];
  const dot = nome.lastIndexOf(".");
  return dot >= 0 ? nome.slice(dot + 1).toLowerCase() : "bin";
}

export function saveKnowledgeFile(id: string, ext: string, bytes: Buffer): string {
  mkdirSync(DIR, { recursive: true });
  const rel = path.join("uploads", "knowledge", `${id}.${ext}`);
  writeFileSync(path.join(process.cwd(), rel), bytes);
  return rel;
}

export function readKnowledgeFile(relPath: string): Buffer {
  return readFileSync(path.join(process.cwd(), relPath));
}

export function deleteKnowledgeFile(relPath: string): void {
  try {
    const abs = path.join(process.cwd(), relPath);
    if (existsSync(abs)) unlinkSync(abs);
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 5: Verify + commit**
Run: `npx vitest run src/lib/knowledge/extract.test.ts && npx tsc --noEmit`
```bash
git add package.json package-lock.json src/lib/knowledge/extract.ts src/lib/knowledge/extract.test.ts src/lib/knowledge/store.ts
git commit -m "feat: knowledge file extraction (pdf/docx/txt/md) + storage helpers"
```

---

## Task 3: File upload + serve + delete routes

**Files:** Create `src/app/api/knowledge/files/route.ts`, `src/app/api/knowledge/files/[id]/route.ts`, `src/app/api/knowledge/files/[id]/raw/route.ts`

- [ ] **Step 1: Upload + list** `src/app/api/knowledge/files/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { pickFileKind, extractText } from "@/lib/knowledge/extract";
import { saveKnowledgeFile, extFromMime } from "@/lib/knowledge/store";

const schema = z.object({ nome: z.string().min(1), mimeType: z.string().min(1), contentBase64: z.string().min(1) });

export async function GET() {
  const files = await prisma.knowledgeFile.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(files);
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const { nome, mimeType, contentBase64 } = parsed.data;
  const kind = pickFileKind(mimeType);
  if (!kind) return NextResponse.json({ error: "Tipo file non supportato" }, { status: 400 });

  let bytes: Buffer;
  try {
    bytes = Buffer.from(contentBase64.replace(/^data:[^,]+,/, ""), "base64");
  } catch {
    return NextResponse.json({ error: "Contenuto non valido" }, { status: 400 });
  }
  if (bytes.length > 15 * 1024 * 1024) return NextResponse.json({ error: "File troppo grande (max 15MB)" }, { status: 400 });

  const created = await prisma.knowledgeFile.create({ data: { nome, mimeType, kind, path: "", stato: kind === "IMMAGINE" ? "PRONTO" : "IN_CORSO" } });
  const relPath = saveKnowledgeFile(created.id, extFromMime(mimeType, nome), bytes);
  await prisma.knowledgeFile.update({ where: { id: created.id }, data: { path: relPath } });

  if (kind === "DOCUMENTO") {
    try {
      const testo = await extractText(bytes, mimeType, nome);
      await prisma.knowledgeFile.update({ where: { id: created.id }, data: { testo, stato: "PRONTO" } });
    } catch (err) {
      await prisma.knowledgeFile.update({ where: { id: created.id }, data: { stato: "ERRORE", errore: err instanceof Error ? err.message : "Estrazione fallita" } });
    }
  }
  const result = await prisma.knowledgeFile.findUnique({ where: { id: created.id } });
  return NextResponse.json(result, { status: 201 });
}
```

- [ ] **Step 2: Serve raw** `src/app/api/knowledge/files/[id]/raw/route.ts`:
```ts
import { prisma } from "@/lib/prisma";
import { readKnowledgeFile } from "@/lib/knowledge/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const file = await prisma.knowledgeFile.findUnique({ where: { id } });
  if (!file?.path) return new Response("Not found", { status: 404 });
  try {
    const buf = readKnowledgeFile(file.path);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": file.mimeType, "Cache-Control": "public, max-age=3600" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
```

- [ ] **Step 3: Delete** `src/app/api/knowledge/files/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteKnowledgeFile } from "@/lib/knowledge/store";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const file = await prisma.knowledgeFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  if (file.path) deleteKnowledgeFile(file.path);
  await prisma.knowledgeFile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Verify + commit**
Run: `npx vitest run && npx tsc --noEmit && npm run build`
```bash
git add "src/app/api/knowledge/files/"
git commit -m "feat: knowledge file upload + serve + delete routes (with extraction)"
```

---

## Task 4: File text feeds the text prompts

**Files:** Create `src/lib/knowledge/items.ts`; Test `src/lib/knowledge/items.test.ts`; Modify `src/lib/meta/runtime.ts`, `src/lib/blog/runtime.ts`, `src/lib/email/runtime.ts`, `src/lib/brain/runtime.ts`

- [ ] **Step 1: Failing test** `src/lib/knowledge/items.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toKbItems } from "@/lib/knowledge/items";

describe("toKbItems", () => {
  it("merges KnowledgeItems and ready file texts (capped)", () => {
    const items = [{ tipo: "BRAND_VOICE", titolo: "Voce", contenuto: "tono caldo" }];
    const files = [{ nome: "piano.pdf", testo: "x".repeat(5000) }];
    const out = toKbItems(items, files);
    expect(out[0]).toEqual({ tipo: "BRAND_VOICE", titolo: "Voce", contenuto: "tono caldo" });
    expect(out[1].tipo).toBe("DOCUMENTO");
    expect(out[1].titolo).toBe("piano.pdf");
    expect(out[1].contenuto.length).toBe(2000);
  });
});
```

- [ ] **Step 2: Implement** `src/lib/knowledge/items.ts`:
```ts
import { prisma } from "@/lib/prisma";

export interface KbItemLike { tipo: string; titolo: string; contenuto: string }

/** Pure merge of knowledge items + ready file texts (each file text capped at 2000 chars). */
export function toKbItems(
  items: { tipo: string; titolo: string; contenuto: string }[],
  files: { nome: string; testo: string | null }[],
): KbItemLike[] {
  const fromItems = items.map((i) => ({ tipo: i.tipo, titolo: i.titolo, contenuto: i.contenuto }));
  const fromFiles = files
    .filter((f) => f.testo && f.testo.trim())
    .map((f) => ({ tipo: "DOCUMENTO", titolo: f.nome, contenuto: (f.testo ?? "").slice(0, 2000) }));
  return [...fromItems, ...fromFiles];
}

/** Loads knowledge items + extracted file texts as KbItems for prompt context. */
export async function loadKnowledgeKbItems(): Promise<KbItemLike[]> {
  const [items, files] = await Promise.all([
    prisma.knowledgeItem.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.knowledgeFile.findMany({ where: { stato: "PRONTO", kind: "DOCUMENTO", NOT: { testo: null } }, orderBy: { createdAt: "desc" } }),
  ]);
  return toKbItems(items, files);
}
```

- [ ] **Step 3: Wire into the 4 runtimes** — in each of `src/lib/{meta,blog,email,brain}/runtime.ts`, find where `loadContext` fetches knowledge (currently `const knowledge = await prisma.knowledgeItem.findMany(...)` then maps to `{tipo,titolo,contenuto}` for `buildKbContext`). Replace that fetch+map with:
```ts
import { loadKnowledgeKbItems } from "@/lib/knowledge/items";
// ...
const knowledge = await loadKnowledgeKbItems();
```
and pass `knowledge` to `buildKbContext({ products, knowledge })` as before (the shape `{tipo,titolo,contenuto}[]` is unchanged). Remove the now-unused direct `knowledgeItem.findMany` if it was only used for this.

- [ ] **Step 4: Verify + commit**
Run: `npx vitest run src/lib/knowledge/items.test.ts && npx vitest run && npx tsc --noEmit && npm run build`
```bash
git add src/lib/knowledge/items.ts src/lib/knowledge/items.test.ts src/lib/meta/runtime.ts src/lib/blog/runtime.ts src/lib/email/runtime.ts src/lib/brain/runtime.ts
git commit -m "feat: knowledge file texts feed text prompts (meta/blog/email/brain)"
```

---

## Task 5: UI — File section in /knowledge

**Files:** Create `src/components/knowledge-files.tsx`; Modify `src/app/knowledge/page.tsx`

- [ ] **Step 1: Component** `src/components/knowledge-files.tsx`:
```tsx
"use client";
import { useEffect, useState, useCallback } from "react";

interface KFile { id: string; nome: string; mimeType: string; kind: string; stato: string; errore?: string | null }

export function KnowledgeFiles() {
  const [files, setFiles] = useState<KFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/knowledge/files"); setFiles(await r.json().catch(() => []));
  }, []);
  useEffect(() => { load(); }, [load]);

  const upload = async (file: File) => {
    setBusy(true); setMsg(null);
    try {
      const dataUrl: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
      const resp = await fetch("/api/knowledge/files", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nome: file.name, mimeType: file.type || "application/octet-stream", contentBase64: dataUrl }) });
      const j = await resp.json();
      setMsg(resp.ok ? `Caricato: ${j.nome} (${j.stato})` : `Errore: ${j.error ?? "sconosciuto"}`);
      await load();
    } catch { setMsg("Errore di rete."); } finally { setBusy(false); }
  };
  const remove = async (id: string) => { await fetch(`/api/knowledge/files/${id}`, { method: "DELETE" }); await load(); };

  return (
    <div className="rounded border bg-white p-4">
      <h2 className="mb-2 font-medium">File</h2>
      <input type="file" accept=".pdf,.doc,.docx,.txt,.md,image/*" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} className="text-sm" />
      {busy && <span className="ml-2 text-xs text-neutral-500">Carico…</span>}
      {msg && <p className="mt-1 text-xs text-neutral-600">{msg}</p>}
      <ul className="mt-3 space-y-2 text-sm">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 border-b pb-2">
            {f.kind === "IMMAGINE" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/knowledge/files/${f.id}/raw`} alt="" className="h-10 w-10 rounded border object-contain" />
            ) : <span className="text-lg">📄</span>}
            <a href={`/api/knowledge/files/${f.id}/raw`} target="_blank" rel="noreferrer" className="flex-1 text-blue-600 hover:underline">{f.nome}</a>
            <span className={`rounded px-1.5 py-0.5 text-xs ${f.stato === "PRONTO" ? "bg-green-100 text-green-700" : f.stato === "ERRORE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{f.stato}</span>
            <button onClick={() => remove(f.id)} className="text-xs text-red-600 hover:underline">elimina</button>
          </li>
        ))}
        {files.length === 0 && <li className="text-neutral-400">Nessun file.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Integrate into `src/app/knowledge/page.tsx`** — keep the existing text-material form/list, but wrap the page into sections and render `<KnowledgeFiles />` below the text section. Add `import { KnowledgeFiles } from "@/components/knowledge-files";`, widen the container to `max-w-3xl`, and add the new types to the type select (the page maps `KNOWLEDGE_TYPES` from `@/lib/brain/enums` — ensure that constant includes the two new values; if it's a hardcoded array, add `IDEA_PERSONALE`, `PIANO_EDITORIALE`). Place `<KnowledgeFiles />` after the text list with an `<h2>Materiale testuale</h2>` heading above the existing form.

- [ ] **Step 3:** If `KNOWLEDGE_TYPES` in `src/lib/brain/enums.ts` is a literal array, add `"IDEA_PERSONALE"` and `"PIANO_EDITORIALE"` to it (keep in sync with the Prisma enum).

- [ ] **Step 4: Verify + commit**
Run: `npx tsc --noEmit && npm run build`
```bash
git add src/components/knowledge-files.tsx src/app/knowledge/page.tsx src/lib/brain/enums.ts
git commit -m "feat: Knowledge Base file upload UI section + new material types"
```

---

# FASE B — Profilo Visivo + coerenza

## Task 6: Prisma BrandVisualProfile + GET/PUT

**Files:** `prisma/schema.prisma`; Create `src/app/api/knowledge/visual-profile/route.ts`

- [ ] **Step 1:** Add model:
```prisma
model BrandVisualProfile {
  id                  String   @id @default("default")
  palette             String[] @default([])
  stileFotografico    String?
  mood                String?
  elementiRicorrenti  String?
  daEvitare           String?
  referenceImagePaths String[] @default([])
  updatedAt           DateTime @updatedAt
}
```
`npx prisma validate`. Hand-author `prisma/migrations/20260626110000_brand_visual_profile/migration.sql`:
```sql
CREATE TABLE "BrandVisualProfile" (
  "id" TEXT NOT NULL,
  "palette" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "stileFotografico" TEXT,
  "mood" TEXT,
  "elementiRicorrenti" TEXT,
  "daEvitare" TEXT,
  "referenceImagePaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrandVisualProfile_pkey" PRIMARY KEY ("id")
);
```
`npx prisma migrate deploy && npx prisma generate`. tsc 0.

- [ ] **Step 2: Route** `src/app/api/knowledge/visual-profile/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  palette: z.array(z.string()).optional(),
  stileFotografico: z.string().nullish(),
  mood: z.string().nullish(),
  elementiRicorrenti: z.string().nullish(),
  daEvitare: z.string().nullish(),
  referenceImagePaths: z.array(z.string()).optional(),
});

export async function GET() {
  const profile = await prisma.brandVisualProfile.findUnique({ where: { id: "default" } });
  return NextResponse.json(profile ?? { id: "default", palette: [], referenceImagePaths: [] });
}

export async function PUT(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const d = parsed.data;
  const data = {
    palette: d.palette ?? [], stileFotografico: d.stileFotografico ?? null, mood: d.mood ?? null,
    elementiRicorrenti: d.elementiRicorrenti ?? null, daEvitare: d.daEvitare ?? null, referenceImagePaths: d.referenceImagePaths ?? [],
  };
  const profile = await prisma.brandVisualProfile.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
  return NextResponse.json(profile);
}
```

- [ ] **Step 3: Verify + commit**
Run: `npx tsc --noEmit && npm run build`
```bash
git add prisma/ "src/app/api/knowledge/visual-profile/route.ts"
git commit -m "feat: BrandVisualProfile model + GET/PUT route"
```

---

## Task 7: Inject brand visual coherence into image/video generation

**Files:** Create `src/lib/knowledge/brand-context.ts`; Test `src/lib/knowledge/brand-context.test.ts`; Modify `src/lib/image/brief.ts`, `src/lib/image/brief.test.ts`, `src/lib/image/generate.ts`, `src/lib/image/runtime.ts`

- [ ] **Step 1: Failing test** `src/lib/knowledge/brand-context.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildBrandVisualContext } from "@/lib/knowledge/brand-context";

const profile = { palette: ["verde salvia", "bianco caldo"], stileFotografico: "UGC iphone, luce naturale", mood: "fresco e sano", elementiRicorrenti: "ingredienti naturali", daEvitare: "aspetto plasticoso, testo in immagine" };

describe("buildBrandVisualContext", () => {
  it("GPT: includes positives AND avoid", () => {
    const s = buildBrandVisualContext(profile, "GPT");
    expect(s).toContain("verde salvia");
    expect(s.toLowerCase()).toContain("evita");
    expect(s).toContain("plasticoso");
  });
  it("HIGGSFIELD: positives only, no avoid", () => {
    const s = buildBrandVisualContext(profile, "HIGGSFIELD");
    expect(s).toContain("verde salvia");
    expect(s.toLowerCase()).not.toContain("evita");
    expect(s).not.toContain("plasticoso");
  });
  it("empty profile → empty string", () => {
    expect(buildBrandVisualContext({ palette: [] }, "GPT")).toBe("");
  });
});
```

- [ ] **Step 2: Implement** `src/lib/knowledge/brand-context.ts`:
```ts
import type { ImageProvider } from "@/lib/image/providers";

export interface BrandVisualData {
  palette?: string[];
  stileFotografico?: string | null;
  mood?: string | null;
  elementiRicorrenti?: string | null;
  daEvitare?: string | null;
}

/** Formats the brand visual profile for a provider. Higgsfield gets positives only (no negations). */
export function buildBrandVisualContext(p: BrandVisualData, provider: ImageProvider): string {
  const positives: string[] = [];
  if (p.palette && p.palette.length) positives.push(`palette ${p.palette.join(", ")}`);
  if (p.stileFotografico) positives.push(`stile ${p.stileFotografico}`);
  if (p.mood) positives.push(`mood ${p.mood}`);
  if (p.elementiRicorrenti) positives.push(`elementi ${p.elementiRicorrenti}`);
  if (positives.length === 0 && !(provider !== "HIGGSFIELD" && p.daEvitare)) return "";

  if (provider === "HIGGSFIELD") {
    return positives.join(", ");
  }
  const base = positives.length ? `Coerenza brand Agocap: ${positives.join("; ")}.` : "";
  const avoid = p.daEvitare ? ` Evita: ${p.daEvitare}.` : "";
  return `${base}${avoid}`.trim();
}
```

- [ ] **Step 3: brief.ts uses brandVisual** — in `src/lib/image/brief.ts`, add `brandVisual?: string` to `PromptCtx`. In `buildImagePromptFromBrief`:
  - HIGGSFIELD: append `ctx.brandVisual` to the comma-joined phrase when present: `[...fields, ctx.brandVisual].filter(Boolean).join(", ")`.
  - GPT/Gemini: append ` ${ctx.brandVisual}` to the returned prompt (after the photoreal/negation block) when present.
  Add a test in `src/lib/image/brief.test.ts`:
```ts
  it("includes brandVisual context", () => {
    const g = buildImagePromptFromBrief({ soggetto: "x" }, { provider: "GPT", brandVisual: "Coerenza brand Agocap: palette verde." });
    expect(g).toContain("palette verde");
    const h = buildImagePromptFromBrief({ soggetto: "x" }, { provider: "HIGGSFIELD", brandVisual: "palette verde" });
    expect(h).toContain("palette verde");
  });
```

- [ ] **Step 4: generate.ts + runtime load the profile** — `src/lib/image/generate.ts`: `ImageDeps` += `loadBrandVisual?: () => Promise<import("@/lib/knowledge/brand-context").BrandVisualData | null>;`. In `generateImageAsset`, before building the prompt:
```ts
    const brandProfile = deps.loadBrandVisual ? await deps.loadBrandVisual() : null;
    const brandVisual = brandProfile ? buildBrandVisualContext(brandProfile, input.provider ?? "GPT") : undefined;
```
and pass `brandVisual` into the `buildImagePromptFromBrief(..., { provider, hasMockup, fallback, brandVisual })` ctx (both the brief path and — for the fallback `buildImagePrompt` path — leave as is; brandVisual only applies to the brief path, which is fine). Import `buildBrandVisualContext`.
  `src/lib/image/runtime.ts`: add to `sharedImageDeps()`:
```ts
    loadBrandVisual: async () => {
      const p = await prisma.brandVisualProfile.findUnique({ where: { id: "default" } });
      if (!p) return null;
      return { palette: p.palette, stileFotografico: p.stileFotografico, mood: p.mood, elementiRicorrenti: p.elementiRicorrenti, daEvitare: p.daEvitare };
    },
```
(Update the `Pick<ImageDeps, ...>` return type of `sharedImageDeps` to include `loadBrandVisual`.)

- [ ] **Step 5: Verify + commit**
Run: `npx vitest run && npx tsc --noEmit && npm run build`
```bash
git add src/lib/knowledge/brand-context.ts src/lib/knowledge/brand-context.test.ts src/lib/image/brief.ts src/lib/image/brief.test.ts src/lib/image/generate.ts src/lib/image/runtime.ts
git commit -m "feat: inject Brand Visual Profile into image/video generation prompts"
```

---

## Task 8: Auto-fill the Visual Profile from KB (Claude)

**Files:** Create `src/lib/knowledge/visual-profile.ts`, `src/app/api/knowledge/visual-profile/generate/route.ts`; Test `src/lib/knowledge/visual-profile.test.ts`

- [ ] **Step 1: Failing test** `src/lib/knowledge/visual-profile.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseVisualProfile } from "@/lib/knowledge/visual-profile";

describe("parseVisualProfile", () => {
  it("parses fenced JSON into a profile", () => {
    const raw = "```json\n{\"palette\":[\"verde salvia\"],\"stileFotografico\":\"UGC\",\"mood\":\"sano\",\"elementiRicorrenti\":\"natura\",\"daEvitare\":\"plastica\"}\n```";
    expect(parseVisualProfile(raw)).toEqual({ palette: ["verde salvia"], stileFotografico: "UGC", mood: "sano", elementiRicorrenti: "natura", daEvitare: "plastica" });
  });
  it("throws on invalid", () => { expect(() => parseVisualProfile("nope")).toThrow(); });
});
```

- [ ] **Step 2: Implement** `src/lib/knowledge/visual-profile.ts`:
```ts
import { z } from "zod";
import { stripFences } from "@/lib/meta/runtime";

const profileSchema = z.object({
  palette: z.array(z.string()).default([]),
  stileFotografico: z.string().default(""),
  mood: z.string().default(""),
  elementiRicorrenti: z.string().default(""),
  daEvitare: z.string().default(""),
});

export type ParsedVisualProfile = z.infer<typeof profileSchema>;

export function parseVisualProfile(raw: string): ParsedVisualProfile {
  return profileSchema.parse(JSON.parse(stripFences(raw)));
}

export function buildVisualProfilePrompt(materiale: string): string {
  return [
    "Sei un direttore artistico. Dal materiale del brand Agocap (integratori/benessere naturale) qui sotto,",
    "estrai un'IDENTITÀ VISIVA per generare immagini coerenti.",
    "Rispondi SOLO con JSON valido: {\"palette\":[\"...\"],\"stileFotografico\":\"...\",\"mood\":\"...\",\"elementiRicorrenti\":\"...\",\"daEvitare\":\"...\"}.",
    "palette = 3-5 colori descrittivi; stileFotografico = stile/luce/camera; mood = atmosfera; elementiRicorrenti = soggetti/oggetti ricorrenti; daEvitare = cosa NON mostrare.",
    "",
    "## Materiale",
    materiale.slice(0, 12000),
  ].join("\n");
}
```
> `stripFences` is already exported from `src/lib/meta/runtime.ts` (used across the project).

- [ ] **Step 3: Generate route** `src/app/api/knowledge/visual-profile/generate/route.ts`:
```ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { loadKnowledgeKbItems } from "@/lib/knowledge/items";
import { buildVisualProfilePrompt, parseVisualProfile } from "@/lib/knowledge/visual-profile";

export async function POST() {
  try {
    const items = await loadKnowledgeKbItems();
    const materiale = items.map((i) => `[${i.tipo}] ${i.titolo}: ${i.contenuto}`).join("\n");
    if (!materiale.trim()) return NextResponse.json({ error: "Nessun materiale in Knowledge Base" }, { status: 400 });

    const client = new Anthropic();
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      messages: [{ role: "user", content: buildVisualProfilePrompt(materiale) }],
    });
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("Output AI non conforme");
    const parsed = parseVisualProfile(text.text);
    const data = { palette: parsed.palette, stileFotografico: parsed.stileFotografico || null, mood: parsed.mood || null, elementiRicorrenti: parsed.elementiRicorrenti || null, daEvitare: parsed.daEvitare || null };
    const profile = await prisma.brandVisualProfile.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore generazione profilo" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Verify + commit**
Run: `npx vitest run src/lib/knowledge/visual-profile.test.ts && npx vitest run && npx tsc --noEmit && npm run build`
```bash
git add src/lib/knowledge/visual-profile.ts src/lib/knowledge/visual-profile.test.ts "src/app/api/knowledge/visual-profile/generate/route.ts"
git commit -m "feat: auto-generate Brand Visual Profile from KB via Claude"
```

---

## Task 9: UI — Identità Visiva section

**Files:** Create `src/components/brand-visual-editor.tsx`; Modify `src/app/knowledge/page.tsx`

- [ ] **Step 1: Editor** `src/components/brand-visual-editor.tsx`:
```tsx
"use client";
import { useEffect, useState, useCallback } from "react";

interface Profile { palette: string[]; stileFotografico?: string | null; mood?: string | null; elementiRicorrenti?: string | null; daEvitare?: string | null }

export function BrandVisualEditor() {
  const [p, setP] = useState<Profile>({ palette: [] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await fetch("/api/knowledge/visual-profile"); setP(await r.json().catch(() => ({ palette: [] }))); }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/knowledge/visual-profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
    setMsg(r.ok ? "Salvato." : "Errore salvataggio."); setBusy(false);
  };
  const autofill = async () => {
    setBusy(true); setMsg("Genero dall'AI…");
    const r = await fetch("/api/knowledge/visual-profile/generate", { method: "POST" });
    const j = await r.json();
    if (r.ok) { setP(j); setMsg("Identità visiva generata (modificabile)."); } else setMsg(`Errore: ${j.error ?? "sconosciuto"}`);
    setBusy(false);
  };
  const field = (k: keyof Profile, label: string) => (
    <label className="flex flex-col text-sm">{label}
      <textarea className="rounded border p-2" rows={2} value={(p[k] as string) ?? ""} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="rounded border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Identità Visiva del brand</h2>
        <button onClick={autofill} disabled={busy} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Genera dai materiali</button>
      </div>
      <p className="mb-3 text-xs text-neutral-500">Guida automaticamente la generazione di immagini e video per la coerenza di brand.</p>
      <label className="mb-2 flex flex-col text-sm">Palette colori (separati da virgola)
        <input className="rounded border p-2" value={p.palette.join(", ")} onChange={(e) => setP({ ...p, palette: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {field("stileFotografico", "Stile fotografico")}
        {field("mood", "Mood")}
        {field("elementiRicorrenti", "Elementi ricorrenti")}
        {field("daEvitare", "Da evitare")}
      </div>
      <button onClick={save} disabled={busy} className="mt-3 rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-40">Salva</button>
      {msg && <span className="ml-2 text-xs text-neutral-600">{msg}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Integrate** into `src/app/knowledge/page.tsx`: import `{ BrandVisualEditor }` and render it as a section (e.g., at the top or after files) with spacing. Final page layout: heading + `Identità Visiva` + `Materiale testuale` (existing form/list) + `File`.

- [ ] **Step 3: Verify + commit**
Run: `npx tsc --noEmit && npm run build`
```bash
git add src/components/brand-visual-editor.tsx src/app/knowledge/page.tsx
git commit -m "feat: Brand Visual Profile editor UI (+ generate from materials)"
```

---

## Task 10: Gate + smoke

- [ ] **Step 1: Gate** — `npx vitest run && npx tsc --noEmit && npm run build` (green).
- [ ] **Step 2: Smoke (all keys):** start dev server.
  - **Files:** upload a `.txt` (and a `.pdf` if available) via `POST /api/knowledge/files` → `stato:PRONTO` with `testo` populated; upload an image → `kind:IMMAGINE`, served at `/api/knowledge/files/<id>/raw`. A malformed/unsupported type → 400.
  - **Text feed:** `loadKnowledgeKbItems()` includes the file text (verify a generated content's prompt or just that `/api/knowledge/files` shows PRONTO + testo).
  - **Visual profile:** `POST /api/knowledge/visual-profile/generate` → returns a populated profile (palette/stile/mood…); `GET` reflects it; `PUT` saves edits.
  - **Coherence:** generate a Meta image (GPT) → the asset's saved `prompt` contains the brand coherence text (palette/stile). Higgsfield → positives appended, no "evita".
  - Open `/knowledge`: 3 sections render (Identità Visiva + Materiale testuale + File); upload + autofill + save work.
  Report: file extraction result, profile generated, and that a generated image prompt includes brand coherence. Any error verbatim.
- [ ] **Step 3: Stop the server.**

---

## Self-Review (addressed)
- **Spec coverage:** §2 models (T1 KnowledgeFile + types, T6 BrandVisualProfile); §3 extraction (T2) + upload/serve/delete (T3); §4 auto-fill (T8); §5.1 image/video injection (T7), §5.2 text feed (T4); §6 UI (T5 files, T9 visual editor); §9 testing across; §11 backlog mapped 1:1.
- **Type consistency:** `pickFileKind`/`extractText` (T2) used by upload (T3); `toKbItems`/`loadKnowledgeKbItems` (T4) used by runtimes (T4) + autofill (T8); `BrandVisualData`/`buildBrandVisualContext` (T7) used by generate (T7) + runtime loadBrandVisual (T7); `PromptCtx.brandVisual` (T7) consumed by buildImagePromptFromBrief; `parseVisualProfile`/`buildVisualProfilePrompt` (T8) used by generate route; profile fields (palette/stileFotografico/mood/elementiRicorrenti/daEvitare/referenceImagePaths) consistent across model/route/editor/context.
- **No placeholders:** all code complete; migrations hand-authored (migrate dev interactive); enum `ADD VALUE` split-note included; file extraction best-effort (ERRORE non-blocking); brand injection degrades when no profile.
- **Honest constraint (spec §10):** reference images are stored/served + shown, not fed as model inputs (provider input slot = product); coherence is driven by the textual profile.
