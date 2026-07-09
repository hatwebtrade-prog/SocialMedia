import { buildImagePrompt, cleanSlide, BLOG_BANNER_COMPOSITION } from "./prompt";
import { buildArchetypePrompt, type ImageArchetype, type ProductPromptData } from "./archetypes";
import { buildImagePromptFromBrief, isBriefEmpty, briefDimensions, type ImageBrief } from "./brief";
import { buildSocialTemplatePrompt } from "./social-template";
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
  /** Meta-only: use the branded social template prompt + toggles below. */
  social?: boolean;
  includiDescrizione?: boolean;
  includiLogo?: boolean;
  influencer?: boolean;
  /** Blog-only: impone la composizione a banner editoriale AGOCAP (formato orizzontale). */
  blogBanner?: boolean;
}

export interface ImageDeps {
  loadContent: (contentId: string, slideIndex: number | null) => Promise<{ ideaCreativa: string; slideText: string | null }>;
  loadMockup: (productId: string) => Promise<Buffer | null>;
  callOpenAI: (prompt: string, mockup?: Buffer, provider?: ImageProvider, opts?: { styleId?: string; soulSize?: string; openaiSize?: string; customReferenceId?: string }) => Promise<Buffer>;
  persistAsset: (args: { input: ImageGenInput; prompt: string; bytes: Buffer }) => Promise<{ assetId: string }>;
  ensureHiggsfieldRef?: (productId: string) => Promise<string | null>;
  loadBrandVisual?: () => Promise<import("@/lib/knowledge/brand-context").BrandVisualData | null>;
  loadProduct?: (productId: string) => Promise<ProductPromptData | null>;
  resolveSocialCopy?: (contentId: string, slideIndex: number | null, productName?: string | null) => Promise<{ titolo: string; bullets: string[] } | null>;
  dominantColor?: (imageBuf: Buffer) => Promise<string | null>;
  loadLogo?: () => Buffer | null;
  overlayLogo?: (imageBuf: Buffer, logoBuf: Buffer) => Promise<Buffer>;
  /** Loads the first slide's generated image (slideIndex 0) to use as a coherence reference. */
  loadSlideReference?: (contentId: string) => Promise<Buffer | null>;
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
    const provider = input.provider ?? "GPT";
    // For GPT always attach the product's real packaging when a product is selected — without a
    // reference image gpt-image invents a fake product/label. Higgsfield keeps its explicit toggle.
    const wantProductImage = !!input.productId && (provider === "GPT" || !!input.useMockup);
    const mockup = wantProductImage && input.productId ? await deps.loadMockup(input.productId) : null;
    const fallback = slideText ? `${ideaCreativa}. ${slideText}` : ideaCreativa;
    const brandProfile = deps.loadBrandVisual ? await deps.loadBrandVisual() : null;
    const brandVisual = brandProfile ? buildBrandVisualContext(brandProfile, provider) : undefined;
    const product = input.productId && deps.loadProduct ? await deps.loadProduct(input.productId) : null;
    // Reference image passed to the model = the product mockup (if any). For a secondary carousel
    // slide we derive the PALETTE from the first slide for coherence, but do NOT pass slide 1 as a
    // literal reference — that made every slide look identical. Composition stays free/varied.
    const imageRef = mockup;
    let prompt: string;
    if (input.social && provider === "GPT") {
      const isSecondarySlide = (input.slideIndex ?? 0) > 0;
      let coherenceRef = false;
      let accentSource = mockup;
      if (isSecondarySlide && deps.loadSlideReference) {
        const ref = await deps.loadSlideReference(input.contentId);
        if (ref) {
          accentSource = ref;
          coherenceRef = true;
        }
      }
      const accentHex = accentSource && deps.dominantColor ? await deps.dominantColor(accentSource) : null;
      const copy =
        input.includiDescrizione && deps.resolveSocialCopy
          ? await deps.resolveSocialCopy(input.contentId, input.slideIndex, product?.nome ?? null)
          : null;
      prompt = buildSocialTemplatePrompt({
        variant: (input.slideIndex ?? 0) === 0 ? "MAIN" : "SECONDARY",
        influencer: !!input.influencer,
        productName: product?.nome ?? null,
        hasMockup: !!mockup,
        accentHex,
        copy,
        brandVisual,
        coherenceRef,
      });
    } else if (provider === "GPT" && product) {
      prompt = buildArchetypePrompt(input.archetype ?? "ADV", {
        product,
        brandVisual,
        brief: input.brief,
        hasMockup: !!mockup,
        headline: input.headline,
        formato: input.brief?.formato,
        // For a slide, drive the scene from THIS slide's content, not the whole-carousel idea.
        ideaCreativa: slideText ? cleanSlide(slideText) : ideaCreativa,
      }).full;
    } else if (input.brief && !isBriefEmpty(input.brief)) {
      prompt = buildImagePromptFromBrief(input.brief, { provider, hasMockup: !!mockup, fallback, brandVisual });
    } else {
      prompt = buildImagePrompt({ ideaCreativa, slideText, hasMockup: !!mockup, brandVisual });
    }
    // Blog: impone la composizione a banner editoriale AGOCAP (orizzontale di default).
    if (input.blogBanner) prompt = `${prompt} ${BLOG_BANNER_COMPOSITION}`;
    const dims = briefDimensions(input.brief?.formato ?? (input.blogBanner ? "orizzontale" : undefined));
    const soulSize = dims.soul;
    const openaiSize = dims.openaiSize;
    const styleId = input.styleId ?? input.brief?.stile;
    // Higgsfield uses the mockup directly via image_reference (fast); a cached SoulId (custom_reference)
    // is used only if already created for the product (no slow synchronous creation in the request path).
    let customReferenceId: string | undefined;
    if (provider === "HIGGSFIELD" && input.useMockup && input.productId && deps.ensureHiggsfieldRef) {
      customReferenceId = (await deps.ensureHiggsfieldRef(input.productId)) ?? undefined;
    }
    let bytes = await deps.callOpenAI(prompt, imageRef ?? undefined, provider, { styleId, soulSize, openaiSize, customReferenceId });
    if (input.includiLogo && deps.loadLogo && deps.overlayLogo) {
      const logo = deps.loadLogo();
      if (logo) bytes = await deps.overlayLogo(bytes, logo);
    }
    const { assetId } = await deps.persistAsset({ input, prompt, bytes });
    return { status: "DONE", assetId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}
