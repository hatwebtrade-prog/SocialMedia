import type { ImageBrief } from "./brief";

export type ImageArchetype = "UGC" | "ADV" | "PRODUCT_HERO";
export const IMAGE_ARCHETYPES = ["UGC", "ADV", "PRODUCT_HERO"] as const;

export interface ProductPromptData {
  nome: string;
  descrizione?: string | null;
  benefici?: string | null;
  ingredienti?: string | null;
  categoria?: string | null;
}

export interface ArchetypeInputs {
  product: ProductPromptData;
  brief?: ImageBrief;
  hasMockup: boolean;
  headline?: string | null;
  formato?: "verticale" | "quadrato" | "orizzontale";
  brandVisual?: string | null;
  /** The user's creative idea for this post — drives the scene/concept. */
  ideaCreativa?: string | null;
}

export interface BuiltPrompt {
  positive: string;
  avoid: string;
  full: string;
}

type Formato = NonNullable<ArchetypeInputs["formato"]>;

interface Preset {
  scene: string;
  subject: string;
  composition: string;
  lighting: string;
  style: string;
  mood: string;
  productPlacement: string;
  defaultFormato: Formato;
}

const PRESETS: Record<ImageArchetype, Preset> = {
  UGC: {
    scene: "an everyday real-life setting (home, bathroom shelf or kitchen counter)",
    subject: "a real person naturally holding and using the product, authentic and relatable, not overly commercial",
    composition: "candid smartphone-style framing, product label facing the camera and in focus",
    lighting: "soft natural window light",
    style: "authentic user-generated content, realistic, unpolished but clean",
    mood: "warm, genuine, trustworthy",
    productPlacement: "the product is held naturally in-hand, sharp and clearly readable",
    defaultFormato: "verticale",
  },
  ADV: {
    scene: "a lifestyle background connected to the product benefit, elegant and high-contrast",
    subject: "the product as the dominant hero object",
    composition: "product large on the rule-of-thirds, clean negative space reserved for a short headline",
    lighting: "dramatic soft studio light",
    style: "premium direct-response advertising creative, realistic, trustworthy, not aggressive",
    mood: "confident, aspirational, premium",
    productPlacement: "the product dominates the frame, sharp, front-facing and undistorted",
    defaultFormato: "quadrato",
  },
  PRODUCT_HERO: {
    scene: "a bright clean white studio background with subtle shadows and a nutraceutical atmosphere",
    subject: "the product package standing upright as the hero object",
    composition: "centered product, balanced negative space, minimal layout",
    lighting: "professional softbox lighting, clean highlights, realistic shadows",
    style: "minimal, scientific, premium Italian nutraceutical",
    mood: "reliable, calm, clinical-premium",
    productPlacement: "the product is centered and upright, sharp and perfectly readable",
    defaultFormato: "quadrato",
  },
};

const AVOID =
  "low quality, blurry, pixelated, distorted product, warped packaging, wrong logo, " +
  "unreadable label, fake text, extra text, random letters, duplicated product, " +
  "deformed hands, extra fingers, missing fingers, artificial plastic skin, plastic face, " +
  "unrealistic smile, overexposed, underexposed, messy background, cheap stock photo, " +
  "amateur design, cartoon style, 3d render look, surreal, medical claim, before and after, " +
  "exaggerated results, cluttered composition, oversaturated colors, " +
  "collage, split screen, multiple panels, grid layout, multiple slides in one image, picture-in-picture";

const FORMATO_LABEL: Record<Formato, string> = {
  verticale: "vertical 2:3 portrait social format",
  quadrato: "square 1:1 social format",
  orizzontale: "horizontal 3:2 landscape social format",
};

/** First sentence (max ~160 chars) of the product description, single line; falls back to category. */
function shortDescription(product: ProductPromptData): string {
  const raw = (product.descrizione ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return (product.categoria ?? "").trim();
  const firstSentence = raw.split(/(?<=[.!?])\s/)[0] ?? raw;
  return firstSentence.length > 160 ? `${firstSentence.slice(0, 157).trim()}…` : firstSentence;
}

/** Appends a non-empty brief override to an archetype default, comma-separated. */
function merge(base: string, override?: string): string {
  const o = (override ?? "").trim();
  return o ? `${base}, ${o}` : base;
}

/** Clamps a headline to at most 5 words. Empty/whitespace → "". */
export function clampHeadline(headline?: string | null): string {
  const words = (headline ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.slice(0, 5).join(" ");
}

function textRule(archetype: ImageArchetype, headline?: string | null): string {
  const clamped = archetype === "ADV" ? clampHeadline(headline) : "";
  if (clamped) {
    return `you may include only this short headline (max 5 words): "${clamped}". No other text anywhere in the image.`;
  }
  return "no text, letters, words or logos other than the product packaging itself.";
}

export function buildArchetypePrompt(archetype: ImageArchetype, inputs: ArchetypeInputs): BuiltPrompt {
  const preset = PRESETS[archetype];
  const b = inputs.brief;
  const formato = inputs.formato ?? preset.defaultFormato;
  const desc = shortDescription(inputs.product);

  const mockupBlock = inputs.hasMockup
    ? "Use the provided product mockup as the EXACT packaging reference. Keep the packaging design, " +
      "colors, logo, proportions and the readable product name IDENTICAL to the original mockup. " +
      "Do NOT redesign the package. Do NOT invent, change or add any text on the label."
    : "No product reference image is provided: do NOT invent, fabricate or show any fake brand, logo " +
      "or made-up text on the packaging. Keep any package plain and unbranded, and never fabricate a " +
      "product identity that is not real.";

  const ingredientsLine =
    archetype === "PRODUCT_HERO"
      ? `Around the product show a few elegant natural ingredients related to the formula` +
        `${inputs.product.ingredienti ? `: ${inputs.product.ingredienti.replace(/\s+/g, " ").trim()}` : ""}.`
      : "";

  const idea = (inputs.ideaCreativa ?? "").replace(/\s+/g, " ").trim();

  const lines = [
    "Create a high-end realistic Instagram/Facebook advertising image for the Italian supplement brand AGOCAP. Ready to publish.",
    idea ? `Creative concept to depict — this is the most important instruction, build the whole scene around it: ${idea}` : "",
    "Product:",
    desc ? `${inputs.product.nome} — ${desc}` : inputs.product.nome,
    mockupBlock,
    `Scene: ${merge(preset.scene, b?.ambientazione)}`,
    `Main subject: ${merge(preset.subject, b?.soggetto)}`,
    `Composition: ${preset.composition}, ${FORMATO_LABEL[formato]}`,
    `Lighting: ${merge(preset.lighting, b?.luce)}`,
    `Style: ${merge(preset.style, b?.stile)}`,
    `Mood: ${merge(preset.mood, b?.mood)}`,
    `Product placement: ${preset.productPlacement}`,
    ingredientsLine,
    b?.note?.trim() ? `Additional direction: ${b.note.trim()}.` : "",
    inputs.brandVisual?.trim() ? `Brand visual style: ${inputs.brandVisual.trim()}.` : "",
    "Brand feeling: premium, clean, trustworthy, natural wellness, Italian nutraceutical brand, elegant but accessible.",
    `Text rule: ${textRule(archetype, inputs.headline)}`,
  ].filter((l) => l !== "");

  const positive = lines.join("\n");
  const full = `${positive}\n\nAvoid: ${AVOID}`;
  return { positive, avoid: AVOID, full };
}
