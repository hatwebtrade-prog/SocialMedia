import { buildImagePrompt } from "./prompt";
import type { ImageProvider } from "./providers";

export interface ImageGenInput {
  contentId: string;
  slideIndex: number | null;
  productId?: string;
  useMockup?: boolean;
  provider?: ImageProvider;
}

export interface ImageDeps {
  loadContent: (contentId: string, slideIndex: number | null) => Promise<{ ideaCreativa: string; slideText: string | null }>;
  loadMockup: (productId: string) => Promise<Buffer | null>;
  callOpenAI: (prompt: string, mockup?: Buffer, provider?: ImageProvider, opts?: { styleId?: string; soulSize?: string; customReferenceId?: string }) => Promise<Buffer>;
  persistAsset: (args: { input: ImageGenInput; prompt: string; bytes: Buffer }) => Promise<{ assetId: string }>;
  ensureHiggsfieldRef?: (productId: string) => Promise<string | null>;
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
    const { ideaCreativa, slideText } = await deps.loadContent(input.contentId, input.slideIndex);
    const mockup = input.useMockup && input.productId ? await deps.loadMockup(input.productId) : null;
    const prompt = buildImagePrompt({ ideaCreativa, slideText, hasMockup: !!mockup });
    let customReferenceId: string | undefined;
    if (input.provider === "HIGGSFIELD" && input.useMockup && input.productId && deps.ensureHiggsfieldRef) {
      customReferenceId = (await deps.ensureHiggsfieldRef(input.productId)) ?? undefined;
    }
    const bytes = await deps.callOpenAI(prompt, mockup ?? undefined, input.provider, { customReferenceId });
    const { assetId } = await deps.persistAsset({ input, prompt, bytes });
    return { status: "DONE", assetId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}
