import { buildImagePrompt } from "./prompt";

export interface ImageGenInput {
  contentId: string;
  slideIndex: number | null;
}

export interface ImageDeps {
  loadContent: (contentId: string, slideIndex: number | null) => Promise<{ ideaCreativa: string; slideText: string | null }>;
  callOpenAI: (prompt: string) => Promise<Buffer>;
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
    const bytes = await deps.callOpenAI(prompt);
    const { assetId } = await deps.persistAsset({ input, prompt, bytes });
    return { status: "DONE", assetId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}
