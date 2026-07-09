# Guardrail anti-competitor (blog) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedire che nomi di competitor compaiano nei contenuti blog generati (incluse le FAQ), tramite regola nel prompt + scrub del payload prima del salvataggio.

**Architecture:** Modulo puro `competitors.ts` con lista + `scrubCompetitors`/`scrubBlogPayload`; il prompt riceve una regola esplicita; `callClaude` applica lo scrub al payload parsato prima di restituirlo/persisterlo.

**Tech Stack:** TypeScript, Vitest (node env — solo funzioni pure), Zod, @anthropic-ai/sdk (già integrato).

## Global Constraints

- Lista competitor in un modulo di codice: `COMPETITORS = ["natural System"]`, estensibile aggiungendo stringhe.
- Su match → **sostituzione** con `NEUTRAL_REPLACEMENT = "un noto marchio concorrente"` (non rimozione).
- Matching case-insensitive, tollerante a spazi/trattini tra i token del nome (`natural[\s-]*system`).
- Scrub applicato a TUTTI i campi testuali del payload: `titoloSeo`, `metaDescription`, `corpoHtml`, `cta`, `keywordPrincipale`, `keywordSecondarie[]`, `puntiChiave[]`, `faq[].domanda`, `faq[].risposta`. `prodotti` e campi non testuali intatti.
- Due strati: regola nel prompt (`buildBlogPrompt`) + scrub in `callClaude` (garanzia).
- Test solo su funzioni pure; prompt/runtime via `npx tsc --noEmit`.
- **Limitazione nota (accettata):** poiché "natural System" è composto da parole comuni, un uso generico in inglese di "natural system" verrebbe anch'esso sostituito (falso positivo raro). L'uso della parola "naturale"/"natural" da sola NON viene toccato (serve l'adiacenza dei due token). Accettabile per l'esigenza dell'utente.
- Commit frequenti, un commit per task.

---

### Task 1: Modulo `competitors.ts` (puro, TDD)

**Files:**
- Create: `src/lib/blog/competitors.ts`
- Test: `src/lib/blog/competitors.test.ts`

**Interfaces:**
- Produces:
  - `const COMPETITORS: string[]`
  - `const NEUTRAL_REPLACEMENT: string`
  - `interface BlogPayloadTextFields { titoloSeo?: string; metaDescription?: string; corpoHtml?: string; cta?: string; keywordPrincipale?: string; keywordSecondarie?: string[]; puntiChiave?: string[]; faq?: { domanda: string; risposta: string }[] }`
  - `scrubCompetitors(text: string, competitors?: string[], replacement?: string): string`
  - `scrubBlogPayload<T extends BlogPayloadTextFields>(payload: T, competitors?: string[], replacement?: string): T`

- [ ] **Step 1: Write the failing test**

Create `src/lib/blog/competitors.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { scrubCompetitors, scrubBlogPayload } from "@/lib/blog/competitors";

describe("scrubCompetitors", () => {
  it("replaces the competitor name case-insensitively", () => {
    expect(scrubCompetitors("Prova Natural System oggi")).toBe("Prova un noto marchio concorrente oggi");
    expect(scrubCompetitors("prova natural system")).toBe("prova un noto marchio concorrente");
  });
  it("tolerates spacing/hyphen variants", () => {
    expect(scrubCompetitors("naturalsystem")).toBe("un noto marchio concorrente");
    expect(scrubCompetitors("natural-system")).toBe("un noto marchio concorrente");
    expect(scrubCompetitors("natural   system")).toBe("un noto marchio concorrente");
  });
  it("replaces multiple occurrences", () => {
    expect(scrubCompetitors("Natural System vs Natural System")).toBe("un noto marchio concorrente vs un noto marchio concorrente");
  });
  it("leaves the standalone word 'naturale' untouched", () => {
    expect(scrubCompetitors("un approccio naturale al benessere")).toBe("un approccio naturale al benessere");
  });
  it("returns empty text unchanged", () => {
    expect(scrubCompetitors("")).toBe("");
  });
});

describe("scrubBlogPayload", () => {
  it("scrubs all text fields including faq, leaving prodotti untouched", () => {
    const p = {
      titoloSeo: "Natural System o Agocap?",
      metaDescription: "Confronto con Natural System",
      corpoHtml: "<p>Meglio di natural system</p>",
      cta: "Batti Natural System",
      keywordPrincipale: "natural system",
      keywordSecondarie: ["natural system integratore"],
      puntiChiave: ["Natural System costa di piu"],
      faq: [{ domanda: "Meglio di Natural System?", risposta: "Si, meglio di natural-system." }],
      prodotti: [{ handle: "x", titolo: "X", url: "u" }],
    };
    const out = scrubBlogPayload(p);
    expect(out.titoloSeo).not.toMatch(/natural[\s-]*system/i);
    expect(out.metaDescription).not.toMatch(/natural[\s-]*system/i);
    expect(out.corpoHtml).toContain("un noto marchio concorrente");
    expect(out.cta).not.toMatch(/natural[\s-]*system/i);
    expect(out.keywordPrincipale).toBe("un noto marchio concorrente");
    expect(out.keywordSecondarie[0]).not.toMatch(/natural[\s-]*system/i);
    expect(out.puntiChiave[0]).toContain("un noto marchio concorrente");
    expect(out.faq[0].domanda).not.toMatch(/natural[\s-]*system/i);
    expect(out.faq[0].risposta).not.toMatch(/natural[\s-]*system/i);
    expect(out.prodotti).toEqual(p.prodotti);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/blog/competitors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/blog/competitors.ts`:
```ts
export const COMPETITORS: string[] = ["natural System"];
export const NEUTRAL_REPLACEMENT = "un noto marchio concorrente";

export interface BlogPayloadTextFields {
  titoloSeo?: string;
  metaDescription?: string;
  corpoHtml?: string;
  cta?: string;
  keywordPrincipale?: string;
  keywordSecondarie?: string[];
  puntiChiave?: string[];
  faq?: { domanda: string; risposta: string }[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Tolerant regex for a competitor name: tokens joined by [\s-]* , case-insensitive, global. */
function competitorRegex(name: string): RegExp {
  const tokens = name.trim().split(/\s+/).filter(Boolean).map(escapeRegex);
  return new RegExp(tokens.join("[\\s-]*"), "gi");
}

export function scrubCompetitors(
  text: string,
  competitors: string[] = COMPETITORS,
  replacement: string = NEUTRAL_REPLACEMENT,
): string {
  if (typeof text !== "string" || text.length === 0) return text;
  let out = text;
  for (const c of competitors) {
    if (!c || !c.trim()) continue;
    out = out.replace(competitorRegex(c), replacement);
  }
  return out;
}

export function scrubBlogPayload<T extends BlogPayloadTextFields>(
  payload: T,
  competitors: string[] = COMPETITORS,
  replacement: string = NEUTRAL_REPLACEMENT,
): T {
  const s = (v: string | undefined) => (typeof v === "string" ? scrubCompetitors(v, competitors, replacement) : v);
  const arr = (a: string[] | undefined) => (Array.isArray(a) ? a.map((x) => scrubCompetitors(x, competitors, replacement)) : a);
  return {
    ...payload,
    titoloSeo: s(payload.titoloSeo),
    metaDescription: s(payload.metaDescription),
    corpoHtml: s(payload.corpoHtml),
    cta: s(payload.cta),
    keywordPrincipale: s(payload.keywordPrincipale),
    keywordSecondarie: arr(payload.keywordSecondarie),
    puntiChiave: arr(payload.puntiChiave),
    faq: Array.isArray(payload.faq)
      ? payload.faq.map((f) => ({
          ...f,
          domanda: scrubCompetitors(f.domanda, competitors, replacement),
          risposta: scrubCompetitors(f.risposta, competitors, replacement),
        }))
      : payload.faq,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run src/lib/blog/competitors.test.ts`
Expected: PASS — all tests.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/lib/blog/competitors.ts src/lib/blog/competitors.test.ts
git commit -m "feat(blog): competitor scrub (list + scrubCompetitors/scrubBlogPayload)"
```

---

### Task 2: Cablaggio prompt + scrub alla generazione

**Files:**
- Modify: `src/lib/blog/prompt.ts`
- Modify: `src/lib/blog/runtime.ts`

**Interfaces:**
- Consumes: `COMPETITORS`, `scrubBlogPayload` (Task 1).

- [ ] **Step 1: Add the competitor rule to the prompt**

In `src/lib/blog/prompt.ts`:

(a) Add the import at the top (after the existing import):
```ts
import { COMPETITORS } from "./competitors";
```

(b) In `buildBlogPrompt`, in the `# Compito` requirements list, find:
```ts
- Ancora tutto alla knowledge base (tono, claim prudenti e conformi).
```
Replace with:
```ts
- Ancora tutto alla knowledge base (tono, claim prudenti e conformi).
- VIETATO citare marchi o prodotti di aziende concorrenti (es. ${COMPETITORS.join(", ")}) in qualsiasi punto dell'articolo, incluse le FAQ. Parla solo di Agocap e usa termini generici.
```

- [ ] **Step 2: Apply the scrub to the parsed payload**

In `src/lib/blog/runtime.ts`:

(a) Add the import (with the other `./` imports near the top):
```ts
import { scrubBlogPayload } from "./competitors";
```

(b) In `buildBlogDeps().callClaude`, find:
```ts
      const payload = blogArticleSchema.parse(JSON.parse(stripFences(textBlock.text)));
```
Replace with:
```ts
      const payload = scrubBlogPayload(blogArticleSchema.parse(JSON.parse(stripFences(textBlock.text))));
```

- [ ] **Step 3: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: no errors (`BlogArticle` from the parse satisfies `BlogPayloadTextFields`; `scrubBlogPayload` returns the same type).

- [ ] **Step 4: Commit**

```bash
cd "/c/Users/Hatweb Lim/agocap-content-ai-hub"
git add src/lib/blog/prompt.ts src/lib/blog/runtime.ts
git commit -m "feat(blog): forbid competitors in the prompt + scrub generated payload"
```

---

### Task 3: Verifica end-to-end

**Files:** nessuna modifica.

- [ ] **Step 1: Full test suite**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx vitest run`
Expected: tutti verdi (inclusi i nuovi `competitors.test.ts`).

- [ ] **Step 2: Typecheck**

Run: `cd "/c/Users/Hatweb Lim/agocap-content-ai-hub" && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Smoke manuale (opzionale, dev server su :3000)**

Genera un articolo blog: il payload salvato non deve contenere "natural System" in nessun campo (corpo/FAQ inclusi); al suo posto compare "un noto marchio concorrente". (Difficile forzare Claude a citarlo; lo scrub è la garanzia anche se non lo cita.)

- [ ] **Step 4: Nessun commit** (task di sola verifica).

---

## Self-Review

**Spec coverage:**
- `competitors.ts` (COMPETITORS, NEUTRAL_REPLACEMENT, scrubCompetitors tollerante, scrubBlogPayload su tutti i campi) → Task 1. ✓
- Regola nel prompt con la lista → Task 2. ✓
- Scrub del payload in `callClaude` prima di persistere → Task 2. ✓
- Test funzioni pure + tsc → Task 1/3. ✓
- Limitazione falsi positivi documentata → Global Constraints. ✓

**Placeholder scan:** nessun TODO/TBD; ogni step ha codice/comando reale. ✓

**Type consistency:** `scrubCompetitors`/`scrubBlogPayload`/`COMPETITORS`/`BlogPayloadTextFields` coerenti tra Task 1 (def) e Task 2 (uso); `BlogArticle` (dallo schema) è strutturalmente un `BlogPayloadTextFields`, quindi `scrubBlogPayload(parse(...))` tipa e ritorna `BlogArticle`. ✓
