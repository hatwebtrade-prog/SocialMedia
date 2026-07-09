# Meta Carousel — Per-Image Product Selection

Date: 2026-06-30
Status: Design approved (pending user spec review)

## Problem

On the Meta content detail page (`/meta/[id]`), image generation for a CAROSELLO
uses a **single global** product-mockup selection (`refProductId` + `useMockup`)
shared by the post image and every slide. When the user wants the product in some
slides but not others, they must toggle the global checkbox between each
generation — and with it left on, "me li genera in tutti" (the product ends up in
every image they generate).

## Goal

Let the user choose, **per image** (the post and each carousel slide
independently), **which product (or none)** to insert and whether to use it as a
mockup. Each image opts in to its own product; nothing is forced across all
images.

The backend already supports this: `POST /api/meta/contents/[id]/image` accepts
`productId`, `useMockup`, and `slideIndex` per request (see
`src/app/api/meta/contents/[id]/image/route.ts` and `imageInputSchema`). **This is
a UI-only change** — no API, schema, validator, or generation-logic changes.

## Non-goals

- No changes to API routes, Prisma schema, validators, or image-generation logic.
- `provider` and the image `brief` stay **global** for the content (not per-slide)
  — out of scope for this request.
- No redesign of the `/meta/[id]` page styling (it is not part of the Brain
  "Natural & Calm" redesign; follow the page's existing default-Tailwind style).
- Manual upload (`provider === "MANUAL"`) is unaffected — it never used a product.

## Design

### New component: `ProductMockupPicker`

File: `src/components/product-mockup-picker.tsx` (client component).

A small, reusable control rendering the product + mockup selection for ONE image,
so the post block and each slide block share one implementation instead of
duplicating the selector N+1 times.

Props:

```ts
interface ProductOption { id: string; nome: string; imagePath: string | null }
interface ProductMockupValue { productId: string; useMockup: boolean }

function ProductMockupPicker(props: {
  products: ProductOption[];
  value: ProductMockupValue;
  onChange: (next: ProductMockupValue) => void;
}): JSX.Element
```

Renders:
- a `<select>` with `"Nessun prodotto"` (value `""`) plus every product that has
  `imagePath` (those are the only ones with a usable mockup, matching today's
  filter `products.filter((p) => p.imagePath)`);
- a `"Includi il mockup nel contesto (image-edit)"` checkbox, **disabled when no
  product is selected** (and forced off in `value` when product is cleared);
- the product thumbnail (`/api/products/${productId}/image`, `h-14 w-14`, object-
  contain) shown only when a product is selected and `useMockup` is true — same
  as today.

Behavior detail: when the product select is cleared to `""`, `onChange` emits
`{ productId: "", useMockup: false }` so a stale `useMockup: true` can't linger.

### Page state (`src/app/meta/[id]/page.tsx`)

Remove the global `refProductId` / `useMockup` state. Add a per-image map keyed by
a stable image key:

```ts
const keyFor = (slideIndex: number | null) => (slideIndex === null ? "post" : String(slideIndex));
const [perImage, setPerImage] = useState<Record<string, ProductMockupValue>>({});
const valueFor = (slideIndex: number | null): ProductMockupValue =>
  perImage[keyFor(slideIndex)] ?? { productId: "", useMockup: false };
const setValueFor = (slideIndex: number | null, next: ProductMockupValue) =>
  setPerImage((prev) => ({ ...prev, [keyFor(slideIndex)]: next }));
```

Default for any image with no entry is `{ productId: "", useMockup: false }` — i.e.
**no product unless explicitly chosen**, which fixes the "in tutti" complaint.

`provider` and `brief` remain global page state exactly as today.

### Wiring

- The top "Immagine prodotto (mockup) per la generazione" box loses the product
  `<select>`, the mockup checkbox, and the thumbnail. It keeps the **provider**
  `<select>` and the `ImageBriefForm`. Retitle it to reflect that it now holds
  provider + brief (e.g. "Generatore immagini (provider + brief)").
- The **post** block (the "Immagine principale" section) renders a
  `<ProductMockupPicker products={products} value={valueFor(null)} onChange={(v) => setValueFor(null, v)} />`
  above its Generate button (hidden when `provider === "MANUAL"`, since the picker
  is irrelevant to manual upload).
- Each **slide** block renders
  `<ProductMockupPicker products={products} value={valueFor(idx)} onChange={(v) => setValueFor(idx, v)} />`
  above its Generate button (also hidden for `provider === "MANUAL"`).
- `genImage(slideIndex)` reads `const v = valueFor(slideIndex)` and sends
  `productId: v.productId || undefined`, `useMockup: v.useMockup && !!v.productId`
  (preserving today's guard that mockup requires a product). `provider`, `brief`,
  and `styleId: brief.stile` stay as they are.

### Data flow

Unchanged end-to-end except that `productId`/`useMockup` now come from the
per-image map instead of global state. The POST body shape to
`/api/meta/contents/[id]/image` is identical to today's.

### Error handling

Unchanged — the existing `genImage` already surfaces `Errore immagine: …` on a
non-OK response and reloads on success.

## Testing

- `npx tsc --noEmit` clean.
- Live smoke on `/meta/[id]` for a CAROSELLO: set slide 1 → product A + mockup,
  slide 2 → "Nessun prodotto", post → product B + mockup; generate each and
  confirm (a) slide 1 and post images are product-guided, (b) slide 2 is generated
  with no product, (c) clearing a slide's product disables/forces-off its mockup
  checkbox. Vitest is node-env, so the component is verified by typecheck + smoke
  (no React-render test).

## Files

- Create: `src/components/product-mockup-picker.tsx`
- Modify: `src/app/meta/[id]/page.tsx`
