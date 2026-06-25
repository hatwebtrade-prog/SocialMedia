import { buildImagePrompt } from "./prompt";

export interface ImageGenInput {
  contentId: string;
  slideIndex: number | null;
  productId?: string;
  useMockup?: boolean;
}

export interface ImageDeps {
  loadContent: (contentId: string, slideIndex: number | null) => Promise<{ ideaCreativa: string; slideText: string | null }>;
  loadMockup: (productId: string) => Promise<Buffer | null>;
  callOpenAI: (prompt: string, mockup?: Buffer) => Promise<Buffer>;
  persistAsset: (args: { input: ImageGenInput; prompt: string; bytes: Buffer }) => Promise<{ assetId: string }>;
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
    const prompt = buildImagePrompt({ ideaCreativa, slideText });
    const mockup = input.useMockup && input.productId ? await deps.loadMockup(input.productId) : null;
    const bytes = await deps.callOpenAI(prompt, mockup ?? undefined);
    const { assetId } = await deps.persistAsset({ input, prompt, bytes });
    return { status: "DONE", assetId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}
