# AGOCAP Content AI Hub — Brain MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Brain" sub-project of AGOCAP Content AI Hub — an internal tool that generates and classifies content ideas with Claude, anchored to a company knowledge base, lets a user review/approve them in a dashboard, and accepts manual ideas — with no auth, running self-hosted in Docker on AWS Lightsail.

**Architecture:** Next.js (App Router, TypeScript) full-stack app. PostgreSQL via Prisma. Idea generation runs a small pipeline (build KB context → one structured-output Claude call producing classified ideas → dedupe in code → persist a `GenerationRun` + `Idea` rows). An extensible `SignalSource` abstraction normalizes AI, manual, and (future) API inputs into `Idea` rows. UI uses Tailwind + shadcn/ui. Tests use Vitest with a mocked Claude client (no live API calls in tests).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma + PostgreSQL, `@anthropic-ai/sdk` (model `claude-opus-4-8`, structured outputs via `messages.parse` + Zod), Tailwind CSS + shadcn/ui, Vitest, Docker Compose.

**Language:** UI text and AI output are in Italian. Code identifiers and comments are in English.

---

## File Structure

```
agocap-content-ai-hub/
  package.json                      # deps + scripts
  tsconfig.json
  next.config.mjs
  tailwind.config.ts
  postcss.config.mjs
  vitest.config.ts
  .env.example
  Dockerfile
  docker-compose.yml
  prisma/
    schema.prisma                   # 6 models + enums
    seed.ts                         # seeds 2 SignalSource rows
  src/
    lib/
      prisma.ts                     # Prisma client singleton
      claude.ts                     # Anthropic client singleton + getClaude()
      brain/
        enums.ts                    # shared enum constants + Zod enums
        schema.ts                   # Zod schema for AI batch output
        context.ts                  # buildKbContext()
        dedupe.ts                   # dedupeIdeas()
        generate.ts                 # runBrainstorm() pipeline
      sources/
        types.ts                    # SignalSource interface, IdeaDraft type
        ai-source.ts                # AiBrainstormSource
        manual-source.ts            # ManualSource
    app/
      layout.tsx                    # root layout + nav
      globals.css
      page.tsx                      # redirect -> /dashboard
      dashboard/page.tsx            # Idea dashboard (table + filters)
      generate/page.tsx             # Generate Ideas form
      manual/page.tsx               # Manual idea form
      knowledge/page.tsx            # Knowledge base CRUD
      report/page.tsx               # counters + alerts
      ideas/[id]/page.tsx           # idea detail / edit
      api/
        ideas/route.ts              # GET list, POST create (manual)
        ideas/[id]/route.ts         # GET, PATCH, DELETE
        ideas/bulk-status/route.ts  # PATCH bulk status change
        generate/route.ts           # POST run pipeline
        generation-runs/[id]/route.ts  # GET run detail
        knowledge/route.ts          # GET, POST
        knowledge/[id]/route.ts     # PATCH, DELETE
        products/route.ts           # GET, POST
        report/summary/route.ts     # GET counters + alerts
    components/
      nav.tsx                       # top navigation
      idea-table.tsx                # dashboard table client component
      idea-filters.tsx             # filter controls
    test/
      helpers.ts                    # test DB reset helper
```

---

## Task 1: Project scaffold (Next.js + TypeScript + Tailwind + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.env.example`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "agocap-content-ai-hub",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "tsx prisma/seed.ts",
    "db:reset": "prisma migrate reset --force"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.70.0",
    "@prisma/client": "^6.1.0",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "prisma": "^6.1.0",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no error exit code.

- [ ] **Step 3: Create config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = { output: "standalone" };
export default nextConfig;
```

`postcss.config.mjs`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

`.env.example`:
```
DATABASE_URL="postgresql://agocap:agocap@localhost:5432/agocap?schema=public"
ANTHROPIC_API_KEY="sk-ant-..."
```

- [ ] **Step 4: Create root app files**

`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body { @apply bg-neutral-50 text-neutral-900; }
```

`src/app/layout.tsx`:
```tsx
import "./globals.css";
import type { ReactNode } from "react";
import { Nav } from "@/components/nav";

export const metadata = { title: "AGOCAP Content AI Hub — Brain" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>
        <Nav />
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 5: Create a placeholder Nav so layout compiles**

`src/components/nav.tsx`:
```tsx
import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard Idee" },
  { href: "/generate", label: "Genera Idee" },
  { href: "/manual", label: "Inserimento Manuale" },
  { href: "/knowledge", label: "Knowledge Base" },
  { href: "/report", label: "Report" },
];

export function Nav() {
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl gap-4 p-4 text-sm">
        <span className="font-semibold">AGOCAP Brain</span>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-neutral-600 hover:text-neutral-900">
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 6: Verify the build type-checks**

Run: `npx tsc --noEmit`
Expected: exits 0 (no type errors). Pages referenced in Nav don't exist yet but Nav only uses `Link`, so this passes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js + Tailwind + Vitest project"
```

---

## Task 2: Prisma schema, migration, and seed

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/prisma.ts`

- [ ] **Step 1: Create the Prisma schema**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum IdeaStatus {
  NUOVA
  INTERESSANTE
  APPROVATA
  SCARTATA
  DA_APPROFONDIRE
}

enum IdeaCategory {
  INTEGRATORI
  BEAUTY
  BENESSERE
  STAGIONALITA
  EDUCATIONAL
  VENDITA
  FAQ
  TREND
}

enum Platform {
  INSTAGRAM
  FACEBOOK
  TIKTOK
  BLOG
}

enum SourceType {
  AI
  MANUALE
  API
}

enum KnowledgeType {
  INFO_PRODOTTO
  BRAND_VOICE
  TARGET
  CLAIM
  LINEA_GUIDA
  DOCUMENTO
}

enum RunStatus {
  RUNNING
  DONE
  ERROR
}

model Product {
  id          String          @id @default(cuid())
  nome        String
  categoria   String?
  descrizione String?
  benefici    String?
  ingredienti String?
  target      String?
  url         String?
  attivo      Boolean         @default(true)
  createdAt   DateTime        @default(now())
  ideas       Idea[]
  knowledge   KnowledgeItem[]
}

model KnowledgeItem {
  id        String        @id @default(cuid())
  tipo      KnowledgeType
  titolo    String
  contenuto String
  tags      String[]      @default([])
  productId String?
  product   Product?      @relation(fields: [productId], references: [id], onDelete: SetNull)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
}

model SignalSource {
  id         String          @id @default(cuid())
  key        String          @unique
  nome       String
  tipo       SourceType
  config     Json            @default("{}")
  abilitata  Boolean         @default(true)
  createdAt  DateTime        @default(now())
  ideas      Idea[]
  runs       GenerationRun[]
}

model GenerationRun {
  id            String       @id @default(cuid())
  sourceId      String
  source        SignalSource @relation(fields: [sourceId], references: [id])
  input         Json         @default("{}")
  promptUsato   String       @default("")
  outputGrezzo  Json         @default("{}")
  modello       String       @default("")
  inputTokens   Int          @default(0)
  outputTokens  Int          @default(0)
  status        RunStatus    @default(RUNNING)
  errore        String?
  createdAt     DateTime     @default(now())
  ideas         Idea[]
}

model Idea {
  id                     String         @id @default(cuid())
  titolo                 String
  descrizione            String         @default("")
  category               IdeaCategory
  piattaformeConsigliate Platform[]     @default([])
  seoScore               Int            @default(3)
  viralityScore          Int            @default(3)
  priority               Int            @default(3)
  status                 IdeaStatus     @default(NUOVA)
  note                   String?
  tags                   String[]       @default([])
  productId              String?
  product                Product?       @relation(fields: [productId], references: [id], onDelete: SetNull)
  sourceId               String
  source                 SignalSource   @relation(fields: [sourceId], references: [id])
  generationRunId        String?
  generationRun          GenerationRun? @relation(fields: [generationRunId], references: [id], onDelete: SetNull)
  createdAt              DateTime       @default(now())
  updatedAt              DateTime       @updatedAt

  @@index([status])
  @@index([category])
}
```

- [ ] **Step 2: Create the Prisma client singleton**

`src/lib/prisma.ts`:
```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 3: Create the seed script**

`prisma/seed.ts`:
```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.signalSource.upsert({
    where: { key: "ai-brainstorming" },
    update: {},
    create: { key: "ai-brainstorming", nome: "AI Brainstorming", tipo: "AI" },
  });
  await prisma.signalSource.upsert({
    where: { key: "manuale" },
    update: {},
    create: { key: "manuale", nome: "Inserimento Manuale", tipo: "MANUALE" },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 4: Start a Postgres instance for development**

Run:
```bash
docker run -d --name agocap-pg -e POSTGRES_USER=agocap -e POSTGRES_PASSWORD=agocap -e POSTGRES_DB=agocap -p 5432:5432 postgres:16
```
Expected: prints a container ID. (Skip if Postgres already running on 5432.)

- [ ] **Step 5: Copy env and run the migration**

Run:
```bash
cp .env.example .env
npx prisma migrate dev --name init
```
Expected: creates `prisma/migrations/<timestamp>_init/`, prints "Your database is now in sync with your schema." and generates the client.

- [ ] **Step 6: Run the seed and verify the two sources exist**

Run:
```bash
npm run prisma:seed
npx prisma studio --browser none &  # optional manual check; or:
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.signalSource.count().then(c=>{console.log('sources',c);return p.\$disconnect()})"
```
Expected: prints `sources 2`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Prisma schema, migration, and signal-source seed"
```

---

## Task 3: Shared enums and Zod schema for AI output

**Files:**
- Create: `src/lib/brain/enums.ts`, `src/lib/brain/schema.ts`
- Test: `src/lib/brain/schema.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/brain/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { brainstormOutputSchema } from "@/lib/brain/schema";

describe("brainstormOutputSchema", () => {
  it("accepts a valid batch of classified ideas", () => {
    const parsed = brainstormOutputSchema.parse({
      ideas: [
        {
          titolo: "Magnesio per il sonno",
          descrizione: "Come il magnesio aiuta il riposo notturno.",
          category: "EDUCATIONAL",
          piattaformeConsigliate: ["INSTAGRAM", "BLOG"],
          seoScore: 4,
          viralityScore: 3,
          priority: 5,
          prodottoCollegato: "Magnesio Supremo",
          motivazione: "Domanda frequente del target.",
        },
      ],
    });
    expect(parsed.ideas).toHaveLength(1);
    expect(parsed.ideas[0].category).toBe("EDUCATIONAL");
  });

  it("rejects an invalid category", () => {
    expect(() =>
      brainstormOutputSchema.parse({
        ideas: [
          {
            titolo: "x",
            descrizione: "y",
            category: "NON_ESISTE",
            piattaformeConsigliate: ["INSTAGRAM"],
            seoScore: 3,
            viralityScore: 3,
            priority: 3,
            prodottoCollegato: null,
            motivazione: "z",
          },
        ],
      }),
    ).toThrow();
  });

  it("clamps scores outside 1-5 via validation", () => {
    expect(() =>
      brainstormOutputSchema.parse({
        ideas: [
          {
            titolo: "x",
            descrizione: "y",
            category: "TREND",
            piattaformeConsigliate: ["TIKTOK"],
            seoScore: 9,
            viralityScore: 3,
            priority: 3,
            prodottoCollegato: null,
            motivazione: "z",
          },
        ],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/brain/schema.test.ts`
Expected: FAIL — cannot resolve `@/lib/brain/schema`.

- [ ] **Step 3: Create the enums module**

`src/lib/brain/enums.ts`:
```ts
export const IDEA_CATEGORIES = [
  "INTEGRATORI",
  "BEAUTY",
  "BENESSERE",
  "STAGIONALITA",
  "EDUCATIONAL",
  "VENDITA",
  "FAQ",
  "TREND",
] as const;

export const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "BLOG"] as const;

export const IDEA_STATUSES = [
  "NUOVA",
  "INTERESSANTE",
  "APPROVATA",
  "SCARTATA",
  "DA_APPROFONDIRE",
] as const;

export type IdeaCategoryValue = (typeof IDEA_CATEGORIES)[number];
export type PlatformValue = (typeof PLATFORMS)[number];
export type IdeaStatusValue = (typeof IDEA_STATUSES)[number];
```

- [ ] **Step 4: Create the Zod schema**

`src/lib/brain/schema.ts`:
```ts
import { z } from "zod";
import { IDEA_CATEGORIES, PLATFORMS } from "./enums";

export const ideaDraftSchema = z.object({
  titolo: z.string().min(1),
  descrizione: z.string(),
  category: z.enum(IDEA_CATEGORIES),
  piattaformeConsigliate: z.array(z.enum(PLATFORMS)).min(1),
  seoScore: z.number().int().min(1).max(5),
  viralityScore: z.number().int().min(1).max(5),
  priority: z.number().int().min(1).max(5),
  prodottoCollegato: z.string().nullable(),
  motivazione: z.string(),
});

export const brainstormOutputSchema = z.object({
  ideas: z.array(ideaDraftSchema),
});

export type IdeaDraftOutput = z.infer<typeof ideaDraftSchema>;
export type BrainstormOutput = z.infer<typeof brainstormOutputSchema>;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/brain/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: shared brain enums and Zod output schema"
```

---

## Task 4: Dedupe helper

**Files:**
- Create: `src/lib/brain/dedupe.ts`
- Test: `src/lib/brain/dedupe.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/brain/dedupe.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeTitle, dedupeIdeas } from "@/lib/brain/dedupe";

describe("normalizeTitle", () => {
  it("lowercases, trims, and collapses whitespace and punctuation", () => {
    expect(normalizeTitle("  Magnesio   per il Sonno! ")).toBe("magnesio per il sonno");
  });
});

describe("dedupeIdeas", () => {
  const draft = (titolo: string) => ({ titolo });

  it("removes candidates whose title matches an existing title", () => {
    const result = dedupeIdeas(
      [draft("Magnesio per il sonno"), draft("Vitamina C d'inverno")],
      ["magnesio per il sonno"],
    );
    expect(result.map((d) => d.titolo)).toEqual(["Vitamina C d'inverno"]);
  });

  it("removes duplicates within the candidate batch itself", () => {
    const result = dedupeIdeas(
      [draft("Magnesio per il sonno"), draft("magnesio  PER il   sonno!")],
      [],
    );
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/brain/dedupe.test.ts`
Expected: FAIL — cannot resolve `@/lib/brain/dedupe`.

- [ ] **Step 3: Create the dedupe module**

`src/lib/brain/dedupe.ts`:
```ts
export function normalizeTitle(titolo: string): string {
  return titolo
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupeIdeas<T extends { titolo: string }>(
  candidates: T[],
  existingTitles: string[],
): T[] {
  const seen = new Set(existingTitles.map(normalizeTitle));
  const result: T[] = [];
  for (const c of candidates) {
    const key = normalizeTitle(c.titolo);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/brain/dedupe.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: idea title dedupe helper"
```

---

## Task 5: KB context builder

**Files:**
- Create: `src/lib/brain/context.ts`
- Test: `src/lib/brain/context.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/brain/context.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildKbContext } from "@/lib/brain/context";

describe("buildKbContext", () => {
  it("renders products and knowledge items into a compact context block", () => {
    const ctx = buildKbContext({
      products: [
        { nome: "Magnesio Supremo", categoria: "INTEGRATORI", descrizione: "Polvere di magnesio", benefici: "Sonno, stress", ingredienti: null, target: "Adulti stressati", url: null },
      ],
      knowledge: [
        { tipo: "BRAND_VOICE", titolo: "Tono", contenuto: "Caldo, professionale, empatico." },
      ],
    });
    expect(ctx).toContain("Magnesio Supremo");
    expect(ctx).toContain("Sonno, stress");
    expect(ctx).toContain("Caldo, professionale, empatico.");
  });

  it("returns an explicit empty marker when there is no KB material", () => {
    const ctx = buildKbContext({ products: [], knowledge: [] });
    expect(ctx).toContain("Nessun materiale");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/brain/context.test.ts`
Expected: FAIL — cannot resolve `@/lib/brain/context`.

- [ ] **Step 3: Create the context builder**

`src/lib/brain/context.ts`:
```ts
export interface KbProduct {
  nome: string;
  categoria: string | null;
  descrizione: string | null;
  benefici: string | null;
  ingredienti: string | null;
  target: string | null;
  url: string | null;
}

export interface KbItem {
  tipo: string;
  titolo: string;
  contenuto: string;
}

export interface KbInput {
  products: KbProduct[];
  knowledge: KbItem[];
}

export function buildKbContext({ products, knowledge }: KbInput): string {
  if (products.length === 0 && knowledge.length === 0) {
    return "Nessun materiale di knowledge base disponibile.";
  }

  const lines: string[] = [];

  if (products.length > 0) {
    lines.push("## Prodotti Agocap");
    for (const p of products) {
      lines.push(`- ${p.nome}${p.categoria ? ` (${p.categoria})` : ""}`);
      if (p.descrizione) lines.push(`  Descrizione: ${p.descrizione}`);
      if (p.benefici) lines.push(`  Benefici: ${p.benefici}`);
      if (p.ingredienti) lines.push(`  Ingredienti: ${p.ingredienti}`);
      if (p.target) lines.push(`  Target: ${p.target}`);
    }
  }

  if (knowledge.length > 0) {
    lines.push("## Knowledge base");
    for (const k of knowledge) {
      lines.push(`- [${k.tipo}] ${k.titolo}: ${k.contenuto}`);
    }
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/brain/context.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: KB context builder for the brainstorm prompt"
```

---

## Task 6: Claude client + brainstorm prompt builder

**Files:**
- Create: `src/lib/claude.ts`, `src/lib/brain/prompt.ts`
- Test: `src/lib/brain/prompt.test.ts`

This task isolates the Claude client behind a `getClaude()` factory so tests can mock it, and puts the (versioned) prompt text in one place. Model is `claude-opus-4-8`.

- [ ] **Step 1: Write the failing test for the prompt builder**

`src/lib/brain/prompt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildBrainstormPrompt } from "@/lib/brain/prompt";

describe("buildBrainstormPrompt", () => {
  it("embeds the KB context, the input parameters, and the editorial angles", () => {
    const prompt = buildBrainstormPrompt({
      kbContext: "## Prodotti Agocap\n- Magnesio Supremo",
      input: { prodotto: "Magnesio Supremo", categoria: "EDUCATIONAL", angolo: "soft selling", keywordSeed: "sonno", count: 5 },
    });
    expect(prompt).toContain("Magnesio Supremo");
    expect(prompt).toContain("soft selling");
    expect(prompt).toContain("sonno");
    expect(prompt).toContain("5");
    // editorial angles must be referenced so the model knows the palette
    expect(prompt.toLowerCase()).toContain("educational");
    expect(prompt.toLowerCase()).toContain("stagionalità");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/brain/prompt.test.ts`
Expected: FAIL — cannot resolve `@/lib/brain/prompt`.

- [ ] **Step 3: Create the prompt builder**

`src/lib/brain/prompt.ts`:
```ts
export interface BrainstormInput {
  prodotto?: string;
  categoria?: string;
  angolo?: string;
  keywordSeed?: string;
  count: number;
}

export function buildBrainstormPrompt(args: {
  kbContext: string;
  input: BrainstormInput;
}): string {
  const { kbContext, input } = args;
  const richieste: string[] = [];
  if (input.prodotto) richieste.push(`Prodotto in focus: ${input.prodotto}`);
  if (input.categoria) richieste.push(`Categoria preferita: ${input.categoria}`);
  if (input.angolo) richieste.push(`Angolo creativo: ${input.angolo}`);
  if (input.keywordSeed) richieste.push(`Keyword seed: ${input.keywordSeed}`);

  return `Sei un esperto di content marketing per Agocap, brand di integratori, benessere, beauty e salute naturale.

Genera esattamente ${input.count} idee di contenuto, ancorate alla knowledge base aziendale qui sotto.

# Knowledge base Agocap
${kbContext}

# Richieste
${richieste.length ? richieste.join("\n") : "Nessuna preferenza specifica: spazia liberamente."}

# Angoli editoriali da considerare
Usa un mix di questi angoli quando pertinenti: educational, soft selling, vendita diretta,
FAQ degli utenti, stagionalità, combinazione prodotto × problema reale del target,
hook virali per reel/TikTok, rubriche editoriali, contenuti di trend.

# Per ogni idea fornisci
- titolo: breve e accattivante (italiano)
- descrizione: 1-2 frasi sul contenuto
- category: una tra INTEGRATORI, BEAUTY, BENESSERE, STAGIONALITA, EDUCATIONAL, VENDITA, FAQ, TREND
- piattaformeConsigliate: una o più tra INSTAGRAM, FACEBOOK, TIKTOK, BLOG
- seoScore, viralityScore, priority: interi da 1 a 5
- prodottoCollegato: il nome del prodotto Agocap collegato, oppure null
- motivazione: perché l'idea è rilevante per il target Agocap`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/brain/prompt.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Create the Claude client factory**

`src/lib/claude.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";

export const BRAINSTORM_MODEL = "claude-opus-4-8";

let client: Anthropic | null = null;

export function getClaude(): Anthropic {
  if (!client) {
    client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  }
  return client;
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Claude client factory and brainstorm prompt builder"
```

---

## Task 7: Source types + the brainstorm pipeline (Claude mocked)

**Files:**
- Create: `src/lib/sources/types.ts`, `src/lib/brain/generate.ts`
- Test: `src/lib/brain/generate.test.ts`

The pipeline (`runBrainstorm`) is the heart of the Brain. It is tested with a **mocked** Claude call and a mocked Prisma layer so no live API or DB is touched. It takes injected dependencies to stay testable.

- [ ] **Step 1: Create the source/draft types**

`src/lib/sources/types.ts`:
```ts
import type { IdeaCategoryValue, PlatformValue } from "@/lib/brain/enums";

export interface IdeaDraft {
  titolo: string;
  descrizione: string;
  category: IdeaCategoryValue;
  piattaformeConsigliate: PlatformValue[];
  seoScore: number;
  viralityScore: number;
  priority: number;
  prodottoCollegato: string | null;
}

export interface SignalSourceAdapter {
  key: string;
  fetchSignals(input: unknown): Promise<IdeaDraft[]>;
}
```

- [ ] **Step 2: Write the failing test for the pipeline**

`src/lib/brain/generate.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { runBrainstorm } from "@/lib/brain/generate";

function makeDeps(overrides = {}) {
  const created = { runId: "run_1", ideaCount: 0 };
  return {
    loadKb: vi.fn().mockResolvedValue({ products: [], knowledge: [] }),
    loadExistingTitles: vi.fn().mockResolvedValue(["idea esistente"]),
    callClaude: vi.fn().mockResolvedValue({
      parsed: {
        ideas: [
          { titolo: "Idea esistente", descrizione: "d", category: "TREND", piattaformeConsigliate: ["TIKTOK"], seoScore: 3, viralityScore: 3, priority: 3, prodottoCollegato: null, motivazione: "m" },
          { titolo: "Idea nuova", descrizione: "d", category: "EDUCATIONAL", piattaformeConsigliate: ["BLOG"], seoScore: 4, viralityScore: 2, priority: 5, prodottoCollegato: "Magnesio", motivazione: "m" },
        ],
      },
      promptUsato: "PROMPT",
      modello: "claude-opus-4-8",
      inputTokens: 100,
      outputTokens: 200,
      rawOutput: { any: "thing" },
    }),
    persist: vi.fn().mockImplementation(async ({ ideas }) => {
      created.ideaCount = ideas.length;
      return { runId: created.runId, ideas };
    }),
    sourceKey: "ai-brainstorming",
    ...overrides,
  };
}

describe("runBrainstorm", () => {
  it("dedupes against existing titles before persisting", async () => {
    const deps = makeDeps();
    const result = await runBrainstorm({ count: 2 }, deps as any);
    expect(deps.persist).toHaveBeenCalledOnce();
    const persisted = (deps.persist as any).mock.calls[0][0].ideas;
    expect(persisted.map((i: any) => i.titolo)).toEqual(["Idea nuova"]);
    expect(result.created).toBe(1);
    expect(result.status).toBe("DONE");
  });

  it("records an ERROR run when the Claude call throws and persists no ideas", async () => {
    const deps = makeDeps({
      callClaude: vi.fn().mockRejectedValue(new Error("API down")),
    });
    const result = await runBrainstorm({ count: 2 }, deps as any);
    expect(result.status).toBe("ERROR");
    expect(result.error).toContain("API down");
    // persist is called once to record the error run, with zero ideas
    const persisted = (deps.persist as any).mock.calls[0][0];
    expect(persisted.ideas).toHaveLength(0);
    expect(persisted.status).toBe("ERROR");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/brain/generate.test.ts`
Expected: FAIL — cannot resolve `@/lib/brain/generate`.

- [ ] **Step 4: Implement the pipeline with injected dependencies**

`src/lib/brain/generate.ts`:
```ts
import type { BrainstormInput } from "./prompt";
import { dedupeIdeas } from "./dedupe";
import type { IdeaDraft } from "@/lib/sources/types";

export interface ClaudeResult {
  parsed: { ideas: Array<IdeaDraft & { motivazione: string }> };
  promptUsato: string;
  modello: string;
  inputTokens: number;
  outputTokens: number;
  rawOutput: unknown;
}

export interface PersistArgs {
  status: "DONE" | "ERROR";
  input: BrainstormInput;
  promptUsato: string;
  modello: string;
  inputTokens: number;
  outputTokens: number;
  rawOutput: unknown;
  errore?: string;
  ideas: IdeaDraft[];
  sourceKey: string;
}

export interface BrainstormDeps {
  loadKb: () => Promise<{ products: any[]; knowledge: any[] }>;
  loadExistingTitles: () => Promise<string[]>;
  callClaude: (args: { kb: { products: any[]; knowledge: any[] }; input: BrainstormInput }) => Promise<ClaudeResult>;
  persist: (args: PersistArgs) => Promise<{ runId: string; ideas: IdeaDraft[] }>;
  sourceKey: string;
}

export interface BrainstormResult {
  status: "DONE" | "ERROR";
  created: number;
  runId?: string;
  error?: string;
}

export async function runBrainstorm(
  input: BrainstormInput,
  deps: BrainstormDeps,
): Promise<BrainstormResult> {
  const kb = await deps.loadKb();
  let claudeResult: ClaudeResult;
  try {
    claudeResult = await deps.callClaude({ kb, input });
  } catch (err) {
    const errore = err instanceof Error ? err.message : String(err);
    await deps.persist({
      status: "ERROR",
      input,
      promptUsato: "",
      modello: "",
      inputTokens: 0,
      outputTokens: 0,
      rawOutput: {},
      errore,
      ideas: [],
      sourceKey: deps.sourceKey,
    });
    return { status: "ERROR", created: 0, error: errore };
  }

  const existing = await deps.loadExistingTitles();
  const drafts: IdeaDraft[] = claudeResult.parsed.ideas.map((i) => ({
    titolo: i.titolo,
    descrizione: i.descrizione,
    category: i.category,
    piattaformeConsigliate: i.piattaformeConsigliate,
    seoScore: i.seoScore,
    viralityScore: i.viralityScore,
    priority: i.priority,
    prodottoCollegato: i.prodottoCollegato,
  }));
  const fresh = dedupeIdeas(drafts, existing);

  const { runId } = await deps.persist({
    status: "DONE",
    input,
    promptUsato: claudeResult.promptUsato,
    modello: claudeResult.modello,
    inputTokens: claudeResult.inputTokens,
    outputTokens: claudeResult.outputTokens,
    rawOutput: claudeResult.rawOutput,
    ideas: fresh,
    sourceKey: deps.sourceKey,
  });

  return { status: "DONE", created: fresh.length, runId };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/brain/generate.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: brainstorm pipeline with injected deps (dedupe + error run)"
```

---

## Task 8: Wire the real Claude call + Prisma persistence into the pipeline deps

**Files:**
- Create: `src/lib/brain/runtime.ts`
- Test: `src/lib/brain/runtime.test.ts`

`runtime.ts` builds the real `BrainstormDeps` (Claude structured-output call + Prisma reads/writes). The Claude call uses `messages.parse` with `zodOutputFormat`. We test only the pure mapping helper `linkProductId` here; the Claude/Prisma wiring is exercised end-to-end in Task 9's API route smoke test against the dev DB with a mocked Claude.

- [ ] **Step 1: Write the failing test for the product-linking helper**

`src/lib/brain/runtime.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { linkProductId } from "@/lib/brain/runtime";

describe("linkProductId", () => {
  const products = [
    { id: "p1", nome: "Magnesio Supremo" },
    { id: "p2", nome: "Vitamina C" },
  ];

  it("matches a product by case-insensitive name", () => {
    expect(linkProductId("magnesio supremo", products)).toBe("p1");
  });

  it("returns null when no product matches or name is null", () => {
    expect(linkProductId(null, products)).toBeNull();
    expect(linkProductId("Sconosciuto", products)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/brain/runtime.test.ts`
Expected: FAIL — cannot resolve `@/lib/brain/runtime`.

- [ ] **Step 3: Implement runtime deps + the helper**

`src/lib/brain/runtime.ts`:
```ts
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { getClaude, BRAINSTORM_MODEL } from "@/lib/claude";
import { buildKbContext } from "./context";
import { buildBrainstormPrompt, type BrainstormInput } from "./prompt";
import { brainstormOutputSchema } from "./schema";
import type { BrainstormDeps, ClaudeResult, PersistArgs } from "./generate";

export function linkProductId(
  nome: string | null,
  products: Array<{ id: string; nome: string }>,
): string | null {
  if (!nome) return null;
  const target = nome.trim().toLowerCase();
  const match = products.find((p) => p.nome.trim().toLowerCase() === target);
  return match ? match.id : null;
}

export function buildRuntimeDeps(): BrainstormDeps {
  return {
    sourceKey: "ai-brainstorming",

    loadKb: async () => {
      const [products, knowledge] = await Promise.all([
        prisma.product.findMany({ where: { attivo: true } }),
        prisma.knowledgeItem.findMany(),
      ]);
      return { products, knowledge };
    },

    loadExistingTitles: async () => {
      const ideas = await prisma.idea.findMany({ select: { titolo: true } });
      return ideas.map((i) => i.titolo);
    },

    callClaude: async ({ kb, input }): Promise<ClaudeResult> => {
      const kbContext = buildKbContext({
        products: kb.products,
        knowledge: kb.knowledge,
      });
      const prompt = buildBrainstormPrompt({ kbContext, input });
      const claude = getClaude();
      const response = await claude.messages.parse({
        model: BRAINSTORM_MODEL,
        max_tokens: 16000,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: zodOutputFormat(brainstormOutputSchema) },
      });
      const parsed = response.parsed_output;
      if (!parsed) throw new Error("Output AI non conforme allo schema");
      return {
        parsed,
        promptUsato: prompt,
        modello: BRAINSTORM_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        rawOutput: response.content,
      };
    },

    persist: async (args: PersistArgs) => {
      const source = await prisma.signalSource.findUniqueOrThrow({
        where: { key: args.sourceKey },
      });
      const products = await prisma.product.findMany({ select: { id: true, nome: true } });

      const run = await prisma.generationRun.create({
        data: {
          sourceId: source.id,
          input: args.input as object,
          promptUsato: args.promptUsato,
          modello: args.modello,
          inputTokens: args.inputTokens,
          outputTokens: args.outputTokens,
          outputGrezzo: args.rawOutput as object,
          status: args.status,
          errore: args.errore,
        },
      });

      if (args.ideas.length > 0) {
        await prisma.idea.createMany({
          data: args.ideas.map((d) => ({
            titolo: d.titolo,
            descrizione: d.descrizione,
            category: d.category,
            piattaformeConsigliate: d.piattaformeConsigliate,
            seoScore: d.seoScore,
            viralityScore: d.viralityScore,
            priority: d.priority,
            productId: linkProductId(d.prodottoCollegato, products),
            sourceId: source.id,
            generationRunId: run.id,
          })),
        });
      }

      return { runId: run.id, ideas: args.ideas };
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/brain/runtime.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: runtime deps wiring Claude structured output + Prisma persistence"
```

---

## Task 9: API route — POST /api/generate

**Files:**
- Create: `src/app/api/generate/route.ts`
- Test: `src/app/api/generate/route.test.ts`

The route validates input, then calls `runBrainstorm` with deps. Tests inject mock deps via a module-level seam (`__setDepsFactory`) so no Claude/DB is hit.

- [ ] **Step 1: Write the failing test**

`src/app/api/generate/route.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { POST, __setDepsFactory } from "@/app/api/generate/route";

function req(body: unknown) {
  return new Request("http://test/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate", () => {
  it("returns 200 with the run summary on success", async () => {
    __setDepsFactory(() => ({}) as any);
    const spy = vi.fn().mockResolvedValue({ status: "DONE", created: 3, runId: "run_1" });
    // override the pipeline runner via the same seam
    __setDepsFactory(() => ({ __run: spy }) as any);
    const res = await POST(req({ count: 3 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.created).toBe(3);
  });

  it("returns 400 when count is missing or invalid", async () => {
    const res = await POST(req({ count: 0 }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/generate/route.test.ts`
Expected: FAIL — cannot resolve `@/app/api/generate/route`.

- [ ] **Step 3: Implement the route with a test seam**

`src/app/api/generate/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { runBrainstorm } from "@/lib/brain/generate";
import { buildRuntimeDeps } from "@/lib/brain/runtime";

const inputSchema = z.object({
  prodotto: z.string().optional(),
  categoria: z.string().optional(),
  angolo: z.string().optional(),
  keywordSeed: z.string().optional(),
  count: z.number().int().min(1).max(20),
});

// Test seam: allows tests to inject a fake runner via deps.__run.
type DepsFactory = () => { __run?: typeof runBrainstorm } & Record<string, unknown>;
let depsFactory: DepsFactory = () => ({});
export function __setDepsFactory(f: DepsFactory) {
  depsFactory = f;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido", details: parsed.error.flatten() }, { status: 400 });
  }

  const injected = depsFactory();
  const run = injected.__run ?? runBrainstorm;
  const deps = injected.__run ? ({} as never) : buildRuntimeDeps();

  const result = await run(parsed.data, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/api/generate/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: POST /api/generate route with validation and test seam"
```

---

## Task 10: API routes — ideas CRUD, bulk status, generation run, knowledge, products, report

**Files:**
- Create: `src/app/api/ideas/route.ts`, `src/app/api/ideas/[id]/route.ts`, `src/app/api/ideas/bulk-status/route.ts`, `src/app/api/generation-runs/[id]/route.ts`, `src/app/api/knowledge/route.ts`, `src/app/api/knowledge/[id]/route.ts`, `src/app/api/products/route.ts`, `src/app/api/report/summary/route.ts`
- Test: `src/app/api/ideas/validation.test.ts`

These routes are thin Prisma wrappers. We unit-test the shared validation schemas (pure, no DB) and rely on the manual smoke test in Task 13 for end-to-end DB behavior.

- [ ] **Step 1: Write the failing test for the idea input validators**

`src/app/api/ideas/validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { manualIdeaSchema, bulkStatusSchema } from "@/app/api/ideas/validators";

describe("manualIdeaSchema", () => {
  it("accepts a minimal valid manual idea", () => {
    const v = manualIdeaSchema.parse({ titolo: "Idea", category: "TREND", piattaformeConsigliate: ["TIKTOK"] });
    expect(v.seoScore).toBe(3); // default
    expect(v.status).toBe("NUOVA"); // default
  });
  it("rejects an unknown category", () => {
    expect(() => manualIdeaSchema.parse({ titolo: "x", category: "ZZZ", piattaformeConsigliate: [] })).toThrow();
  });
});

describe("bulkStatusSchema", () => {
  it("requires at least one id and a valid status", () => {
    expect(() => bulkStatusSchema.parse({ ids: [], status: "APPROVATA" })).toThrow();
    const v = bulkStatusSchema.parse({ ids: ["a"], status: "APPROVATA" });
    expect(v.status).toBe("APPROVATA");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/ideas/validation.test.ts`
Expected: FAIL — cannot resolve `@/app/api/ideas/validators`.

- [ ] **Step 3: Create the shared validators**

`src/app/api/ideas/validators.ts`:
```ts
import { z } from "zod";
import { IDEA_CATEGORIES, PLATFORMS, IDEA_STATUSES } from "@/lib/brain/enums";

export const manualIdeaSchema = z.object({
  titolo: z.string().min(1),
  descrizione: z.string().default(""),
  category: z.enum(IDEA_CATEGORIES),
  piattaformeConsigliate: z.array(z.enum(PLATFORMS)).default([]),
  seoScore: z.number().int().min(1).max(5).default(3),
  viralityScore: z.number().int().min(1).max(5).default(3),
  priority: z.number().int().min(1).max(5).default(3),
  status: z.enum(IDEA_STATUSES).default("NUOVA"),
  note: z.string().optional(),
  tags: z.array(z.string()).default([]),
  productId: z.string().optional(),
});

export const updateIdeaSchema = manualIdeaSchema.partial();

export const bulkStatusSchema = z.object({
  ids: z.array(z.string()).min(1),
  status: z.enum(IDEA_STATUSES),
});
```

- [ ] **Step 4: Run the validator test to verify it passes**

Run: `npx vitest run src/app/api/ideas/validation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the ideas list/create route**

`src/app/api/ideas/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { manualIdeaSchema } from "./validators";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const where: Record<string, unknown> = {};
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const platform = searchParams.get("platform");
  const productId = searchParams.get("productId");
  if (status) where.status = status;
  if (category) where.category = category;
  if (platform) where.piattaformeConsigliate = { has: platform };
  if (productId) where.productId = productId;

  const ideas = await prisma.idea.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: { product: { select: { nome: true } } },
  });
  return NextResponse.json(ideas);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = manualIdeaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido", details: parsed.error.flatten() }, { status: 400 });
  }
  const source = await prisma.signalSource.findUniqueOrThrow({ where: { key: "manuale" } });
  const idea = await prisma.idea.create({
    data: { ...parsed.data, sourceId: source.id },
  });
  return NextResponse.json(idea, { status: 201 });
}
```

- [ ] **Step 6: Create the single-idea route**

`src/app/api/ideas/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateIdeaSchema } from "../validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const idea = await prisma.idea.findUnique({
    where: { id },
    include: { product: true, generationRun: true },
  });
  if (!idea) return NextResponse.json({ error: "Non trovata" }, { status: 404 });
  return NextResponse.json(idea);
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateIdeaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  }
  const idea = await prisma.idea.update({ where: { id }, data: parsed.data });
  return NextResponse.json(idea);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await prisma.idea.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Create the bulk-status route**

`src/app/api/ideas/bulk-status/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bulkStatusSchema } from "../validators";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bulkStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  }
  const result = await prisma.idea.updateMany({
    where: { id: { in: parsed.data.ids } },
    data: { status: parsed.data.status },
  });
  return NextResponse.json({ updated: result.count });
}
```

- [ ] **Step 8: Create the generation-run detail route**

`src/app/api/generation-runs/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const run = await prisma.generationRun.findUnique({
    where: { id },
    include: { ideas: { select: { id: true, titolo: true } } },
  });
  if (!run) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  return NextResponse.json(run);
}
```

- [ ] **Step 9: Create the knowledge routes**

`src/app/api/knowledge/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const KNOWLEDGE_TYPES = ["INFO_PRODOTTO", "BRAND_VOICE", "TARGET", "CLAIM", "LINEA_GUIDA", "DOCUMENTO"] as const;

const schema = z.object({
  tipo: z.enum(KNOWLEDGE_TYPES),
  titolo: z.string().min(1),
  contenuto: z.string().min(1),
  tags: z.array(z.string()).default([]),
  productId: z.string().optional(),
});

export async function GET() {
  const items = await prisma.knowledgeItem.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const item = await prisma.knowledgeItem.create({ data: parsed.data });
  return NextResponse.json(item, { status: 201 });
}
```

`src/app/api/knowledge/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  titolo: z.string().min(1).optional(),
  contenuto: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const item = await prisma.knowledgeItem.update({ where: { id }, data: parsed.data });
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await prisma.knowledgeItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 10: Create the products route**

`src/app/api/products/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  nome: z.string().min(1),
  categoria: z.string().optional(),
  descrizione: z.string().optional(),
  benefici: z.string().optional(),
  ingredienti: z.string().optional(),
  target: z.string().optional(),
  url: z.string().optional(),
});

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { nome: "asc" } });
  return NextResponse.json(products);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido" }, { status: 400 });
  const product = await prisma.product.create({ data: parsed.data });
  return NextResponse.json(product, { status: 201 });
}
```

- [ ] **Step 11: Create the report summary route**

`src/app/api/report/summary/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IDEA_CATEGORIES } from "@/lib/brain/enums";

export async function GET() {
  const byStatus = await prisma.idea.groupBy({ by: ["status"], _count: true });
  const byCategory = await prisma.idea.groupBy({ by: ["category"], _count: true });

  const statusCounts = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
  const categoryCounts = Object.fromEntries(byCategory.map((c) => [c.category, c._count]));

  const alerts: string[] = [];
  if ((statusCounts["APPROVATA"] ?? 0) < 3) {
    alerts.push("Poche idee approvate: meno di 3 pronte per la produzione contenuti.");
  }
  const uncovered = IDEA_CATEGORIES.filter((c) => !categoryCounts[c]);
  if (uncovered.length > 0) {
    alerts.push(`Categorie scoperte (nessuna idea): ${uncovered.join(", ")}.`);
  }
  const lastRun = await prisma.generationRun.findFirst({ orderBy: { createdAt: "desc" } });
  if (!lastRun) {
    alerts.push("Nessuna generazione AI eseguita finora.");
  }

  return NextResponse.json({ statusCounts, categoryCounts, alerts });
}
```

- [ ] **Step 12: Verify type-check and full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: `tsc` exits 0; all Vitest suites pass.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: ideas/knowledge/products/report API routes + shared validators"
```

---

## Task 11: Dashboard, Generate, Manual, Knowledge, Report, and Idea-detail pages

**Files:**
- Create: `src/app/dashboard/page.tsx`, `src/components/idea-table.tsx`, `src/components/idea-filters.tsx`, `src/app/generate/page.tsx`, `src/app/manual/page.tsx`, `src/app/knowledge/page.tsx`, `src/app/report/page.tsx`, `src/app/ideas/[id]/page.tsx`

These are UI pages. They use `fetch` against the API routes. No Vitest coverage (verified manually in Task 13). Keep components small and focused.

- [ ] **Step 1: Dashboard page (server component shell)**

`src/app/dashboard/page.tsx`:
```tsx
import { IdeaTable } from "@/components/idea-table";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Dashboard Idee</h1>
      <IdeaTable />
    </div>
  );
}
```

- [ ] **Step 2: Idea filters client component**

`src/components/idea-filters.tsx`:
```tsx
"use client";

import { IDEA_STATUSES, IDEA_CATEGORIES, PLATFORMS } from "@/lib/brain/enums";

export interface Filters {
  status: string;
  category: string;
  platform: string;
}

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
    </div>
  );
}
```

- [ ] **Step 3: Idea table client component (with bulk approve/discard)**

`src/components/idea-table.tsx`:
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
  product?: { nome: string } | null;
}

export function IdeaTable() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [filters, setFilters] = useState<Filters>({ status: "", category: "", platform: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filters.status) qs.set("status", filters.status);
    if (filters.category) qs.set("category", filters.category);
    if (filters.platform) qs.set("platform", filters.platform);
    const res = await fetch(`/api/ideas?${qs.toString()}`);
    setIdeas(await res.json());
    setSelected(new Set());
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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
              <th className="p-2">Piattaforme</th>
              <th className="p-2">SEO</th>
              <th className="p-2">Viral</th>
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
                <td className="p-2">{i.piattaformeConsigliate.join(", ")}</td>
                <td className="p-2">{i.seoScore}</td>
                <td className="p-2">{i.viralityScore}</td>
                <td className="p-2">{i.priority}</td>
                <td className="p-2">{i.status}</td>
              </tr>
            ))}
            {ideas.length === 0 && <tr><td colSpan={8} className="p-4 text-neutral-500">Nessuna idea.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Generate page**

`src/app/generate/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { IDEA_CATEGORIES } from "@/lib/brain/enums";

export default function GeneratePage() {
  const [form, setForm] = useState({ prodotto: "", categoria: "", angolo: "", keywordSeed: "", count: 5 });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setStatus(null);
    const body: Record<string, unknown> = { count: Number(form.count) };
    for (const k of ["prodotto", "categoria", "angolo", "keywordSeed"] as const) {
      if (form[k]) body[k] = form[k];
    }
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setStatus(res.ok ? `Generate ${json.created} nuove idee. Vai alla Dashboard.` : `Errore: ${json.error ?? "sconosciuto"}`);
    setBusy(false);
  };

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-2xl font-semibold">Genera Idee (Superpower Brainstorming)</h1>
      <div className="space-y-3">
        <input className="w-full rounded border p-2" placeholder="Prodotto in focus (opzionale)" value={form.prodotto} onChange={(e) => setForm({ ...form, prodotto: e.target.value })} />
        <select className="w-full rounded border p-2" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
          <option value="">Categoria preferita (opzionale)</option>
          {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="w-full rounded border p-2" placeholder="Angolo creativo (opzionale)" value={form.angolo} onChange={(e) => setForm({ ...form, angolo: e.target.value })} />
        <input className="w-full rounded border p-2" placeholder="Keyword seed (opzionale)" value={form.keywordSeed} onChange={(e) => setForm({ ...form, keywordSeed: e.target.value })} />
        <input type="number" min={1} max={20} className="w-full rounded border p-2" value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} />
        <button onClick={submit} disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40">{busy ? "Generazione…" : "Genera"}</button>
      </div>
      {status && <p className="mt-4 text-sm">{status}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Manual page**

`src/app/manual/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { IDEA_CATEGORIES, PLATFORMS } from "@/lib/brain/enums";

export default function ManualPage() {
  const [form, setForm] = useState({ titolo: "", descrizione: "", category: "TREND", piattaformeConsigliate: [] as string[] });
  const [status, setStatus] = useState<string | null>(null);

  const togglePlatform = (p: string) => {
    setForm((f) => ({
      ...f,
      piattaformeConsigliate: f.piattaformeConsigliate.includes(p)
        ? f.piattaformeConsigliate.filter((x) => x !== p)
        : [...f.piattaformeConsigliate, p],
    }));
  };

  const submit = async () => {
    const res = await fetch("/api/ideas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setStatus(res.ok ? "Idea creata." : "Errore nella creazione.");
    if (res.ok) setForm({ titolo: "", descrizione: "", category: "TREND", piattaformeConsigliate: [] });
  };

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-2xl font-semibold">Inserimento Manuale</h1>
      <div className="space-y-3">
        <input className="w-full rounded border p-2" placeholder="Titolo" value={form.titolo} onChange={(e) => setForm({ ...form, titolo: e.target.value })} />
        <textarea className="w-full rounded border p-2" placeholder="Descrizione" value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} />
        <select className="w-full rounded border p-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex flex-wrap gap-3 text-sm">
          {PLATFORMS.map((p) => (
            <label key={p} className="flex items-center gap-1">
              <input type="checkbox" checked={form.piattaformeConsigliate.includes(p)} onChange={() => togglePlatform(p)} />{p}
            </label>
          ))}
        </div>
        <button onClick={submit} className="rounded bg-blue-600 px-4 py-2 text-white">Salva</button>
      </div>
      {status && <p className="mt-4 text-sm">{status}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Knowledge page**

`src/app/knowledge/page.tsx`:
```tsx
"use client";

import { useEffect, useState, useCallback } from "react";

const TYPES = ["INFO_PRODOTTO", "BRAND_VOICE", "TARGET", "CLAIM", "LINEA_GUIDA", "DOCUMENTO"] as const;

interface Item { id: string; tipo: string; titolo: string; contenuto: string; }

export default function KnowledgePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState({ tipo: "DOCUMENTO", titolo: "", contenuto: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/knowledge");
    setItems(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ tipo: "DOCUMENTO", titolo: "", contenuto: "" });
    await load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold">Knowledge Base</h1>
      <div className="mb-6 space-y-3 rounded border bg-white p-4">
        <select className="w-full rounded border p-2" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="w-full rounded border p-2" placeholder="Titolo" value={form.titolo} onChange={(e) => setForm({ ...form, titolo: e.target.value })} />
        <textarea className="w-full rounded border p-2" rows={4} placeholder="Contenuto (incolla materiali Agocap)" value={form.contenuto} onChange={(e) => setForm({ ...form, contenuto: e.target.value })} />
        <button onClick={submit} className="rounded bg-blue-600 px-4 py-2 text-white">Aggiungi</button>
      </div>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.id} className="rounded border bg-white p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">[{i.tipo}] {i.titolo}</span>
              <button onClick={() => remove(i.id)} className="text-red-600">Elimina</button>
            </div>
            <p className="mt-1 text-neutral-600">{i.contenuto}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: Report page**

`src/app/report/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

interface Summary {
  statusCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  alerts: string[];
}

export default function ReportPage() {
  const [data, setData] = useState<Summary | null>(null);
  useEffect(() => {
    fetch("/api/report/summary").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p>Caricamento…</p>;
  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold">Report & Alert</h1>
      <section className="mb-6">
        <h2 className="mb-2 font-medium">Idee per stato</h2>
        <ul className="text-sm">{Object.entries(data.statusCounts).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
      </section>
      <section className="mb-6">
        <h2 className="mb-2 font-medium">Idee per categoria</h2>
        <ul className="text-sm">{Object.entries(data.categoryCounts).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
      </section>
      <section>
        <h2 className="mb-2 font-medium">Alert</h2>
        {data.alerts.length === 0 ? <p className="text-sm text-green-700">Nessun alert.</p> : (
          <ul className="space-y-1 text-sm text-amber-700">{data.alerts.map((a, idx) => <li key={idx}>⚠️ {a}</li>)}</ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 8: Idea detail page**

`src/app/ideas/[id]/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { IDEA_STATUSES } from "@/lib/brain/enums";

interface Idea {
  id: string;
  titolo: string;
  descrizione: string;
  category: string;
  status: string;
  note: string | null;
  seoScore: number;
  viralityScore: number;
  priority: number;
  product?: { nome: string } | null;
  generationRun?: { id: string; modello: string; promptUsato: string } | null;
}

export default function IdeaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/ideas/${id}`).then((r) => r.json()).then(setIdea);
  }, [id]);

  const patch = async (data: Partial<Idea>) => {
    const res = await fetch(`/api/ideas/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setIdea(await res.json()); setSaved(true); setTimeout(() => setSaved(false), 1500); }
  };

  if (!idea) return <p>Caricamento…</p>;
  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold">{idea.titolo}</h1>
      <p className="mb-2 text-neutral-700">{idea.descrizione}</p>
      <p className="mb-4 text-sm text-neutral-500">
        Categoria: {idea.category} · SEO {idea.seoScore} · Viral {idea.viralityScore} · Prio {idea.priority}
        {idea.product ? ` · Prodotto: ${idea.product.nome}` : ""}
      </p>
      <label className="mb-4 block text-sm">
        Stato:&nbsp;
        <select value={idea.status} onChange={(e) => patch({ status: e.target.value })} className="rounded border p-1">
          {IDEA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="mb-2 block text-sm">Note:</label>
      <textarea className="mb-2 w-full rounded border p-2" rows={4} defaultValue={idea.note ?? ""} onBlur={(e) => patch({ note: e.target.value })} />
      {saved && <p className="text-sm text-green-700">Salvato.</p>}
      {idea.generationRun && (
        <p className="mt-4 text-xs text-neutral-400">Generata dall'AI ({idea.generationRun.modello}) — run {idea.generationRun.id}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Verify type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: dashboard, generate, manual, knowledge, report, and idea-detail pages"
```

---

## Task 12: Dockerfile and docker-compose

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

`.dockerignore`:
```
node_modules
.next
.git
npm-debug.log
.env
```

- [ ] **Step 2: Create the Dockerfile (multi-stage, Next.js standalone)**

`Dockerfile`:
```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

> Note: create an empty `public/.gitkeep` so the `COPY public` step succeeds.

- [ ] **Step 3: Create `public/.gitkeep`**

Run: `mkdir -p public && touch public/.gitkeep`

- [ ] **Step 4: Create docker-compose.yml**

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: agocap
      POSTGRES_PASSWORD: agocap
      POSTGRES_DB: agocap
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  app:
    build: .
    environment:
      DATABASE_URL: "postgresql://agocap:agocap@db:5432/agocap?schema=public"
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
    depends_on:
      - db
    ports:
      - "3000:3000"
    command: sh -c "npx prisma migrate deploy && npx prisma db seed && node server.js"

volumes:
  pgdata:
```

> Note: the `app` service runs `prisma migrate deploy` + seed before starting. Because the standalone image doesn't include the Prisma CLI or `tsx`, adjust the build to keep them, OR run migrations as a one-off. Simplest for the MVP: add `prisma` and `tsx` to the runner stage. Update the Dockerfile runner stage to also `COPY --from=builder /app/node_modules ./node_modules` instead of only the Prisma subfolders, and drop the two `.prisma`/`@prisma` COPY lines. This trades image size for a working migrate+seed at boot.

- [ ] **Step 5: Apply the Dockerfile adjustment from the note**

Replace the three `COPY ... node_modules ...` lines in the runner stage with a single:
```dockerfile
COPY --from=builder /app/node_modules ./node_modules
```

- [ ] **Step 6: Build the image to verify it compiles**

Run: `docker compose build app`
Expected: build completes without error (downloads base image, runs `npm ci`, `prisma generate`, `next build`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Dockerfile and docker-compose for Lightsail deployment"
```

---

## Task 13: End-to-end manual smoke test + full suite

**Files:** none created — verification only.

- [ ] **Step 1: Run the full unit suite**

Run: `npx vitest run`
Expected: all suites pass (schema, dedupe, context, prompt, generate, runtime, ideas validators, generate route).

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Bring the stack up**

Run: `ANTHROPIC_API_KEY=sk-ant-... docker compose up --build`
Expected: `db` becomes healthy, `app` runs migrate+seed then logs "Ready on http://localhost:3000".

- [ ] **Step 4: Manual smoke test in the browser**

Visit `http://localhost:3000` and verify, in order:
1. Redirects to `/dashboard` (empty table).
2. `/knowledge` — add a product-info item and a brand-voice item; they appear in the list.
3. `/generate` — submit with count=5; after completion it reports "Generate N nuove idee".
4. `/dashboard` — the generated ideas appear; filters by status/category/platform work; select 2 and click "Approva"; their status becomes `APPROVATA`.
5. Click an idea title → detail page; change status and add a note; "Salvato" appears.
6. `/manual` — add an idea by hand; it appears in the dashboard with source `manuale`.
7. `/report` — counters reflect the ideas; the "poche idee approvate" alert clears once ≥3 are approved.

- [ ] **Step 5: Verify the generation run was recorded with prompt + tokens**

Run (against the running DB):
```bash
docker compose exec db psql -U agocap -d agocap -c "select id, modello, status, \"inputTokens\", \"outputTokens\" from \"GenerationRun\" order by \"createdAt\" desc limit 1;"
```
Expected: one row with `modello = claude-opus-4-8`, `status = DONE`, non-zero token counts.

- [ ] **Step 6: Commit any final fixes**

```bash
git add -A
git commit -m "chore: brain MVP end-to-end verified"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** KB area (Task 2/10/11), AI generation + classification (Tasks 3–9), dedupe (Task 4), manual source (Task 10/11), dashboard with filters + bulk approve (Task 11), idea detail (Task 11), report + alerts (Task 10/11), GenerationRun audit of prompt/output/tokens (Tasks 7/8, verified Task 13 step 5), extensible SignalSource registry (Task 2 seed + `sources/types.ts`), error-run path (Task 7 test 2), no auth (nothing added). Stack matches spec (Next.js/Postgres/Docker/Lightsail).
- **Type consistency:** `IdeaDraft` shape is shared across `schema.ts`, `sources/types.ts`, `generate.ts`, and `runtime.ts`; enum constants come from one module (`enums.ts`); `runBrainstorm` signature is identical in `generate.ts`, its test, and the API route.
- **No placeholders:** every code step contains complete, runnable code; commands have expected output.
