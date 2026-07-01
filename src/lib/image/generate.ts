import { buildImagePrompt } from "./prompt";
import { buildArchetypePrompt, type ImageArchetype, type ProductPromptData } from "./archetypes";
import { buildImagePromptFromBrief, isBriefEmpty, briefDimensions, type ImageBrief } from "./brief";
import type { ImageProvider } from "./providers";
import { buildBrandVisualContext } from "@/lib/knowledge/brand-context";

export interface ImageGenInput {
  contentId: string;
  slideIndex: number | null;
  productId?: string;
  useMockup?: boolean;
  provider?: ImageProvider;
  brief?: ImageBrief;
  styleId?: string;
  /** Current creative-idea text from the client; when present it IS the prompt (overrides the
   *  persisted payload, avoiding a race with the onBlur save). */
  ideaCreativa?: string;
  archetype?: ImageArchetype;
  headline?: string;
}

export interface ImageDeps {
  loadContent: (contentId: string, slideIndex: number | null) => Promise<{ ideaCreativa: string; slideText: string | null }>;
  loadMockup: (productId: string) => Promise<Buffer | null>;
  callOpenAI: (prompt: string, mockup?: Buffer, provider?: ImageProvider, opts?: { styleId?: string; soulSize?: string; customReferenceId?: string }) => Promise<Buffer>;
  persistAsset: (args: { input: ImageGenInput; prompt: string; bytes: Buffer }) => Promise<{ assetId: string }>;
  ensureHiggsfieldRef?: (productId: string) => Promise<string | null>;
  loadBrandVisual?: () => Promise<import("@/lib/knowledge/brand-context").BrandVisualData | null>;
  loadProduct?: (productId: string) => Promise<ProductPromptData | null>;
}

export interface ImageGenResult {
  status: "DONE" | "ERROR";
  assetId?: string;
  error?: string;
}

export async function generateImageAsset(
  input: ImageGenInput,
  deps: ImageDeps,
): Promise<ImageGenResult> {
  try {
    const loaded = await deps.loadContent(input.contentId, input.slideIndex);
    const ideaCreativa = input.ideaCreativa?.trim() ? input.ideaCreativa.trim() : loaded.ideaCreativa;
    const slideText = loaded.slideText;
    const mockup = input.useMockup && input.productId ? await deps.loadMockup(input.productId) : null;
    const fallback = slideText ? `${ideaCreativa}. ${slideText}` : ideaCreativa;
    const provider = input.provider ?? "GPT";
    const brandProfile = deps.loadBrandVisual ? await deps.loadBrandVisual() : null;
    const brandVisual = brandProfile ? buildBrandVisualContext(brandProfile, provider) : undefined;
    const product = input.productId && deps.loadProduct ? await deps.loadProduct(input.productId) : null;
    let prompt: string;
    if (provider === "GPT" && product) {
      prompt = buildArchetypePrompt(input.archetype ?? "ADV", {
        product,
        brief: input.brief,
        hasMockup: !!mockup,
        headline: input.headline,
        formato: input.brief?.formato,
      }).full;
    } else if (input.brief && !isBriefEmpty(input.brief)) {
      prompt = buildImagePromptFromBrief(input.brief, { provider, hasMockup: !!mockup, fallback, brandVisual });
    } else {
      prompt = buildImagePrompt({ ideaCreativa, slideText, hasMockup: !!mockup });
    }
    const soulSize = briefDimensions(input.brief?.formato).soul;
    const styleId = input.styleId ?? input.brief?.stile;
    // Higgsfield uses the mockup directly via image_reference (fast); a cached SoulId (custom_reference)
    // is used only if already created for the product (no slow synchronous creation in the request path).
    let customReferenceId: string | undefined;
    if (provider === "HIGGSFIELD" && input.useMockup && input.productId && deps.ensureHiggsfieldRef) {
      customReferenceId = (await deps.ensureHiggsfieldRef(input.productId)) ?? undefined;
    }
    const bytes = await deps.callOpenAI(prompt, mockup ?? undefined, provider, { styleId, soulSize, customReferenceId });
    const { assetId } = await deps.persistAsset({ input, prompt, bytes });
    return { status: "DONE", assetId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}
